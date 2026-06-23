import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getItem, KEYS } from '../utils/localStorage.js'
import { quizCandidates, mergeSpec } from '../utils/priority.js'
import { getSpecPoint } from '../data/spec.js'
import { generateFlashcard, markFlashcard } from '../api/anthropic.js'
import {
  dueCards,
  dueCount,
  deckSpecIds,
  addLapse,
  gradeCard,
  gradeFromResult,
} from '../utils/reviewDeck.js'
import { logQuizAttempt } from '../utils/stats.js'
import { applySuperscript } from '../utils/superscript.js'
import MicroLesson from '../components/MicroLesson.jsx'

// Weighted-random spec point: prefer high-frequency, low-confidence ones, and
// give an extra boost to topics that have cards waiting in the review deck so
// fresh questions on weak areas surface between reviews ("both").
function pickSpec(pool, boostIds = []) {
  if (pool.length === 0) return null
  const boost = new Set(boostIds)
  // Weight = position-based (top of the prioritised list weighted heavier),
  // doubled for topics present in the review deck.
  const weights = pool.map((s, i) => (pool.length - i) * (boost.has(s.id) ? 2 : 1))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

export default function Flashcards() {
  const [params] = useSearchParams()
  const lockId = params.get('spec') // when set, drill only this topic
  const [pool, setPool] = useState([])
  const [spec, setSpec] = useState(null)
  const [question, setQuestion] = useState(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [seen, setSeen] = useState(0)
  const [scored, setScored] = useState(0)
  const [maxPossible, setMaxPossible] = useState(0)
  const [reviewsDue, setReviewsDue] = useState(0)
  // The deck card currently being reviewed, or null when it's a fresh question.
  const [reviewCard, setReviewCard] = useState(null)
  const inputRef = useRef(null)
  const superRef = useRef(false) // superscript-mode tracker for the answer field

  useEffect(() => {
    const progress = getItem(KEYS.specProgress, {})
    // Locked to one topic (from "Drill this now" on the Learn page)?
    if (lockId) {
      const sp = getSpecPoint(lockId)
      if (sp) {
        setPool([{ ...sp, confidence: progress[lockId]?.confidence ?? 0 }])
        return
      }
    }
    let candidates = quizCandidates(progress)
    if (candidates.length === 0) candidates = mergeSpec(progress) // fallback: all
    setPool(candidates)
    if (!lockId) setReviewsDue(dueCount())
  }, [lockId])

  async function nextCard() {
    if (pool.length === 0) return
    setLoading(true)
    setError('')
    setResult(null)
    setAnswer('')
    setQuestion(null)
    superRef.current = false // reset superscript mode for the new card

    // Anki-style: serve due reviews first (unless locked to a single topic).
    const due = lockId ? [] : dueCards()
    try {
      if (due.length > 0) {
        const card = due[0]
        const s = getSpecPoint(card.specId)
        setSpec(s)
        setReviewCard(card)
        // First review re-serves the exact question; later reviews use a fresh
        // question on the same topic ("both").
        const q =
          card.reps === 0 ? card.question : await generateFlashcard(s)
        setQuestion(q)
      } else {
        setReviewCard(null)
        const s = pickSpec(pool, deckSpecIds())
        setSpec(s)
        const q = await generateFlashcard(s)
        setQuestion(q)
      }
      setTimeout(() => inputRef.current?.focus(), 50)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function check() {
    if (!question || !spec || loading) return
    setLoading(true)
    setError('')
    try {
      const r = await markFlashcard(spec, question, answer)
      setResult(r)
      setSeen((n) => n + 1)
      setScored((n) => n + (r.score || 0))
      setMaxPossible((n) => n + (r.maxScore || question.marks || 1))
      logQuizAttempt({
        specId: spec.id,
        totalScore: r.score || 0,
        totalMax: r.maxScore || question.marks || 1,
      })

      const max = r.maxScore || question.marks || 1
      if (reviewCard) {
        // Grade the existing review card — reschedule or graduate it.
        gradeCard(reviewCard.id, gradeFromResult(r.score || 0, max))
        setReviewsDue(dueCount())
      } else if ((r.score || 0) < max) {
        // A new question answered wrong → schedule it for review (hidden).
        addLapse({
          specId: spec.id,
          frequency: spec.frequency,
          question: {
            question: question.question,
            context: question.context || '',
            marks: question.marks,
            command: question.command,
          },
          modelAnswer: r.modelAnswer || '',
        })
        setReviewsDue(dueCount())
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Enter to submit; after marking, Enter loads the next card.
  function onKeyDown(e) {
    // Live superscript: '^' then digits/signs become ²³ etc.
    if (applySuperscript(e, superRef, answer, setAnswer)) return
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
      e.preventDefault()
      if (result) nextCard()
      else check()
    }
  }

  const passed = result && (result.score || 0) >= (result.maxScore || 1)

  return (
    <div>
      <h1>Rapid Drill</h1>
      <p className="muted">
        One question at a time, weighted toward your weak high-frequency topics.
        Type your answer, hit <kbd>Enter</kbd> to mark, <kbd>Enter</kbd> again for
        the next. Anything you get wrong is scheduled for a hidden spaced-repetition
        review on a later day — wrong today, back tomorrow, then on widening
        intervals until it sticks.
      </p>

      {!lockId && reviewsDue > 0 && (
        <div className="alert info">
          🔁 {reviewsDue} review{reviewsDue === 1 ? '' : 's'} due today — these come
          up first.
        </div>
      )}

      {lockId && getSpecPoint(lockId) && (
        <div className="alert info">
          Locked to <strong>{lockId} — {getSpecPoint(lockId).title}</strong>.{' '}
          <Link to="/drill">Drill all topics instead →</Link>
        </div>
      )}

      {seen > 0 && (
        <div className="summary-bar">
          <div>
            <span className="big">
              {scored}/{maxPossible}
            </span>{' '}
            marks this session
          </div>
          <div className="muted">{seen} cards answered</div>
        </div>
      )}

      {error && <div className="alert error">{error}</div>}

      {!question && !loading && (
        <button onClick={nextCard} disabled={pool.length === 0}>
          {pool.length === 0 ? 'No topics available' : 'Start drilling →'}
        </button>
      )}

      {loading && !question && <div className="alert info">Loading question…</div>}

      {question && (
        <div
          className={`flashcard${
            result ? (passed ? ' fc-pass' : ' fc-fail') : ''
          }`}
        >
          <div className="fc-meta">
            {reviewCard && <span className="badge MED">🔁 REVIEW</span>}{' '}
            <span className="spec-ref">{spec.id}</span>{' '}
            <span className={`badge ${spec.frequency}`}>{spec.frequency}</span>{' '}
            · {spec.title} · {question.command} · {question.marks} mark
            {question.marks > 1 ? 's' : ''}
          </div>

          {question.context && <p className="q-context">{question.context}</p>}
          <p className="fc-question">{question.question}</p>

          <input
            ref={inputRef}
            type="text"
            className="fc-input"
            value={answer}
            placeholder="Type your answer and press Enter…"
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={!!result || loading}
          />
          {!result && (
            <p className="muted" style={{ margin: '0.3rem 0 0', fontSize: '0.8rem' }}>
              Tip: type <kbd>^</kbd> then digits for powers — e.g. 10<kbd>^</kbd>23 → 10²³
            </p>
          )}

          {!result ? (
            <div className="row-actions">
              <button onClick={check} disabled={loading}>
                {loading ? 'Marking…' : 'Mark (Enter)'}
              </button>
              <button className="secondary" onClick={nextCard} disabled={loading}>
                Skip
              </button>
            </div>
          ) : (
            <div style={{ marginTop: '0.75rem' }}>
              <div className={`score-line ${passed ? 'pass' : 'fail'}`}>
                {result.score} / {result.maxScore} {passed ? '✓' : '✗'}
              </div>
              <div style={{ margin: '0.3rem 0' }}>
                {result.gcseFlag && <span className="flag">GCSE phrasing</span>}
                {result.precisionFlag && <span className="flag">Imprecise</span>}
                {result.unitsFlag && <span className="flag">Units / sig figs</span>}
              </div>
              <p style={{ margin: '0.3rem 0' }}>{result.feedback}</p>
              <div className="model-answer">
                <strong>Full-marks answer:</strong> {result.modelAnswer}
              </div>
              {!passed && spec && (
                <MicroLesson
                  specId={spec.id}
                  question={question.question}
                  userAnswer={answer}
                  modelAnswer={result.modelAnswer}
                  score={result.score}
                  maxScore={result.maxScore}
                />
              )}
              <div className="row-actions">
                <button onClick={nextCard}>Next card (Enter) →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
