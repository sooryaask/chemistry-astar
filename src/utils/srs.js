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

// Pure: compute the next card state for a grade, without saving.
// - again: relearn from scratch — due today (resurfaces this session)
// - hard:  while still learning (reps < STEPS), repeat the step — due today
//          (resurfaces this session); once mature, a small day-level bump
// - good:  advance through 1d, 3d, then ease-multiplied intervals
// - easy:  a bigger jump than good, and the card gets easier
function computeNext(prev, g, today) {
  const card = prev
    ? { ...prev }
    : { reps: 0, lapses: 0, ease: DEFAULT_EASE, intervalDays: 0, due: today, createdAt: Date.now() }

  if (g === 'again') {
    card.lapses += 1
    card.reps = 0
    card.ease = Math.max(MIN_EASE, card.ease - 0.2)
    card.intervalDays = 0
    card.due = today
  } else if (g === 'hard') {
    card.ease = Math.max(MIN_EASE, card.ease - 0.15)
    if (card.reps < STEPS.length) {
      card.intervalDays = 0
      card.due = today
    } else {
      card.intervalDays = Math.max(1, Math.round((card.intervalDays || 1) * 1.2))
      card.due = addDays(today, card.intervalDays)
    }
  } else if (g === 'good') {
    card.reps += 1
    card.intervalDays =
      card.reps <= STEPS.length ? STEPS[card.reps - 1] : Math.round((card.intervalDays || 1) * card.ease)
    card.due = addDays(today, card.intervalDays)
  } else {
    // easy
    card.reps += 1
    const base =
      card.reps <= STEPS.length ? STEPS[card.reps - 1] : Math.round((card.intervalDays || 1) * card.ease)
    card.intervalDays = Math.max(base + 1, Math.round(base * 1.4))
    card.ease = card.ease + 0.15
    card.due = addDays(today, card.intervalDays)
  }
  return card
}

// Apply a grade to a card id and persist. Returns the new card state.
export function grade(cardId, g, today = todayISO()) {
  const state = getState()
  const next = computeNext(state[cardId], g, today)
  state[cardId] = next
  saveState(state)
  return next
}

// Human-readable "next interval" for each grade button (e.g. "soon", "1d", "8d").
export function previewLabels(cardId, today = todayISO()) {
  const prev = getState()[cardId]
  const fmt = (c) => (c.intervalDays <= 0 ? 'soon' : `${c.intervalDays}d`)
  return {
    again: fmt(computeNext(prev, 'again', today)),
    hard: fmt(computeNext(prev, 'hard', today)),
    good: fmt(computeNext(prev, 'good', today)),
    easy: fmt(computeNext(prev, 'easy', today)),
  }
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
