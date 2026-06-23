import { useEffect, useState } from 'react'
import { getItem, setItem, KEYS } from '../utils/localStorage.js'
import { quizCandidates } from '../utils/priority.js'
import { generateFlashcard, markFlashcard } from '../api/anthropic.js'
import { addError } from '../utils/errorLog.js'
import { addLapse } from '../utils/reviewDeck.js'
import { logQuizAttempt } from '../utils/stats.js'
import MicroLesson from '../components/MicroLesson.jsx'

// Pick n random items from arr, weighted toward the front (high-frequency, low-confidence).
function weightedSample(arr, n) {
  const picked = []
  const pool = [...arr]
  while (picked.length < n && pool.length > 0) {
    const weights = pool.map((_, i) => pool.length - i)
    const total = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i]
      if (r <= 0) {
        picked.push(pool.splice(i, 1)[0])
        break
      }
    }
  }
  return picked
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function MixedPractice() {
  const [phase, setPhase] = useState('idle') // idle | generating | drilling | results
  const [topics, setTopics] = useState([])
  const [cards, setCards] = useState([])
  const [current, setCurrent] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function startSession() {
    setPhase('generating')
    setError('')
    setResults([])
    setCurrent(0)

    const progress = getItem(KEYS.specProgress, {})
    let candidates = quizCandidates(progress)
    if (candidates.length < 3) candidates = candidates.length > 0 ? candidates : []

    const selected = weightedSample(candidates, Math.min(4, candidates.length))
    setTopics(selected)

    try {
      // Generate 2-3 questions per topic in parallel
      const perTopic = await Promise.all(
        selected.map(async (spec) => {
          const count = spec.frequency === 'HIGH' ? 3 : 2
          const qs = []
          for (let i = 0; i < count; i++) {
            const q = await generateFlashcard(spec)
            qs.push({ ...q, specId: spec.id, specTitle: spec.title, frequency: spec.frequency, spec })
          }
          return qs
        })
      )

      const allCards = shuffle(perTopic.flat())
      setCards(allCards)
      setPhase('drilling')
      setAnswer('')
      setResult(null)
    } catch (err) {
      setError(err.message)
      setPhase('idle')
    }
  }

  async function checkAnswer() {
    if (loading || !cards[current]) return
    setLoading(true)
    setError('')
    try {
      const card = cards[current]
      const r = await markFlashcard(card.spec, card, answer)
      setResult(r)

      const entry = { ...card, answer, result: r }
      setResults((prev) => [...prev, entry])

      logQuizAttempt({
        specId: card.specId,
        totalScore: r.score || 0,
        totalMax: r.maxScore || card.marks || 1,
      })

      const max = r.maxScore || card.marks || 1
      if ((r.score || 0) < max) {
        addError({
          specId: card.specId,
          question: card.question,
          context: card.context || '',
          marks: card.marks,
          command: card.command,
          userAnswer: answer,
          modelAnswer: r.modelAnswer || '',
          frequency: card.frequency,
        })
        addLapse({
          specId: card.specId,
          frequency: card.frequency,
          question: { question: card.question, context: card.context || '', marks: card.marks, command: card.command },
          modelAnswer: r.modelAnswer || '',
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function nextCard() {
    if (current + 1 >= cards.length) {
      setPhase('results')
      // Save session history
      const history = getItem(KEYS.mixedPracticeHistory, [])
      const totalScore = results.reduce((a, r) => a + (r.result?.score || 0), 0)
      const totalMax = results.reduce((a, r) => a + (r.result?.maxScore || 1), 0)
      history.push({
        ts: Date.now(),
        topics: topics.map((t) => t.id),
        totalScore,
        totalMax,
        cards: results.length + 1,
      })
      if (history.length > 50) history.shift()
      setItem(KEYS.mixedPracticeHistory, history)
      return
    }
    setCurrent((n) => n + 1)
    setAnswer('')
    setResult(null)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (result) nextCard()
      else checkAnswer()
    }
  }

  // Results breakdown by topic
  const topicBreakdown = topics.map((t) => {
    const topicResults = results.filter((r) => r.specId === t.id)
    const score = topicResults.reduce((a, r) => a + (r.result?.score || 0), 0)
    const max = topicResults.reduce((a, r) => a + (r.result?.maxScore || 1), 0)
    return { id: t.id, title: t.title, frequency: t.frequency, score, max, count: topicResults.length }
  })

  const totalScore = results.reduce((a, r) => a + (r.result?.score || 0), 0)
  const totalMax = results.reduce((a, r) => a + (r.result?.maxScore || 1), 0)

  return (
    <div>
      <h1>Mixed Practice</h1>
      <p className="muted">
        Interleaved practice across multiple topics — the most effective way to build
        long-term retention. Questions from 3-4 different spec points are shuffled
        together so your brain has to switch between concepts.
      </p>

      {phase === 'idle' && (
        <button onClick={startSession}>Start mixed session</button>
      )}

      {phase === 'generating' && (
        <div className="alert info">Generating questions across {topics.length} topics...</div>
      )}

      {error && <div className="alert error">{error}</div>}

      {phase === 'drilling' && cards[current] && (
        <div>
          <div className="summary-bar">
            <div>
              <span className="big">{current + 1}/{cards.length}</span> questions
            </div>
            <div className="muted">{totalScore}/{totalMax} marks so far</div>
          </div>

          <div className={`flashcard${result ? (result.score >= result.maxScore ? ' fc-pass' : ' fc-fail') : ''}`}>
            <div className="fc-meta">
              <span className="spec-ref">{cards[current].specId}</span>{' '}
              <span className={`badge ${cards[current].frequency}`}>{cards[current].frequency}</span>{' '}
              · {cards[current].specTitle} · {cards[current].command} · {cards[current].marks} mark{cards[current].marks > 1 ? 's' : ''}
            </div>

            {cards[current].context && <p className="q-context">{cards[current].context}</p>}
            <p className="fc-question">{cards[current].question}</p>

            <input
              type="text"
              className="fc-input"
              value={answer}
              placeholder="Type your answer and press Enter..."
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={!!result || loading}
              autoFocus
            />

            {!result ? (
              <div className="row-actions">
                <button onClick={checkAnswer} disabled={loading}>
                  {loading ? 'Marking...' : 'Mark (Enter)'}
                </button>
                <button className="secondary" onClick={nextCard} disabled={loading}>Skip</button>
              </div>
            ) : (
              <div style={{ marginTop: '0.75rem' }}>
                <div className={`score-line ${result.score >= result.maxScore ? 'pass' : 'fail'}`}>
                  {result.score} / {result.maxScore} {result.score >= result.maxScore ? '\u2713' : '\u2717'}
                </div>
                <p style={{ margin: '0.3rem 0' }}>{result.feedback}</p>
                <div className="model-answer">
                  <strong>Full-marks answer:</strong> {result.modelAnswer}
                </div>
                {result.score < result.maxScore && cards[current]?.spec && (
                  <MicroLesson
                    specId={cards[current].specId}
                    question={cards[current].question}
                    userAnswer={answer}
                    modelAnswer={result.modelAnswer}
                    score={result.score}
                    maxScore={result.maxScore}
                  />
                )}
                <div className="row-actions">
                  <button onClick={nextCard}>
                    {current + 1 >= cards.length ? 'See results' : 'Next card (Enter) \u2192'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'results' && (
        <div>
          <div className={`alert ${totalScore >= totalMax * 0.8 ? 'info' : 'warn'}`}>
            <strong>Session complete: {totalScore}/{totalMax} marks ({totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0}%)</strong>
          </div>

          <h2>Breakdown by topic</h2>
          <div className="mix-breakdown">
            {topicBreakdown.map((t) => (
              <div key={t.id} className="mix-topic-row">
                <div className="mix-topic-info">
                  <span className="spec-ref">{t.id}</span>{' '}
                  <strong>{t.title}</strong>{' '}
                  <span className={`badge ${t.frequency}`}>{t.frequency}</span>
                </div>
                <div className="mix-topic-bar-wrap">
                  <div className="mix-topic-bar">
                    <div
                      className={`mix-topic-bar-fill ${t.max > 0 && t.score >= t.max ? 'pass' : 'fail'}`}
                      style={{ width: `${t.max > 0 ? Math.round((t.score / t.max) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="mix-topic-score">{t.score}/{t.max}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="row-actions" style={{ marginTop: '1.5rem' }}>
            <button onClick={() => { setPhase('idle'); setResults([]); setCurrent(0); setCards([]); }}>
              Start another session
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
