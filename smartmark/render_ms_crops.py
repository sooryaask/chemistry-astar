"""
Render the OFFICIAL mark scheme cropped to each individual question (including all
its sub-parts a, b, c...), so the app can show the real OCR answer for one question
rather than the whole mark-scheme page.

Strategy (mark schemes are landscape tables, "Question" is the leftmost column):
  - Left-margin integers (x0 < 130, value 1..40) are top-level question numbers —
    both the MCQ grid column (x≈118) and the Section B column (x≈58). Sub-parts
    like (a)/(i) are not integers, so they're ignored.
  - For question N on one of its msPages p:
      top    = y of N's number on p   (or page top, if N continues from a prior page)
      bottom = y of the next top-level number below N on p (or page bottom)
  - Each (question, page) yields one crop. The app stitches a question's page-crops.

Output: smartmark/rendered/<slug(MS)>_p<page>_q<number>.png
Run:  python render_ms_crops.py            (skip existing)
      python render_ms_crops.py --force    (re-render all)
"""

import json
import sys
from pathlib import Path

import fitz

PAPERS_DIR = Path(__file__).parent / "papers"
INDEX_PATH = Path(__file__).parent / "index.json"
OUTPUT_DIR = Path(__file__).parent / "rendered"
RENDER_DPI = 200
LEFT_COL_X = 130        # left "Question" column cutoff
MARGIN_ABOVE = 6
MARGIN_BELOW = 4


def slug(pdf_name: str) -> str:
    return pdf_name.split(" - ")[0].replace(" ", "_")


def left_margin_numbers(page):
    """Return sorted [(y0, number)] for top-level question numbers on a page."""
    h = page.rect.height
    found = {}
    for w in page.get_text("words"):
        x0, y0, txt = w[0], w[1], w[4].strip()
        if x0 < LEFT_COL_X and txt.isdigit() and 1 <= int(txt) <= 40 and y0 < h - 30:
            # keep the top-most occurrence of each number
            if txt not in found or y0 < found[txt]:
                found[txt] = y0
    return sorted(((y, int(n)) for n, y in found.items()))


def crop_for_question(page, number):
    """(top, bottom) y-range for question `number` on this page, or None to skip."""
    nums = left_margin_numbers(page)
    h = page.rect.height
    ys = [y for y, n in nums if n == number]
    if ys:
        top = ys[0]
    else:
        # Number not on this page -> it's a continuation; start from the page top.
        # Only valid if no *earlier* question also lacks a marker here; we still
        # bound the bottom by the next number that appears.
        top = page.rect.y0
    # bottom = first number that starts strictly below `top`
    below = [y for y, n in nums if y > top + 2]
    bottom = min(below) if below else h
    return top, bottom


def render_crop(pdf_path, page_index, y0, y1, out_path):
    doc = fitz.open(pdf_path)
    page = doc[page_index]
    r = page.rect
    clip = fitz.Rect(r.x0, max(r.y0, y0 - MARGIN_ABOVE), r.x1, min(r.y1, y1 + MARGIN_BELOW))
    pix = page.get_pixmap(dpi=RENDER_DPI, clip=clip)
    pix.save(str(out_path))
    doc.close()


def main():
    force = "--force" in sys.argv
    if not INDEX_PATH.exists():
        sys.exit("index.json not found. Run index_papers.py first.")
    index = json.loads(INDEX_PATH.read_text())
    OUTPUT_DIR.mkdir(exist_ok=True)

    rendered = skipped = failed = 0
    for qp_name, data in index.items():
        for q in data.get("questions", []):
            ms_name = q.get("msPaper", "")
            ms_path = PAPERS_DIR / ms_name
            if not ms_name or not ms_path.exists():
                continue
            number = q.get("number")
            try:
                num_int = int(str(number))
            except (TypeError, ValueError):
                continue  # only crop by integer top-level number

            doc = fitz.open(ms_path)
            for page_num in q.get("msPages", []):
                pi = page_num - 1
                if pi < 0 or pi >= doc.page_count:
                    continue
                out_path = OUTPUT_DIR / f"{slug(ms_name)}_p{page_num}_q{number}.png"
                if out_path.exists() and not force:
                    skipped += 1
                    continue
                try:
                    top, bottom = crop_for_question(doc[pi], num_int)
                    if bottom - top < 8:  # too thin, fall back to full page
                        top, bottom = doc[pi].rect.y0, doc[pi].rect.y1
                    render_crop(ms_path, pi, top, bottom, out_path)
                    rendered += 1
                except Exception as e:  # noqa: BLE001
                    print(f"  !! {out_path.name}: {e}")
                    failed += 1
            doc.close()

    print(f"Done. Rendered {rendered}, skipped {skipped}, failed {failed}.")
    print(f"Output: {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
