import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock config.js
vi.mock('../../config.js', () => ({
  MODEL: 'claude-sonnet-4-6',
  FAST_MODEL: 'claude-haiku-4-5',
}))

const { SYSTEM_PROMPT } = await import('../../api/anthropic.js')

// Helper to mock fetch with a successful Claude API response
function mockFetch(responseText) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        content: [{ text: responseText }],
      }),
  })
}

// Helper to mock fetch with an error response
function mockFetchError(status, message) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error: { message } }),
  })
}

describe('SYSTEM_PROMPT', () => {
  it('mentions OCR A Chemistry', () => {
    expect(SYSTEM_PROMPT).toContain('OCR A Chemistry')
  })

  it('specifies 3 questions', () => {
    expect(SYSTEM_PROMPT).toContain('exactly 3')
  })

  it('enforces strict marking', () => {
    expect(SYSTEM_PROMPT).toContain('strict')
  })

  it('mentions JSON response format', () => {
    expect(SYSTEM_PROMPT).toContain('valid JSON')
  })

  it('references AS-level (not A2)', () => {
    expect(SYSTEM_PROMPT).toContain('AS-level')
  })

  it('penalises imprecise language', () => {
    expect(SYSTEM_PROMPT).toContain('imprecise')
  })

  it('flags GCSE-level phrasing', () => {
    expect(SYSTEM_PROMPT).toContain('GCSE')
  })
})

describe('generateQuestions', () => {
  let generateQuestions

  beforeEach(async () => {
    const mod = await import('../../api/anthropic.js')
    generateQuestions = mod.generateQuestions
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed questions array from API response', async () => {
    const apiResponse = JSON.stringify({
      questions: [
        { id: 1, marks: 1, command: 'State', question: 'What is...', context: '' },
        { id: 2, marks: 2, command: 'Describe', question: 'Describe...', context: '' },
        { id: 3, marks: 3, command: 'Explain', question: 'Explain...', context: '' },
      ],
    })
    globalThis.fetch = mockFetch(apiResponse)

    const questions = await generateQuestions({ id: '2.1.1', title: 'Atoms', description: 'Atomic structure' })
    expect(questions).toHaveLength(3)
    expect(questions[0].marks).toBe(1)
    expect(questions[2].marks).toBe(3)
  })

  it('throws on API error', async () => {
    globalThis.fetch = mockFetchError(401, 'Invalid API key')
    await expect(
      generateQuestions({ id: '2.1.1', title: 'Atoms', description: 'test' })
    ).rejects.toThrow('Anthropic API error 401')
  })

  it('throws on non-JSON response', async () => {
    globalThis.fetch = mockFetch('This is not JSON at all')
    await expect(
      generateQuestions({ id: '2.1.1', title: 'Atoms', description: 'test' })
    ).rejects.toThrow()
  })

  it('throws when response has no questions array', async () => {
    globalThis.fetch = mockFetch(JSON.stringify({ result: 'wrong format' }))
    await expect(
      generateQuestions({ id: '2.1.1', title: 'Atoms', description: 'test' })
    ).rejects.toThrow('questions array')
  })

  it('handles markdown-fenced JSON', async () => {
    const fenced = '```json\n' + JSON.stringify({
      questions: [
        { id: 1, marks: 1, command: 'State', question: 'Q1', context: '' },
        { id: 2, marks: 2, command: 'Describe', question: 'Q2', context: '' },
        { id: 3, marks: 3, command: 'Explain', question: 'Q3', context: '' },
      ],
    }) + '\n```'
    globalThis.fetch = mockFetch(fenced)

    const questions = await generateQuestions({ id: '2.1.1', title: 'Atoms', description: 'test' })
    expect(questions).toHaveLength(3)
  })

  it('throws on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('NetworkError'))
    await expect(
      generateQuestions({ id: '2.1.1', title: 'Atoms', description: 'test' })
    ).rejects.toThrow('Network error')
  })
})

describe('markAnswers', () => {
  let markAnswers

  beforeEach(async () => {
    const mod = await import('../../api/anthropic.js')
    markAnswers = mod.markAnswers
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed marking results', async () => {
    const apiResponse = JSON.stringify({
      results: [
        { id: 1, score: 1, maxScore: 1, passed: true, feedback: 'Correct', modelAnswer: 'Model', gcseFlag: false, precisionFlag: false, unitsFlag: false },
      ],
      totalScore: 1,
      totalMax: 1,
      overallFeedback: 'Well done',
    })
    globalThis.fetch = mockFetch(apiResponse)

    const result = await markAnswers(
      { id: '2.1.1', title: 'Atoms' },
      [{ id: 1, marks: 1, command: 'State', question: 'What is an atom?' }],
      ['The smallest unit of an element']
    )
    expect(result.results).toHaveLength(1)
    expect(result.totalScore).toBe(1)
  })

  it('handles empty/no answer gracefully', async () => {
    const apiResponse = JSON.stringify({
      results: [
        { id: 1, score: 0, maxScore: 1, passed: false, feedback: 'No answer', modelAnswer: 'Model', gcseFlag: false, precisionFlag: false, unitsFlag: false },
      ],
      totalScore: 0,
      totalMax: 1,
      overallFeedback: 'No answer given',
    })
    globalThis.fetch = mockFetch(apiResponse)

    const result = await markAnswers(
      { id: '2.1.1', title: 'Atoms' },
      [{ id: 1, marks: 1, command: 'State', question: 'What?' }],
      [''] // empty answer
    )
    expect(result.results[0].score).toBe(0)
  })
})

describe('generateLesson', () => {
  let generateLesson

  beforeEach(async () => {
    const mod = await import('../../api/anthropic.js')
    generateLesson = mod.generateLesson
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed lesson object', async () => {
    const lesson = {
      keyIdeas: ['Idea 1'],
      mustKnow: [{ term: 'Term', definition: 'Def' }],
      markSchemePhrases: ['Phrase 1'],
      commandWords: 'State means...',
      examinerTips: ['Tip 1'],
      workedExample: 'Example',
      commonTraps: ['Trap 1'],
    }
    globalThis.fetch = mockFetch(JSON.stringify(lesson))

    const result = await generateLesson({ id: '2.1.1', title: 'Atoms', description: 'test' })
    expect(result.keyIdeas).toHaveLength(1)
    expect(result.mustKnow[0].term).toBe('Term')
  })
})

describe('API key validation', () => {
  it('SYSTEM_PROMPT does not contain actual API keys', () => {
    expect(SYSTEM_PROMPT).not.toMatch(/sk-ant-/)
  })
})
