import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getItem, setItem, removeItem, KEYS, todayISO } from '../../utils/localStorage.js'

describe('getItem', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns fallback when key does not exist', () => {
    expect(getItem('nonexistent', 'default')).toBe('default')
  })

  it('returns null fallback by default', () => {
    expect(getItem('nonexistent')).toBeNull()
  })

  it('parses stored JSON correctly', () => {
    localStorage.setItem('testKey', JSON.stringify({ a: 1, b: [2, 3] }))
    expect(getItem('testKey')).toEqual({ a: 1, b: [2, 3] })
  })

  it('returns fallback on corrupted JSON', () => {
    localStorage.setItem('broken', '{not valid json')
    expect(getItem('broken', 'safe')).toBe('safe')
  })

  it('returns fallback when localStorage throws', () => {
    localStorage.getItem.mockImplementationOnce(() => {
      throw new Error('Quota exceeded')
    })
    expect(getItem('any', 'fallback')).toBe('fallback')
  })
})

describe('setItem', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores JSON-stringified value', () => {
    setItem('key1', { x: 42 })
    expect(JSON.parse(localStorage.getItem('key1'))).toEqual({ x: 42 })
  })

  it('returns true on success', () => {
    expect(setItem('key2', 'value')).toBe(true)
  })

  it('returns false when localStorage throws', () => {
    localStorage.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError')
    })
    expect(setItem('key3', 'value')).toBe(false)
  })

  it('stores arrays correctly', () => {
    setItem('arr', [1, 2, 3])
    expect(getItem('arr')).toEqual([1, 2, 3])
  })

  it('stores nested objects', () => {
    const data = { cards: { id1: { reps: 3, ease: 2.5 } } }
    setItem('nested', data)
    expect(getItem('nested')).toEqual(data)
  })
})

describe('removeItem', () => {
  it('removes a key from storage', () => {
    setItem('toRemove', 'value')
    expect(removeItem('toRemove')).toBe(true)
    expect(getItem('toRemove')).toBeNull()
  })

  it('returns false when localStorage throws', () => {
    localStorage.removeItem.mockImplementationOnce(() => {
      throw new Error('SecurityError')
    })
    expect(removeItem('key')).toBe(false)
  })
})

describe('KEYS', () => {
  it('has all expected storage keys', () => {
    const expected = [
      'specProgress', 'errorLog', 'journal', 'quizAttempts',
      'paperScores', 'streak', 'lessons', 'reviewDeck', 'srs',
      'timerLog', 'mixedPracticeHistory', 'examAttempts',
    ]
    for (const key of expected) {
      expect(KEYS[key]).toBeDefined()
      expect(typeof KEYS[key]).toBe('string')
    }
  })

  it('srs key is "srsState"', () => {
    expect(KEYS.srs).toBe('srsState')
  })
})

describe('todayISO', () => {
  it('returns a YYYY-MM-DD string', () => {
    const result = todayISO()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns today\'s date', () => {
    const d = new Date()
    const result = todayISO()
    // Should at least match the year and month
    expect(result.startsWith(String(d.getFullYear()))).toBe(true)
  })
})
