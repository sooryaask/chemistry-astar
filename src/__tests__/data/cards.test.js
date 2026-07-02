import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock paperIndex.json with controlled test data
vi.mock('../../data/paperIndex.json', () => ({
  default: {
    'June 2023 QP - Paper 1 OCR (A) Chemistry AS-Level.pdf': {
      questions: [
        // MCQ (marks <= 1) — should be filtered out
        { number: 1, marks: 1, page: 1, topic: 'Atomic structure', summary: 'MCQ' },
        // Calculation — should be filtered out
        { number: 5, marks: 3, page: 3, topic: 'Moles', isCalculation: true, summary: 'Calc' },
        // Valid written question — whole card
        {
          number: 3, marks: 4, page: 2, topic: 'Bonding',
          summary: 'Describe ionic bonding',
          qpPages: [2],
          msPages: [10],
          msPaper: 'June 2023 MS - Paper 1 OCR (A) Chemistry AS-Level.pdf',
          explanation: 'Ionic bonding involves electron transfer.',
          steps: [],
        },
        // Valid question with sub-parts — should create one card per sub-part
        {
          number: 7, marks: 6, page: 4, topic: 'Organic',
          summary: 'Alkene reactions',
          qpPages: [4],
          msPages: [12],
          msPaper: 'June 2023 MS - Paper 1 OCR (A) Chemistry AS-Level.pdf',
          subPartImgs: {
            a: ['June_2023_q7a.png'],
            b: ['June_2023_q7b.png'],
          },
          subPartMarks: { a: 2, b: 4 },
          msSubPartImgs: {
            a: ['June_2023_ms_q7a.png'],
            b: ['June_2023_ms_q7b.png'],
          },
          explanation: 'Alkene addition reactions.',
          steps: ['Step 1', 'Step 2'],
        },
        // Question with sub-parts including a calculation sub-part to skip
        {
          number: 9, marks: 5, page: 5, topic: 'Energetics',
          summary: 'Enthalpy changes',
          qpPages: [5],
          msPages: [14],
          msPaper: 'June 2023 MS - Paper 1 OCR (A) Chemistry AS-Level.pdf',
          subPartImgs: {
            a: ['June_2023_q9a.png'],
            b: ['June_2023_q9b.png'],
            c: ['June_2023_q9c.png'],
          },
          subPartMarks: { a: 2, b: 1, c: 2 },
          calcSubParts: ['b'], // part b is calculation → skip
          msSubPartImgs: {
            a: ['June_2023_ms_q9a.png'],
            c: ['June_2023_ms_q9c.png'],
          },
        },
      ],
    },
    'Specimen QP - Paper 1 OCR (A) Chemistry AS-Level.pdf': {
      questions: [
        {
          number: 2, marks: 3, page: 1, topic: 'Electrons',
          summary: 'Electron configuration',
          qpPages: [1],
          msPages: [8],
          msPaper: 'Specimen MS - Paper 1 OCR (A) Chemistry AS-Level.pdf',
        },
      ],
    },
  },
}))

// Import after mock is set up
const { getDeckCards, getPaperList, deckTitle } = await import('../../data/cards.js')

describe('card generation', () => {
  it('filters out MCQ questions (marks <= 1)', () => {
    const papers = getPaperList()
    const june = papers.find((p) => p.label.includes('June 2023'))
    const allIds = june.cards.map((c) => c.number)
    expect(allIds).not.toContain(1) // MCQ filtered
  })

  it('filters out calculation questions', () => {
    const papers = getPaperList()
    const june = papers.find((p) => p.label.includes('June 2023'))
    const allNums = june.cards.map((c) => c.number)
    expect(allNums).not.toContain(5) // isCalculation filtered
  })

  it('creates one card per sub-part when subPartImgs has >= 2 entries', () => {
    const papers = getPaperList()
    const june = papers.find((p) => p.label.includes('June 2023'))
    const q7cards = june.cards.filter((c) => c.number === 7)
    expect(q7cards.length).toBe(2) // parts a and b
    expect(q7cards[0].subPart).toBe('a')
    expect(q7cards[1].subPart).toBe('b')
  })

  it('creates whole-question card when no sub-parts', () => {
    const papers = getPaperList()
    const june = papers.find((p) => p.label.includes('June 2023'))
    const q3cards = june.cards.filter((c) => c.number === 3)
    expect(q3cards.length).toBe(1)
    expect(q3cards[0].subPart).toBeNull()
  })

  it('skips calculation sub-parts within a question', () => {
    const papers = getPaperList()
    const june = papers.find((p) => p.label.includes('June 2023'))
    const q9cards = june.cards.filter((c) => c.number === 9)
    const subParts = q9cards.map((c) => c.subPart)
    expect(subParts).toContain('a')
    expect(subParts).not.toContain('b') // calculation sub-part filtered
    expect(subParts).toContain('c')
  })

  it('assigns correct marks per sub-part', () => {
    const papers = getPaperList()
    const june = papers.find((p) => p.label.includes('June 2023'))
    const q7a = june.cards.find((c) => c.number === 7 && c.subPart === 'a')
    expect(q7a.marks).toBe(2)
    const q7b = june.cards.find((c) => c.number === 7 && c.subPart === 'b')
    expect(q7b.marks).toBe(4)
  })

  it('generates correct card IDs', () => {
    const papers = getPaperList()
    const june = papers.find((p) => p.label.includes('June 2023'))
    const q3 = june.cards.find((c) => c.number === 3)
    expect(q3.id).toMatch(/^pp::.*::q3$/) // whole question
    const q7a = june.cards.find((c) => c.number === 7 && c.subPart === 'a')
    expect(q7a.id).toMatch(/^pp::.*::q7::sa$/) // sub-part
  })

  it('sorts cards by question number then sub-part', () => {
    const papers = getPaperList()
    const june = papers.find((p) => p.label.includes('June 2023'))
    const numbers = june.cards.map((c) => c.number)
    // Should be ascending
    for (let i = 1; i < numbers.length; i++) {
      expect(numbers[i]).toBeGreaterThanOrEqual(numbers[i - 1])
    }
  })

  it('includes qpUrls and msUrls on every card', () => {
    const papers = getPaperList()
    for (const paper of papers) {
      for (const card of paper.cards) {
        expect(Array.isArray(card.qpUrls)).toBe(true)
        expect(card.qpUrls.length).toBeGreaterThan(0)
        expect(Array.isArray(card.msUrls)).toBe(true)
        expect(card.msUrls.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('getPaperList', () => {
  it('returns all papers with cards', () => {
    const papers = getPaperList()
    expect(papers.length).toBe(2)
  })

  it('sorts Specimen paper first', () => {
    const papers = getPaperList()
    expect(papers[0].label).toMatch(/Specimen/)
  })

  it('each paper has slug, label, deckId, and cards', () => {
    for (const p of getPaperList()) {
      expect(typeof p.slug).toBe('string')
      expect(typeof p.label).toBe('string')
      expect(p.deckId).toMatch(/^paper:/)
      expect(Array.isArray(p.cards)).toBe(true)
      expect(p.cards.length).toBeGreaterThan(0)
    }
  })
})

describe('getDeckCards', () => {
  it('returns cards for a valid deck ID', () => {
    const papers = getPaperList()
    const cards = getDeckCards(papers[0].deckId)
    expect(cards.length).toBeGreaterThan(0)
  })

  it('returns empty array for unknown deck', () => {
    expect(getDeckCards('paper:nonexistent')).toEqual([])
  })

  it('returns empty array for malformed deck ID', () => {
    expect(getDeckCards('bogus')).toEqual([])
  })
})

describe('deckTitle', () => {
  it('returns paper label + "Paper 1" for valid deck', () => {
    const papers = getPaperList()
    const title = deckTitle(papers[0].deckId)
    expect(title).toContain('Paper 1')
  })

  it('returns "Past papers" for unknown deck', () => {
    expect(deckTitle('paper:unknown')).toBe('Past papers')
  })

  it('returns "Past papers" for malformed ID', () => {
    expect(deckTitle('invalid')).toBe('Past papers')
  })
})
