import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getDeckCards, deckTitle } from '../data/cards.js'
import { buildSession, deckCounts, grade, previewLabels, setSuspended, resetCard, masteryStats } from '../utils/srs.js'
import { todayISO } from '../utils/localStorage.js'
import { assessPaperQuestion } from '../api/anthropic.js'

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
  const [mastery, setMastery] = useState(() => masteryStats(allCards))
  const [revealed, setRevealed] = useState(false)
  const [answers, setAnswers] = useState([])
  const [ticks, setTicks] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [marking, setMarking] = useState(false)
  const [assessment, setAssessment] = useState(null)
  const [markError, setMarkError] = useState(null)

  const card = queue[0]
  const labels = card ? previewLabels(card.id) : null
  const slots = card?.slots?.length ? card.slots : [{ label: '', marks: card?.marks ?? 1 }]
  const totalMarks = slots.reduce((s, sl) => s + sl.marks, 0)
  const wroteSomething = answers.some((a) => a && a.trim())

  function refreshCounts() {
    setCounts(deckCounts(allCards))
    setMastery(masteryStats(allCards))
  }

  function resetView() {
    setRevealed(false)
    setAnswers([])
    setTicks([])
    setMenuOpen(false)
    setMarking(false)
    setAssessment(null)
    setMarkError(null)
  }

  // Send the typed answer to Claude to be marked against this part's mark scheme.
  async function markAnswer() {
    setRevealed(true)
    setAssessment(null)
    setMarkError(null)
    setMarking(true)
    try {
      const result = await assessPaperQuestion({
        qpImageUrls: card.qpUrls,
        msImageUrls: card.msUrls,
        questionNo: `${card.number}${card.subPart ? `(${card.subPart})` : ''}`,
        answer: answers.filter(Boolean).join('\n'),
      })
      setAssessment(result)
      // Pre-fill the tick boxes from the AI's score so grading is one glance away.
      if (typeof result?.score === 'number') {
        setTicks(Array.from({ length: totalMarks }, (_, i) => i < result.score))
      }
    } catch (err) {
      setMarkError(err.message || 'Marking failed.')
    } finally {
      setMarking(false)
    }
  }

  function setAnswer(i, val) {
    setAnswers((a) => {
      const next = a.slice()
      next[i] = val
      return next
    })
  }

  function toggleTick(i) {
    setTicks((t) => {
      const next = [...t]
      next[i] = !next[i]
      return next
    })
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

  if (!card) {
    return (
      <div className="review done">
        <h2>All caught up</h2>
        <p className="muted">No cards due in "{title}" right now.</p>
        <Link className="pill" to="/">← Back to decks</Link>
      </div>
    )
  }

  const tickedCount = ticks.filter(Boolean).length

  return (
    <div className="review">
      <div className="review-top">
        <Link className="back-link" to="/">←</Link>
        <span className="review-title">{title}</span>
      </div>

      {/* Paper mastery — how much of this paper you've mastered, toward 100% */}
      <div className="progress-bar-wrap" title="Cards mastered (graded Good/Easy) in this paper">
        <div className="progress-bar-fill" style={{ width: `${mastery.pct}%` }} />
        <span className="progress-label">{mastery.pct}% mastered · {mastery.mastered}/{mastery.total}</span>
      </div>

      <div className="review-scroll">
        {/* Question paper card — continuous white paper */}
        <div className="q-meta">
          {card.paperLabel} · Q{card.number}{card.subPart ? `(${card.subPart})` : ''} · {totalMarks} mark{totalMarks !== 1 ? 's' : ''}
        </div>
        <div className="paper-card">
          {card.qpUrls.map((url, i) => (
            <img key={url} className="q-image" src={url} alt={`Question ${card.number} page ${i + 1}`} />
          ))}

          {/* Answer input — lined paper, one box per sub-part */}
          {!revealed && (
            <div className="a-area">
              {slots.map((s, i) => (
                <div className="slot" key={i}>
                  {s.label && (
                    <span className="slot-label">{s.label}<span className="slot-marks">[{s.marks}]</span></span>
                  )}
                  <textarea
                    className="answer-box"
                    value={answers[i] || ''}
                    onChange={(e) => setAnswer(i, e.target.value)}
                    placeholder={s.label ? `Your answer to ${s.label}…` : 'Write your answer here…'}
                    autoFocus={i === 0}
                    rows={s.marks > 1 ? Math.max(s.marks + 1, 3) : 2}
                  />
                </div>
              ))}
              <div className="answer-actions">
                <button className="mark-btn" onClick={markAnswer} disabled={!wroteSomething}>
                  Mark my answer
                </button>
                <button className="show-btn ghost-btn" onClick={() => setRevealed(true)}>
                  Just show the answer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Revealed: mark scheme with tick boxes */}
        {revealed && (
          <div className="reveal">
            {wroteSomething && (
              <div className="your-answer">
                <span className="ra-label">You wrote</span>
                {slots.map((s, i) => (answers[i] && answers[i].trim()) ? (
                  <div className="ya-slot" key={i}>
                    {s.label && <span className="ya-label">{s.label}</span>}
                    <span>{answers[i]}</span>
                  </div>
                ) : null)}
              </div>
            )}

            {/* AI examiner feedback */}
            {marking && (
              <div className="ai-feedback loading">
                <span className="spinner" /> Marking your answer against the mark scheme…
              </div>
            )}
            {markError && (
              <div className="ai-feedback error">
                <span className="ra-label">Couldn’t mark automatically</span>
                <p>{markError}</p>
                <p className="muted">Self-mark against the scheme below instead.</p>
              </div>
            )}
            {assessment && (
              <div className="ai-feedback">
                <div className="ai-score-row">
                  <span className="ai-score">{assessment.score ?? '?'} / {assessment.questionMarks ?? totalMarks}</span>
                  <span className="ai-score-label">AI examiner mark</span>
                </div>
                {assessment.whatWentWell && (
                  <div className="ai-sec good">
                    <span className="ai-sec-h">✓ What went well</span>
                    <p>{assessment.whatWentWell}</p>
                  </div>
                )}
                {assessment.howToImprove && (
                  <div className="ai-sec improve">
                    <span className="ai-sec-h">→ How to improve</span>
                    <p>{assessment.howToImprove}</p>
                  </div>
                )}
                {assessment.markSchemeAnswer && (
                  <div className="ai-sec model">
                    <span className="ai-sec-h">Model answer</span>
                    <p>{assessment.markSchemeAnswer}</p>
                  </div>
                )}
              </div>
            )}

            <div className="ms-block">
              <span className="ra-label">Mark scheme — tick each mark you earned</span>
              {card.msUrls.length > 0 ? (
                <div className="ms-with-ticks">
                  <div className="ms-images">
                    {card.msUrls.map((u) => <img key={u} className="ms-image" src={u} alt="Mark scheme" />)}
                  </div>
                  <div className="tick-col">
                    {Array.from({ length: totalMarks }, (_, i) => (
                      <label className={`tick-box ${ticks[i] ? 'ticked' : ''}`} key={i}>
                        <input type="checkbox" checked={!!ticks[i]} onChange={() => toggleTick(i)} />
                        <span className="tick-icon">{ticks[i] ? '✓' : '✗'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="muted">Mark scheme page not available for this question.</p>
              )}
              <div className="tick-score">{tickedCount} / {totalMarks} marks</div>
            </div>

            {/* Grade buttons */}
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

      {/* Bottom bar */}
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
