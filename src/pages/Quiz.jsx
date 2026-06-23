import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getItem, KEYS } from '../utils/localStorage.js'
import { quizCandidates } from '../utils/priority.js'
import { getSpecPoint } from '../data/spec.js'
import { generateQuestions, markAnswers } from '../api/anthropic.js'
import { addError } from '../utils/errorLog.js'
import { unmasteredPrereqs } from '../utils/guide.js'
import { logQuizAttempt } from '../utils/stats.js'
import QuizQuestion from '../components/QuizQuestion.jsx'

export default function Quiz() {
  const [params] = useSearchParams()
  const lockId = params.get('spec')
  const [candidates, setCandidates] = useState([])
  const [specId, setSpecId] = useState(lockId || '')
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState(['', '', ''])
  const [marking, setMarking] = useState(null)
  const [variation, setVariation] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const progress = getItem(KEYS.specProgress, {})
    // When locked to a topic, that's the only candidate; else the prioritised list.
    if (lockId && getSpecPoint(lockId)) {
      setCandidates([{ ...getSpecPoint(lockId), confidence: progress[lockId]?.confidence ?? 0 }])
      setSpecId(lockId)
      return
    }
    const list = quizCandidates(progress)
    setCandidates(list)
    if (list.length && !specId) setSpecId(list[0].id)
  }, [lockId])

  const specPoint = specId ? getSpecPoint(specId) : null
  const prereqWarnings = specId ? unmasteredPrereqs(specId) : []

  async function handleGenerate(nextVariation = 0) {
    if (!specPoint) return
    setLoading(true)
    setError('')
    setMarking(null)
    setQuestions([])
    try {
      const qs = await generateQuestions(specPoint, nextVariation)
      setQuestions(qs)
      setAnswers(qs.map(() => ''))
      setVariation(nextVariation)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleMark() {
    if (!specPoint || questions.length === 0) return
    setLoading(true)
    setError('')
    try {
      const result = await markAnswers(specPoint, questions, answers)
      setMarking(result)

      // Log the attempt for streak / chart.
      logQuizAttempt({
        specId: specPoint.id,
        totalScore: result.totalScore,
        totalMax: result.totalMax,
      })

      // Any question below full marks -> error log.
      result.results.forEach((r, i) => {
        if (r.score < r.maxScore) {
          addError({
            specId: specPoint.id,
            question: questions[i]?.question || '',
            context: questions[i]?.context || '',
            marks: questions[i]?.marks,
            command: questions[i]?.command,
            userAnswer: answers[i] || '',
            modelAnswer: r.modelAnswer || '',
            frequency: specPoint.frequency,
          })
        }
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>AI Quiz</h1>
      <p className="muted">
        Pick a spec point — the list is ordered by what needs work most (high
        frequency, low confidence first).
      </p>

      <div className="field" style={{ maxWidth: 640 }}>
        <label>Spec point</label>
        <select
          value={specId}
          onChange={(e) => {
            setSpecId(e.target.value)
            setQuestions([])
            setMarking(null)
          }}
          style={{ width: '100%' }}
        >
          {candidates.length === 0 && <option>No candidates — all at full confidence</option>}
          {candidates.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} · {s.title} ({s.frequency}, conf {s.confidence}/3)
            </option>
          ))}
        </select>
      </div>

      <div className="row-actions">
        <button onClick={() => handleGenerate(0)} disabled={loading || !specPoint}>
          {loading && questions.length === 0 ? 'Generating…' : 'Generate questions'}
        </button>
      </div>

      {prereqWarnings.length > 0 && (
        <div className="alert warn">
          <strong>Heads up:</strong> You haven't mastered the prerequisites for this topic yet:{' '}
          {prereqWarnings.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <strong>{p.id}</strong> {p.title}
            </span>
          ))}
          . You can still quiz, but consider studying those first.
        </div>
      )}

      {error && <div className="alert error">{error}</div>}

      {specPoint && questions.length === 0 && !loading && !error && (
        <div className="alert info" style={{ marginTop: '1rem' }}>
          Spec point: <strong>{specPoint.title}</strong> — {specPoint.description}
        </div>
      )}

      {questions.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          {questions.map((q, i) => (
            <QuizQuestion
              key={q.id}
              question={q}
              answer={answers[i]}
              onChange={(val) => {
                const next = [...answers]
                next[i] = val
                setAnswers(next)
              }}
              result={marking?.results?.[i]}
              disabled={loading}
              specId={specId}
            />
          ))}

          {!marking && (
            <button onClick={handleMark} disabled={loading}>
              {loading ? 'Marking…' : 'Mark my answers'}
            </button>
          )}

          {marking && (
            <div>
              <div
                className={`alert ${
                  marking.totalScore === marking.totalMax ? 'info' : 'warn'
                }`}
              >
                <strong>
                  Total: {marking.totalScore} / {marking.totalMax}
                </strong>
                <p style={{ margin: '0.4rem 0 0' }}>{marking.overallFeedback}</p>
              </div>
              <button onClick={() => handleGenerate(variation + 1)} disabled={loading}>
                Quiz me again (different context)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
