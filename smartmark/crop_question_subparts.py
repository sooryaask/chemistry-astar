"""
Content-aware sub-part cropping.

For each written question, crop each main sub-part (a),(b),(c)... into its own PNG.
Unlike v2 (which ran blindly from one label's y to the next label's y), this:
  - excludes page furniture (footer "© OCR ...", "PMT" watermark, "Turn over",
    "BLANK PAGE", standalone page numbers in the top/bottom margins)
  - trims each page segment to the actual ink (real text + vector drawings/boxes
    + the dotted answer rules), removing trailing whitespace and the footer band
  - on continuation pages, skips the page header above the first real content
  - DROPS any page segment that has no real content (kills the empty slivers that
    appear when the next sub-part's label sits on a later page)

Output naming matches v2 so cards.js needs no change:
  {slug}_p{page}_s{letter}.png  (single page)
  {slug}_p{page}_s{letter}_cont{i}.png  (multi-page sub-part)
"""

import fitz, re, json
from pathlib import Path

PAPERS_DIR = Path('smartmark/papers')
RENDERED_DIR = Path('smartmark/rendered')
PI_PATH = Path('src/data/paperIndex.json')

DPI = 200
SCALE = DPI / 72
MARGIN_X = 80      # sub-part labels sit at x~50; state symbols (g),(s) are at x>120
PAD = 10           # px of breathing room around content (in PDF points)

MAIN_RE = re.compile(r'^[a-f]$')           # single sub-part letter (a)-(f)
FURNITURE_RE = re.compile(
    r'^©\s*OCR|^PMT$|Turn over|BLANK PAGE|^\s*\*?\d{6,}\*?\s*$',  # copyright/watermark/barcode
    re.IGNORECASE,
)


def is_furniture(text, bbox, page_h):
    """True if this text block is page chrome, not question content."""
    t = text.strip()
    if not t:
        return True
    if FURNITURE_RE.search(t):
        return True
    # Standalone page number in the top or bottom margin
    if re.fullmatch(r'\d{1,3}', t):
        y0 = bbox[1]
        if y0 < 90 or y0 > page_h - 80:
            return True
    return False


def content_spans(page, y0, y1):
    """Return list of (top, bottom) ink rectangles within [y0, y1), minus furniture."""
    spans = []
    ph = page.rect.height
    data = page.get_text('dict')
    for b in data['blocks']:
        bx0, by0, bx1, by1 = b['bbox']
        if by1 <= y0 or by0 >= y1:
            continue
        if 'lines' in b:  # text block
            text = ' '.join(s['text'] for ln in b['lines'] for s in ln['spans'])
            if is_furniture(text, b['bbox'], ph):
                continue
        # image or kept-text block
        spans.append((max(by0, y0), min(by1, y1)))
    # vector drawings: boxes, arrows, dotted answer rules
    for d in page.get_drawings():
        r = d['rect']
        if r.y1 <= y0 or r.y0 >= y1:
            continue
        if r.height < 0.5 and r.width < 0.5:
            continue
        spans.append((max(r.y0, y0), min(r.y1, y1)))
    return spans


DOT_CHARS = '.·•…․‥…‧'  # dot-leader glyphs used for answer blanks


def is_answer_line_text(text):
    """True if a text line is just answer space — dot-leaders and/or a mark
    bracket like [2] — with fewer than 2 real alphanumeric characters. This keeps
    labelled blanks ('1s ...... ......', alnum>=2) but drops essay answer lines."""
    t = text.strip()
    if not t:
        return True
    stripped = re.sub(r'\[\s*\d{1,2}\s*\]', '', t)          # drop mark brackets
    stripped = ''.join(c for c in stripped if c not in DOT_CHARS)
    return sum(1 for c in stripped if c.isalnum()) < 2


def keep_bottom(page, y0, y1):
    """Bottom y of the last SUBSTANTIVE content in [y0, y1): prompt text, diagrams,
    boxes, tables, graphs, labelled blanks. Trailing pure answer lines, lone [n]
    marks and blank space are excluded so the crop can end at the question prompt.
    Returns None if nothing substantive is found (leave the crop as-is)."""
    bottoms = []
    for b in page.get_text('dict')['blocks']:
        bx0, by0, bx1, by1 = b['bbox']
        if by1 <= y0 or by0 >= y1:
            continue
        if 'lines' in b:
            for ln in b['lines']:                            # judge each line
                lx0, ly0, lx1, ly1 = ln['bbox']
                if ly1 <= y0 or ly0 >= y1:
                    continue
                txt = ''.join(s['text'] for s in ln['spans'])
                if is_furniture(txt, ln['bbox'], page.rect.height):
                    continue
                if not is_answer_line_text(txt):
                    bottoms.append(min(ly1, y1))
        else:
            bottoms.append(min(by1, y1))                     # image block = keep
    for d in page.get_drawings():                            # 2D shapes = keep,
        r = d['rect']                                        # thin rules = answer line
        if r.y1 <= y0 or r.y0 >= y1:
            continue
        if r.height >= 3:
            bottoms.append(min(r.y1, y1))
    return max(bottoms) if bottoms else None


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


def crop_region(doc, pg_start, y_start, pg_end, y_end, slug, label):
    """Crop [start..end) across pages, trimming furniture & empty segments."""
    files = []
    pages = list(range(pg_start, pg_end + 1))
    raw_segments = []
    # The end boundary is the NEXT sub-part's label y. Pull the cut up a little
    # so that label's heading (whose block top sits a hair above its baseline)
    # is excluded — otherwise the next part's first line bleeds into this crop.
    END_GAP = 14
    for i, pg in enumerate(pages):
        page = doc[pg]
        ph = page.rect.height
        seg_top = y_start if i == 0 else 0
        seg_bot = (y_end - END_GAP) if i == len(pages) - 1 else ph
        if seg_bot - seg_top < 4:
            continue
        spans = content_spans(page, seg_top, seg_bot)
        if not spans:
            continue  # no real content -> drop this page segment
        content_top = min(t for t, _ in spans)
        content_bot = max(b for _, b in spans)
        # Prompt-only: end the crop at the last substantive content, dropping any
        # trailing essay answer lines / blanks (diagrams, tables, labelled blanks
        # are preserved). The clean answer box in the app sits right below.
        kb = keep_bottom(page, seg_top, seg_bot)
        if kb is not None:
            content_bot = min(content_bot, kb)
        # Keep the label on the starting page; otherwise hug the content.
        top = (y_start if i == 0 else content_top) - PAD
        bot = content_bot + PAD
        top = max(0, top)
        bot = min(ph, bot)
        if bot - top < 4:
            continue
        raw_segments.append((pg, top, bot, i == 0))

    # Drop continuation segments (not the first) that are too short to hold real
    # content — these are single-line bleed of the next sub-part's heading or a
    # stray page number that survived the furniture filter. A genuine spillover
    # (answer lines continuing onto a new page) is always much taller than this.
    MIN_CONT_PT = 70
    raw_segments = [
        s for s in raw_segments
        if s[3] or (s[2] - s[1]) >= MIN_CONT_PT
    ]
    raw_segments = [(pg, top, bot) for (pg, top, bot, _first) in raw_segments]

    multi = len(raw_segments) > 1
    for j, (pg, top, bot) in enumerate(raw_segments):
        page = doc[pg]
        clip = fitz.Rect(0, top, page.rect.width, bot)
        pix = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE), clip=clip)
        suffix = f'_cont{j}' if multi else ''
        fname = f'{slug}_p{pg+1}_s{label}{suffix}.png'
        pix.save(str(RENDERED_DIR / fname))
        files.append(fname)
    return files


def process(qp_name, data, doc):
    slug = qp_name.split(' - ')[0].replace(' ', '_')
    written = [q for q in data['questions'] if q.get('marks', 1) > 1]
    written.sort(key=lambda q: int(q['number']))

    for q in written:
        page_idxs = [p - 1 for p in q.get('qpPages', [q['page']])]
        parts = find_subparts(doc, page_idxs)
        if len(parts) < 2:
            q.pop('subPartImgs', None)
            continue
        last_ph = doc[page_idxs[-1]].rect.height
        bounded = parts + [(page_idxs[-1], last_ph, '_end')]
        sub_imgs = {}
        for k in range(len(bounded) - 1):
            ps, ys, lbl = bounded[k]
            pe, ye, _ = bounded[k + 1]
            sub_imgs[lbl] = crop_region(doc, ps, ys, pe, ye, slug, lbl)
        q['subPartImgs'] = sub_imgs
        print(f'  {slug} Q{q["number"]}: ' +
              ', '.join(f'{k}->{len(v)}img' for k, v in sub_imgs.items()))


# wipe stale sub-part crops
stale = list(RENDERED_DIR.glob('*_s?.png')) + list(RENDERED_DIR.glob('*_s?_cont?.png'))
for f in stale:
    f.unlink()
print(f'Removed {len(stale)} stale sub-part PNGs\n')

pi = json.loads(PI_PATH.read_text())
for qp_name, data in pi.items():
    if 'QP' not in qp_name:
        continue
    pdf = PAPERS_DIR / qp_name
    if not pdf.exists():
        print(f'!! missing {qp_name}')
        continue
    doc = fitz.open(pdf)
    process(qp_name, data, doc)
    doc.close()

PI_PATH.write_text(json.dumps(pi, indent=2, ensure_ascii=False) + '\n')
print('\nDone.')
