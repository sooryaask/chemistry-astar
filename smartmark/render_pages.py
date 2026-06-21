"""
Pre-render per-question cropped PNGs from past-paper PDFs.

Uses the question index to know which questions are on which pages,
then finds each question's vertical position using PyMuPDF text blocks
and crops the page to show only that question.

Outputs to smartmark/rendered/ with filenames like:
  June_2017_QP_p6_q12.png   (cropped to Q12 only)
  June_2017_MS_p5.png        (full page — mark schemes aren't cropped)

Run:  python render_pages.py
      python render_pages.py --force   (re-render everything)
"""

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import fitz

PAPERS_DIR = Path(__file__).parent / "papers"
INDEX_PATH = Path(__file__).parent / "index.json"
OUTPUT_DIR = Path(__file__).parent / "rendered"
RENDER_DPI = 200
MARGIN_ABOVE = 8   # extra pixels above the question start
MARGIN_BELOW = 12  # extra pixels below the crop end


def slug(pdf_name: str) -> str:
    """'June 2017 QP - Paper 1 ...' -> 'June_2017_QP'"""
    return pdf_name.split(" - ")[0].replace(" ", "_")


def find_question_y_positions(page, question_numbers):
    """Find the Y-start of each question number on a PDF page.

    Returns {question_number_str: y_position} for the ones found.
    Looks for text blocks at the left margin (~x < 80) that start with
    the question number followed by a space.
    """
    blocks = page.get_text("blocks")
    positions = {}

    for qn in question_numbers:
        qn_str = str(qn)
        for b in blocks:
            x0, y0, x1, y1, text = b[0], b[1], b[2], b[3], b[4]
            text_stripped = text.strip()
            # Question numbers appear at the left margin (x0 < 80)
            # and the block text starts with the number followed by space or newline
            if x0 < 80 and re.match(rf"^{re.escape(qn_str)}\s", text_stripped):
                positions[qn_str] = y0
                break

    return positions


def render_cropped_question(pdf_path, page_index, y_start, y_end, out_path, dpi=RENDER_DPI):
    """Render a vertical slice of a PDF page to PNG."""
    doc = fitz.open(pdf_path)
    page = doc[page_index]

    # Define crop rectangle (full width, limited height)
    page_rect = page.rect
    clip = fitz.Rect(
        page_rect.x0,
        max(page_rect.y0, y_start - MARGIN_ABOVE),
        page_rect.x1,
        min(page_rect.y1, y_end + MARGIN_BELOW),
    )

    pix = page.get_pixmap(dpi=dpi, clip=clip)
    pix.save(str(out_path))
    doc.close()


def render_full_page(pdf_path, page_index, out_path, dpi=RENDER_DPI):
    """Render a full PDF page to PNG."""
    doc = fitz.open(pdf_path)
    page = doc[page_index]
    pix = page.get_pixmap(dpi=dpi)
    pix.save(str(out_path))
    doc.close()


def main():
    force = "--force" in sys.argv

    if not INDEX_PATH.exists():
        sys.exit("index.json not found. Run index_papers.py first.")

    index = json.loads(INDEX_PATH.read_text())
    OUTPUT_DIR.mkdir(exist_ok=True)

    rendered = 0
    skipped = 0
    failed = 0

    # --- Render cropped question paper pages ---
    for qp_name, data in index.items():
        questions = data.get("questions", [])
        qp_path = PAPERS_DIR / qp_name
        if not qp_path.exists():
            print(f"  !! missing: {qp_name}")
            continue

        # Group questions by page
        by_page = defaultdict(list)
        for q in questions:
            by_page[q["page"]].append(q)

        for page_num, page_qs in by_page.items():
            # Sort questions by their number (as they appear top to bottom)
            page_qs.sort(key=lambda q: q.get("number", ""))

            if len(page_qs) == 1:
                # Only one question on this page — render full page
                q = page_qs[0]
                out_name = f"{slug(qp_name)}_p{page_num}_q{q['number']}.png"
                out_path = OUTPUT_DIR / out_name

                if out_path.exists() and not force:
                    skipped += 1
                    continue

                render_full_page(qp_path, page_num - 1, out_path)
                rendered += 1
            else:
                # Multiple questions — find positions and crop
                doc = fitz.open(qp_path)
                page = doc[page_num - 1]
                page_height = page.rect.height

                q_numbers = [q["number"] for q in page_qs]
                positions = find_question_y_positions(page, q_numbers)
                doc.close()

                # Build list of (question, y_start) sorted by position
                positioned = []
                for q in page_qs:
                    qn = str(q["number"])
                    if qn in positions:
                        positioned.append((q, positions[qn]))
                    else:
                        # Fallback: couldn't find position, render full page
                        positioned.append((q, None))

                positioned.sort(key=lambda x: x[1] if x[1] is not None else 0)

                for i, (q, y_start) in enumerate(positioned):
                    out_name = f"{slug(qp_name)}_p{page_num}_q{q['number']}.png"
                    out_path = OUTPUT_DIR / out_name

                    if out_path.exists() and not force:
                        skipped += 1
                        continue

                    if y_start is None:
                        # Couldn't find position — render full page as fallback
                        print(f"  !! Q{q['number']} position not found on {slug(qp_name)} p{page_num}, using full page")
                        render_full_page(qp_path, page_num - 1, out_path)
                        rendered += 1
                        continue

                    # y_end is the start of the next question, or page bottom
                    if i + 1 < len(positioned) and positioned[i + 1][1] is not None:
                        y_end = positioned[i + 1][1]
                    else:
                        y_end = page_height

                    render_cropped_question(qp_path, page_num - 1, y_start, y_end, out_path)
                    rendered += 1

    # --- Render full mark scheme pages (no cropping needed) ---
    ms_pages = set()
    for qp_name, data in index.items():
        for q in data.get("questions", []):
            ms_name = q.get("msPaper", "")
            for ms_page in q.get("msPages", []):
                if ms_name:
                    ms_pages.add((ms_name, ms_page))

    for ms_name, page_num in sorted(ms_pages):
        out_name = f"{slug(ms_name)}_p{page_num}.png"
        out_path = OUTPUT_DIR / out_name

        if out_path.exists() and not force:
            skipped += 1
            continue

        ms_path = PAPERS_DIR / ms_name
        if not ms_path.exists():
            print(f"  !! missing: {ms_name}")
            failed += 1
            continue

        render_full_page(ms_path, page_num - 1, out_path)
        rendered += 1

    print(f"Done. Rendered {rendered}, skipped {skipped}, failed {failed}.")
    print(f"Output: {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
