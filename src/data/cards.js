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
    if (q.marks <= 1) {
      // Multiple-choice question — one card per MCQ, using its own per-question
      // crop so only a single MCQ appears on the card.
      const msUrls =
        q.msShownImgs && q.msShownImgs.length
          ? q.msShownImgs.map(renderedUrl)
          : (q.msShow || q.msPages || []).map((p) => msCropUrl(q.msPaper, p, q.number))
      // The correct letter lives in the explanation steps' "Answer: X" line
      // (sometimes phrased "Answer: ... → X") — take the last standalone A-D.
      let correctOption = null
      for (const s of q.steps || []) {
        if (!/\bAnswer\b/i.test(s)) continue
        const ms = [...s.matchAll(/(?:^|[\s:(→\u2013\u2014-])([A-D])(?=[\s).,]|$)/g)]
        if (ms.length) correctOption = ms[ms.length - 1][1]
      }
      cards.push({
        id: `pp::${ps}::q${q.number}`,
        type: 'mcq',
        isMcq: true,
        marks: 1,
        number: q.number,
        subPart: null,
        topic: q.topic || '',
        summary: q.summary || '',
        paperLabel: paperLabel(paper),
        qpUrls: [renderedUrl(`${ps}_p${q.page}_q${q.number}.png`)],
        msUrls,
        correctOption,
        explanation: q.explanation || '',
        steps: q.steps || [],
        slots: [{ label: '', marks: 1 }],
      })
      continue
    }
    if (q.isCalculation) continue        // skip calculation questions
    if (q.isDiagram) continue            // skip diagram-only questions (draw, label, sketch)

    // Whole-question mark scheme (fallback when a part has no per-part crop)
    const wholeMsUrls =
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

    if (q.subPartImgs && Object.keys(q.subPartImgs).length >= 1) {
      // One card per sub-part — each with its OWN cropped mark scheme so the
      // student only sees the answer to the part they just attempted.
      const calcParts = new Set(q.calcSubParts || [])
      const diagramParts = new Set(q.diagramSubParts || [])
      for (const [lbl, fnames] of Object.entries(q.subPartImgs)) {
        if (calcParts.has(lbl)) continue  // skip calculation sub-parts
        if (diagramParts.has(lbl)) continue  // skip diagram sub-parts (draw, label, sketch)
        // One answer box per roman sub-sub-part ((i),(ii),(iii)…) when the part
        // has them and can't be split further (shared table/context); otherwise
        // a single box for the whole part.
        const partSlots =
          q.subPartSlots && q.subPartSlots[lbl] && q.subPartSlots[lbl].length
            ? q.subPartSlots[lbl]
            : [{ label: '', marks: (q.subPartMarks && q.subPartMarks[lbl]) || marksByLetter[lbl] || 1 }]
        const marks = partSlots.reduce((s, sl) => s + (sl.marks || 0), 0)
        const partMs = q.msSubPartImgs && q.msSubPartImgs[lbl]
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
          msUrls: partMs && partMs.length ? partMs.map(renderedUrl) : wholeMsUrls,
          explanation: q.explanation || '',
          steps: q.steps || [],
          slots: partSlots,
        })
      }
    } else {
      // Whole question as one card — filter out diagram/calc slots
      const diagramParts = new Set(q.diagramSubParts || [])
      const calcParts = new Set(q.calcSubParts || [])
      const skipPart = (label) => {
        const m = /^\(?\s*([a-f])\b/.exec((label || '').trim().toLowerCase())
        return m && (diagramParts.has(m[1]) || calcParts.has(m[1]))
      }
      const rawSlots =
        q.slots && q.slots.length ? q.slots : [{ label: '', marks: q.marks ?? 1 }]
      const slots = rawSlots.filter((s) => !skipPart(s.label))
      if (slots.length === 0) continue  // all slots are diagram/calc
      const marks = slots.reduce((s, sl) => s + (sl.marks || 0), 0)
      cards.push({
        id: `pp::${ps}::q${q.number}`,
        type: 'image',
        marks,
        number: q.number,
        subPart: null,
        topic: q.topic || '',
        summary: q.summary || '',
        paperLabel: paperLabel(paper),
        qpUrls: fullQpUrls,
        msUrls: wholeMsUrls,
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
PAPER_LIST.forEach((p) => { p.title = `${p.label} — Paper 1` })

// ---- AI-generated questions deck (text cards, no images) ----
// Brand-new spec-following questions authored into src/data/aiQuestions/*.json.
// Each file is an array of question objects; MCQs check locally, written
// questions carry their own markPoints for ticking / text-based AI marking.
const aiFiles = import.meta.glob('./aiQuestions/*.json', { eager: true })
// Interleave cards round-robin across topic files so the NEW_PER_DAY cap
// draws from every topic, not just the first alphabetically (acids_bases).
const aiFileArrays = Object.keys(aiFiles).sort().map((f) => aiFiles[f].default || [])
const aiInterleaved = []
const maxLen = Math.max(0, ...aiFileArrays.map((a) => a.length))
for (let i = 0; i < maxLen; i++) {
  for (const arr of aiFileArrays) {
    if (i < arr.length) aiInterleaved.push(arr[i])
  }
}
const AI_CARDS = aiInterleaved
  .map((q, i) => ({
    id: `ai::${q.id}`,
    type: q.type,
    isMcq: q.type === 'mcq',
    isText: true,
    marks: q.type === 'mcq' ? 1 : q.marks || 1,
    module: q.module || null,
    number: i + 1,
    subPart: null,
    topic: q.topic || '',
    summary: q.specRef || '',
    paperLabel: 'AI Generated',
    question: q.question || '',
    options: q.options || null,
    correctOption: q.correctOption || null,
    markPoints: q.markPoints || [],
    modelAnswer: q.modelAnswer || '',
    explanation: q.explanation || '',
    steps: q.steps || [],
    qpUrls: [],
    msUrls: [],
    slots: [{ label: '', marks: q.type === 'mcq' ? 1 : q.marks || 1 }],
  }))

const AI_DECK = AI_CARDS.length > 0
  ? {
      slug: 'ai_generated',
      label: 'AI Generated questions',
      title: 'AI Generated questions',
      deckId: 'ai:generated',
      cards: AI_CARDS,
    }
  : null

const DECK_LIST = AI_DECK ? [...PAPER_LIST, AI_DECK] : PAPER_LIST

// Metadata for the AI filter UI — computed once at module load
export const AI_TOPICS = [...new Set(AI_CARDS.map((c) => c.topic))].filter(Boolean).sort()
export const AI_MODULES = [...new Set(AI_CARDS.map((c) => c.module))].filter(Boolean).sort((a, b) => a - b)
export const AI_TOTAL = AI_CARDS.length

// Shuffle AI MCQ options so memorising the letter "B" doesn't help.
// Returns { options: {A,B,C,D}, correctOption, shuffleMap } with the original
// answers redistributed to new random letters. Uses Fisher-Yates.
export function shuffleMcqOptions(card) {
  if (!card.options || !card.correctOption) return card
  const keys = ['A', 'B', 'C', 'D']
  const entries = keys.map((k) => [k, card.options[k]])
  // Fisher-Yates shuffle
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[entries[i], entries[j]] = [entries[j], entries[i]]
  }
  const newOptions = {}
  let newCorrect = card.correctOption
  for (let i = 0; i < keys.length; i++) {
    newOptions[keys[i]] = entries[i][1]
    if (entries[i][0] === card.correctOption) newCorrect = keys[i]
  }
  return { options: newOptions, correctOption: newCorrect }
}

export function getDeckCards(deckId) {
  if (deckId === 'ai:generated') return AI_CARDS
  const m = /^paper:(.+)$/.exec(deckId)
  return m ? (CARDS_BY_PAPER[m[1]] || []) : []
}

export function getPaperList() {
  return DECK_LIST
}

export function deckTitle(deckId) {
  const deck = DECK_LIST.find((p) => p.deckId === deckId)
  return deck ? deck.title : 'Past papers'
}
