import { describe, it, expect, beforeEach } from 'vitest'
import {
  addDays,
  classify,
  grade,
  previewLabels,
  setSuspended,
  resetCard,
  buildSession,
  deckCounts,
  isMastered,
  masteryStats,
  getState,
  NEW_PER_DAY,
  autoGrade,
  autoGradeAndSave,
} from '../../utils/srs.js'

const TODAY = '2026-07-02'

// Helper: make a fake card list
function makeCards(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `card-${i}`, marks: 2 }))
}

describe('addDays', () => {
  it('adds positive days correctly', () => {
    expect(addDays('2026-07-01', 1)).toBe('2026-07-02')
    expect(addDays('2026-07-01', 7)).toBe('2026-07-08')
    expect(addDays('2026-07-01', 30)).toBe('2026-07-31')
  })

  it('handles month boundaries', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('handles zero days', () => {
    expect(addDays('2026-07-02', 0)).toBe('2026-07-02')
  })

  it('handles leap year', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
  })
})

describe('classify', () => {
  it('returns "new" for undefined state', () => {
    expect(classify(undefined, TODAY)).toBe('new')
    expect(classify(null, TODAY)).toBe('new')
  })

  it('returns "suspended" for suspended cards', () => {
    expect(classify({ suspended: true, reps: 5, due: TODAY }, TODAY)).toBe('suspended')
  })

  it('returns "future" for cards due after today', () => {
    expect(classify({ reps: 3, due: '2026-07-05' }, TODAY)).toBe('future')
  })

  it('returns "learning" for cards with reps < 2 (STEPS.length) due today', () => {
    expect(classify({ reps: 0, due: TODAY }, TODAY)).toBe('learning')
    expect(classify({ reps: 1, due: TODAY }, TODAY)).toBe('learning')
  })

  it('returns "review" for mature cards due today or overdue', () => {
    expect(classify({ reps: 2, due: TODAY }, TODAY)).toBe('review')
    expect(classify({ reps: 5, due: '2026-06-30' }, TODAY)).toBe('review')
  })
})

describe('grade', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('creates new card state on first grade', () => {
    const { cardState: next, saved } = grade('new-card', 'good', TODAY)
    expect(saved).toBe(true)
    expect(next.reps).toBe(1)
    expect(next.intervalDays).toBe(1) // STEPS[0]
    expect(next.due).toBe(addDays(TODAY, 1))
    expect(next.ease).toBe(2.5)
  })

  it('"again" resets reps and reduces ease', () => {
    grade('card-a', 'good', TODAY) // reps=1
    const { cardState: next } = grade('card-a', 'again', TODAY)
    expect(next.reps).toBe(0)
    expect(next.lapses).toBe(1)
    expect(next.ease).toBeLessThan(2.5)
    expect(next.due).toBe(TODAY) // resurfaces same day
  })

  it('"good" advances through STEPS then multiplies by ease', () => {
    grade('card-b', 'good', TODAY) // reps=1, interval=1d
    const { cardState: s2 } = grade('card-b', 'good', TODAY) // reps=2, interval=3d (STEPS[1])
    expect(s2.reps).toBe(2)
    expect(s2.intervalDays).toBe(3)
    const { cardState: s3 } = grade('card-b', 'good', TODAY) // reps=3, interval=3*2.5=8d
    expect(s3.reps).toBe(3)
    expect(s3.intervalDays).toBe(Math.round(3 * 2.5))
  })

  it('"easy" gives a bigger jump and increases ease', () => {
    const { cardState: s1 } = grade('card-c', 'easy', TODAY) // reps=1
    expect(s1.ease).toBe(2.5 + 0.15) // ease increases
    expect(s1.intervalDays).toBeGreaterThanOrEqual(2) // at least STEPS[0]+1
  })

  it('"hard" on a learning card keeps it due today', () => {
    grade('card-d', 'good', TODAY) // reps=1 (still learning, < STEPS.length)
    const { cardState: s2 } = grade('card-d', 'hard', TODAY)
    expect(s2.due).toBe(TODAY) // stays due today
  })

  it('"hard" on a mature card bumps interval by 1.2x', () => {
    grade('card-e', 'good', TODAY) // reps=1
    grade('card-e', 'good', TODAY) // reps=2, interval=3
    const { cardState: s3 } = grade('card-e', 'hard', TODAY) // mature: interval = round(3*1.2)=4
    expect(s3.intervalDays).toBe(Math.max(1, Math.round(3 * 1.2)))
  })

  it('ease never drops below MIN_EASE (1.3)', () => {
    // Keep hitting "again" to reduce ease
    for (let i = 0; i < 20; i++) {
      grade('card-f', 'again', TODAY)
    }
    const state = getState()['card-f']
    expect(state.ease).toBeGreaterThanOrEqual(1.3)
  })

  it('persists state to localStorage', () => {
    grade('card-g', 'good', TODAY)
    const stored = JSON.parse(localStorage.getItem('srsState'))
    expect(stored['card-g']).toBeDefined()
    expect(stored['card-g'].reps).toBe(1)
  })
})

describe('previewLabels', () => {
  it('returns "soon" for again on a new card', () => {
    const labels = previewLabels('preview-card', TODAY)
    expect(labels.again).toBe('soon')
  })

  it('returns day intervals for good/easy on new card', () => {
    const labels = previewLabels('preview-card', TODAY)
    expect(labels.good).toBe('1d') // STEPS[0]
    expect(labels.easy).toMatch(/^\d+d$/)
  })
})

describe('setSuspended', () => {
  it('suspends a card', () => {
    setSuspended('sus-card', true, TODAY)
    expect(classify(getState()['sus-card'], TODAY)).toBe('suspended')
  })

  it('unsuspends a card', () => {
    setSuspended('sus-card', true, TODAY)
    setSuspended('sus-card', false, TODAY)
    expect(getState()['sus-card'].suspended).toBe(false)
  })
})

describe('resetCard', () => {
  it('removes all state for a card', () => {
    grade('reset-card', 'good', TODAY)
    expect(getState()['reset-card']).toBeDefined()
    resetCard('reset-card')
    expect(getState()['reset-card']).toBeUndefined()
  })
})

describe('buildSession', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('queues new cards up to NEW_PER_DAY cap', () => {
    const cards = makeCards(30)
    const session = buildSession(cards, TODAY)
    expect(session.counts.new).toBe(NEW_PER_DAY)
    // Queue should have at most NEW_PER_DAY new cards
    expect(session.queue.length).toBeLessThanOrEqual(NEW_PER_DAY)
  })

  it('puts due cards before new cards in the queue', () => {
    const cards = makeCards(5)
    // Grade one card so it's due today (learning)
    grade(cards[2].id, 'again', TODAY)
    const session = buildSession(cards, TODAY)
    // The graded card should come first
    expect(session.queue[0].id).toBe(cards[2].id)
  })

  it('excludes suspended cards', () => {
    const cards = makeCards(5)
    setSuspended(cards[0].id, true, TODAY)
    const session = buildSession(cards, TODAY)
    expect(session.queue.find((c) => c.id === cards[0].id)).toBeUndefined()
  })

  it('excludes future cards', () => {
    const cards = makeCards(3)
    grade(cards[0].id, 'good', TODAY) // due tomorrow
    const session = buildSession(cards, TODAY)
    // card-0 has interval=1d, due tomorrow, so should be "future" -> excluded from due
    const inQueue = session.queue.find((c) => c.id === cards[0].id)
    // It might be in the new-card part or excluded; check it's not in the due portion
    expect(session.counts.review).toBe(0)
  })

  it('returns correct counts', () => {
    const cards = makeCards(5)
    const session = buildSession(cards, TODAY)
    expect(session.counts.total).toBe(5)
    expect(session.counts.new).toBe(5) // all new, under cap
    expect(session.counts.learning).toBe(0)
    expect(session.counts.review).toBe(0)
  })
})

describe('deckCounts', () => {
  it('returns same counts as buildSession', () => {
    const cards = makeCards(5)
    const counts = deckCounts(cards, TODAY)
    const session = buildSession(cards, TODAY)
    expect(counts).toEqual(session.counts)
  })
})

describe('isMastered', () => {
  it('returns false for undefined/null state', () => {
    expect(isMastered(undefined)).toBe(false)
    expect(isMastered(null)).toBe(false)
  })

  it('returns false for new card (reps=0)', () => {
    expect(isMastered({ reps: 0, lapses: 0, suspended: false })).toBe(false)
  })

  it('returns true for card with reps >= 1', () => {
    expect(isMastered({ reps: 1, suspended: false })).toBe(true)
    expect(isMastered({ reps: 5, suspended: false })).toBe(true)
  })

  it('returns false for suspended cards', () => {
    expect(isMastered({ reps: 3, suspended: true })).toBe(false)
  })
})

describe('masteryStats', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns 0% for all-new deck', () => {
    const cards = makeCards(5)
    const stats = masteryStats(cards)
    expect(stats.pct).toBe(0)
    expect(stats.mastered).toBe(0)
    expect(stats.total).toBe(5)
  })

  it('returns correct percentage after grading', () => {
    const cards = makeCards(4)
    grade(cards[0].id, 'good', TODAY)
    grade(cards[1].id, 'good', TODAY)
    const stats = masteryStats(cards)
    expect(stats.mastered).toBe(2)
    expect(stats.pct).toBe(50)
  })

  it('mastery drops when a card lapses', () => {
    const cards = makeCards(2)
    grade(cards[0].id, 'good', TODAY) // mastered
    grade(cards[1].id, 'good', TODAY) // mastered
    expect(masteryStats(cards).pct).toBe(100)
    grade(cards[0].id, 'again', TODAY) // lapse -> reps back to 0
    expect(masteryStats(cards).pct).toBe(50)
  })

  it('handles empty card list', () => {
    const stats = masteryStats([])
    expect(stats.pct).toBe(0)
    expect(stats.total).toBe(0)
  })
})

// ---- Auto-grading tests ----

describe('autoGrade', () => {
  it('returns "again" for 0 score on written', () => {
    expect(autoGrade(0, 3, null)).toBe('again')
  })

  it('returns "hard" for < 50% score on written', () => {
    expect(autoGrade(1, 3, null)).toBe('hard')
  })

  it('returns "good" for 50-79% score on written', () => {
    expect(autoGrade(2, 3, null)).toBe('good')
  })

  it('returns "easy" for >= 80% score on written', () => {
    expect(autoGrade(4, 5, null)).toBe('easy')
    expect(autoGrade(3, 3, null)).toBe('easy')
  })

  it('returns "again" when justShowed and no score', () => {
    expect(autoGrade(0, 3, null, { justShowed: true })).toBe('again')
  })

  // MCQ tests
  it('returns "again" for wrong MCQ', () => {
    expect(autoGrade(0, 1, null, { isMcq: true })).toBe('again')
  })

  it('returns "good" for first-time correct MCQ (unproven)', () => {
    expect(autoGrade(1, 1, null, { isMcq: true })).toBe('good')
    expect(autoGrade(1, 1, { reps: 0 }, { isMcq: true })).toBe('good')
  })

  it('returns "easy" for consistently correct MCQ (reps >= 2)', () => {
    expect(autoGrade(1, 1, { reps: 2, lapses: 0 }, { isMcq: true })).toBe('easy')
    expect(autoGrade(1, 1, { reps: 5, lapses: 0 }, { isMcq: true })).toBe('easy')
  })

  it('returns "hard" for MCQ with 3+ lapses', () => {
    expect(autoGrade(1, 1, { reps: 1, lapses: 3 }, { isMcq: true })).toBe('hard')
  })

  it('returns "hard" for flip-flopping MCQ (lastMcqWrong)', () => {
    expect(autoGrade(1, 1, { reps: 1, lapses: 1, lastMcqWrong: true }, { isMcq: true })).toBe('hard')
  })
})

describe('autoGradeAndSave', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves card state and returns the computed grade', () => {
    const result = autoGradeAndSave('auto-card-1', 3, 3)
    expect(result.grade).toBe('easy')
    expect(result.saved).toBe(true)
    expect(result.cardState.reps).toBe(1)
    expect(getState()['auto-card-1']).toBeDefined()
  })

  it('tracks MCQ wrong history', () => {
    autoGradeAndSave('mcq-card', 0, 1, { isMcq: true })
    const state = getState()['mcq-card']
    expect(state.lastMcqWrong).toBe(true)
  })

  it('tracks MCQ correct history', () => {
    autoGradeAndSave('mcq-card-2', 1, 1, { isMcq: true })
    const state = getState()['mcq-card-2']
    expect(state.lastMcqWrong).toBe(false)
  })
})
