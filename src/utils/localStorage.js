// Safe localStorage wrappers. Storage can throw (private mode, quota, disabled),
// so every access is wrapped in try/catch and degrades gracefully.

export function getItem(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch (err) {
    console.warn(`localStorage.getItem("${key}") failed:`, err)
    return fallback
  }
}

export function setItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (err) {
    console.warn(`localStorage.setItem("${key}") failed:`, err)
    return false
  }
}

export function removeItem(key) {
  try {
    localStorage.removeItem(key)
    return true
  } catch (err) {
    console.warn(`localStorage.removeItem("${key}") failed:`, err)
    return false
  }
}

// localStorage keys used across the app.
export const KEYS = {
  specProgress: 'specProgress',
  errorLog: 'errorLog',
  journal: 'journal',
  quizAttempts: 'quizAttempts',
  paperScores: 'paperScores',
  streak: 'streakState',
  lessons: 'lessons',
  reviewDeck: 'reviewDeck',
  timerLog: 'timerLog',
}

// Today's date as a YYYY-MM-DD string in local time.
export function todayISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}
