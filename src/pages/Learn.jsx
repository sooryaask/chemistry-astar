import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getItem, setItem, KEYS } from '../utils/localStorage.js'
import { quizCandidates } from '../utils/priority.js'
import { getSpecPoint } from '../data/spec.js'
import { generateLesson } from '../api/anthropic.js'
import { topicMastery, MASTERY_LABEL } from '../utils/guide.js'
import { CONFIDENCE_LABELS } from '../config.js'

export default function Learn() {
  const [params, setParams] = useSearchParams()
  const [candidates, setCandidates] = useState([])
  const [specId, setSpecId] = useState(params.get('spec') || '')
  const [lesson, setLesson] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cached, setCached] = useState(false)
  const [progress, setProgress] = useState({})

  useEffect(() => {
    setProgress(getItem(KEYS.specProgress, {}))
    const list = quizCandidates(getItem(KEYS.specProgress, {}))
    setCandidates(list)
    if (!specId && list.length) setSpecId(list[0].id)
  }, [])

  useEffect(() => {
    if (!specId) return
    const cache = getItem(KEYS.lessons, {})
    if (cache[specId]) {
      setLesson(cache[specId])
      setCached(true)
    } else {
      setLesson(null)
      setCached(false)
    }
    setError('')
  }, [specId])

  const specPoint = specId ? getSpecPoint(specId) : null
  const p = progress[specId] || {}
  const confidence = typeof p.confidence === 'number' ? p.confidence : 0
  const complete = !!p.complete
  const mastery = specId ? topicMastery(specId, { progress }) : null

  async function teach() {
    if (!specPoint) return
    setLoading(true)
    setError('')
    try {
      const result = await generateLesson(specPoint)
      setLesson(result)
      setCached(false)
      const cache = getItem(KEYS.lessons, {})
      cache[specId] = result
      setItem(KEYS.lessons, cache)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function persist(next) {
    setProgress(next)
    setItem(KEYS.specProgress, next)
  }
  function setConfidence(v) {
    persist({ ...progress, [specId]: { ...progress[specId], confidence: v } })
  }
  function setComplete(v) {
    persist({ ...progress, [specId]: { ...progress[specId], complete: v } })
  }

  function onSelect(id) {
    setSpecId(id)
    setParams(id ? { spec: id } : {})
  }

  return (
    <div>
      <h1>Study a topic</h1>
      <p className="muted">
        The guided journey for one topic: <strong>1 · Learn</strong> →{' '}
        <strong>2 · Practise</strong> → <strong>3 · Master</strong>. Lessons are
        cached so re-opening is instant.
      </p>

      <div className="field" style={{ maxWidth: 640 }}>
        <label>Topic</label>
        <select value={specId} onChange={(e) => onSelect(e.target.value)} style={{ width: '100%' }}>
          {candidates.length === 0 && <option>All topics at full confidence</option>}
          {candidates.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} · {s.title} ({s.frequency}, conf {s.confidence}/3)
            </option>
          ))}
        </select>
      </div>

      {specPoint && (
        <div className="alert info" style={{ marginTop: '0.75rem' }}>
          <strong>{specPoint.id} — {specPoint.title}</strong>{' '}
          <span className={`badge ${specPoint.frequency}`}>{specPoint.frequency}</span>{' '}
          {mastery && <span className={`badge ${masteryClass(mastery)}`}>{MASTERY_LABEL[mastery]}</span>}
          <div className="muted" style={{ marginTop: '0.3rem' }}>{specPoint.description}</div>
        </div>
      )}

      {/* ===== Step 1: Learn ===== */}
      <h2>1 · Learn</h2>
      <div className="row-actions">
        <button onClick={teach} disabled={loading || !specPoint}>
          {loading ? 'Teaching…' : lesson ? 'Re-teach' : 'Teach me this topic'}
        </button>
        {lesson && cached && (
          <span className="muted" style={{ alignSelf: 'center' }}>
            Showing a saved lesson — “Re-teach” for a fresh one.
          </span>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}

      {lesson && (
        <div style={{ marginTop: '1rem' }}>
          <Section title="Key ideas">
            <ul>{(lesson.keyIdeas || []).map((k, i) => <li key={i}>{k}</li>)}</ul>
          </Section>
          <Section title="Must-know definitions">
            {(lesson.mustKnow || []).map((m, i) => (
              <p key={i} style={{ margin: '0.35rem 0' }}>
                <strong>{m.term}:</strong> {m.definition}
              </p>
            ))}
          </Section>
          <Section title="Mark-scheme phrases (use these exact words)">
            <ul>{(lesson.markSchemePhrases || []).map((x, i) => <li key={i}><code>{x}</code></li>)}</ul>
          </Section>
          {lesson.commandWords && (
            <Section title="How it's examined (command words)">
              <p style={{ whiteSpace: 'pre-wrap' }}>{lesson.commandWords}</p>
            </Section>
          )}
          {lesson.examinerTips && lesson.examinerTips.length > 0 && (
            <Section title="Examiner tips">
              <ul>{lesson.examinerTips.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </Section>
          )}
          <Section title="Worked example">
            <p style={{ whiteSpace: 'pre-wrap' }}>{lesson.workedExample}</p>
          </Section>
          <Section title="Common traps (lose-mark mistakes)">
            <ul>{(lesson.commonTraps || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
          </Section>
        </div>
      )}

      {/* ===== Step 2: Practise ===== */}
      <h2>2 · Practise</h2>
      <p className="muted">Retrieve it straight away — that's where the learning sticks.</p>
      <div className="row-actions">
        <Link to={`/drill?spec=${specId}`} className="badge MED">Drill this topic →</Link>
        <Link to={`/quiz?spec=${specId}`} className="badge MED">Quiz this topic →</Link>
        <span className="muted" style={{ alignSelf: 'center' }}>
          Then sit real past-paper questions on this in Smart Mark.
        </span>
      </div>

      {/* ===== Step 3: Master ===== */}
      <h2>3 · Master</h2>
      <div className="card">
        <div className="confidence-row">
          <span>Confidence:</span>
          <input
            type="range"
            min="0"
            max="3"
            step="1"
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
          />
          <strong>{confidence}</strong>
          <span className="muted">{CONFIDENCE_LABELS[confidence]}</span>
        </div>
        <label style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
          <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} />
          <span>Mark this topic complete</span>
        </label>
      </div>
    </div>
  )
}

function masteryClass(m) {
  return m === 'weak' ? 'HIGH' : m === 'developing' ? 'MED' : 'LOW'
}

function Section({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: '0.85rem' }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </div>
  )
}
