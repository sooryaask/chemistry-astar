import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App.jsx'

// Mock the page components to simplify routing tests
vi.mock('../pages/Decks.jsx', () => ({
  default: () => <div data-testid="decks-page">Decks Page</div>,
}))
vi.mock('../pages/Review.jsx', () => ({
  default: () => <div data-testid="review-page">Review Page</div>,
}))

describe('App routing', () => {
  it('renders Decks page at root "/"', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByTestId('decks-page')).toBeInTheDocument()
  })

  it('renders Review page at "/review/:deckId"', () => {
    render(
      <MemoryRouter initialEntries={['/review/paper%3AJune_2023']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByTestId('review-page')).toBeInTheDocument()
  })

  it('does not render Review at root', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.queryByTestId('review-page')).not.toBeInTheDocument()
  })

  it('does not render Decks at review route', () => {
    render(
      <MemoryRouter initialEntries={['/review/paper%3ATest']}>
        <App />
      </MemoryRouter>
    )
    expect(screen.queryByTestId('decks-page')).not.toBeInTheDocument()
  })
})
