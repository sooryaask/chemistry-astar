"""
Detect the answer slots on each question's shown QP page, so the app can render one
labelled answer box per sub-part (e.g. (a), (b)(i), (b)(ii)) instead of a single box.

Each mark allocation "[n]" on the page marks where an answer is expected. Walking the
page in reading order, we track the current letter part (a,b,c...) and roman sub-part
(i,ii,iii...) and emit a slot {label, marks} at every "[n]".

Writes `slots` onto each question in index.json. A question with no "[n]" markers
gets a single unlabelled slot worth its total marks.

Run:  python detect_answer_slots.py
"""

import json
import re
from pathlib import Path

import fitz

PAPERS_DIR = Path(__file__).parent / "papers"
INDEX_PATH = Path(__file__).parent / "index.json"

LETTER = re.compile(r"^\(([a-h])\)$")
ROMAN = re.compile(r"^\((i|ii|iii|iv|v|vi|vii|viii|ix|x)\)$")
MARK = re.compile(r"^\[(\d+)\]$")


def question_yrange(page, number):
    """Vertical span of question `number` on the page (so MCQs sharing a page,
    and multi-question pages, only count their own marks) — matches the QP crop."""
    y_start, y_next = None, None
    for w in page.get_text("words"):
        x0, y0, txt = w[0], w[1], w[4].strip()
        if x0 < 95:
            if txt == str(number) and y_start is None:
                y_start = y0
            elif txt == str(number + 1) and (y_next is None or y0 < y_next):
                y_next = y0
    if y_start is None:
        y_start = page.rect.y0
    y_end = y_next if (y_next is not None and y_next > y_start) else page.rect.y1
    return y_start, y_end


def detect_slots(page, number, total_marks):
    y0r, y1r = question_yrange(page, number)
    # events: (y, x, kind, value) — only within this question's vertical span
    events = []
    for w in page.get_text("words"):
        x0, y0, txt = w[0], w[1], w[4].strip()
        if not (y0r - 3 <= y0 <= y1r):
            continue
        if LETTER.match(txt) and x0 < 220:
            events.append((y0, x0, "letter", LETTER.match(txt).group(1)))
        elif ROMAN.match(txt) and x0 < 260:
            events.append((y0, x0, "roman", ROMAN.match(txt).group(1)))
        else:
            m = MARK.match(txt)
            if m:
                events.append((y0, x0, "mark", int(m.group(1))))
    events.sort(key=lambda e: (round(e[0]), e[1]))

    slots = []
    letter = roman = ""
    for _, _, kind, val in events:
        if kind == "letter":
            letter, roman = val, ""
        elif kind == "roman":
            roman = val
        else:  # mark
            label = ""
            if letter:
                label = f"({letter})"
                if roman:
                    label += f" ({roman})"
            elif roman:
                label = f"({roman})"
            slots.append({"label": label, "marks": val})

    if not slots:
        slots = [{"label": "", "marks": total_marks}]
    return slots


def main():
    index = json.loads(INDEX_PATH.read_text())
    docs = {}

    def doc(name):
        if name not in docs:
            docs[name] = fitz.open(PAPERS_DIR / name)
        return docs[name]

    n_multi = 0
    for qp_name, data in index.items():
        if not (PAPERS_DIR / qp_name).exists():
            continue
        qp = doc(qp_name)
        for q in data.get("questions", []):
            pi = q["page"] - 1
            if pi < 0 or pi >= qp.page_count:
                q["slots"] = [{"label": "", "marks": q.get("marks", 1)}]
                continue
            try:
                num = int(str(q["number"]))
            except (TypeError, ValueError):
                num = None
            q["slots"] = (
                detect_slots(qp[pi], num, q.get("marks", 1))
                if num is not None
                else [{"label": "", "marks": q.get("marks", 1)}]
            )
            if len(q["slots"]) > 1:
                n_multi += 1

    for d in docs.values():
        d.close()
    INDEX_PATH.write_text(json.dumps(index, indent=2))
    print(f"Done. {n_multi} questions have multiple answer boxes.")


if __name__ == "__main__":
    main()
