import { useEffect, useMemo, useState } from 'react'
import { getItem, setItem, KEYS, todayISO } from '../utils/localStorage.js'
import { SPEC } from '../data/spec.js'
import { dailyScoreAverages, allAttempts } from '../utils/stats.js'
import ScoreChart from '../components/ScoreChart.jsx'
import JournalEntry from '../components/JournalEntry.jsx'

export default function Journal() {
  const [entries, setEntries] = useState([])
  const [specPoints, setSpecPoints] = useState([])
  const [reflection, setReflection] = useState('')
  const [saved, setSaved] = useState(false)

  const today = todayISO()

  useEffect(() => {
    const stored = getItem(KEYS.journal, [])
    setEntries(stored)
    const todayEntry = stored.find((e) => e.date === today)
    if (todayEntry) {
      setSpecPoints(todayEntry.specPoints || [])
      setReflection(todayEntry.reflection || '')
    }
  }, [])

  // Auto-build today's quiz score summary from logged attempts.
  const todayScoreSummary = useMemo(() => {
    const all = allAttempts()
    const list = all[today] || []
    if (list.length === 0) return ''
    const score = list.reduce((a, x) => a + (x.totalScore || 0), 0)
    const max = list.reduce((a, x) => a + (x.totalMax || 0), 0)
    const pct = max > 0 ? Math.round((score / max) * 100) : 0
    return `${list.length} attempt${list.length > 1 ? 's' : ''}, ${score}/${max} (${pct}%)`
  }, [today])

  function toggleSpec(id) {
    setSpecPoints((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function saveToday() {
    const entry = {
      date: today,
      specPoints,
      scoreSummary: todayScoreSummary,
      reflection,
    }
    const others = entries.filter((e) => e.date !== today)
    const next = [...others, entry].sort((a, b) => b.date.localeCompare(a.date))
    setEntries(next)
    setItem(KEYS.journal, next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const chartData = dailyScoreAverages()
  const pastEntries = entries.filter((e) => e.date !== today)

  return (
    <div>
      <h1>Daily Log</h1>
      <p className="muted">
        The honest record of the experiment — what clicked, what didn't, and the
        score trajectory.
      </p>

      <h2>Score trend</h2>
      <div className="card">
        <ScoreChart data={chartData} yLabel="Daily quiz average %" />
      </div>

      <h2>Today — {new Date(today).toLocaleDateString()}</h2>
      <div className="card">
        <div className="field">
          <label>Quiz scores summary (auto from quiz attempts)</label>
          <div className="muted">
            {todayScoreSummary || 'No quiz attempts logged today yet.'}
          </div>
        </div>

        <div className="field">
          <label>Spec points studied today</label>
          <div className="checkbox-grid">
            {SPEC.map((s) => (
              <label key={s.id}>
                <input
                  type="checkbox"
                  checked={specPoints.includes(s.id)}
                  onChange={() => toggleSpec(s.id)}
                />
                <span>
                  <span className="spec-ref">{s.id}</span> {s.title}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Reflection</label>
          <textarea
            rows={6}
            value={reflection}
            placeholder="What clicked? What didn't? Honest assessment of where I am."
            onChange={(e) => setReflection(e.target.value)}
          />
        </div>

        <button onClick={saveToday}>{saved ? 'Saved ✓' : "Save today's entry"}</button>
      </div>

      <h2>Past entries</h2>
      {pastEntries.length === 0 ? (
        <div className="alert info">No past entries yet.</div>
      ) : (
        pastEntries.map((e) => <JournalEntry key={e.date} entry={e} />)
      )}
    </div>
  )
}
