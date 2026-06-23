import { getItem, setItem, KEYS } from './localStorage.js'

const MAX_ATTEMPTS = 20

export function getExamAttempts() {
  return getItem(KEYS.examAttempts, [])
}

export function saveExamAttempt(attempt) {
  const list = getExamAttempts()
  list.push({ ...attempt, ts: Date.now() })
  // FIFO cap
  while (list.length > MAX_ATTEMPTS) list.shift()
  setItem(KEYS.examAttempts, list)
  return list
}
