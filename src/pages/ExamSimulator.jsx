import { useEffect, useRef, useState } from 'react'
import { getItem, KEYS } from '../utils/localStorage.js'
import { quizCandidates } from '../utils/priority.js'
import { generateQuestions, markAnswers } from '../api/anthropic.js'
import { addError } from '../utils/errorLog.js'
import { addLapse } from '../utils/reviewDeck.js'
import { logQuizAttempt } from '../utils/stats.js'
import { saveExamAttempt, getExamAttempts } from '../utils/examStore.js'
import ScoreChart from '../components/ScoreChart.jsx'

const MODES = {
  quick: { label: 'Quick (25 Qs, 30 min)', questions: 25, minutes: 30, specCount: 9 },
  full: { label: 'Full Paper 1 (all modules, 90 min)', questions: 60, minutes: 90, specCount: 20 },
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function ExamSimulator() {
  const [phase, setPhase] = useState('select') // select | generating | exam | marking | results
  const [mode, setMode] = useState('quick')
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState([])
  const [genProgress, setGenProgress] = useState('')
  const [startTime, setStartTime] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)

  const config = MODES[mode]

  // Countdown timer
  useEffect(() => {
    if (phase !== 'exam' || !startTime) return
    const limit = config.minutes * 60 * 1000

    function tick() {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, limit - elapsed)
      setTimeLeft(remaining)
      if (remaining <= 0) {
        handleSubmit()
      }
    }

    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase, startTime])

  // Add/remove exam lockdown class on body
  useEffect(() => {
    if (phase === 'exam') {
      document.body.classList.add('exam-lockdown')
    } else {
      document.body.classList.remove('exam-lockdown')
    }
    return () => document.body.classList.remove('exam-lockdown')
  }, [phase])

  async function startExam() {
    setPhase('generating')
    setError('')
    setQuestions([])
    setAnswers([])

    const progress = getItem(KEYS.specProgress, {})
    let candidates = quizCandidates(progress)
    if (candidates.length === 0) {
      setError('No spec points available to quiz.')
      setPhase('select')
      return
    }

    // Pick spec points
    const selected = shuffle(candidates).slice(0, config.specCount)
    const allQs = []

    try {
      // Generate in chunks of 3 to avoid rate limits
      for (let i = 0; i < selected.length; i += 3) {
        const chunk = selected.slice(i, i + 3)
        setGenProgress(`Generating questions... ${Math.min(i + 3, selected.length)}/${selected.length} topics`)
        const chunkResults = await Promise.all(
          chunk.map((spec) => generateQuestions(spec, 0).then((qs) =>
            qs.map((q) => ({ ...q, specId: spec.id, specTitle: spec.title, frequency: spec.frequency, module: spec.module }))
          ))
        )
        allQs.push(...chunkResults.flat())
      }

      // Trim to target question count and shuffle
      const trimmed = shuffle(allQs).slice(0, config.questions)
      setQuestions(trimmed)
      setAnswers(trimmed.map(() => ''))
      setStartTime(Date.now())
      setPhase('exam')
    } catch (err) {
      setError(err.message)
      setPhase('select')
    }
  }

  async function handleSubmit() {
    clearInterval(timerRef.current)
    const timeTaken = startTime ? Date.now() - startTime : 0
    setPhase('marking')
    setLoading(true)

    try {
      // Group questions by specId for batch marking
      const bySpec = {}
      questions.forEach((q, i) => {
        if (!bySpec[q.specId]) bySpec[q.specId] = { indices: [], qs: [], ans: [] }
        bySpec[q.specId].indices.push(i)
        bySpec[q.specId].qs.push(q)
        bySpec[q.specId].ans.push(answers[i] || '')
      })

      const allResults = new Array(questions.length)
      let totalScore = 0
      let totalMax = 0

      // Mark in chunks
      const specIds = Object.keys(bySpec)
      for (let i = 0; i < specIds.length; i += 3) {
        const chunk = specIds.slice(i, i + 3)
        const markResults = await Promise.all(
          chunk.map(async (specId) => {
            const group = bySpec[specId]
            const spec = { id: specId, title: group.qs[0].specTitle }
            const result = await markAnswers(spec, group.qs, group.ans)
            return { specId, group, result }
          })
        )

        for (const { specId, group, result } of markResults) {
          result.results.forEach((r, j) => {
            const origIdx = group.indices[j]
            allResults[origIdx] = { ...r, specId, specTitle: group.qs[j].specTitle, module: group.qs[j].module }
            totalScore += r.score || 0
            totalMax += r.maxScore || 0

            logQuizAttempt({ specId, totalScore: r.score || 0, totalMax: r.maxScore || 0 })

            if (r.score < r.maxScore) {
              addError({
                specId,
                question: group.qs[j].question,
                context: group.qs[j].context || '',
                marks: group.qs[j].marks,
                command: group.qs[j].command,
                userAnswer: group.ans[j] || '',
                modelAnswer: r.modelAnswer || '',
                frequency: group.qs[j].frequency,
              })
              addLapse({
                specId,
                frequency: group.qs[j].frequency,
                question: { question: group.qs[j].question, context: group.qs[j].context || '', marks: group.qs[j].marks, command: group.qs[j].command },
                modelAnswer: r.modelAnswer || '',
              })
            }
          })
        }
      }

      // Module breakdown
      const moduleMap = {}
      allResults.forEach((r) => {
        if (!r) return
        const mod = r.module || 'Unknown'
        if (!moduleMap[mod]) moduleMap[mod] = { score: 0, max: 0, count: 0 }
        moduleMap[mod].score += r.score || 0
        moduleMap[mod].max += r.maxScore || 0
        moduleMap[mod].count += 1
      })

      const examResult = {
        mode,
        totalScore,
        totalMax,
        pct: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0,
        timeTaken,
        timeLimit: config.minutes * 60 * 1000,
        modules: moduleMap,
        questionResults: allResults,
        questionCount: questions.length,
      }

      saveExamAttempt(examResult)
      setResults(examResult)
      setPhase('results')
    } catch (err) {
      setError(err.message)
      setPhase('exam') // let them try submitting again
    } finally {
      setLoading(false)
    }
  }

  function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  // Past attempt trend data for chart
  const pastAttempts = getExamAttempts()
    .filter((a) => a.mode === mode)
    .map((a, i) => ({
      label: `#${i + 1}`,
      value: a.pct || 0,
    }))

  return (
    <div>
      <h1>Exam Simulator</h1>

      {phase === 'select' && (
        <>
          <p className="muted">
            Timed, exam-conditions practice. All questions visible at once, countdown timer,
            sidebar hidden. Results show your module breakdown and trend over time.
          </p>

          <div className="field" style={{ maxWidth: 400 }}>
            <label>Exam mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {Object.entries(MODES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {pastAttempts.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>Past attempts — {MODES[mode].label}</h3>
              <ScoreChart data={pastAttempts} yLabel="Score %" />
            </div>
          )}

          <button onClick={startExam}>Start exam</button>
          {error && <div className="alert error">{error}</div>}
        </>
      )}

      {phase === 'generating' && (
        <div className="alert info">{genProgress || 'Preparing exam...'}</div>
      )}

      {phase === 'exam' && (
        <>
          <div className="exam-timer">
            <span className={timeLeft < 60000 ? 'exam-timer-urgent' : ''}>
              {formatTime(timeLeft)}
            </span>
          </div>

          <div className="exam-questions">
            {questions.map((q, i) => (
              <div key={i} className="question-block">
                <div className="q-meta">
                  Q{i + 1} · {q.specId} · {q.command} · {q.marks} mark{q.marks > 1 ? 's' : ''}
                </div>
                {q.context && <div className="q-context">{q.context}</div>}
                <div className="q-text">{q.question}</div>
                <textarea
                  rows={q.marks >= 3 ? 4 : 2}
                  value={answers[i]}
                  placeholder="Type your answer..."
                  onChange={(e) => {
                    const next = [...answers]
                    next[i] = e.target.value
                    setAnswers(next)
                  }}
                />
              </div>
            ))}
          </div>

          <div className="row-actions" style={{ marginTop: '1.5rem' }}>
            <button onClick={handleSubmit}>Submit exam</button>
            <div className="muted">{questions.length} questions · {formatTime(timeLeft)} remaining</div>
          </div>
        </>
      )}

      {phase === 'marking' && (
        <div className="alert info">Marking your exam... this may take a minute.</div>
      )}

      {phase === 'results' && results && (
        <div>
          <div className={`alert ${results.pct >= 80 ? 'info' : 'warn'}`}>
            <strong>Result: {results.totalScore}/{results.totalMax} ({results.pct}%)</strong>
            <p style={{ margin: '0.3rem 0 0' }}>
              Time: {formatTime(results.timeTaken)} / {formatTime(results.timeLimit)}
              {' · '}{results.questionCount} questions
            </p>
          </div>

          <h2>Module breakdown</h2>
          <div className="mix-breakdown">
            {Object.entries(results.modules)
              .sort(([a], [b]) => String(a).localeCompare(String(b)))
              .map(([mod, data]) => (
                <div key={mod} className="mix-topic-row">
                  <div className="mix-topic-info">
                    <strong>Module {mod}</strong>
                    <span className="muted"> · {data.count} questions</span>
                  </div>
                  <div className="mix-topic-bar-wrap">
                    <div className="mix-topic-bar">
                      <div
                        className={`mix-topic-bar-fill ${data.max > 0 && data.score >= data.max * 0.8 ? 'pass' : 'fail'}`}
                        style={{ width: `${data.max > 0 ? Math.round((data.score / data.max) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="mix-topic-score">{data.score}/{data.max}</span>
                  </div>
                </div>
              ))}
          </div>

          {pastAttempts.length > 1 && (
            <div className="card" style={{ marginTop: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>Trend</h3>
              <ScoreChart data={pastAttempts} yLabel="Score %" />
            </div>
          )}

          <h2>Question details</h2>
          {results.questionResults.map((r, i) => r && (
            <div key={i} className={`question-block ${r.score >= r.maxScore ? 'result-pass' : 'result-fail'}`}>
              <div className="q-meta">
                Q{i + 1} · {r.specId} · {r.specTitle}
              </div>
              <div className="q-text">{questions[i]?.question}</div>
              <p className="muted"><strong>Your answer:</strong> {answers[i] || '[blank]'}</p>
              <div className={`score-line ${r.score >= r.maxScore ? 'pass' : 'fail'}`}>
                {r.score}/{r.maxScore}
              </div>
              <p style={{ margin: '0.3rem 0' }}>{r.feedback}</p>
              {r.modelAnswer && (
                <div className="model-answer">
                  <strong>Model answer:</strong> {r.modelAnswer}
                </div>
              )}
            </div>
          ))}

          <div className="row-actions" style={{ marginTop: '1.5rem' }}>
            <button onClick={() => { setPhase('select'); setResults(null); setQuestions([]); setAnswers([]); }}>
              Back to exam select
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
