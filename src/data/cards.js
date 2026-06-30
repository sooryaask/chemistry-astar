// The card data layer — PAST PAPERS ONLY.
//
// Every card is a real OCR past-paper sub-part (cropped QP image) paired with the
// official mark scheme. When subPartImgs is available for a question, one card is
// created per main sub-part (a), (b), (c)... Otherwise the whole question is one card.
//
// Deck ids:
//   paper:<paperSlug>  -> a full past paper's written questions

import paperIndex from './paperIndex.json'

function slug(pdfName) {
  return pdfName.split(' - ')[0].replaceAll(' ', '_')
}
function pageUrl(pdfName, page) {
  return `${import.meta.env.BASE_URL}rendered/${slug(pdfName)}_p${page}.png`
}
function renderedUrl(filename) {
  return `${import.meta.env.BASE_URL}rendered/${filename}`
}
function msCropUrl(pdfName, page, number) {
  return `${import.meta.env.BASE_URL}rendered/${slug(pdfName)}_p${page}_q${number}.png`
}
function paperLabel(pdfName) {
  return pdfName.split(' QP ')[0] || pdfName
}

const CARDS_BY_PAPER = {}
const PAPER_LIST = []

for (const [paper, data] of Object.entries(paperIndex)) {
  const ps = slug(paper)
  const cards = []

  for (const q of data.questions || []) {
    if (q.marks <= 1) continue           // skip MCQs
    if (q.isCalculation) continue        // skip calculation questions

    const msUrls =
      q.msShownImgs && q.msShownImgs.length
        ? q.msShownImgs.map(renderedUrl)
        : (q.msShow || q.msPages || []).map((p) => msCropUrl(q.msPaper, p, q.number))

    const qpPages = q.qpPages || [q.page]
    const fullQpUrls = qpPages.map((p) => pageUrl(paper, p))

    // Total the marks of each main sub-part by summing all its slots. Slot
    // labels look like "(a)", "(a) (i)", "(a) (ii)" — a part with roman
    // sub-sub-parts has several slots that all roll up to the same letter.
    const marksByLetter = {}
    for (const s of q.slots || []) {
      const m = /^\(?\s*([a-f])\b/.exec((s.label || '').trim().toLowerCase())
      if (m) marksByLetter[m[1]] = (marksByLetter[m[1]] || 0) + (s.marks || 0)
    }

    if (q.subPartImgs && Object.keys(q.subPartImgs).length >= 2) {
      // One card per sub-part
      for (const [lbl, fnames] of Object.entries(q.subPartImgs)) {
        const marks = marksByLetter[lbl] || 1
        cards.push({
          id: `pp::${ps}::q${q.number}::s${lbl}`,
          type: 'image',
          marks,
          number: q.number,
          subPart: lbl,
          topic: q.topic || '',
          summary: q.summary || '',
          paperLabel: paperLabel(paper),
          qpUrls: fnames.map(renderedUrl),
          msUrls,
          explanation: q.explanation || '',
          steps: q.steps || [],
          slots: [{ label: `(${lbl})`, marks }],
        })
      }
    } else {
      // Whole question as one card
      const slots =
        q.slots && q.slots.length ? q.slots : [{ label: '', marks: q.marks ?? 1 }]
      cards.push({
        id: `pp::${ps}::q${q.number}`,
        type: 'image',
        marks: q.marks ?? 1,
        number: q.number,
        subPart: null,
        topic: q.topic || '',
        summary: q.summary || '',
        paperLabel: paperLabel(paper),
        qpUrls: fullQpUrls,
        msUrls,
        explanation: q.explanation || '',
        steps: q.steps || [],
        slots,
      })
    }
  }

  if (cards.length > 0) {
    // Sort by question number then sub-part label
    cards.sort((a, b) => {
      const qn = parseInt(a.number) - parseInt(b.number)
      if (qn !== 0) return qn
      return (a.subPart || '').localeCompare(b.subPart || '')
    })
    CARDS_BY_PAPER[ps] = cards
    PAPER_LIST.push({
      slug: ps,
      label: paperLabel(paper),
      deckId: `paper:${ps}`,
      cards,
    })
  }
}

PAPER_LIST.sort((a, b) => {
  if (a.label.startsWith('Specimen')) return -1
  if (b.label.startsWith('Specimen')) return 1
  return a.label.localeCompare(b.label)
})

export function getDeckCards(deckId) {
  const m = /^paper:(.+)$/.exec(deckId)
  return m ? (CARDS_BY_PAPER[m[1]] || []) : []
}

export function getPaperList() {
  return PAPER_LIST
}

export function deckTitle(deckId) {
  const m = /^paper:(.+)$/.exec(deckId)
  if (!m) return 'Past papers'
  const paper = PAPER_LIST.find((p) => p.slug === m[1])
  return paper ? `${paper.label} — Paper 1` : 'Past papers'
}
