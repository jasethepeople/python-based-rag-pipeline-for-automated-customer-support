#!/usr/bin/env python3
"""Create a portable local vector index from the normalized knowledge-base JSON."""
from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np

TOKEN_RE = re.compile(r"[a-zA-Z0-9_][a-zA-Z0-9_+.#/-]{1,}")
STOPWORDS = {
    "about", "after", "again", "also", "and", "are", "but", "can", "for", "from", "has", "have", "how", "into", "its", "not", "of", "on", "or", "that", "the", "then", "their", "there", "these", "this", "to", "was", "what", "when", "where", "which", "with", "you", "your",
}


def tokenize(text: str) -> list[str]:
    return [token.lower() for token in TOKEN_RE.findall(text) if token.lower() not in STOPWORDS]


def split_chunks(text: str, max_tokens: int = 220, overlap: int = 45) -> list[str]:
    words = text.split()
    if not words:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = min(len(words), start + max_tokens)
        # Prefer to stop on paragraph/sentence boundaries without exceeding the cap.
        candidate = " ".join(words[start:end])
        if end < len(words):
            punct = max(candidate.rfind(". "), candidate.rfind("? "), candidate.rfind("! "), candidate.rfind("\n"))
            if punct > len(candidate) * 0.55:
                candidate = candidate[: punct + 1]
                end = start + len(candidate.split())
        chunks.append(candidate.strip())
        if end >= len(words):
            break
        start = max(end - overlap, start + 1)
    return chunks


def make_chunks(corpus: dict[str, Any], max_tokens: int, overlap: int) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    for doc in corpus["documents"]:
        for ordinal, chunk_text in enumerate(split_chunks(doc["text"], max_tokens, overlap), start=1):
            chunks.append({
                "chunk_id": f"{doc['id']}:{ordinal}",
                "document_id": doc["id"],
                "ordinal": ordinal,
                "title": doc["title"],
                "url": doc["url"],
                "source_id": doc["source_id"],
                "source_label": doc["source_label"],
                "source_kind": doc["source_kind"],
                "authority_weight": float(doc["authority_weight"]),
                "published_at": doc.get("published_at"),
                "text": chunk_text,
            })
    return chunks


def build_index(chunks: list[dict[str, Any]]) -> dict[str, Any]:
    doc_terms = [Counter(tokenize(f"{item['title']} {item['text']}")) for item in chunks]
    document_frequency: Counter[str] = Counter()
    for counts in doc_terms:
        document_frequency.update(counts.keys())
    vocabulary = {term: position for position, (term, _) in enumerate(sorted(document_frequency.items()))}
    n_docs = max(len(doc_terms), 1)
    idf = np.zeros(len(vocabulary), dtype=np.float32)
    for term, position in vocabulary.items():
        idf[position] = math.log((1 + n_docs) / (1 + document_frequency[term])) + 1.0
    matrix = np.zeros((len(chunks), len(vocabulary)), dtype=np.float32)
    for row, counts in enumerate(doc_terms):
        total = sum(counts.values()) or 1
        for term, count in counts.items():
            matrix[row, vocabulary[term]] = (count / total) * idf[vocabulary[term]]
        norm = np.linalg.norm(matrix[row])
        if norm:
            matrix[row] /= norm
    return {
        "schema_version": "1.0",
        "engine": "local_tfidf_cosine",
        "document_count": len({chunk["document_id"] for chunk in chunks}),
        "chunk_count": len(chunks),
        "vocabulary": vocabulary,
        "idf": idf.tolist(),
        "matrix": matrix.tolist(),
        "chunks": chunks,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build local TF-IDF cosine index for a support knowledge base.")
    parser.add_argument("--input", type=Path, default=Path("data/knowledge_base.json"))
    parser.add_argument("--output", type=Path, default=Path("data/vector_index.json"))
    parser.add_argument("--chunk-tokens", type=int, default=220)
    parser.add_argument("--overlap-tokens", type=int, default=45)
    args = parser.parse_args()
    if args.overlap_tokens >= args.chunk_tokens:
        parser.error("--overlap-tokens must be smaller than --chunk-tokens")
    corpus = json.loads(args.input.read_text(encoding="utf-8"))
    chunks = make_chunks(corpus, args.chunk_tokens, args.overlap_tokens)
    if not chunks:
        parser.error("No indexable document content found")
    index = build_index(chunks)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(index, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({key: index[key] for key in ("engine", "document_count", "chunk_count")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
