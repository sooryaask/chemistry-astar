import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getDeckCards, deckTitle } from '../data/cards.js'
import { buildSession, deckCounts, grade, previewLabels, setSuspended, resetCard, masteryStats } from '../utils/srs.js'
import { todayISO } from '../utils/localStorage.js'
import { assessPaperQuestion } from '../api/anthropic.js'
import ChemInput, { StaticMathField } from '../components/ChemInput.jsx'

// How many cards later a graded card resurfaces this session (in-session relearn).
const GAPS = { again: 3, hard: 7 }

// Convert MathQuill LaTeX to readable plain text for the AI marker.
const LATEX_TO_TEXT = [
  [/\\rightleftharpoons/g, '⇌'],
  [/\\rightarrow/g, '→'],
  [/\\leftarrow/g, '←'],
  [/\\Delta/g, 'Δ'],
  [/\\times/g, '×'],
  [/\\div/g, '÷'],
  [/\\cdot/g, '·'],
  [/\\pm/g, '±'],
  [/\\infty/g, '∞'],
  [/\\degree/g, '°'],
  [/\\circ/g, '°'],
  [/\\pi/g, 'π'],
  [/\\theta/g, 'θ'],
  [/\\alpha/g, 'α'],
  [/\\beta/g, 'β'],
  [/\\gamma/g, 'γ'],
  [/\\le/g, '≤'],
  [/\\ge/g, '≥'],
  [/\\neq/g, '≠'],
  [/\\approx/g, '≈'],
]
const SUB_MAP = { 0:'₀',1:'₁',2:'₂',3:'₃',4:'₄',5:'₅',6:'₆',7:'₇',8:'₈',9:'₉' }
const SUP_MAP = { 0:'⁰',1:'¹',2:'²',3:'³',4:'⁴',5:'⁵',6:'⁶',7:'⁷',8:'⁸',9:'⁹','+':'⁺','-':'⁻' }

function latexToText(latex) {
  if (!latex) return ''
  let t = latex
  // Fractions → a/b
  t = t.replace(/\\frac\{([^}]*)}\{([^}]*)}/g, '($1/$2)')
  // Square roots
  t = t.replace(/\\sqrt\{([^}]*)}/g, '√($1)')
  // Subscripts → unicode
  t = t.replace(/_\{([^}]*)}/g, (_, inner) => inner.split('').map(c => SUB_MAP[c] || c).join(''))
  t = t.replace(/_([0-9])/g, (_, d) => SUB_MAP[d] || d)
  // Superscripts → unicode
  t = t.replace(/\^\{([^}]*)}/g, (_, inner) => inner.split('').map(c => SUP_MAP[c] || c).join(''))
  t = t.replace(/\^([0-9])/g, (_, d) => SUP_MAP[d] || d)
  // Named commands
  for (const [re, rep] of LATEX_TO_TEXT) t = t.replace(re, rep)
  // Clean up remaining braces and backslashes
  t = t.replace(/[{}]/g, '')
  t = t.replace(/\\\\/g, ' ')
  t = t.replace(/\\ /g, ' ')
  // Collapse whitespace
  t = t.replace(/\s+/g, ' ').trim()
  return t
}

// Wrap each awarded mark-scheme "evidence" phrase found in the student's answer
// in a green <mark>, so you can see exactly which words earned which mark.
function highlightHits(text, evidences) {
  if (!text) return text
  const lower = text.toLowerCase()
  const ranges = []
  for (const ev of evidences || []) {
    const q = (ev || '').trim()
    if (q.length < 3) continue
    const idx = lower.indexOf(q.toLowerCase())
    if (idx !== -1) ranges.push([idx, idx + q.length])
  }
  if (!ranges.length) return text
  ranges.sort((a, b) => a[0] - b[0])
  const merged = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  const nodes = []
  let cursor = 0
  merged.forEach(([a, b], i) => {
    if (a > cursor) nodes.push(text.slice(cursor, a))
    nodes.push(<mark className="hit" key={i}>{text.slice(a, b)}</mark>)
    cursor = b
  })
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

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
  const [saveWarning, setSaveWarning] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [msImgError, setMsImgError] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // 'suspend' | 'reset' | null
  const confirmTimerRef = useRef(null)
  const moreRef = useRef(null)

  // Close More menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMenuOpen(false)
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  // Cleanup confirm timer on unmount
  useEffect(() => {
    return () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current) }
  }, [])

  const card = queue[0]
  const labels = card ? previewLabels(card.id) : null
  const slots = card?.slots?.length ? card.slots : [{ label: '', marks: card?.marks ?? 1 }]
  const totalMarks = slots.reduce((s, sl) => s + sl.marks, 0)
  const wroteSomething = answers.some((a) => a && a.trim())
  // Verbatim phrases the AI says earned a mark — highlighted green in the answer.
  const awardedEvidence = (assessment?.markingPoints || [])
    .filter((p) => p && p.awarded && p.evidence)
    .map((p) => p.evidence)

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
    setImgError(false)
    setMsImgError(false)
    setConfirmAction(null)
    if (confirmTimerRef.current) { clearTimeout(confirmTimerRef.current); confirmTimerRef.current = null }
  }

  // Send the typed answer to Claude to be marked against this part's mark scheme.
  async function markAnswer() {
    setRevealed(true)
    setAssessment(null)
    setMarkError(null)
    setMarking(true)
    try {
      const labelledAnswer = slots
        .map((s, i) => (answers[i] && answers[i].trim())
          ? `${s.label ? s.label + ' ' : ''}${latexToText(answers[i])}`
          : null)
        .filter(Boolean)
        .join('\n')
      const result = await assessPaperQuestion({
        qpImageUrls: card.qpUrls,
        msImageUrls: card.msUrls,
        questionNo: `${card.number}${card.subPart ? `(${card.subPart})` : ''}`,
        answer: labelledAnswer,
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
    const { cardState, saved } = grade(card.id, g)
    if (!saved) {
      setSaveWarning(true)
      setTimeout(() => setSaveWarning(false), 5000)
    }
    refreshCounts()
    // If the card is due again today (Again, or Hard while still learning), it
    // resurfaces later this session; otherwise it's scheduled for a future day.
    const stillDueToday = cardState.due <= todayISO()
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

      {saveWarning && (
        <div className="save-warning" onClick={() => setSaveWarning(false)}>
          Storage full — progress wasn't saved. Free up space or clear old data.
        </div>
      )}

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
            <img key={url} className="q-image" src={url} alt={`Question ${card.number} page ${i + 1}`} onError={() => setImgError(true)} />
          ))}
          {imgError && (
            <div className="img-error">
              Question image failed to load. Check that rendered/ images exist, or use "Just show the answer" to self-mark.
            </div>
          )}

          {/* Answer input — lined paper, one box per sub-part */}
          {!revealed && (
            <div className="a-area">
              {slots.map((s, i) => (
                <div className="slot" key={i}>
                  {s.label && (
                    <span className="slot-label">{s.label}<span className="slot-marks">[{s.marks}]</span></span>
                  )}
                  <ChemInput
                    value={answers[i] || ''}
                    onChange={(val) => setAnswer(i, val)}
                    placeholder={s.label ? `Your answer to ${s.label}…` : 'Write your answer here…'}
                    autoFocus={i === 0}
                    rows={s.marks > 1 ? Math.max(s.marks + 1, 3) : 2}
                  />
                </div>
              ))}
              <div className="answer-actions">
                <button className="mark-btn" onClick={markAnswer} disabled={!wroteSomething || imgError}>
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
                {slots.map((s, i) => (answers[i] && answers[i].trim()) ? (
                  <div className="ya-slot" key={i}>
                    {s.label && <span className="ya-label">{s.label}</span>}
                    <StaticMathField>{answers[i]}</StaticMathField>
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
                {Array.isArray(assessment.markingPoints) && assessment.markingPoints.length > 0 && (
                  <div className="ai-points">
                    {assessment.markingPoints.map((p, i) => (
                      <div className={`ai-point ${p.awarded ? 'hit' : 'miss'}`} key={i}>
                        <span className="ai-point-icon">{p.awarded ? '✓' : '✗'}</span>
                        <div className="ai-point-body">
                          <span>{p.point}</span>
                          {!p.awarded && p.why && <span className="ai-point-why">{p.why}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="ms-block">
              <span className="ra-label">Mark scheme — tick each mark you earned</span>
              {card.msUrls.length > 0 ? (
                <div className="ms-with-ticks">
                  <div className="ms-images">
                    {card.msUrls.map((u) => <img key={u} className="ms-image" src={u} alt="Mark scheme" onError={(e) => { e.target.style.display = 'none'; setMsImgError(true) }} />)}
                    {msImgError && <p className="img-error">Mark scheme image failed to load.</p>}
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
        <button className="pill ghost" onClick={() => advance(queue.length)} disabled={queue.length <= 1}>Skip</button>
        <Counter counts={counts} />
        <div className="more-wrap" ref={moreRef}>
          <button className="pill ghost" onClick={() => setMenuOpen((o) => !o)}>More ▾</button>
          {menuOpen && (
            <div className="more-menu">
              {confirmAction === 'suspend' ? (
                <button className="confirm-btn" onClick={() => { setSuspended(card.id, true); refreshCounts(); advance(null) }}>Tap again to suspend</button>
              ) : (
                <button onClick={() => { setConfirmAction('suspend'); if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); confirmTimerRef.current = setTimeout(() => setConfirmAction((c) => c === 'suspend' ? null : c), 3000) }}>Suspend card</button>
              )}
              {confirmAction === 'reset' ? (
                <button className="confirm-btn" onClick={() => { resetCard(card.id); refreshCounts(); resetView() }}>Tap again to reset</button>
              ) : (
                <button onClick={() => { setConfirmAction('reset'); if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); confirmTimerRef.current = setTimeout(() => setConfirmAction((c) => c === 'reset' ? null : c), 3000) }}>Reset progress</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
