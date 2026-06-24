import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getDeckCards, deckTitle } from '../data/cards.js'
import { buildSession, deckCounts, grade, previewLabels, setSuspended, resetCard } from '../utils/srs.js'
import { todayISO } from '../utils/localStorage.js'

// How many cards later a graded card resurfaces this session (in-session relearn).
const GAPS = { again: 3, hard: 7 }

function Counter({ counts }) {
  return (
    <div className="counter" title="new + learning + due">
      <span className="c-new">{counts.new}</span>
      <span className="c-sep"> + </span>
      <span className="c-learn">{counts.learning}</span>
      <span className="c-sep"> + </span>
      <span className="c-due">{counts.review}</span>
    </div>
  )
}

export default function Review() {
  const { deckId: raw } = useParams()
  const deckId = decodeURIComponent(raw || '')
  const allCards = useMemo(() => getDeckCards(deckId), [deckId])
  const title = useMemo(() => deckTitle(deckId), [deckId])

  const [queue, setQueue] = useState(() => buildSession(allCards).queue)
  const [counts, setCounts] = useState(() => deckCounts(allCards))
  const [revealed, setRevealed] = useState(false)
  const [input, setInput] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const card = queue[0]
  const labels = card ? previewLabels(card.id) : null

  function refreshCounts() {
    setCounts(deckCounts(allCards))
  }

  function resetView() {
    setRevealed(false)
    setInput('')
    setMenuOpen(false)
  }

  // Move past the current card. `reinsertAt` = null removes it from the session;
  // a number reinserts it that many cards later (so it resurfaces this session).
  function advance(reinsertAt) {
    setQueue((q) => {
      const [head, ...rest] = q
      if (reinsertAt == null || !head) return rest
      const i = Math.min(reinsertAt, rest.length)
      return [...rest.slice(0, i), head, ...rest.slice(i)]
    })
    resetView()
  }

  function gradeCard(g) {
    const next = grade(card.id, g)
    refreshCounts()
    // If the card is due again today (Again, or Hard while still learning), it
    // resurfaces later this session; otherwise it's scheduled for a future day.
    const stillDueToday = next.due <= todayISO()
    advance(stillDueToday ? GAPS[g] ?? 0 : null)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !revealed) {
      e.preventDefault()
      setRevealed(true)
    }
  }

  if (!card) {
    return (
      <div className="review done">
        <h2>All caught up</h2>
        <p className="muted">No cards due in “{title}” right now.</p>
        <Link className="pill" to="/">← Back to decks</Link>
      </div>
    )
  }

  return (
    <div className="review">
      <div className="review-top">
        <Link className="back-link" to="/">←</Link>
        <span className="review-title">{title}</span>
      </div>

      <div className="review-scroll">
        {/* Question */}
        <div className="q-area">
          <div className="q-meta">{card.paperLabel} · Q{card.number} · {card.marks} mark{card.marks !== 1 ? 's' : ''}</div>
          <img className="q-image" src={card.qpUrl} alt={`Question ${card.number}`} />
        </div>

        {/* Answer input */}
        {!revealed && (
          <div className="a-area">
            <textarea
              className="answer-box"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Jot your answer, then reveal the mark scheme…"
              autoFocus
              rows={3}
            />
            <button className="show-btn" onClick={() => setRevealed(true)}>Show Answer</button>
          </div>
        )}

        {/* Revealed: official mark scheme cropped to this question */}
        {revealed && (
          <div className="reveal">
            {input && (
              <div className="your-answer">
                <span className="ra-label">You wrote</span>
                <div>{input}</div>
              </div>
            )}

            <div className="ms-block">
              <span className="ra-label">Official mark scheme</span>
              {card.msUrls.length > 0 ? (
                card.msUrls.map((u) => <img key={u} className="ms-image" src={u} alt="Mark scheme" />)
              ) : (
                <p className="muted">Mark scheme page not available for this question.</p>
              )}
            </div>

            {(card.explanation || card.steps?.length > 0) && (
              <div className="solve-block">
                <span className="ra-label">How to solve it</span>
                {card.explanation && <p className="solve-explanation">{card.explanation}</p>}
                {card.steps?.length > 0 && (
                  <ol className="solve-steps">
                    {card.steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                )}
              </div>
            )}

            {/* Grade buttons — the interval shows when you'll next see this card */}
            <div className="grades">
              <button className="g again" onClick={() => gradeCard('again')}>
                Again<span className="g-int">{labels.again}</span>
              </button>
              <button className="g hard" onClick={() => gradeCard('hard')}>
                Hard<span className="g-int">{labels.hard}</span>
              </button>
              <button className="g good" onClick={() => gradeCard('good')}>
                Good<span className="g-int">{labels.good}</span>
              </button>
              <button className="g easy" onClick={() => gradeCard('easy')}>
                Easy<span className="g-int">{labels.easy}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar: Skip / counter / More — like the Anki mockup */}
      <div className="bottom-bar">
        <button className="pill ghost" onClick={() => advance(queue.length)}>Skip</button>
        <Counter counts={counts} />
        <div className="more-wrap">
          <button className="pill ghost" onClick={() => setMenuOpen((o) => !o)}>More ▾</button>
          {menuOpen && (
            <div className="more-menu">
              <button onClick={() => { setSuspended(card.id, true); refreshCounts(); advance(null) }}>Suspend card</button>
              <button onClick={() => { resetCard(card.id); refreshCounts(); resetView() }}>Reset progress</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
