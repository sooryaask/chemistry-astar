import { useEffect, useState } from 'react'
import { getItem, setItem, KEYS } from '../utils/localStorage.js'
import { PAPERS } from '../data/papers.js'
import ScoreChart from '../components/ScoreChart.jsx'

export default function PastPapers() {
  const [scores, setScores] = useState([])
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [raw, setRaw] = useState('')
  const [max, setMax] = useState('')

  useEffect(() => {
    setScores(getItem(KEYS.paperScores, []))
  }, [])

  function addScore(e) {
    e.preventDefault()
    const rawN = Number(raw)
    const maxN = Number(max)
    if (!name || !maxN || maxN <= 0) return
    const entry = {
      id: Date.now(),
      name,
      date: date || new Date().toISOString().slice(0, 10),
      raw: rawN,
      max: maxN,
      pct: Math.round((rawN / maxN) * 100),
    }
    const next = [...scores, entry].sort((a, b) => a.date.localeCompare(b.date))
    setScores(next)
    setItem(KEYS.paperScores, next)
    setName('')
    setDate('')
    setRaw('')
    setMax('')
  }

  function remove(id) {
    const next = scores.filter((s) => s.id !== id)
    setScores(next)
    setItem(KEYS.paperScores, next)
  }

  const chartData = scores.map((s) => ({ label: s.date.slice(5), value: s.pct }))

  return (
    <div>
      <h1>Past Papers</h1>
      <p className="muted">
        The experiment endpoint — the final paper score is what proves (or
        disproves) the concept.
      </p>

      <h2>Official papers</h2>
      <ul className="compact-list">
        {PAPERS.map((p) => (
          <li key={p.url}>
            <a href={p.url} target="_blank" rel="noopener noreferrer">
              {p.name}
            </a>{' '}
            <span className="muted">· {p.board}</span>
          </li>
        ))}
      </ul>

      <h2>Log a score</h2>
      <form className="card" onSubmit={addScore}>
        <div className="field">
          <label>Paper name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. H032/01 June 2018"
            style={{ width: '100%', maxWidth: 420 }}
          />
        </div>
        <div className="row-actions" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Date sat</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Raw score</label>
            <input
              type="number"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              style={{ width: 90 }}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Max score</label>
            <input
              type="number"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              style={{ width: 90 }}
            />
          </div>
          <button type="submit">Add score</button>
        </div>
      </form>

      <h2>Score history</h2>
      {scores.length === 0 ? (
        <div className="alert info">No papers logged yet.</div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Paper</th>
                <th>Date</th>
                <th>Raw</th>
                <th>Max</th>
                <th>%</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.date}</td>
                  <td>{s.raw}</td>
                  <td>{s.max}</td>
                  <td>{s.pct}%</td>
                  <td>
                    <button className="small secondary" onClick={() => remove(s.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Trend</h2>
          <div className="card">
            <ScoreChart data={chartData} yLabel="Paper score %" />
          </div>
        </>
      )}
    </div>
  )
}
