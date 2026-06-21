"""
Build a topic index for every question paper in ./papers.

For each QP PDF, extracts per-page text, asks Claude to split it into individual
questions tagged with a topic, marks and starting page, and writes index.json:

{
  "June 2023 QP - ...pdf": {
    "questions": [
      {"number": "1", "topic": "Amount of Substance (Moles)", "marks": 1, "page": 4,
       "summary": "Moles of oxygen atoms in SiO2"},
      ...
    ]
  },
  ...
}

Run:  python index_papers.py            (indexes papers without an entry yet)
      python index_papers.py --force    (re-indexes everything)
"""

import json
import os
import sys
from pathlib import Path

import fitz
from anthropic import Anthropic
from dotenv import load_dotenv

from topics import TOPICS

load_dotenv(override=True)  # override any empty ANTHROPIC_API_KEY in the shell

PAPERS_DIR = Path(__file__).parent / "papers"
INDEX_PATH = Path(__file__).parent / "index.json"
MODEL = "claude-sonnet-4-6"


def question_papers():
    """Only index question papers (skip mark schemes)."""
    return sorted(
        p.name
        for p in PAPERS_DIR.glob("*.pdf")
        if " QP " in p.name or p.name.lower().endswith("qp.pdf")
    )


def extract_text_with_pages(pdf_name: str) -> str:
    doc = fitz.open(PAPERS_DIR / pdf_name)
    chunks = []
    for i in range(doc.page_count):
        chunks.append(f"=== PAGE {i + 1} ===\n{doc[i].get_text()}")
    doc.close()
    return "\n".join(chunks)


def parse_json(text: str):
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```", 2)[1]
        if cleaned.lstrip().startswith("json"):
            cleaned = cleaned.lstrip()[4:]
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end != -1:
        cleaned = cleaned[start : end + 1]
    return json.loads(cleaned)


SYSTEM = (
    "You are an OCR A Chemistry examiner indexing a past paper. You receive the "
    "full extracted text of a question paper with === PAGE n === markers. Split it "
    "into the main numbered questions (1, 2, 3, ... — the top-level questions, not "
    "every sub-part). For each, assign exactly one best-fit topic from the provided "
    "list, the total marks for that question (sum its parts), the page number where "
    "it starts, and a short summary (max 8 words).\n\n"
    "Respond with VALID JSON ONLY:\n"
    '{ "questions": [ {"number": "1", "topic": "<one from list>", "marks": 6, '
    '"page": 4, "summary": "..."} ] }'
)


def index_paper(client: Anthropic, pdf_name: str) -> dict:
    text = extract_text_with_pages(pdf_name)
    user = (
        f"Topic list (use these exact strings):\n- " + "\n- ".join(TOPICS) + "\n\n"
        f"Question paper text:\n{text}\n\nReturn the JSON index."
    )
    msg = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        system=SYSTEM,
        messages=[{"role": "user", "content": user}],
    )
    out = "".join(b.text for b in msg.content if b.type == "text")
    return parse_json(out)


def main():
    force = "--force" in sys.argv
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key or "your-key" in key:
        sys.exit("No ANTHROPIC_API_KEY. Add it to .env first.")
    client = Anthropic(api_key=key)

    index = {}
    if INDEX_PATH.exists():
        index = json.loads(INDEX_PATH.read_text())

    papers = question_papers()
    if not papers:
        sys.exit("No question papers found in ./papers (looking for ' QP ' in name).")

    for name in papers:
        if name in index and not force:
            print(f"skip (cached): {name}")
            continue
        print(f"indexing: {name} …", flush=True)
        try:
            index[name] = index_paper(client, name)
            n = len(index[name].get("questions", []))
            print(f"  -> {n} questions tagged")
            INDEX_PATH.write_text(json.dumps(index, indent=2))  # save incrementally
        except Exception as e:  # noqa: BLE001
            print(f"  !! failed: {e}")

    print(f"\nDone. Index written to {INDEX_PATH}")


if __name__ == "__main__":
    main()
