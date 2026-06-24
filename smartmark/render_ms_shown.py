"""
Crop each question's mark scheme to ONLY the sub-parts visible on the shown QP page
— including roman sub-parts (b)(i) vs (b)(ii). The QP crop shows just the question's
first page, so later parts (on the next QP page) must be cut from the mark scheme,
even when they share a letter (all under (b)) and even when the cut falls mid-page.

Approach:
  - shownParts = the part labels detected as answer boxes on the QP page (q['slots']).
  - Walk the mark scheme in reading order tracking letter+roman; the first part that
    is NOT a shown part (after the shown ones) is the cutoff.
  - Emit `msShownImgs`: full per-question crops for MS pages before the cutoff page,
    then a special crop of the cutoff page from the question top down to the cutoff y.

Run:  python render_ms_shown.py            (re-renders cut crops; updates index.json)
"""

import json
import re
from pathlib import Path

import fitz

PAPERS_DIR = Path(__file__).parent / "papers"
INDEX_PATH = Path(__file__).parent / "index.json"
OUTPUT_DIR = Path(__file__).parent / "rendered"
RENDER_DPI = 200
LETTER = re.compile(r"^\(([a-h])\)$")
ROMAN = re.compile(r"^\((i|ii|iii|iv|v|vi|vii|viii|ix|x)\)$")


def slug(pdf_name):
    return pdf_name.split(" - ")[0].replace(" ", "_")


def norm(label):
    """'(b) (i)' -> 'b/i' ; '(a)' -> 'a' ; '' -> ''"""
    parts = re.findall(r"\(([a-z]+)\)", label)
    if not parts:
        return ""
    letter = parts[0]
    roman = parts[1] if len(parts) > 1 else ""
    return letter + ("/" + roman if roman else "")


def ms_part_events(page):
    """Ordered [(y, partId)] for each sub-part heading on a mark-scheme page."""
    toks = []
    for w in page.get_text("words"):
        x0, y0, t = w[0], w[1], w[4].strip()
        if LETTER.match(t) and x0 < 240:
            toks.append((y0, x0, "L", LETTER.match(t).group(1)))
        elif ROMAN.match(t) and x0 < 280:
            toks.append((y0, x0, "R", ROMAN.match(t).group(1)))
    toks.sort(key=lambda e: (round(e[0]), e[1]))
    events, L, R, i = [], "", "", 0
    while i < len(toks):
        y, _, kind, val = toks[i]
        if kind == "L":
            L, R = val, ""
            if i + 1 < len(toks) and abs(toks[i + 1][0] - y) < 6 and toks[i + 1][2] == "R":
                R = toks[i + 1][3]
                i += 1
        else:
            R = val
        events.append((y, L + ("/" + R if R else "")))
        i += 1
    return events


def question_top_y(page, number):
    ys = [w[1] for w in page.get_text("words") if w[0] < 95 and w[4].strip() == str(number)]
    return min(ys) if ys else page.rect.y0


def render_crop(doc, page_index, y0, y1, out_path):
    page = doc[page_index]
    r = page.rect
    clip = fitz.Rect(r.x0, max(r.y0, y0 - 6), r.x1, min(r.y1, y1 + 4))
    page.get_pixmap(dpi=RENDER_DPI, clip=clip).save(str(out_path))


def main():
    index = json.loads(INDEX_PATH.read_text())
    docs = {}

    def doc(name):
        if name not in docs:
            docs[name] = fitz.open(PAPERS_DIR / name)
        return docs[name]

    n_cut = 0
    for qp_name, data in index.items():
        for q in data.get("questions", []):
            ms_name = q.get("msPaper", "")
            ms_pages = q.get("msPages", [])
            number = q.get("number")
            if not ms_name or not ms_pages or not (PAPERS_DIR / ms_name).exists():
                q["msShownImgs"] = []
                continue
            shown = {norm(s.get("label", "")) for s in q.get("slots", []) if norm(s.get("label", ""))}
            ms = doc(ms_name)

            # find the cutoff: first MS sub-part not in `shown`, scanning pages in order
            cutoff_page = cutoff_y = None
            if shown:
                for p in ms_pages:
                    for y, pid in ms_part_events(ms[p - 1]):
                        if pid and pid not in shown:
                            cutoff_page, cutoff_y = p, y
                            break
                    if cutoff_page is not None:
                        break

            imgs = []
            for p in ms_pages:
                if cutoff_page is not None and p > cutoff_page:
                    break
                if cutoff_page is not None and p == cutoff_page:
                    top = question_top_y(ms[p - 1], number)
                    if top >= cutoff_y:
                        top = ms[p - 1].rect.y0
                    if cutoff_y - top < 8:
                        break  # no shown content on this page — drop it
                    name = f"{slug(ms_name)}_p{p}_q{number}_cut.png"
                    render_crop(ms, p - 1, top, cutoff_y, OUTPUT_DIR / name)
                    imgs.append(name)
                    n_cut += 1
                    break
                imgs.append(f"{slug(ms_name)}_p{p}_q{number}.png")  # full (all shown)
            q["msShownImgs"] = imgs

    for d in docs.values():
        d.close()
    INDEX_PATH.write_text(json.dumps(index, indent=2))
    print(f"Done. Rendered {n_cut} mid-page cut crops.")


if __name__ == "__main__":
    main()
