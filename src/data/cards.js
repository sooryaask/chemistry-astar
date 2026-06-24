// The card data layer — PAST PAPERS ONLY.
//
// Every card is a real OCR past-paper question (cropped QP image) and reveals the
// OFFICIAL mark scheme cropped to that exact question, including its sub-parts.
// Source: paperIndex.json + public/rendered/*.png (the rendered/ folder is a
// symlink to smartmark/rendered). No authored answers; no API key.
//
// Deck ids:
//   topic:<topicId>:pp  -> a topic's past-paper questions
//   calc                -> cross-cutting Calculations deck (calc questions only)

import paperIndex from './paperIndex.json'
import { TOPICS, PP_TOPIC_TO_ID } from './topicMap.js'

// "June 2017 QP - Paper 1 ... .pdf" -> "June_2017_QP"
function slug(pdfName) {
  return pdfName.split(' - ')[0].replaceAll(' ', '_')
}
function qpImageUrl(pdfName, page, number) {
  return `${import.meta.env.BASE_URL}rendered/${slug(pdfName)}_p${page}_q${number}.png`
}
function renderedUrl(filename) {
  return `${import.meta.env.BASE_URL}rendered/${filename}`
}
// Per-question mark-scheme crop (rendered by smartmark/render_ms_crops.py).
function msCropUrl(pdfName, page, number) {
  return `${import.meta.env.BASE_URL}rendered/${slug(pdfName)}_p${page}_q${number}.png`
}
function paperLabel(pdfName) {
  return pdfName.split(' QP ')[0] || pdfName
}

// Which questions count as "calculations" for the cross-cutting deck.
const CALC_TOPICS = new Set([
  'Amount of Substance (Moles)',
  'Enthalpy & Energetics',
  'Equilibrium',
])
const CALC_RE = /calculat|\bmole|concentration|enthalp|yield|atom econ|empirical|titrat|uncertaint|percentage|\bKc\b|volume|reacting mass|relative atomic mass|moles/i
function isCalc(topic, summary) {
  return CALC_TOPICS.has(topic) || CALC_RE.test(summary || '')
}

// topicId -> ordered array of unified image cards
const IMAGE_BY_TOPIC = {}
for (const [paper, data] of Object.entries(paperIndex)) {
  for (const q of data.questions || []) {
    const topicId = PP_TOPIC_TO_ID[q.topic]
    if (!topicId) continue
    const card = {
      id: `pp::${slug(paper)}::p${q.page}q${q.number}`,
      type: 'image',
      topicId,
      module: TOPICS.find((t) => t.id === topicId)?.module,
      marks: q.marks ?? 1,
      number: q.number,
      summary: q.summary || '',
      paperLabel: paperLabel(paper),
      qpUrl: qpImageUrl(paper, q.page, q.number),
      // Mark scheme cropped to ONLY the sub-parts visible on the shown QP page
      // (msShownImgs is the precise, roman-aware list, with mid-page cut crops).
      msUrls:
        q.msShownImgs && q.msShownImgs.length
          ? q.msShownImgs.map(renderedUrl)
          : (q.msShow || q.msPages || []).map((p) => msCropUrl(q.msPaper, p, q.number)),
      isMcq: q.marks === 1,
      calc: isCalc(q.topic, q.summary),
      explanation: q.explanation || '',
      steps: q.steps || [],
      // one answer box per sub-part shown on the question page
      slots: q.slots && q.slots.length ? q.slots : [{ label: '', marks: q.marks ?? 1 }],
    }
    ;(IMAGE_BY_TOPIC[topicId] ||= []).push(card)
  }
}

export function topicCards(topicId) {
  return IMAGE_BY_TOPIC[topicId] || []
}

// All calculation questions across every topic (the cross-cutting Calc deck).
export function calcCards() {
  const out = []
  for (const cards of Object.values(IMAGE_BY_TOPIC)) {
    for (const c of cards) if (c.calc) out.push(c)
  }
  return out
}

export function getDeckCards(deckId) {
  if (deckId === 'calc') return calcCards()
  const m = /^topic:([^:]+):pp$/.exec(deckId)
  return m ? topicCards(m[1]) : []
}

// Deck tree for the deck list, grouped by module. One past-paper deck per topic.
export function getDeckTree() {
  const byModule = {}
  for (const t of TOPICS) {
    const cards = topicCards(t.id)
    if (cards.length === 0) continue
    ;(byModule[t.module] ||= []).push({
      topicId: t.id,
      name: t.name,
      deckId: `topic:${t.id}:pp`,
      cards,
    })
  }
  return byModule
}

export function deckTitle(deckId) {
  if (deckId === 'calc') return 'Calculations'
  const m = /^topic:([^:]+):pp$/.exec(deckId)
  const topic = m && TOPICS.find((t) => t.id === m[1])
  return topic ? topic.name : 'Past papers'
}
