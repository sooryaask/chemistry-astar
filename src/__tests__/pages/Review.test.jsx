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
}))

vi.mock('../../utils/srs.js', () => ({
  buildSession: (cards) => ({
    queue: cards,
    counts: { new: cards.length, learning: 0, review: 0, total: cards.length },
  }),
  deckCounts: (cards) => ({ new: cards.length, learning: 0, review: 0, total: cards.length }),
  grade: vi.fn(() => ({ reps: 1, due: '2026-07-03', ease: 2.5, intervalDays: 1 })),
  previewLabels: () => ({ again: 'soon', hard: 'soon', good: '1d', easy: '2d' }),
  setSuspended: vi.fn(),
  resetCard: vi.fn(),
  masteryStats: () => ({ mastered: 0, total: 2, pct: 0 }),
}))

vi.mock('../../utils/localStorage.js', () => ({
  todayISO: () => '2026-07-02',
  getItem: () => ({}),
  setItem: vi.fn(),
  KEYS: { srs: 'srsState' },
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

describe('Review page', () => {
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

  it('shows answer textarea before reveal', () => {
    renderReview()
    expect(screen.getByPlaceholderText(/Write your answer/)).toBeInTheDocument()
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

  it('"Mark my answer" becomes enabled when answer is typed', () => {
    renderReview()
    const textarea = screen.getByPlaceholderText(/Write your answer/)
    fireEvent.change(textarea, { target: { value: 'Ionic bonding involves electron transfer' } })
    expect(screen.getByText('Mark my answer')).not.toBeDisabled()
  })

  it('clicking "Just show the answer" reveals mark scheme', () => {
    renderReview()
    fireEvent.click(screen.getByText('Just show the answer'))
    expect(screen.getByText(/Mark scheme/)).toBeInTheDocument()
    expect(screen.getByAltText('Mark scheme')).toBeInTheDocument()
  })

  it('shows grade buttons after reveal', () => {
    renderReview()
    fireEvent.click(screen.getByText('Just show the answer'))
    expect(screen.getByText('Again')).toBeInTheDocument()
    expect(screen.getByText('Hard')).toBeInTheDocument()
    expect(screen.getByText('Good')).toBeInTheDocument()
    expect(screen.getByText('Easy')).toBeInTheDocument()
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

  it('shows mastery progress bar', () => {
    renderReview()
    expect(screen.getByText(/0% mastered/)).toBeInTheDocument()
  })

  it('shows SRS counter in bottom bar', () => {
    renderReview()
    expect(screen.getByTitle('new + learning + due')).toBeInTheDocument()
  })

  it('shows Skip button', () => {
    renderReview()
    expect(screen.getByText('Skip')).toBeInTheDocument()
  })

  it('shows More menu with Suspend and Reset', () => {
    renderReview()
    fireEvent.click(screen.getByText('More ▾'))
    expect(screen.getByText('Suspend card')).toBeInTheDocument()
    expect(screen.getByText('Reset progress')).toBeInTheDocument()
  })

  it('shows back link to decks', () => {
    renderReview()
    const backLink = screen.getByText('←')
    expect(backLink.closest('a')).toHaveAttribute('href', '/')
  })

  it('shows preview intervals on grade buttons', () => {
    renderReview()
    fireEvent.click(screen.getByText('Just show the answer'))
    // "soon" appears on both Again and Hard buttons
    expect(screen.getAllByText('soon').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('1d')).toBeInTheDocument() // good
    expect(screen.getByText('2d')).toBeInTheDocument() // easy
  })
})

describe('Review — "All caught up" state', () => {
  it('shows completion message when queue is empty', async () => {
    // Override getDeckCards to return empty array for this test
    const cards = await import('../../data/cards.js')
    vi.spyOn(cards, 'getDeckCards').mockReturnValue([])

    render(
      <MemoryRouter initialEntries={['/review/paper%3Aempty']}>
        <Routes>
          <Route path="/review/:deckId" element={<Review />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('All caught up')).toBeInTheDocument()
    expect(screen.getByText(/Back to decks/)).toBeInTheDocument()

    vi.restoreAllMocks()
  })
})
