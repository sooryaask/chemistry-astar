"""
Per-sub-part mark-scheme cropping.

OCR mark schemes are landscape tables: Question | Answer | Marks | Guidance.
The left "Question" column holds the sub-part labels ("16 (a)", "(b)", "(i)"...).
Full-width horizontal rules separate the rows. For each main sub-part (a),(b),...
we crop the band between the rule at its row top and the rule at the NEXT label's
row top (main letter OR roman numeral). This ensures each crop shows ONLY the
answer for that sub-part.

Roman numeral rows ((i),(ii)…) that appear without a preceding main letter on
the same page are grouped under the next expected letter from the question data.
For example, if Q16 has subPartImgs {a,b,c,d} and the MS labels are (a),(i),(ii),
the roman numerals are assigned to (b) since (a) is already accounted for.

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
ROMAN_RE = re.compile(r'\((i{1,4}v?|vi{0,3})\)')  # roman numeral sub-sub-parts
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


def all_label_rows(page):
    """[(y, type, value)] for ALL labels in the question column.

    type='main' value='a'  → main sub-part letter
    type='roman' value='i' → roman numeral sub-sub-part
    """
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
                rows.append((y0, 'main', m.group(1)))
                continue
            r = ROMAN_RE.search(txt)
            if r:
                rows.append((y0, 'roman', r.group(1)))
    # de-dupe: keep the first (topmost) occurrence of each label
    seen = set()
    deduped = []
    for y, typ, val in sorted(rows):
        key = (typ, val)
        if key not in seen:
            seen.add(key)
            deduped.append((y, typ, val))
    return deduped


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

    # The question's expected sub-part letters (from subPartImgs)
    expected_letters = sorted((q.get('subPartImgs') or {}).keys())

    # Collect all labels (main + roman) per page
    per_page = []
    for pg in ms_pages:
        idx = pg - 1
        if idx < 0 or idx >= doc.page_count:
            continue
        page = doc[idx]
        per_page.append((pg, page, horizontal_rules(page), all_label_rows(page)))

    # Flatten all labels into a unified list and assign each to a parent letter.
    # Main labels keep their letter. Roman numerals get assigned to the next
    # expected letter that doesn't already have a main label.
    # e.g. labels [(a), (i), (ii), (c)] with expected [a,b,c,d] → (i),(ii) → b
    flat = []  # (page_num, page, rules, y, letter)
    main_letters_seen = set()

    # First pass: collect all main labels
    for pg, page, rules, labels in per_page:
        for y, typ, val in labels:
            if typ == 'main':
                main_letters_seen.add(val)

    # Second pass: assign roman numerals to missing parent letters
    current_parent = None  # tracks which letter the current roman group belongs to
    for pg, page, rules, labels in per_page:
        for y, typ, val in labels:
            if typ == 'main':
                flat.append((pg, page, rules, y, val))
                current_parent = None  # reset — next romans need a new parent
            elif typ == 'roman':
                # Find the parent letter for this roman numeral group.
                # It's the first expected letter not already seen as a main label.
                if current_parent is None:
                    for el in expected_letters:
                        if el not in main_letters_seen:
                            current_parent = el
                            main_letters_seen.add(el)  # claim it
                            break
                if current_parent:
                    flat.append((pg, page, rules, y, current_parent))

    if len(flat) < 2:
        return None  # not enough sub-parts to split — keep whole-question MS

    out = {}
    marks = {}

    # Group consecutive entries with the same letter on the same page into
    # a single crop (top of first → top of next different entry or table bottom).
    i = 0
    while i < len(flat):
        pg, page, rules, y, letter = flat[i]
        top = snap_below(rules, y)

        # Find the end: skip consecutive entries for the same letter on the same page
        j = i + 1
        while j < len(flat) and flat[j][4] == letter and flat[j][0] == pg:
            j += 1

        # Bottom = next entry's row top (if same page), else table bottom
        if j < len(flat) and flat[j][0] == pg:
            bot = snap_below(flat[j][2], flat[j][3])
        else:
            bot = rules[-1] if rules else page.rect.height

        fname = crop_band(page, slug, pg, letter, top, bot)
        if fname:
            out.setdefault(letter, []).append(fname)
            m = band_marks(page, top, bot)
            if m:
                marks[letter] = marks.get(letter, 0) + m

        i = j

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
            # Only set subPartMarks if the question doesn't already have them.
            # Tick-counted marks are unreliable; manually-set values take priority.
            if marks and 'subPartMarks' not in q:
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
