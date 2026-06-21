import { START_DATE, CHALLENGE_DAYS } from '../config.js'
import { getItem, setItem, KEYS, todayISO } from './localStorage.js'

// Day X of 21 (1-indexed, clamped to >= 1).
export function dayOfChallenge() {
  const start = new Date(START_DATE + 'T00:00:00')
  const now = new Date(todayISO() + 'T00:00:00')
  const diff = Math.floor((now - start) / 86400000)
  return Math.max(1, diff + 1)
}

export function challengeDaysTotal() {
  return CHALLENGE_DAYS
}

// quizAttempts is an object: { 'YYYY-MM-DD': [{ specId, totalScore, totalMax, ts }] }
export function logQuizAttempt(attempt) {
  const all = getItem(KEYS.quizAttempts, {})
  const day = todayISO()
  if (!all[day]) all[day] = []
  all[day].push({ ...attempt, ts: Date.now() })
  setItem(KEYS.quizAttempts, all)
  recomputeStreak()
  return all
}

export function attemptsToday() {
  const all = getItem(KEYS.quizAttempts, {})
  return (all[todayISO()] || []).length
}

export function allAttempts() {
  return getItem(KEYS.quizAttempts, {})
}

// Average quiz score % per day, oldest -> newest. Used by the journal chart.
export function dailyScoreAverages() {
  const all = getItem(KEYS.quizAttempts, {})
  return Object.keys(all)
    .sort()
    .map((day) => {
      const list = all[day]
      const totalScore = list.reduce((a, x) => a + (x.totalScore || 0), 0)
      const totalMax = list.reduce((a, x) => a + (x.totalMax || 0), 0)
      const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0
      return { label: day.slice(5), value: pct, day }
    })
}

// Streak: consecutive days (ending today or yesterday) with >= 1 quiz attempt.
export function recomputeStreak() {
  const all = getItem(KEYS.quizAttempts, {})
  const days = new Set(Object.keys(all).filter((d) => (all[d] || []).length > 0))
  let streak = 0
  const cursor = new Date(todayISO() + 'T00:00:00')

  // If nothing logged today, allow the streak to count up to yesterday.
  if (!days.has(isoOf(cursor))) cursor.setDate(cursor.getDate() - 1)

  while (days.has(isoOf(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  setItem(KEYS.streak, { value: streak, updated: todayISO() })
  return streak
}

export function currentStreak() {
  return recomputeStreak()
}

function isoOf(d) {
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}
