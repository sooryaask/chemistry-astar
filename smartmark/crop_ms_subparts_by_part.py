"""
Per-sub-part mark-scheme cropping.

OCR mark schemes are landscape tables: Question | Answer | Marks | Guidance.
The left "Question" column holds the sub-part labels ("16 (a)", "(b)", "(i)"...).
Full-width horizontal rules separate the rows. For each main sub-part (a),(b),...
we crop the band between the rule at its row top and the rule at the next main
sub-part's row top (or the table bottom). This gives one mark-scheme image per
sub-part, so a card reveals ONLY the answer for the part being practised.

Writes q['msSubPartImgs'] = { 'a': [files], 'b': [files], ... } into paperIndex.json
and the PNGs into smartmark/rendered/. Output naming: {msSlug}_p{page}_ms{letter}.png
"""

import fitz, re, json
from pathlib import Path

PAPERS_DIR = Path('smartmark/papers')
RENDERED_DIR = Path('smartmark/rendered')
PI_PATH = Path('src/data/paperIndex.json')

DPI = 200
SCALE = DPI / 72
QCOL_X = 135          # Question column is left of this x
MAIN_RE = re.compile(r'\(([a-f])\)')   # main sub-part letter in the row text
PAD = 2


def ms_slug(ms_name):
    return ms_name.split(' - ')[0].replace(' ', '_')


def horizontal_rules(page):
    """Full-width row-separator rules, sorted top-to-bottom."""
    ys = set()
    for d in page.get_drawings():
        r = d['rect']
        if r.width > 300 and r.height < 3:
            ys.add(round(r.y0, 1))
    return sorted(ys)


# OCR mark schemes award one tick (✓) per mark point. Counting ticks in a
# sub-part's row band gives its mark total — the authentic, reliable source
# (the printed "Marks" column digit is easy to confuse with other numerals).
TICKS = {'\uf0fc', '\u2713', '\u2714', '\u2705'}


def band_marks(page, top, bot):
    """Count award ticks in [top, bot] = the marks for that sub-part."""
    total = 0
    for b in page.get_text('dict')['blocks']:
        if 'lines' not in b:
            continue
        for ln in b['lines']:
            for sp in ln['spans']:
                sy = sp['bbox'][1]
                if top - 2 <= sy <= bot + 2:
                    total += sum(1 for ch in sp['text'] if ch in TICKS)
    return total


def main_label_rows(page):
    """[(y, letter)] for each row in the Question column that starts a main sub-part."""
    rows = []
    for b in page.get_text('dict')['blocks']:
        if 'lines' not in b:
            continue
        for ln in b['lines']:
            x0 = ln['spans'][0]['bbox'][0]
            y0 = ln['spans'][0]['bbox'][1]
            if x0 >= QCOL_X:
                continue
            txt = ' '.join(s['text'] for s in ln['spans'])
            m = MAIN_RE.search(txt)
            if m:
                rows.append((y0, m.group(1)))
    # de-dupe: keep the first (topmost) occurrence of each letter on the page
    seen = {}
    for y, letter in sorted(rows):
        if letter not in seen:
            seen[letter] = y
    return sorted((y, l) for l, y in seen.items())


def snap_below(rules, y, tol=4):
    """Largest rule at or just above y (the rule forming this row's top edge)."""
    cands = [r for r in rules if r <= y + tol]
    return cands[-1] if cands else (rules[0] if rules else y)


def crop_band(page, slug, page_num, letter, top, bot):
    top = max(0, top - PAD)
    bot = min(page.rect.height, bot + PAD)
    if bot - top < 8:
        return None
    clip = fitz.Rect(0, top, page.rect.width, bot)
    pix = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE), clip=clip)
    fname = f'{slug}_p{page_num}_ms{letter}.png'
    pix.save(str(RENDERED_DIR / fname))
    return fname


def process_question(q, doc, slug):
    ms_pages = q.get('msPages') or q.get('msShow') or []
    if not ms_pages:
        return None
    # Collect main labels per page (in page order)
    per_page = []
    for pg in ms_pages:
        idx = pg - 1
        if idx < 0 or idx >= doc.page_count:
            continue
        page = doc[idx]
        per_page.append((pg, page, horizontal_rules(page), main_label_rows(page)))

    # Flatten labels with their page, in document order
    flat = []  # (page_num, page, rules, y, letter)
    for pg, page, rules, labels in per_page:
        for y, letter in labels:
            flat.append((pg, page, rules, y, letter))
    if len(flat) < 2:
        return None  # not enough sub-parts to split — keep whole-question MS

    out = {}
    marks = {}
    for i, (pg, page, rules, y, letter) in enumerate(flat):
        top = snap_below(rules, y)
        # bottom = next main label's row top, if it's on the SAME page; else table bottom of this page
        if i + 1 < len(flat) and flat[i + 1][0] == pg:
            bot = snap_below(flat[i + 1][2], flat[i + 1][3])
        else:
            bot = rules[-1] if rules else page.rect.height
        fname = crop_band(page, slug, pg, letter, top, bot)
        if fname:
            out.setdefault(letter, []).append(fname)
            m = band_marks(page, top, bot)
            if m:
                marks[letter] = marks.get(letter, 0) + m
    return (out, marks) if out else None


# wipe stale MS sub-part crops
stale = list(RENDERED_DIR.glob('*_ms[a-f].png'))
for f in stale:
    f.unlink()
print(f'Removed {len(stale)} stale MS sub-part PNGs\n')

pi = json.loads(PI_PATH.read_text())
ms_cache = {}
done = 0
for qp_name, data in pi.items():
    if 'QP' not in qp_name:
        continue
    for q in data['questions']:
        if q.get('marks', 1) <= 1:
            continue
        if not (q.get('subPartImgs') and len(q['subPartImgs']) >= 2):
            continue
        ms_name = q.get('msPaper')
        if not ms_name:
            continue
        ms_path = PAPERS_DIR / ms_name
        if not ms_path.exists():
            print(f'!! missing MS {ms_name}')
            continue
        if ms_name not in ms_cache:
            ms_cache[ms_name] = fitz.open(ms_path)
        doc = ms_cache[ms_name]
        slug = ms_slug(ms_name)
        result = process_question(q, doc, slug)
        if result:
            imgs, marks = result
            q['msSubPartImgs'] = imgs
            if marks:
                q['subPartMarks'] = marks
            done += 1
            print(f'  {qp_name.split(" - ")[0]} Q{q["number"]}: ' +
                  ', '.join(f'{k}->{len(v)}img/{marks.get(k, "?")}m' for k, v in imgs.items()))
        else:
            q.pop('msSubPartImgs', None)
            q.pop('subPartMarks', None)

for doc in ms_cache.values():
    doc.close()
PI_PATH.write_text(json.dumps(pi, indent=2, ensure_ascii=False) + '\n')
print(f'\nDone — {done} questions got per-sub-part mark schemes.')
