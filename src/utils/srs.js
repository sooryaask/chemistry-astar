// Generic Anki-style spaced repetition, keyed by card id. Day-grained SM-2-lite:
// each card carries an ease factor, an interval in whole days, and a due date.
// Unlike the old hidden review deck, cards are NEVER removed — they keep cycling
// with growing intervals, so every deck is a permanent study surface.
//
// State lives in localStorage under KEYS.srs as { [cardId]: cardState }.
// A card with no state is "new". Grades: 'again' | 'hard' | 'good' | 'easy'.

import { getItem, setItem, KEYS, todayISO } from './localStorage.js'

const DEFAULT_EASE = 2.5
const MIN_EASE = 1.3
const STEPS = [1, 3] // day intervals for the first "good" reps before ease kicks in

// New cards introduced per deck per day, so a from-zero learner isn't buried.
export const NEW_PER_DAY = 20

export function getState() {
  return getItem(KEYS.srs, {})
}

function saveState(state) {
  setItem(KEYS.srs, state)
}

// Add `n` whole days to a YYYY-MM-DD string (local time).
export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

// Classify a single card given its stored state (or undefined for new).
// Returns 'new' | 'learning' | 'review' | 'suspended' | 'future'.
export function classify(cardState, today = todayISO()) {
  if (!cardState) return 'new'
  if (cardState.suspended) return 'suspended'
  if (cardState.due > today) return 'future'
  // due today or earlier
  return cardState.reps >= STEPS.length ? 'review' : 'learning'
}

// Apply a grade to a card id and persist. Returns the new card state.
export function grade(cardId, g, today = todayISO()) {
  const state = getState()
  const card = state[cardId] || {
    reps: 0,
    lapses: 0,
    ease: DEFAULT_EASE,
    intervalDays: 0,
    due: today,
    createdAt: Date.now(),
  }

  if (g === 'again') {
    card.lapses += 1
    card.reps = 0
    card.ease = Math.max(MIN_EASE, card.ease - 0.2)
    card.intervalDays = 0
    card.due = today // stays in today's queue
  } else if (g === 'hard') {
    card.ease = Math.max(MIN_EASE, card.ease - 0.15)
    card.intervalDays = Math.max(1, Math.round((card.intervalDays || 1) * 1.2))
    card.due = addDays(today, card.intervalDays)
  } else {
    // good / easy
    card.reps += 1
    const base =
      card.reps <= STEPS.length
        ? STEPS[card.reps - 1]
        : Math.round((card.intervalDays || 1) * card.ease)
    card.intervalDays = g === 'easy' ? Math.max(base + 1, Math.round(base * 1.3)) : base
    if (g === 'easy') card.ease = card.ease + 0.15
    card.due = addDays(today, card.intervalDays)
  }

  state[cardId] = card
  saveState(state)
  return card
}

export function setSuspended(cardId, suspended, today = todayISO()) {
  const state = getState()
  const card = state[cardId] || {
    reps: 0, lapses: 0, ease: DEFAULT_EASE, intervalDays: 0, due: today, createdAt: Date.now(),
  }
  card.suspended = !!suspended
  state[cardId] = card
  saveState(state)
}

export function resetCard(cardId) {
  const state = getState()
  delete state[cardId]
  saveState(state)
}

// Given the full ordered card list for a deck, return today's session counts and
// the queue to study. New cards are capped at NEW_PER_DAY. Order: due review/
// learning cards first (most overdue first), then up to the new-card cap.
export function buildSession(cards, today = todayISO()) {
  const state = getState()
  const due = []
  let newCount = 0
  let learningCount = 0
  let reviewCount = 0

  const newCards = []
  for (const card of cards) {
    const cs = state[card.id]
    const kind = classify(cs, today)
    if (kind === 'suspended' || kind === 'future') continue
    if (kind === 'new') {
      newCount += 1
      if (newCards.length < NEW_PER_DAY) newCards.push(card)
    } else if (kind === 'learning') {
      learningCount += 1
      due.push({ card, due: cs.due })
    } else if (kind === 'review') {
      reviewCount += 1
      due.push({ card, due: cs.due })
    }
  }

  due.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0))
  const queue = [...due.map((d) => d.card), ...newCards]

  return {
    queue,
    counts: {
      new: Math.min(newCount, NEW_PER_DAY),
      learning: learningCount,
      review: reviewCount,
      total: cards.length,
    },
  }
}

// Lightweight counts for a deck (for the deck list) without building the queue.
export function deckCounts(cards, today = todayISO()) {
  return buildSession(cards, today).counts
}
