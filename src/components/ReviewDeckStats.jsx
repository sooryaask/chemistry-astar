import { useState } from 'react'
import { getDeck, dueCards, addDays } from '../utils/reviewDeck.js'
import { todayISO } from '../utils/localStorage.js'

export default function ReviewDeckStats() {
  const [expanded, setExpanded] = useState(false)
  const deck = getDeck()
  const due = dueCards()
  const today = todayISO()

  if (deck.length === 0) return null

  // Cards due within the next 7 days
  const weekEnd = addDays(today, 7)
  const dueThisWeek = deck.filter((c) => c.due <= weekEnd).length

  return (
    <div className="card review-deck-stats">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ margin: 0 }}>Spaced Repetition Deck</h3>
          <div className="muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
            {deck.length} card{deck.length !== 1 ? 's' : ''} total · {due.length} due today · {dueThisWeek} due this week
          </div>
        </div>
        <button className="small secondary" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {due.length > 0 && (
        <div className="rds-due-bar" style={{ marginTop: '0.6rem' }}>
          <div className="rds-due-fill" style={{ width: `${Math.round((due.length / deck.length) * 100)}%` }} />
        </div>
      )}

      {expanded && (
        <div className="rds-table-wrap" style={{ marginTop: '0.75rem' }}>
          <table className="rds-table">
            <thead>
              <tr>
                <th>Topic</th>
                <th>Due</th>
                <th>Interval</th>
                <th>Ease</th>
                <th>Lapses</th>
              </tr>
            </thead>
            <tbody>
              {deck
                .sort((a, b) => (a.due < b.due ? -1 : 1))
                .map((c) => (
                  <tr key={c.id} className={c.due <= today ? 'rds-overdue' : ''}>
                    <td>
                      <span className="spec-ref">{c.specId}</span>
                    </td>
                    <td>{c.due}</td>
                    <td>{c.intervalDays}d</td>
                    <td>{c.ease?.toFixed(1)}</td>
                    <td>{c.lapses || 0}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
