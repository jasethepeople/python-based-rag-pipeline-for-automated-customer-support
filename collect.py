#!/usr/bin/env python3
"""Build a normalized public support corpus from configured sitemaps.

The collector only uses configured public URLs, checks robots.txt before each
request, delays requests, and never authenticates or bypasses access controls.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import sys
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup

LOG = logging.getLogger("collector")


@dataclass(frozen=True)
class Source:
    id: str
    label: str
    kind: str
    sitemap_urls: list[str]
    robots_url: str
    include_prefixes: list[str]
    exclude_patterns: list[str]
    authority_weight: float
    forum_category_id: int | None = None
    forum_listing_urls: list[str] | None = None
    forum_max_listing_pages: int | None = None


class PoliteClient:
    def __init__(self, user_agent: str, delay_seconds: float, timeout: int) -> None:
        self.user_agent = user_agent
        self.delay_seconds = delay_seconds
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": user_agent, "Accept-Language": "en-US,en;q=0.8"})
        self.robots: dict[str, RobotFileParser] = {}
        self.last_request_at = 0.0

    def load_robots(self, robots_url: str) -> RobotFileParser:
        if robots_url in self.robots:
            return self.robots[robots_url]
        parser = RobotFileParser()
        parser.set_url(robots_url)
        try:
            response = self._request_unchecked(robots_url)
            response.raise_for_status()
            parser.parse(response.text.splitlines())
        except requests.RequestException as exc:
            raise RuntimeError(f"Could not read robots.txt at {robots_url}: {exc}") from exc
        self.robots[robots_url] = parser
        return parser

    def _request_unchecked(self, url: str) -> requests.Response:
        remaining = self.delay_seconds - (time.monotonic() - self.last_request_at)
        if remaining > 0:
            time.sleep(remaining)
        response = self.session.get(url, timeout=self.timeout, allow_redirects=True)
        self.last_request_at = time.monotonic()
        return response

    def get(self, url: str, robots_url: str) -> requests.Response:
        robots = self.load_robots(robots_url)
        if not robots.can_fetch(self.user_agent, url):
            raise PermissionError(f"robots.txt disallows: {url}")
        response = self._request_unchecked(url)
        response.raise_for_status()
        return response


def canonicalize(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip("/") or "/", "", ""))


def matches_source(url: str, source: Source) -> bool:
    url = canonicalize(url)
    if not any(url.startswith(prefix.rstrip("/")) for prefix in source.include_prefixes):
        return False
    return not any(pattern.lower() in url.lower() for pattern in source.exclude_patterns)


def sitemap_urls(client: PoliteClient, sitemap_url: str, robots_url: str, seen: set[str] | None = None) -> list[str]:
    """Recursively resolve published sitemap indexes into canonical URLs."""
    seen = seen or set()
    if sitemap_url in seen:
        return []
    seen.add(sitemap_url)
    response = client.get(sitemap_url, robots_url)
    try:
        root = ET.fromstring(response.content)
    except ET.ParseError as exc:
        raise RuntimeError(f"Invalid sitemap XML at {sitemap_url}") from exc
    tag = root.tag.rsplit("}", 1)[-1]
    locs = [elem.text.strip() for elem in root.iter() if elem.tag.rsplit("}", 1)[-1] == "loc" and elem.text]
    if tag == "sitemapindex":
        discovered: list[str] = []
        for child in locs:
            discovered.extend(sitemap_urls(client, child, robots_url, seen))
        return discovered
    if tag != "urlset":
        raise RuntimeError(f"Unsupported sitemap root <{tag}> at {sitemap_url}")
    return locs


def sanitize_text(text: str) -> str:
    """Remove obvious personal contact details and credential-like values from extracted text."""
    text = re.sub(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", "[REDACTED_EMAIL]", text)
    text = re.sub(r"(?i)\b(sk|pk|api)[_-][A-Za-z0-9_-]{16,}\b", "[REDACTED_SECRET]", text)
    text = re.sub(r"(?i)(api[_ -]?key|access[_ -]?token|authorization)\s*[:=]\s*[^\s,;]+", r"\1=[REDACTED_SECRET]", text)
    return text


def clean_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for node in soup(["script", "style", "noscript", "svg", "nav", "header", "footer", "form", "aside"]):
        node.decompose()
    root = soup.find("main") or soup.find("article") or soup.body or soup
    text = root.get_text("\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return sanitize_text(text.strip())


def title_from_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    heading = soup.find("h1")
    if heading:
        return heading.get_text(" ", strip=True)
    if soup.title:
        return soup.title.get_text(" ", strip=True)
    return "Untitled support page"


def document_id(source_id: str, url: str, text: str) -> str:
    payload = f"{source_id}|{url}|{text}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:24]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def forum_listing_topics(client: PoliteClient, listing_url: str, source: Source, max_pages: int | None = None) -> list[str]:
    """Read each available public Discourse category-listing page into topic URLs."""
    urls: list[str] = []
    seen_topic_ids: set[int] = set()
    maximum_pages = max_pages or source.forum_max_listing_pages or 10_000
    separator = "&" if "?" in listing_url else "?"
    for page in range(maximum_pages):
        page_url = listing_url if page == 0 else f"{listing_url}{separator}page={page}"
        response = client.get(page_url, source.robots_url)
        payload = response.json()
        topics = payload.get("topic_list", {}).get("topics", [])
        if not topics:
            break
        fresh = 0
        for topic in topics:
            if source.forum_category_id is not None and topic.get("category_id") != source.forum_category_id:
                continue
            slug, topic_id = topic.get("slug"), topic.get("id")
            if slug and topic_id and topic_id not in seen_topic_ids:
                urls.append(f"https://discourse.metabase.com/t/{slug}/{topic_id}")
                seen_topic_ids.add(topic_id)
                fresh += 1
        if fresh == 0:
            break
    return urls


def parse_docs_page(client: PoliteClient, url: str, source: Source) -> dict[str, Any] | None:
    response = client.get(url, source.robots_url)
    content_type = response.headers.get("content-type", "")
    if "html" not in content_type:
        return None
    # Documentation is UTF-8; decode the response bytes explicitly instead of
    # trusting a missing or incorrect HTTP charset declaration.
    html = response.content.decode("utf-8", errors="replace")
    text = clean_html(html)
    if len(text) < 100:
        return None
    title = title_from_html(html)
    canonical = canonicalize(response.url)
    return {
        "id": document_id(source.id, canonical, text),
        "title": title,
        "url": canonical,
        "source_id": source.id,
        "source_label": source.label,
        "source_kind": source.kind,
        "authority_weight": source.authority_weight,
        "published_at": None,
        "retrieved_at": now_iso(),
        "text": text,
        "content_hash": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "metadata": {"content_type": "official_documentation"},
    }


def parse_forum_topic(client: PoliteClient, url: str, source: Source) -> dict[str, Any] | None:
    api_url = canonicalize(url) + ".json"
    response = client.get(api_url, source.robots_url)
    payload = response.json()
    category_id = payload.get("category_id")
    if source.forum_category_id is not None and category_id != source.forum_category_id:
        return None
    posts = payload.get("post_stream", {}).get("posts", [])
    parts: list[str] = []
    for post in posts:
        cooked = post.get("cooked", "")
        body = clean_html(cooked)
        if body:
            parts.append(f"Post {post.get('post_number', '?')}:\n{body}")
    text = "\n\n".join(parts).strip()
    if len(text) < 80:
        return None
    canonical = canonicalize(url)
    title = str(payload.get("title") or "Untitled community topic")
    return {
        "id": document_id(source.id, canonical, text),
        "title": title,
        "url": canonical,
        "source_id": source.id,
        "source_label": source.label,
        "source_kind": source.kind,
        "authority_weight": source.authority_weight,
        "published_at": payload.get("created_at"),
        "retrieved_at": now_iso(),
        "text": text,
        "content_hash": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "metadata": {
            "content_type": "community_forum_thread",
            "category_id": category_id,
            "posts": len(posts),
            "last_posted_at": payload.get("last_posted_at"),
        },
    }


def parse_limit(values: list[str]) -> dict[str, int]:
    parsed: dict[str, int] = {}
    for value in values:
        try:
            source_id, limit = value.split("=", 1)
            parsed[source_id] = int(limit)
        except ValueError as exc:
            raise argparse.ArgumentTypeError("--limit must be source_id=nonnegative_integer") from exc
        if parsed[source_id] < 0:
            raise argparse.ArgumentTypeError("--limit cannot be negative")
    return parsed


def collect(config_path: Path, output_path: Path, limits: dict[str, int]) -> dict[str, Any]:
    config = json.loads(config_path.read_text(encoding="utf-8"))
    client = PoliteClient(config["user_agent"], float(config["delay_seconds"]), int(config["request_timeout_seconds"]))
    sources = [Source(**item) for item in config["sources"]]
    docs: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []

    for source in sources:
        source_limit = limits.get(source.id, int(config["max_pages_per_source"]))
        limit_label = str(source_limit) if source_limit else "unlimited"
        candidates: list[str] = []
        if source.kind == "community_forum" and source.forum_listing_urls:
            for listing_url in source.forum_listing_urls:
                listing_pages = max(1, (source_limit + 29) // 30) if source_limit else None
                candidates.extend(forum_listing_topics(client, listing_url, source, listing_pages))
        else:
            for sitemap in source.sitemap_urls:
                candidates.extend(sitemap_urls(client, sitemap, source.robots_url))
        unique_urls = list(dict.fromkeys(canonicalize(url) for url in candidates if matches_source(url, source)))
        LOG.info("%s: %d eligible public URLs; collecting up to %s", source.id, len(unique_urls), limit_label)
        kept = 0
        for url in unique_urls:
            if source_limit and kept >= source_limit:
                break
            try:
                record = parse_forum_topic(client, url, source) if source.kind == "community_forum" else parse_docs_page(client, url, source)
                if record:
                    docs.append(record)
                    kept += 1
            except PermissionError as exc:
                LOG.warning("Skipping disallowed URL: %s", exc)
            except (requests.RequestException, ValueError, RuntimeError) as exc:
                LOG.warning("Failed %s: %s", url, exc)
                failures.append({"source_id": source.id, "url": url, "error": str(exc)})

    deduped = list({doc["id"]: doc for doc in docs}.values())
    corpus = {
        "schema_version": "1.0",
        "target": config["target_name"],
        "generated_at": now_iso(),
        "collection_policy": {
            "public_only": True,
            "robots_checked": True,
            "request_delay_seconds": config["delay_seconds"],
            "community_content_is_secondary": True,
        },
        "documents": deduped,
        "collection_failures": failures,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(corpus, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"documents": len(deduped), "failures": len(failures), "output": str(output_path)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect a public support knowledge base into normalized JSON.")
    parser.add_argument("--config", type=Path, default=Path("config.json"))
    parser.add_argument("--output", type=Path, default=Path("data/knowledge_base.json"))
    parser.add_argument("--limit", action="append", default=[], metavar="SOURCE=COUNT", help="Override one source page cap; use 0 for no cap; repeatable.")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO if args.verbose else logging.WARNING, format="%(levelname)s %(message)s")
    try:
        result = collect(args.config, args.output, parse_limit(args.limit))
    except Exception as exc:  # Fail with a useful nonzero exit instead of producing a partial silent corpus.
        LOG.error("Collection stopped: %s", exc)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
