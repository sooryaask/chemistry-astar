// The card data layer. Two offline sources, one unified card model:
//   - TEXT cards  : content/decks/{specId}.json  (bundled at build, no API key)
//   - IMAGE cards : paperIndex.json + public/rendered/*.png (real past papers)
//
// A deck is addressed by a string id:
//   topic:<topicId>:text  -> Learn & topic questions (text cards)
//   topic:<topicId>:pp    -> Past papers (image cards)
//   calc                  -> cross-cutting Calculations deck (all calc text cards)
//
// Review state (scheduling) is separate (see utils/srs.js). This module only
// describes WHAT the cards are.

import paperIndex from './paperIndex.json'
import { TOPICS, SPEC_TO_TOPIC, PP_TOPIC_TO_ID } from './topicMap.js'
import { getSpecPoint } from './spec.js'

// ---- TEXT cards: load every content/decks/{specId}.json eagerly ----
const deckModules = import.meta.glob('../../content/decks/*.json', { eager: true })

// specId -> array of unified text cards
const TEXT_BY_SPEC = {}
for (const path in deckModules) {
  const data = deckModules[path].default || deckModules[path]
  if (!data || !data.specId || !Array.isArray(data.cards)) continue
  const specId = data.specId
  const sp = getSpecPoint(specId)
  const topic = SPEC_TO_TOPIC[specId]
  TEXT_BY_SPEC[specId] = data.cards.map((c) => ({
    id: `${specId}#${c.id}`,
    type: 'text',
    specId,
    topicId: topic?.id,
    module: data.module ?? sp?.module,
    kind: c.kind || 'question', // 'recall' cards float to the front
    marks: c.marks ?? 1,
    command: c.command || '',
    context: c.context || '',
    question: c.question,
    answer: c.answer || '',
    markPoints: c.markPoints || [],
    explanation: c.explanation || '',
    calc: !!c.calc || c.command === 'Calculate',
  }))
}

// ---- IMAGE cards: build from the past-paper index ----
// "June 2017 QP - Paper 1 ... .pdf" -> "June_2017_QP"
function slug(pdfName) {
  return pdfName.split(' - ')[0].replaceAll(' ', '_')
}
function qpImageUrl(pdfName, page, number) {
  return `${import.meta.env.BASE_URL}rendered/${slug(pdfName)}_p${page}_q${number}.png`
}
function msImageUrl(pdfName, page) {
  return `${import.meta.env.BASE_URL}rendered/${slug(pdfName)}_p${page}.png`
}
function paperLabel(pdfName) {
  return pdfName.split(' QP ')[0] || pdfName
}

// topicId -> array of unified image cards
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
      msUrls: (q.msPages || []).map((p) => msImageUrl(q.msPaper, p)),
      isMcq: q.marks === 1,
    }
    ;(IMAGE_BY_TOPIC[topicId] ||= []).push(card)
  }
}

// recall cards first, then questions in file order.
function orderTextCards(cards) {
  return [...cards].sort((a, b) => {
    if (a.kind === 'recall' && b.kind !== 'recall') return -1
    if (b.kind === 'recall' && a.kind !== 'recall') return 1
    return 0
  })
}

export function topicTextCards(topicId) {
  const topic = TOPICS.find((t) => t.id === topicId)
  if (!topic) return []
  const out = []
  for (const sid of topic.specIds) out.push(...(TEXT_BY_SPEC[sid] || []))
  return orderTextCards(out)
}

export function topicImageCards(topicId) {
  return IMAGE_BY_TOPIC[topicId] || []
}

// All calculation text cards across every topic (the cross-cutting Calc deck).
export function calcCards() {
  const out = []
  for (const cards of Object.values(TEXT_BY_SPEC)) {
    for (const c of cards) if (c.calc) out.push(c)
  }
  return out
}

// Resolve a deck id to its ordered card list.
export function getDeckCards(deckId) {
  if (deckId === 'calc') return calcCards()
  const m = /^topic:([^:]+):(text|pp)$/.exec(deckId)
  if (!m) return []
  return m[2] === 'text' ? topicTextCards(m[1]) : topicImageCards(m[1])
}

// Build the deck tree for the deck-list page, grouped by module.
export function getDeckTree() {
  const byModule = {}
  for (const t of TOPICS) {
    const text = topicTextCards(t.id)
    const pp = topicImageCards(t.id)
    if (text.length === 0 && pp.length === 0) continue
    ;(byModule[t.module] ||= []).push({
      topicId: t.id,
      name: t.name,
      subdecks: [
        { deckId: `topic:${t.id}:text`, label: 'Learn & topic questions', cards: text },
        { deckId: `topic:${t.id}:pp`, label: 'Past papers', cards: pp },
      ].filter((s) => s.cards.length > 0),
    })
  }
  return byModule
}

export function deckTitle(deckId) {
  if (deckId === 'calc') return 'Calculations'
  const m = /^topic:([^:]+):(text|pp)$/.exec(deckId)
  if (!m) return 'Deck'
  const topic = TOPICS.find((t) => t.id === m[1])
  const sub = m[2] === 'text' ? 'Learn & topic questions' : 'Past papers'
  return topic ? `${topic.name} · ${sub}` : sub
}
