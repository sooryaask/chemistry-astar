import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getItem, KEYS } from '../utils/localStorage.js'
import { SPEC } from '../data/spec.js'
import { mergeSpec } from '../utils/priority.js'
import { getErrors, errorsDue } from '../utils/errorLog.js'
import { nextAction, weakestTopics, MASTERY_LABEL } from '../utils/guide.js'
import {
  dayOfChallenge,
  challengeDaysTotal,
  attemptsToday,
  currentStreak,
} from '../utils/stats.js'

const NAV_CARDS = [
  { to: '/plan', title: '21-Day Plan', desc: 'The frequency-first schedule — what to study today.' },
  { to: '/learn', title: 'Study', desc: 'Guided topic journey: learn → practise → master.' },
  { to: '/drill', title: 'Rapid Drill', desc: 'Fast recall questions with hidden spaced repetition.' },
  { to: '/quiz', title: 'AI Quiz', desc: 'Generate and mark exam questions on any spec point.' },
  { to: '/spec', title: 'Spec Tracker', desc: 'Confidence & completion across all 46 spec points.' },
  { to: '/errors', title: 'Error Log', desc: 'Most-missed high-frequency topics, ranked.' },
  { to: '/journal', title: 'Daily Log', desc: 'Reflections and the score trajectory.' },
  { to: '/papers', title: 'Past Papers', desc: 'Official papers and the score history.' },
]

function masteryClass(m) {
  return m === 'weak' ? 'HIGH' : m === 'developing' ? 'MED' : 'LOW'
}

export default function Dashboard() {
  const [progress, setProgress] = useState({})
  const [streak, setStreak] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [action, setAction] = useState(null)

  useEffect(() => {
    setProgress(getItem(KEYS.specProgress, {}))
    setStreak(currentStreak())
    setAttempts(attemptsToday())
    setAction(nextAction())
  }, [])

  const merged = mergeSpec(progress)
  const completeCount = merged.filter((s) => s.complete).length
  const pct = Math.round((completeCount / SPEC.length) * 100)
  const errors = getErrors()
  const due = errorsDue()
  const weak = weakestTopics(5, { progress })

  return (
    <div>
      <div className="day-banner">
        Day {dayOfChallenge()} of {challengeDaysTotal()}
      </div>
      <h1>Do this next</h1>

      {/* ===== The single next action ===== */}
      {action && (
        <div
          className="card"
          style={{ borderLeft: '6px solid var(--color-med)', marginBottom: '1.5rem' }}
        >
          <div className="muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>
            {action.kind === 'review'
              ? 'Spaced repetition'
              : action.kind === 'plan'
                ? "Today's plan"
                : action.kind === 'weak'
                  ? 'Weakest topic'
                  : 'Next'}
          </div>
          <h2 style={{ marginTop: '0.25rem' }}>{action.title}</h2>
          <p style={{ margin: '0.25rem 0 0.75rem' }}>{action.detail}</p>
          <Link to={action.to} className="badge MED" style={{ fontSize: '0.95rem', padding: '0.45rem 0.9rem' }}>
            {action.cta}
          </Link>
        </div>
      )}

      <p className="muted">
        GCSE Combined Science → A*-equivalent on OCR A AS Paper 1 (Modules 1–4) in{' '}
        {challengeDaysTotal()} days. <Link to="/plan">Full plan →</Link>
      </p>

      {/* ===== Metrics (secondary) ===== */}
      <div className="metric-grid">
        <div className="card">
          <div className="metric-value">{pct}%</div>
          <div className="metric-label">Spec complete ({completeCount}/{SPEC.length})</div>
        </div>
        <div className="card">
          <div className="metric-value">{attempts}</div>
          <div className="metric-label">Quiz attempts today</div>
        </div>
        <div className="card">
          <div className="metric-value">{errors.length}</div>
          <div className="metric-label">Error log items</div>
        </div>
        <div className="card">
          <div className="metric-value">{streak}</div>
          <div className="metric-label">Day study streak</div>
        </div>
      </div>

      {/* ===== Weakest topics (weakness targeting) ===== */}
      <h2>Your weakest high-frequency topics</h2>
      <p className="muted">Where the marks are leaking. Tap one to study it.</p>
      {weak.length === 0 ? (
        <div className="alert info">Everything is at full confidence. 🎉</div>
      ) : (
        <div>
          {weak.map((s) => (
            <div key={s.id} className="spec-card">
              <div className="spec-main">
                <span className="spec-ref">{s.id}</span>{' '}
                <strong>{s.title}</strong>{' '}
                <span className={`badge ${s.frequency}`}>{s.frequency}</span>{' '}
                <span className={`badge ${masteryClass(s.mastery)}`}>{MASTERY_LABEL[s.mastery]}</span>
                <div className="spec-desc">{s.description}</div>
              </div>
              <Link to={`/learn?spec=${s.id}`} className="badge MED" style={{ alignSelf: 'center' }}>
                Study →
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* ===== Reviews due ===== */}
      <h2>Reviews due ({due.length})</h2>
      {due.length === 0 ? (
        <div className="alert info">Nothing due right now.</div>
      ) : (
        <ul className="compact-list">
          {due.slice(0, 8).map((e) => (
            <li key={e.id}>
              <span className="spec-ref">{e.specId}</span>{' '}
              <span className={`badge ${e.frequency}`}>{e.frequency}</span> · missed
              ×{e.missCount} — {e.question.slice(0, 90)}
              {e.question.length > 90 ? '…' : ''}
            </li>
          ))}
        </ul>
      )}

      <h2>Everything else</h2>
      <div className="nav-card-grid">
        {NAV_CARDS.map((c) => (
          <Link key={c.to} to={c.to} className="card nav-card">
            <div className="nc-title">{c.title}</div>
            <div className="nc-desc">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
