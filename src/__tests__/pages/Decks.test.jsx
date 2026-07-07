import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Decks from '../../pages/Decks.jsx'

// Mock cards.js to return controlled test data
vi.mock('../../data/cards.js', () => ({
  getPaperList: () => [
    {
      slug: 'Specimen',
      label: 'Specimen',
      title: 'Specimen — Paper 1',
      deckId: 'paper:Specimen',
      cards: [
        { id: 'card1', marks: 3 },
        { id: 'card2', marks: 2 },
      ],
    },
    {
      slug: 'June_2023',
      label: 'June 2023',
      title: 'June 2023 — Paper 1',
      deckId: 'paper:June_2023',
      cards: [
        { id: 'card3', marks: 4 },
      ],
    },
  ],
}))

// Mock srs.js
vi.mock('../../utils/srs.js', () => ({
  deckCounts: (cards) => ({
    new: cards.length,
    learning: 0,
    review: 0,
    total: cards.length,
  }),
  masteryStats: (cards) => ({
    mastered: 0,
    total: cards.length,
    pct: 0,
  }),
}))

function renderDecks() {
  return render(
    <MemoryRouter>
      <Decks />
    </MemoryRouter>
  )
}

describe('Decks page', () => {
  it('renders the page title', () => {
    renderDecks()
    expect(screen.getByText(/Chemistry.*Past Papers/i)).toBeInTheDocument()
  })

  it('renders OCR A section heading', () => {
    renderDecks()
    expect(screen.getByText(/OCR A Chemistry AS.*Paper 1/i)).toBeInTheDocument()
  })

  it('renders a row for each paper', () => {
    renderDecks()
    expect(screen.getByText(/Specimen.*Paper 1/)).toBeInTheDocument()
    expect(screen.getByText(/June 2023.*Paper 1/)).toBeInTheDocument()
  })

  it('shows question count and total marks', () => {
    renderDecks()
    expect(screen.getByText(/2 questions.*5 marks/)).toBeInTheDocument() // Specimen
    expect(screen.getByText(/1 question.*4 marks/)).toBeInTheDocument() // June 2023
  })

  it('renders mastery percentage', () => {
    renderDecks()
    const pcts = screen.getAllByText('0%')
    expect(pcts.length).toBeGreaterThanOrEqual(2)
  })

  it('links each paper to its review route', () => {
    renderDecks()
    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs.some((h) => h.includes('/review/'))).toBe(true)
  })

  it('renders SRS counter (new + learning + review)', () => {
    renderDecks()
    // Specimen has 2 new cards
    const counters = screen.getAllByTitle('new + learning + due')
    expect(counters.length).toBeGreaterThanOrEqual(2)
  })
})
