"""
For multi-page questions, the QP crop only shows the question's first page, so it
may show parts (a),(b) while later parts (c)... live on the next QP page. The mark
scheme, however, spans every part. This computes, per question, which mark-scheme
pages to DISPLAY so the mark scheme matches the parts visible in the question image.

Writes `msShow` (a subset of `msPages`) onto each question in index.json.

Rule: keep MS pages whose sub-part labels appear on the shown QP page; once a MS
page is reached that holds only later (unshown) parts, drop it and the rest.

Run:  python align_ms_parts.py
"""

import json
from pathlib import Path

import fitz

PAPERS_DIR = Path(__file__).parent / "papers"
INDEX_PATH = Path(__file__).parent / "index.json"
PART_LABELS = {f"({c})" for c in "abcdefgh"}
LEFT_X = 160


def part_labels(page):
    return {w[4] for w in page.get_text("words") if w[0] < LEFT_X and w[4] in PART_LABELS}


def main():
    index = json.loads(INDEX_PATH.read_text())
    docs = {}

    def doc(name):
        if name not in docs:
            docs[name] = fitz.open(PAPERS_DIR / name)
        return docs[name]

    changed = trimmed = 0
    for qp_name, data in index.items():
        if not (PAPERS_DIR / qp_name).exists():
            continue
        qp = doc(qp_name)
        for q in data.get("questions", []):
            ms_pages = q.get("msPages", [])
            ms_name = q.get("msPaper", "")
            if not ms_pages or not ms_name or not (PAPERS_DIR / ms_name).exists():
                q["msShow"] = ms_pages
                continue
            page_i = q["page"] - 1
            qp_parts = part_labels(qp[page_i]) if 0 <= page_i < qp.page_count else set()
            if not qp_parts:
                q["msShow"] = ms_pages  # MCQ / single-part: nothing to trim
                continue
            ms = doc(ms_name)
            show, stop = [], False
            for p in ms_pages:
                if stop:
                    break
                mp = part_labels(ms[p - 1]) if 0 <= p - 1 < ms.page_count else set()
                if not mp:
                    show.append(p)  # continuation of an already-shown part
                elif mp & qp_parts:
                    show.append(p)
                else:
                    stop = True  # this MS page is only later/unshown parts
            q["msShow"] = show or ms_pages
            changed += 1
            if len(q["msShow"]) < len(ms_pages):
                trimmed += 1

    for d in docs.values():
        d.close()
    INDEX_PATH.write_text(json.dumps(index, indent=2))
    print(f"Done. Processed {changed} multi-part questions; trimmed MS on {trimmed}.")


if __name__ == "__main__":
    main()
