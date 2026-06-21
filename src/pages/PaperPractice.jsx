import { useState, useMemo } from 'react'
import paperIndex from '../data/paperIndex.json'
import { assessPaperQuestion } from '../api/anthropic.js'

// Build topic -> questions list from the index
function buildTopicMap(index) {
  const map = {}
  for (const [paper, data] of Object.entries(index)) {
    for (const q of data.questions || []) {
      const topic = q.topic || 'Uncategorised'
      if (!map[topic]) map[topic] = []
      map[topic].push({ ...q, paper })
    }
  }
  return map
}

// "June 2017 QP - Paper 1 OCR (A) Chemistry AS-Level.pdf" -> "June_2017_QP"
function slug(pdfName) {
  return pdfName.split(' - ')[0].replaceAll(' ', '_')
}

function qpImageUrl(pdfName, page, questionNumber) {
  return `${import.meta.env.BASE_URL}rendered/${slug(pdfName)}_p${page}_q${questionNumber}.png`
}

function msImageUrl(pdfName, page) {
  return `${import.meta.env.BASE_URL}rendered/${slug(pdfName)}_p${page}.png`
}

// Nice display name: "June 2017 QP - Paper 1 ..." -> "June 2017"
function paperLabel(pdfName) {
  return pdfName.split(' QP ')[0] || pdfName
}

// MCQ = 1-mark question (Q1-Q20 in OCR papers are always multiple choice)
function isMcq(question) {
  return question.marks === 1
}

const MCQ_OPTIONS = ['A', 'B', 'C', 'D']

export default function PaperPractice() {
  const topicMap = useMemo(() => buildTopicMap(paperIndex), [])
  const topics = useMemo(
    () => Object.keys(topicMap).sort((a, b) => topicMap[b].length - topicMap[a].length),
    [topicMap]
  )

  const [topic, setTopic] = useState(topics[0] || '')
  const [question, setQuestion] = useState(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showMs, setShowMs] = useState(false)

  const mcq = question && isMcq(question)

  function pickQuestion() {
    const pool = topicMap[topic] || []
    if (!pool.length) return
    const q = pool[Math.floor(Math.random() * pool.length)]
    setQuestion(q)
    setAnswer('')
    setResult(null)
    setError('')
    setShowMs(false)
  }

  async function handleMark() {
    if (!question || !answer.trim()) return
    setLoading(true)
    setError('')
    try {
      const qpUrl = qpImageUrl(question.paper, question.page, question.number)
      const msUrls = (question.msPages || []).map((p) =>
        msImageUrl(question.msPaper, p)
      )
      const res = await assessPaperQuestion({
        qpImageUrl: qpUrl,
        msImageUrls: msUrls,
        questionNo: question.number,
        answer,
        isMcq: mcq,
      })
      setResult(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>Past Paper Practice</h1>
      <p className="muted">
        Real questions from OCR past papers, marked against the official mark scheme by AI.
      </p>

      <div className="field" style={{ maxWidth: 640 }}>
        <label>Topic</label>
        <select
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value)
            setQuestion(null)
            setResult(null)
          }}
          style={{ width: '100%' }}
        >
          {topics.map((t) => (
            <option key={t} value={t}>
              {t} ({topicMap[t].length} questions)
            </option>
          ))}
        </select>
      </div>

      <div className="row-actions">
        <button onClick={pickQuestion} disabled={loading}>
          Pick a random question
        </button>
      </div>

      {question && (
        <div style={{ marginTop: '1.5rem' }}>
          <div className="alert info" style={{ marginBottom: '1rem' }}>
            <strong>Q{question.number}</strong> — {question.summary} ·{' '}
            {question.marks} mark{question.marks !== 1 ? 's' : ''} ·{' '}
            {paperLabel(question.paper)}
            {mcq && <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>(Multiple choice)</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
            {/* Left: question paper page */}
            <div>
              <h3 style={{ marginTop: 0 }}>Question Paper</h3>
              <img
                src={qpImageUrl(question.paper, question.page, question.number)}
                alt={`Question ${question.number}`}
                style={{ width: '100%', border: '1px solid var(--border, #ddd)', borderRadius: 6 }}
              />
            </div>

            {/* Right: answer + results */}
            <div>
              <h3 style={{ marginTop: 0 }}>Your Answer</h3>

              {mcq ? (
                /* MCQ: radio buttons for A/B/C/D */
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {MCQ_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setAnswer(opt)}
                      disabled={loading || !!result}
                      style={{
                        padding: '0.6rem 1.4rem',
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        border: '2px solid',
                        borderColor: answer === opt ? 'var(--accent, #2563eb)' : 'var(--border, #ddd)',
                        background: answer === opt ? 'var(--accent, #2563eb)' : 'transparent',
                        color: answer === opt ? '#fff' : 'inherit',
                        borderRadius: 8,
                        cursor: loading || result ? 'default' : 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                /* Written question: textarea */
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer here…"
                  rows={8}
                  style={{ width: '100%', resize: 'vertical' }}
                  disabled={loading}
                />
              )}

              <div style={{ marginTop: '0.75rem' }}>
                {!result && (
                  <button onClick={handleMark} disabled={loading || !answer.trim()}>
                    {loading ? 'Marking…' : 'Mark my answer'}
                  </button>
                )}
              </div>

              {error && <div className="alert error" style={{ marginTop: '1rem' }}>{error}</div>}

              {result && (
                <div style={{ marginTop: '1rem' }}>
                  {!result.found ? (
                    <div className="alert warn">
                      Could not locate Q{question.number} on the page. Try a different question.
                    </div>
                  ) : mcq ? (
                    /* MCQ result display */
                    <>
                      <div className={`alert ${result.score === 1 ? 'info' : 'error'}`}>
                        <strong>
                          {result.score === 1 ? 'Correct!' : `Incorrect — the answer is ${result.correctOption}`}
                        </strong>
                      </div>

                      {/* Explanation cards */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                        {/* Simple explanation */}
                        <div style={{
                          background: 'var(--surface, #f8fafc)',
                          border: '1px solid var(--border, #e2e8f0)',
                          borderRadius: 8,
                          padding: '0.85rem 1rem',
                        }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent, #2563eb)', marginBottom: '0.35rem' }}>
                            In Simple Terms
                          </div>
                          <p style={{ margin: 0, lineHeight: 1.55 }}>{result.simpleExplanation || '—'}</p>
                        </div>

                        {/* Step by step */}
                        <div style={{
                          background: 'var(--surface, #f8fafc)',
                          border: '1px solid var(--border, #e2e8f0)',
                          borderRadius: 8,
                          padding: '0.85rem 1rem',
                        }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent, #2563eb)', marginBottom: '0.35rem' }}>
                            Step-by-Step Working
                          </div>
                          <p style={{ margin: 0, lineHeight: 1.55, whiteSpace: 'pre-line' }}>{result.stepByStep || '—'}</p>
                        </div>

                        {/* Why other options are wrong */}
                        <div style={{
                          background: 'var(--surface, #f8fafc)',
                          border: '1px solid var(--border, #e2e8f0)',
                          borderRadius: 8,
                          padding: '0.85rem 1rem',
                        }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#b45309', marginBottom: '0.35rem' }}>
                            Why the Other Options Are Wrong
                          </div>
                          <p style={{ margin: 0, lineHeight: 1.55, whiteSpace: 'pre-line' }}>{result.whyOtherOptionsWrong || '—'}</p>
                        </div>

                        {/* Exam tip */}
                        <div style={{
                          background: '#fffbeb',
                          border: '1px solid #fbbf24',
                          borderRadius: 8,
                          padding: '0.85rem 1rem',
                        }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#92400e', marginBottom: '0.35rem' }}>
                            Exam Tip
                          </div>
                          <p style={{ margin: 0, lineHeight: 1.55, fontWeight: 500 }}>{result.examTip || '—'}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Written question result display */
                    <>
                      <div className={`alert ${result.score === result.questionMarks ? 'info' : 'warn'}`}>
                        <strong>
                          Your mark: {result.score} / {result.questionMarks}
                        </strong>
                      </div>

                      <div style={{ marginTop: '0.75rem' }}>
                        <strong>What went well</strong>
                        <p>{result.whatWentWell || '—'}</p>
                      </div>

                      <div style={{ marginTop: '0.75rem' }}>
                        <strong>How to improve</strong>
                        <p>{result.howToImprove || '—'}</p>
                      </div>

                      <details style={{ marginTop: '0.75rem' }}>
                        <summary><strong>Model answer (full marks)</strong></summary>
                        <p style={{ marginTop: '0.5rem' }}>{result.markSchemeAnswer || '—'}</p>
                      </details>
                    </>
                  )}

                  {/* Mark scheme reveal */}
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={showMs}
                        onChange={(e) => setShowMs(e.target.checked)}
                      />{' '}
                      Reveal official mark scheme
                    </label>
                  </div>

                  {showMs && question.msPages?.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      {question.msPages.map((p) => (
                        <img
                          key={p}
                          src={msImageUrl(question.msPaper, p)}
                          alt={`Mark scheme page ${p}`}
                          style={{ width: '100%', border: '1px solid var(--border, #ddd)', borderRadius: 6, marginBottom: '0.5rem' }}
                        />
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: '1rem' }}>
                    <button onClick={pickQuestion}>
                      Next question
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
