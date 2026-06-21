import { Link } from 'react-router-dom'
import { PLAN, STRETCH } from '../data/plan.js'
import { getSpecPoint } from '../data/spec.js'
import { dayOfChallenge } from '../utils/stats.js'

export default function StudyPlan() {
  const today = dayOfChallenge()

  return (
    <div>
      <h1>21-Day Plan</h1>
      <div className="alert warn">
        <strong>Honest setup.</strong> Target: <strong>A*-equivalent (90%+) on
        AS Paper 1, Modules 1–4</strong> — from a GCSE Combined Science base, at
        1–2 hrs/day. That's ~21–40 hours total, so this plan <strong>chases marks
        by frequency, not full coverage</strong>: high-frequency and GCSE-overlap
        topics first, low-frequency topics left off (see "Stretch" below). 90% is
        a stretch in this time — the plan maximises your shot at it.
      </div>

      <p className="muted">
        Each day: learn the topic, then practise <em>real past-paper questions</em> on
        it in the Smart Mark tool, then clear your <Link to="/errors">error log</Link>.
        Today is <strong>Day {today}</strong>.
      </p>

      {PLAN.map((d) => {
        const isToday = d.day === today
        const isPast = d.day < today
        return (
          <div
            key={d.day}
            className="list-item"
            style={{
              borderLeft: isToday ? '4px solid var(--color-med)' : undefined,
              opacity: isPast ? 0.6 : 1,
            }}
          >
            <div className="muted">
              {d.phase} · ~{d.minutes} min{isToday ? ' · TODAY' : ''}
              {isPast ? ' · done/passed' : ''}
            </div>
            <h3 style={{ margin: '0.2rem 0' }}>
              Day {d.day}: {d.title}
            </h3>
            {d.specIds.length > 0 && (
              <div style={{ margin: '0.3rem 0' }}>
                {d.specIds.map((id) => {
                  const sp = getSpecPoint(id)
                  return (
                    <span key={id} style={{ marginRight: '0.6rem' }}>
                      <span className="spec-ref">{id}</span>{' '}
                      {sp && <span className={`badge ${sp.frequency}`}>{sp.frequency}</span>}{' '}
                      <span className="muted">{sp ? sp.title : ''}</span>
                    </span>
                  )
                })}
              </div>
            )}
            <p style={{ margin: '0.3rem 0' }}>{d.note}</p>
            <div className="muted">
              Smart Mark topic to practise: <strong>{d.smartTopic}</strong>
            </div>
            {isToday && (
              <div className="row-actions">
                {d.specIds.length > 0 ? (
                  <>
                    <Link to={`/learn?spec=${d.specIds[0]}`} className="badge MED">
                      1 · Learn →
                    </Link>
                    <Link to={`/drill?spec=${d.specIds[0]}`} className="badge MED">
                      2 · Drill →
                    </Link>
                    <span className="muted" style={{ alignSelf: 'center' }}>
                      3 · Practise “{d.smartTopic}” in Smart Mark · 4 ·{' '}
                      <Link to="/errors">clear due errors</Link>
                    </span>
                  </>
                ) : (
                  <span className="muted" style={{ alignSelf: 'center' }}>
                    Practice day — <Link to="/drill">drill</Link> ·{' '}
                    Smart Mark “{d.smartTopic}” · <Link to="/errors">errors</Link>
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}

      <h2>Stretch (only if you get ahead)</h2>
      <p className="muted">
        These are low-frequency — deliberately off the schedule. Don't spend
        scarce time here until the high-frequency core is solid.
      </p>
      <ul className="compact-list">
        {STRETCH.map((s) => {
          const sp = getSpecPoint(s.id)
          return (
            <li key={s.id}>
              <span className="spec-ref">{s.id}</span>{' '}
              {sp && <span className="muted">{sp.title}</span>} — {s.why}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
