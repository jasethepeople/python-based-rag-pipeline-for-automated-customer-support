#!/usr/bin/env python3
"""Apply the collector's current basic text-redaction policy to an existing JSON corpus."""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from collect import sanitize_text


def main() -> int:
    parser = argparse.ArgumentParser(description="Redact obvious emails and credential-like values in a support corpus.")
    parser.add_argument("--input", type=Path, default=Path("data/knowledge_base.json"))
    parser.add_argument("--output", type=Path, default=Path("data/knowledge_base.json"))
    args = parser.parse_args()
    corpus = json.loads(args.input.read_text(encoding="utf-8"))
    changed = 0
    for document in corpus.get("documents", []):
        for field in ("title", "text"):
            original = document.get(field, "")
            redacted = sanitize_text(original)
            if redacted != original:
                changed += 1
                document[field] = redacted
        document["content_hash"] = hashlib.sha256(document.get("text", "").encode("utf-8")).hexdigest()
    corpus.setdefault("collection_policy", {})["basic_text_redaction_applied"] = True
    corpus["sanitized_at"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    args.output.write_text(json.dumps(corpus, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"documents": len(corpus.get("documents", [])), "changed_fields": changed, "output": str(args.output)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
