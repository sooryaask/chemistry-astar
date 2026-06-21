"""
Enrich index.json with mark-scheme page numbers for each question.

For each question paper in the index, finds the matching mark-scheme PDF,
extracts its text with page markers, and asks Claude to map each question
number to the MS page(s) where its answers appear.

Run:  python enrich_index.py            (only papers not yet enriched)
      python enrich_index.py --force    (re-enrich everything)
"""

import json
import os
import sys
from pathlib import Path

import fitz
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv(override=True)

PAPERS_DIR = Path(__file__).parent / "papers"
INDEX_PATH = Path(__file__).parent / "index.json"
MODEL = "claude-sonnet-4-6"


def extract_text_with_pages(pdf_path: Path) -> str:
    doc = fitz.open(pdf_path)
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
    "You are mapping OCR A Chemistry mark-scheme pages to question numbers. "
    "You receive the full extracted text of a mark scheme with === PAGE n === markers, "
    "and a list of question numbers from the question paper.\n\n"
    "For each question number, identify which mark-scheme page(s) contain its answers. "
    "Most questions fit on one page; some span two pages.\n\n"
    "Respond with VALID JSON ONLY:\n"
    '{ "mapping": [ {"number": "1", "msPages": [3]}, {"number": "21(a)", "msPages": [8, 9]} ] }'
)


def enrich_paper(client: Anthropic, qp_name: str, questions: list) -> list:
    ms_name = qp_name.replace(" QP ", " MS ")
    ms_path = PAPERS_DIR / ms_name
    if not ms_path.exists():
        print(f"  !! mark scheme not found: {ms_name}")
        return questions

    ms_text = extract_text_with_pages(ms_path)
    q_numbers = [q["number"] for q in questions]

    user = (
        f"Question numbers from the paper:\n{json.dumps(q_numbers)}\n\n"
        f"Mark scheme text:\n{ms_text}\n\n"
        "Map each question number to its mark-scheme page(s). Return the JSON."
    )

    msg = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        system=SYSTEM,
        messages=[{"role": "user", "content": user}],
    )
    out = "".join(b.text for b in msg.content if b.type == "text")
    result = parse_json(out)

    # Build lookup: question number -> msPages
    ms_lookup = {}
    for entry in result.get("mapping", []):
        ms_lookup[str(entry["number"])] = entry["msPages"]

    # Enrich each question
    enriched = []
    for q in questions:
        q = dict(q)  # copy
        q["msPaper"] = ms_name
        q["msPages"] = ms_lookup.get(str(q["number"]), [])
        enriched.append(q)

    return enriched


def main():
    force = "--force" in sys.argv
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key or "your-key" in key:
        sys.exit("No ANTHROPIC_API_KEY. Add it to .env first.")
    client = Anthropic(api_key=key)

    if not INDEX_PATH.exists():
        sys.exit("index.json not found. Run index_papers.py first.")

    index = json.loads(INDEX_PATH.read_text())

    for qp_name, data in index.items():
        questions = data.get("questions", [])
        # Skip if already enriched (has msPaper on first question)
        if questions and "msPaper" in questions[0] and not force:
            print(f"skip (already enriched): {qp_name}")
            continue

        print(f"enriching: {qp_name} …", flush=True)
        try:
            enriched = enrich_paper(client, qp_name, questions)
            data["questions"] = enriched
            mapped = sum(1 for q in enriched if q.get("msPages"))
            print(f"  -> {mapped}/{len(enriched)} questions mapped to MS pages")
            INDEX_PATH.write_text(json.dumps(index, indent=2))
        except Exception as e:  # noqa: BLE001
            print(f"  !! failed: {e}")

    print(f"\nDone. Enriched index written to {INDEX_PATH}")


if __name__ == "__main__":
    main()
