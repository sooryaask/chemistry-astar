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

MARGIN_X = 80
MAIN_RE = re.compile(r'^[a-f]$')
BRACKET_RE = re.compile(r'\[(\d{1,2})\]')


def find_subparts(doc, page_idxs):
    out = []
    for pg in page_idxs:
        page = doc[pg]
        for b in page.get_text('dict')['blocks']:
            if 'lines' not in b:
                continue
            for ln in b['lines']:
                for sp in ln['spans']:
                    t = sp['text'].strip()
                    inner = t[1:-1] if t.startswith('(') and t.endswith(')') else ''
                    if MAIN_RE.match(inner) and sp['bbox'][0] < MARGIN_X:
                        out.append((pg, sp['bbox'][1], inner))
    return out


def marks_in_band(doc, pg_start, y_start, pg_end, y_end):
    total = 0
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
                    txt = ''.join(s['text'] for s in ln['spans'])
                    for m in BRACKET_RE.findall(txt):
                        total += int(m)
    return total


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
        for i in range(len(bounded) - 1):
            ps, ys, lbl = bounded[i]
            pe, ye, _ = bounded[i + 1]
            m = marks_in_band(doc, ps, ys, pe, ye)
            if m:
                marks[lbl] = marks.get(lbl, 0) + m
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
