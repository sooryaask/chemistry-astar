// Hidden Anki-style spaced-repetition deck for the Rapid Drill.
//
// Each missed drill question becomes a card scheduled by calendar DAY using an
// SM-2-lite algorithm (the core of Anki): cards carry an ease factor, an interval
// in whole days, and a due date. Grading recall (Again / Hard / Good) updates the
// interval and pushes the due date out. Wrong-today is never re-tested the same
// day — the first retest is the following day.
//
// The deck is hidden: nothing browses its contents; the Drill just serves due
// cards first and shows a count.

import { getItem, setItem, KEYS, todayISO } from './localStorage.js'

const DEFAULT_EASE = 2.5
const MIN_EASE = 1.3
const STEPS = [1, 3, 7] // interval (days) for the first three "Good" reps
const GRADUATE_REPS = 3 // consecutive Good answers before a card leaves the deck

export function getDeck() {
  return getItem(KEYS.reviewDeck, [])
}

function saveDeck(deck) {
  setItem(KEYS.reviewDeck, deck)
}

// Add `n` whole days to a YYYY-MM-DD string, returning YYYY-MM-DD (local time).
export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h).toString(36)
}

// Record a drill miss: create (or reset) a card due the FOLLOWING day.
export function addLapse({ specId, frequency, question, modelAnswer }) {
  const deck = getDeck()
  const id = `${specId}::${hash(question.question)}`
  const tomorrow = addDays(todayISO(), 1)
  const existing = deck.find((c) => c.id === id)
  if (existing) {
    existing.reps = 0
    existing.lapses = (existing.lapses || 0) + 1
    existing.ease = Math.max(MIN_EASE, (existing.ease || DEFAULT_EASE) - 0.2)
    existing.intervalDays = 1
    existing.due = tomorrow
    existing.modelAnswer = modelAnswer || existing.modelAnswer
  } else {
    deck.push({
      id,
      specId,
      frequency: frequency || 'LOW',
      question,
      modelAnswer: modelAnswer || '',
      reps: 0,
      lapses: 0,
      ease: DEFAULT_EASE,
      intervalDays: 1,
      due: tomorrow,
      createdAt: Date.now(),
    })
  }
  saveDeck(deck)
  return deck
}

const FREQ_RANK = { HIGH: 0, MED: 1, LOW: 2 }

// Cards due today or earlier, ordered by due date then frequency (HIGH first).
export function dueCards() {
  const today = todayISO()
  return getDeck()
    .filter((c) => c.due <= today)
    .sort((a, b) => {
      if (a.due !== b.due) return a.due < b.due ? -1 : 1
      return (FREQ_RANK[a.frequency] ?? 2) - (FREQ_RANK[b.frequency] ?? 2)
    })
}

export function dueCount() {
  return dueCards().length
}

// Distinct spec ids that have cards in the deck (used to weight new questions).
export function deckSpecIds() {
  return [...new Set(getDeck().map((c) => c.specId))]
}

// Apply an SM-2-lite grade to a card. grade: 'again' | 'hard' | 'good'.
// Returns the updated deck. Graduates (removes) a card after GRADUATE_REPS Goods.
export function gradeCard(id, grade) {
  const deck = getDeck()
  const card = deck.find((c) => c.id === id)
  if (!card) return deck
  const today = todayISO()

  if (grade === 'again') {
    card.reps = 0
    card.lapses = (card.lapses || 0) + 1
    card.ease = Math.max(MIN_EASE, card.ease - 0.2)
    card.intervalDays = 1
    card.due = addDays(today, 1)
  } else if (grade === 'hard') {
    card.ease = Math.max(MIN_EASE, card.ease - 0.15)
    card.intervalDays = Math.max(1, Math.round(card.intervalDays * 1.2))
    card.due = addDays(today, card.intervalDays)
  } else {
    // good
    card.reps += 1
    if (card.reps >= GRADUATE_REPS) {
      // Well-known — graduate it out of the hidden deck.
      saveDeck(deck.filter((c) => c.id !== id))
      return getDeck()
    }
    card.intervalDays =
      card.reps <= STEPS.length
        ? STEPS[card.reps - 1]
        : Math.round(card.intervalDays * card.ease)
    card.due = addDays(today, card.intervalDays)
  }

  saveDeck(deck)
  return deck
}

// Map a markFlashcard result to an SM-2 grade.
export function gradeFromResult(score, maxScore) {
  if (!score || score <= 0) return 'again'
  if (score >= maxScore) return 'good'
  return 'hard'
}
