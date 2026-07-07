import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PeriodicTable from '../../components/PeriodicTable.jsx'

describe('PeriodicTable', () => {
  it('renders elements with symbol, atomic number and Ar', () => {
    render(<PeriodicTable onClose={() => {}} />)
    expect(screen.getByText('Na')).toBeInTheDocument()
    expect(screen.getByText('Cl')).toBeInTheDocument()
    expect(screen.getByText('35.5')).toBeInTheDocument()
    // 118 element tiles
    expect(document.querySelectorAll('.pt-el').length).toBe(118)
  })

  it('closes on × button and on Escape', () => {
    const onClose = vi.fn()
    render(<PeriodicTable onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close periodic table'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
