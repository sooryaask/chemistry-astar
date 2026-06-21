import { getItem, setItem, KEYS } from './localStorage.js'
import { getSpecPoint } from '../data/spec.js'

const DAY = 86400000

// Spaced-repetition interval (ms) until the next review, based on correct streak.
// streak 0 -> 1 day, 1 -> 3 days, 2 -> 7 days, 3+ -> 14 days.
function intervalFor(streak) {
  if (streak >= 3) return 14 * DAY
  if (streak === 2) return 7 * DAY
  if (streak === 1) return 3 * DAY
  return DAY
}

export function getErrors() {
  return getItem(KEYS.errorLog, [])
}

export function saveErrors(list) {
  setItem(KEYS.errorLog, list)
}

// Add (or refresh) an error-log item for a missed question.
export function addError({
  specId,
  question,
  context,
  marks,
  command,
  userAnswer,
  modelAnswer,
  frequency,
}) {
  const list = getErrors()
  const sp = getSpecPoint(specId)
  const id = `${specId}::${hash(question)}`
  const existing = list.find((e) => e.id === id)
  if (existing) {
    existing.userAnswer = userAnswer
    existing.modelAnswer = modelAnswer
    existing.missCount = (existing.missCount || 1) + 1
    existing.streak = 0
    existing.passed = false
    existing.timestamp = Date.now()
    existing.nextDue = Date.now() + intervalFor(0)
  } else {
    list.push({
      id,
      specId,
      module: sp ? sp.module : 0,
      question,
      context: context || '',
      marks: marks || 3,
      command: command || 'Explain',
      userAnswer,
      modelAnswer,
      frequency: frequency || (sp ? sp.frequency : 'LOW'),
      missCount: 1,
      streak: 0,
      passed: false,
      timestamp: Date.now(),
      nextDue: Date.now() + intervalFor(0),
    })
  }
  saveErrors(list)
  return list
}

// Record a re-quiz result: pass decrements miss count and builds streak; fail
// increments miss count and resets streak.
export function recordRequiz(id, passed) {
  const list = getErrors()
  const item = list.find((e) => e.id === id)
  if (!item) return list
  item.passed = passed
  item.timestamp = Date.now()
  if (passed) {
    item.streak = (item.streak || 0) + 1
    item.missCount = Math.max(0, (item.missCount || 1) - 1)
  } else {
    item.streak = 0
    item.missCount = (item.missCount || 0) + 1
  }
  item.nextDue = Date.now() + intervalFor(item.streak)
  saveErrors(list)
  return list
}

export function removeError(id) {
  const list = getErrors().filter((e) => e.id !== id)
  saveErrors(list)
  return list
}

// Items due for spaced-repetition review now (nextDue elapsed). Older items
// without a nextDue fall back to the legacy "24h since last attempt" rule.
export function errorsDue() {
  const now = Date.now()
  return getErrors().filter((e) =>
    typeof e.nextDue === 'number' ? e.nextDue <= now : e.timestamp < now - DAY
  )
}

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h).toString(36)
}
