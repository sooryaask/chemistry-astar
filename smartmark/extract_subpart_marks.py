"""
Authoritative per-sub-part marks from the QUESTION PAPER.

OCR prints "[n]" after every markable part. Summing the [n] brackets inside a
sub-part's vertical band on the QP gives its exact mark total — more reliable
than the question's incomplete `slots` data or counting mark-scheme ticks
(ECF/alternative routes inflate tick counts).

Writes q['subPartMarks'] = { 'a': 4, 'b': 3, ... } into paperIndex.json.
"""

import fitz, re, json
from pathlib import Path

PAPERS_DIR = Path('smartmark/papers')
PI_PATH = Path('src/data/paperIndex.json')

BRACKET_RE = re.compile(r'\[(\d{1,2})\]')
# Main sub-part label at the start of a line (see crop_question_subparts.py).
LABEL_RE = re.compile(r'^\s*\d{0,2}\s*\(([a-f])\)')
LABEL_MAX_X = 120


def find_subparts(doc, page_idxs):
    out = []
    seen = set()
    for pg in page_idxs:
        page = doc[pg]
        for b in page.get_text('dict')['blocks']:
            if 'lines' not in b:
                continue
            for ln in b['lines']:
                x0 = ln['spans'][0]['bbox'][0]
                if x0 >= LABEL_MAX_X:
                    continue
                txt = ''.join(s['text'] for s in ln['spans'])
                m = LABEL_RE.match(txt)
                if m and m.group(1) not in seen:
                    seen.add(m.group(1))
                    out.append((pg, ln['spans'][0]['bbox'][1], m.group(1)))
    return out


# A sub-part is a calculation (excluded from the decks) if its wording asks the
# student to compute a numeric result. Kept conservative so prose "explain/state"
# parts are never caught.
CALC_RE = re.compile(
    r'\bcalculate\b|\bwork out\b|how many (?:moles|atoms|molecules|ions)|'
    r'\bdetermine the (?:value|mass|concentration|amount|volume|ph|number of moles)\b',
    re.IGNORECASE,
)


def band_lines(doc, pg_start, y_start, pg_end, y_end):
    """Yield the text lines that fall inside a sub-part's band."""
    for pg in range(pg_start, pg_end + 1):
        page = doc[pg]
        lo = y_start if pg == pg_start else 0
        hi = y_end if pg == pg_end else page.rect.height
        for b in page.get_text('dict')['blocks']:
            if 'lines' not in b:
                continue
            for ln in b['lines']:
                y = ln['spans'][0]['bbox'][1]
                if lo - 2 <= y <= hi + 2:
                    yield ''.join(s['text'] for s in ln['spans'])


def marks_in_band(doc, pg_start, y_start, pg_end, y_end):
    total = 0
    for txt in band_lines(doc, pg_start, y_start, pg_end, y_end):
        for m in BRACKET_RE.findall(txt):
            total += int(m)
    return total


def band_is_calc(doc, pg_start, y_start, pg_end, y_end):
    text = ' '.join(band_lines(doc, pg_start, y_start, pg_end, y_end))
    return bool(CALC_RE.search(text))


pi = json.loads(PI_PATH.read_text())
qp_cache = {}
fixed = 0
mismatches = []

for qp_name, data in pi.items():
    if 'QP' not in qp_name:
        continue
    qp_path = PAPERS_DIR / qp_name
    if not qp_path.exists():
        continue
    if qp_name not in qp_cache:
        qp_cache[qp_name] = fitz.open(qp_path)
    doc = qp_cache[qp_name]

    for q in data['questions']:
        if q.get('marks', 1) <= 1:
            continue
        if not (q.get('subPartImgs') and len(q['subPartImgs']) >= 2):
            q.pop('subPartMarks', None)
            continue
        page_idxs = [p - 1 for p in q.get('qpPages', [q['page']])]
        parts = find_subparts(doc, page_idxs)
        if len(parts) < 2:
            q.pop('subPartMarks', None)
            continue
        last_ph = doc[page_idxs[-1]].rect.height
        bounded = parts + [(page_idxs[-1], last_ph, '_end')]
        marks = {}
        calc_parts = []
        for i in range(len(bounded) - 1):
            ps, ys, lbl = bounded[i]
            pe, ye, _ = bounded[i + 1]
            m = marks_in_band(doc, ps, ys, pe, ye)
            if m:
                marks[lbl] = marks.get(lbl, 0) + m
            if band_is_calc(doc, ps, ys, pe, ye):
                calc_parts.append(lbl)
        if calc_parts:
            q['calcSubParts'] = calc_parts
        else:
            q.pop('calcSubParts', None)
        if marks:
            q['subPartMarks'] = marks
            fixed += 1
            s = sum(marks.values())
            if s != q['marks']:
                mismatches.append(f'{qp_name.split(" - ")[0]} Q{q["number"]}: '
                                  f'parts sum {s} vs total {q["marks"]} {marks}')

for doc in qp_cache.values():
    doc.close()
PI_PATH.write_text(json.dumps(pi, indent=2, ensure_ascii=False) + '\n')
print(f'Set subPartMarks on {fixed} questions.')
print(f'Mismatches (parts != question total): {len(mismatches)}')
for m in mismatches:
    print('  ', m)
