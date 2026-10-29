import sys
import unittest
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT / "src"))

from ask import confidence, retrieve
from collect import sanitize_text
from index_kb import build_index, split_chunks


class RAGTests(unittest.TestCase):
    def test_sanitize_text_redacts_obvious_contact_and_secret_values(self):
        cleaned = sanitize_text("Contact help@example.com. api_key=sk_abcdefghijklmnopqr")
        self.assertNotIn("help@example.com", cleaned)
        self.assertNotIn("sk_abcdefghijklmnopqr", cleaned)
        self.assertIn("[REDACTED_EMAIL]", cleaned)
        self.assertIn("[REDACTED_SECRET]", cleaned)

    def test_chunker_preserves_overlap(self):
        text = " ".join(f"word{i}" for i in range(100))
        chunks = split_chunks(text, max_tokens=30, overlap=8)
        self.assertGreater(len(chunks), 2)
        self.assertIn("word22", chunks[0])
        self.assertIn("word22", chunks[1])

    def test_retrieval_prefers_official_when_relevance_matches(self):
        chunks = [
            {
                "chunk_id": "official:1", "document_id": "official", "ordinal": 1,
                "title": "Official installation", "url": "https://docs.example/install",
                "source_id": "official", "source_label": "Official Documentation",
                "source_kind": "official_docs", "authority_weight": 1.0,
                "published_at": None, "text": "Install Metabase using Docker and configure the application database.",
            },
            {
                "chunk_id": "community:1", "document_id": "community", "ordinal": 1,
                "title": "Community installation post", "url": "https://forum.example/t/1",
                "source_id": "community", "source_label": "Community Discussion",
                "source_kind": "community_forum", "authority_weight": 0.62,
                "published_at": None, "text": "Install Metabase using Docker and configure the application database.",
            },
        ]
        index = build_index(chunks)
        results = retrieve("How do I install Metabase with Docker?", index, top_k=2)
        self.assertEqual(results[0]["source_kind"], "official_docs")
        self.assertEqual(confidence(results), "high")

    def test_no_vocabulary_match_is_low_confidence(self):
        chunks = [
            {
                "chunk_id": "official:1", "document_id": "official", "ordinal": 1,
                "title": "Official database docs", "url": "https://docs.example/database",
                "source_id": "official", "source_label": "Official Documentation",
                "source_kind": "official_docs", "authority_weight": 1.0,
                "published_at": None, "text": "Connect PostgreSQL database and synchronize metadata.",
            }
        ]
        index = build_index(chunks)
        results = retrieve("zzzxxyy unsupported", index, top_k=3)
        self.assertEqual(results, [])
        self.assertEqual(confidence(results), "low")


if __name__ == "__main__":
    unittest.main()
