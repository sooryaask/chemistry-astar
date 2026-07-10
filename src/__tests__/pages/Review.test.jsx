import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Review from '../../pages/Review.jsx'

const MOCK_CARDS = [
  {
    id: 'pp::test::q3::sa',
    type: 'image',
    marks: 3,
    number: 3,
    subPart: 'a',
    topic: 'Bonding',
    summary: 'Describe ionic bonding',
    paperLabel: 'June 2023',
    qpUrls: ['/chemistry-astar/rendered/test_q3a.png'],
    msUrls: ['/chemistry-astar/rendered/test_ms_q3a.png'],
    explanation: '',
    steps: [],
    slots: [{ label: '', marks: 3 }],
  },
  {
    id: 'pp::test::q3::sb',
    type: 'image',
    marks: 2,
    number: 3,
    subPart: 'b',
    topic: 'Bonding',
    summary: 'Draw dot-and-cross',
    paperLabel: 'June 2023',
    qpUrls: ['/chemistry-astar/rendered/test_q3b.png'],
    msUrls: ['/chemistry-astar/rendered/test_ms_q3b.png'],
    explanation: '',
    steps: [],
    slots: [{ label: '', marks: 2 }],
  },
]

// Mock the data and SRS modules
vi.mock('../../data/cards.js', () => ({
  getDeckCards: () => MOCK_CARDS,
  deckTitle: () => 'June 2023 — Paper 1',
  shuffleMcqOptions: (card) => ({ options: card.options, correctOption: card.correctOption }),
  AI_TOPICS: [],
  AI_MODULES: [],
  AI_TOTAL: 0,
}))

vi.mock('../../utils/srs.js', () => ({
  buildSession: (cards) => ({
    queue: cards,
    counts: { new: cards.length, learning: 0, review: 0, total: cards.length },
  }),
  deckCounts: (cards) => ({ new: cards.length, learning: 0, review: 0, total: cards.length }),
  grade: vi.fn(() => ({ cardState: { reps: 1, due: '2026-07-03', ease: 2.5, intervalDays: 1 }, saved: true })),
  previewLabels: () => ({ again: 'soon', hard: 'soon', good: '1d', easy: '2d' }),
  setSuspended: vi.fn(),
  resetCard: vi.fn(),
  masteryStats: () => ({ mastered: 0, total: 2, pct: 0 }),
  autoGrade: vi.fn(() => 'good'),
  autoGradeAndSave: vi.fn(() => ({ cardState: { reps: 1, due: '2026-07-03', ease: 2.5, intervalDays: 1 }, saved: true, grade: 'good' })),
  getState: vi.fn(() => ({})),
}))

vi.mock('../../utils/localStorage.js', () => ({
  todayISO: () => '2026-07-02',
  getItem: () => ({}),
  setItem: vi.fn(),
  KEYS: { srs: 'srsState', aiFilters: 'aiFilters' },
}))

vi.mock('../../api/anthropic.js', () => ({
  assessPaperQuestion: vi.fn().mockResolvedValue({
    found: true,
    questionMarks: 3,
    score: 2,
    markingPoints: [
      { point: 'Electron transfer', awarded: true, evidence: 'electron transfer', why: '' },
      { point: 'Electrostatic attraction', awarded: true, evidence: 'attraction', why: '' },
      { point: 'Opposite charges', awarded: false, evidence: '', why: 'Missing mention of charges' },
    ],
  }),
  assessTextQuestion: vi.fn(),
}))

function renderReview() {
  return render(
    <MemoryRouter initialEntries={['/review/paper%3Atest']}>
      <Routes>
        <Route path="/review/:deckId" element={<Review />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Review page (past paper — free practice mode)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders the deck title', () => {
    renderReview()
    expect(screen.getByText('June 2023 — Paper 1')).toBeInTheDocument()
  })

  it('shows the first card question metadata', () => {
    renderReview()
    expect(screen.getByText(/Q3\(a\).*3 mark/)).toBeInTheDocument()
  })

  it('renders the question image', () => {
    renderReview()
    const img = screen.getByAltText(/Question 3 page 1/)
    expect(img).toBeInTheDocument()
    expect(img.src).toContain('test_q3a.png')
  })

  it('shows answer input before reveal', () => {
    renderReview()
    expect(screen.getByText(/Write your answer/)).toBeInTheDocument()
  })

  it('shows "Mark my answer" and "Just show the answer" buttons', () => {
    renderReview()
    expect(screen.getByText('Mark my answer')).toBeInTheDocument()
    expect(screen.getByText('Just show the answer')).toBeInTheDocument()
  })

  it('"Mark my answer" is disabled when no answer typed', () => {
    renderReview()
    const btn = screen.getByText('Mark my answer')
    expect(btn).toBeDisabled()
  })

  it('clicking "Just show the answer" reveals mark scheme', () => {
    renderReview()
    fireEvent.click(screen.getByText('Just show the answer'))
    expect(screen.getByText(/Mark scheme/)).toBeInTheDocument()
    expect(screen.getByAltText('Mark scheme')).toBeInTheDocument()
  })

  it('shows "Next question" button after reveal (not grade buttons)', () => {
    renderReview()
    fireEvent.click(screen.getByText('Just show the answer'))
    expect(screen.getByText('Next question')).toBeInTheDocument()
    // Grade buttons should NOT be present
    expect(screen.queryByText('Again')).not.toBeInTheDocument()
    expect(screen.queryByText('Hard')).not.toBeInTheDocument()
    expect(screen.queryByText('Good')).not.toBeInTheDocument()
    expect(screen.queryByText('Easy')).not.toBeInTheDocument()
  })

  it('shows tick boxes matching total marks', () => {
    renderReview()
    fireEvent.click(screen.getByText('Just show the answer'))
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBe(3) // 3 marks
  })

  it('toggles tick boxes on click', () => {
    renderReview()
    fireEvent.click(screen.getByText('Just show the answer'))
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    expect(checkboxes[0]).toBeChecked()
    expect(screen.getByText('1 / 3 marks')).toBeInTheDocument()
  })

  it('shows sequential progress (X / Y questions)', () => {
    renderReview()
    expect(screen.getByText('1 / 2 questions')).toBeInTheDocument()
  })

  it('shows Prev/Next navigation in bottom bar', () => {
    renderReview()
    expect(screen.getByText('← Prev')).toBeInTheDocument()
    expect(screen.getByText('Next →')).toBeInTheDocument()
  })

  it('Prev is disabled on first card', () => {
    renderReview()
    expect(screen.getByText('← Prev')).toBeDisabled()
  })

  it('does NOT show SRS counter for past papers', () => {
    renderReview()
    expect(screen.queryByTitle('new + learning + due')).not.toBeInTheDocument()
  })

  it('does NOT show More menu for past papers (no suspend/reset)', () => {
    renderReview()
    expect(screen.queryByText('More ▾')).not.toBeInTheDocument()
  })

  it('shows back link to decks', () => {
    renderReview()
    const backLink = screen.getByText('←')
    expect(backLink.closest('a')).toHaveAttribute('href', '/')
  })
})

describe('Review — empty state', () => {
  it('shows "No questions" when paper has no cards', async () => {
    const cards = await import('../../data/cards.js')
    vi.spyOn(cards, 'getDeckCards').mockReturnValue([])

    render(
      <MemoryRouter initialEntries={['/review/paper%3Aempty']}>
        <Routes>
          <Route path="/review/:deckId" element={<Review />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('No questions')).toBeInTheDocument()
    expect(screen.getByText(/Back to decks/)).toBeInTheDocument()

    vi.restoreAllMocks()
  })
})
