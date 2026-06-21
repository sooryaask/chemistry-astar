import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getItem, KEYS } from '../utils/localStorage.js'
import { SPEC } from '../data/spec.js'
import { mergeSpec } from '../utils/priority.js'
import { getErrors, errorsDue } from '../utils/errorLog.js'
import { nextAction, weakestTopics, MASTERY_LABEL, buildDailyAgenda, paceStatus } from '../utils/guide.js'
import {
  dayOfChallenge,
  challengeDaysTotal,
  attemptsToday,
  currentStreak,
} from '../utils/stats.js'
import { getTodayTime } from '../components/PomodoroTimer.jsx'

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

const AGENDA_ICONS = {
  review: '↻',
  errors: '!',
  learn: '◈',
  practice: '✎',
  strengthen: '▲',
}

function masteryClass(m) {
  return m === 'weak' ? 'HIGH' : m === 'developing' ? 'MED' : 'LOW'
}

export default function Dashboard() {
  const [progress, setProgress] = useState({})
  const [streak, setStreak] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [action, setAction] = useState(null)
  const [agenda, setAgenda] = useState([])
  const [pace, setPace] = useState(null)
  const [todayTime, setTodayTime] = useState({ total: 0, byPage: {} })

  useEffect(() => {
    setProgress(getItem(KEYS.specProgress, {}))
    setStreak(currentStreak())
    setAttempts(attemptsToday())
    setAction(nextAction())
    setAgenda(buildDailyAgenda())
    setPace(paceStatus())
    setTodayTime(getTodayTime())
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
          style={{ borderLeft: '6px solid var(--color-accent)', marginBottom: '1.5rem' }}
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

      {/* ===== Pace Tracker ===== */}
      {pace && (
        <div className={`card pace-card pace-${pace.status}`} style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div className="pace-status-label">
                {pace.status === 'ahead' ? 'Ahead of schedule' : pace.status === 'behind' ? 'Behind schedule' : 'On track'}
              </div>
              <div className="muted" style={{ fontSize: '0.82rem' }}>
                {pace.completed}/{pace.total} done · expected {pace.expectedByNow} by Day {pace.day}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{pace.pctComplete}%</div>
              <div className="muted" style={{ fontSize: '0.78rem' }}>
                {pace.daysLeft > 0
                  ? `${pace.remaining} left · ~${pace.perDay}/day needed`
                  : 'Challenge complete!'}
              </div>
            </div>
          </div>
          <div className="pace-bar" style={{ marginTop: '0.6rem' }}>
            <div className="pace-bar-fill" style={{ width: `${pace.pctComplete}%` }} />
            <div className="pace-bar-expected" style={{ left: `${Math.round((pace.expectedByNow / pace.total) * 100)}%` }} />
          </div>
          <div className="muted" style={{ fontSize: '0.75rem', marginTop: '0.35rem' }}>
            At this pace, you'll finish {pace.projectedTotal}/{pace.total} specs by Day {pace.totalDays}
          </div>
        </div>
      )}

      {/* ===== Metrics ===== */}
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
        {todayTime.total > 0 && (
          <div className="card">
            <div className="metric-value">{todayTime.total}<span style={{ fontSize: '1rem', fontWeight: 400 }}> min</span></div>
            <div className="metric-label">Focus time today</div>
          </div>
        )}
      </div>

      {/* ===== Smart Daily Agenda ===== */}
      <h2>Today's agenda</h2>
      <p className="muted">Auto-generated from your plan, errors, reviews, and weak spots. Do them in this order.</p>
      {agenda.length === 0 ? (
        <div className="alert info">No tasks for today — you're all caught up!</div>
      ) : (
        <div className="agenda-list">
          {agenda.map((item, i) => (
            <Link key={i} to={item.to} className="agenda-item card">
              <span className="agenda-icon">{AGENDA_ICONS[item.type] || '·'}</span>
              <div style={{ flex: 1 }}>
                <div className="agenda-title">{item.title}</div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>{item.detail}</div>
              </div>
              <span className="muted" style={{ fontSize: '0.85rem' }}>→</span>
            </Link>
          ))}
        </div>
      )}

      {/* ===== Weakest topics ===== */}
      <h2>Your weakest high-frequency topics</h2>
      <p className="muted">Where the marks are leaking. Tap one to study it.</p>
      {weak.length === 0 ? (
        <div className="alert info">Everything is at full confidence.</div>
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
