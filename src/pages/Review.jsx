import { useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getDeckCards, deckTitle } from '../data/cards.js'
import { buildSession, deckCounts, grade, setSuspended, resetCard } from '../utils/srs.js'
import { applySuperscript } from '../utils/superscript.js'

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
  const [attempt, setAttempt] = useState('first') // 'first' | 'retry'
  const [input, setInput] = useState('')
  const [firstInput, setFirstInput] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const ssMode = useRef(false)

  const card = queue[0]

  function refreshCounts() {
    setCounts(deckCounts(allCards))
  }

  function resetView() {
    setRevealed(false)
    setAttempt('first')
    setInput('')
    setFirstInput('')
    setMenuOpen(false)
    ssMode.current = false
  }

  // Advance to the next card. `requeue` pushes the current card to the back so it
  // resurfaces later this session (used for Again / Still-shaky / Skip).
  function next(requeue) {
    setQueue((q) => {
      const [head, ...rest] = q
      return requeue && head ? [...rest, head] : rest
    })
    resetView()
  }

  function reveal() {
    if (attempt === 'first') setFirstInput(input)
    setRevealed(true)
  }

  function gradeFirst(g) {
    grade(card.id, g)
    refreshCounts()
    // Image past-paper cards already show the full mark scheme, so they skip the
    // type-again step. Text cards graded Again will resurface anyway.
    if (card.type === 'image' || g === 'again') {
      next(g === 'again')
    } else {
      setAttempt('retry')
      setRevealed(false)
      setInput('')
      ssMode.current = false
    }
  }

  function retryDone(locked) {
    if (!locked) {
      // Still shaky — override to Again so it stays in today's learning queue.
      grade(card.id, 'again')
      refreshCounts()
      next(true)
    } else {
      next(false)
    }
  }

  function onKeyDown(e) {
    if (applySuperscript(e, ssMode, input, setInput)) return
    if (e.key === 'Enter' && !e.shiftKey && !revealed) {
      e.preventDefault()
      reveal()
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

  const isImage = card.type === 'image'

  return (
    <div className="review">
      <div className="review-top">
        <Link className="back-link" to="/">←</Link>
        <span className="review-title">{title}</span>
      </div>

      <div className="review-scroll">
      {/* Question */}
      <div className="q-area">
        {attempt === 'retry' && (
          <div className="retry-banner">Now do it again — lock it in 🔒</div>
        )}
        {isImage ? (
          <>
            <div className="q-meta">{card.paperLabel} · Q{card.number} · {card.marks} mark{card.marks !== 1 ? 's' : ''}</div>
            <img className="q-image" src={card.qpUrl} alt={`Question ${card.number}`} />
          </>
        ) : (
          <div className="q-text">
            {card.context && <span className="q-context">{card.context} </span>}
            {card.question}
            <span className="q-marks">[{card.marks}]</span>
          </div>
        )}
      </div>

      {/* Answer input */}
      {!revealed && (
        <div className="a-area">
          <textarea
            className="answer-box"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={isImage ? 'Jot your answer, then reveal the mark scheme…' : 'Type your answer…  (^ for superscript, Enter to reveal)'}
            autoFocus
            rows={card.marks > 1 || isImage ? 3 : 1}
          />
          <button className="show-btn" onClick={reveal}>Show Answer</button>
        </div>
      )}

      {/* Revealed answer */}
      {revealed && (
        <div className="reveal">
          {(firstInput || input) && (
            <div className="your-answer">
              <span className="ra-label">You wrote</span>
              <div>{attempt === 'first' ? firstInput : input || <em className="muted">(blank)</em>}</div>
            </div>
          )}

          {isImage ? (
            <div className="ms-block">
              <span className="ra-label">Official mark scheme</span>
              {card.msUrls.length > 0 ? (
                card.msUrls.map((u) => (
                  <img key={u} className="ms-image" src={u} alt="Mark scheme" />
                ))
              ) : (
                <p className="muted">Mark scheme page not available for this question.</p>
              )}
            </div>
          ) : (
            <div className="model-block">
              <span className="ra-label">Model answer</span>
              <div className="model-answer">{card.answer}</div>
              {card.markPoints?.length > 0 && (
                <ul className="mark-points">
                  {card.markPoints.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              )}
              {card.explanation && (
                <div className="explanation"><strong>Why:</strong> {card.explanation}</div>
              )}
            </div>
          )}

          {/* Grade buttons */}
          {attempt === 'first' ? (
            <div className="grades">
              <button className="g again" onClick={() => gradeFirst('again')}>Again</button>
              <button className="g hard" onClick={() => gradeFirst('hard')}>Hard</button>
              <button className="g good" onClick={() => gradeFirst('good')}>Good</button>
              <button className="g easy" onClick={() => gradeFirst('easy')}>Easy</button>
            </div>
          ) : (
            <div className="grades retry">
              <button className="g again" onClick={() => retryDone(false)}>Still shaky</button>
              <button className="g good" onClick={() => retryDone(true)}>Locked in ✓</button>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Bottom bar: Skip / counter / More — like the Anki mockup */}
      <div className="bottom-bar">
        <button className="pill ghost" onClick={() => next(true)}>Skip</button>
        <Counter counts={counts} />
        <div className="more-wrap">
          <button className="pill ghost" onClick={() => setMenuOpen((o) => !o)}>More ▾</button>
          {menuOpen && (
            <div className="more-menu">
              <button onClick={() => { setSuspended(card.id, true); refreshCounts(); next(false) }}>Suspend card</button>
              <button onClick={() => { resetCard(card.id); refreshCounts(); resetView() }}>Reset progress</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
