import { useEffect, useState } from 'react'
import { FREQ_RANK, getSpecPoint } from '../data/spec.js'
import { getErrors, recordRequiz, removeError } from '../utils/errorLog.js'
import { markAnswers } from '../api/anthropic.js'
import ErrorItem from '../components/ErrorItem.jsx'

const MODULES = [1, 2, 3, 4]

export default function ErrorLog() {
  const [items, setItems] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [fModule, setFModule] = useState('all')
  const [fFreq, setFFreq] = useState('all')
  const [fMiss, setFMiss] = useState(0)

  useEffect(() => {
    setItems(getErrors())
  }, [])

  function sortItems(list) {
    return [...list].sort((a, b) => {
      const fr = FREQ_RANK[a.frequency] - FREQ_RANK[b.frequency]
      if (fr !== 0) return fr
      return (b.missCount || 0) - (a.missCount || 0)
    })
  }

  async function handleRequiz(item) {
    const userAnswer = window.prompt(
      `Re-quiz — ${item.specId}\n\n${item.question}\n\nType your answer:`,
      ''
    )
    if (userAnswer === null) return // cancelled
    setBusyId(item.id)
    setError('')
    setInfo('')
    try {
      const specPoint = getSpecPoint(item.specId) || {
        id: item.specId,
        title: item.specId,
      }
      const q = {
        id: 1,
        marks: item.marks || 3,
        command: item.command || 'Explain',
        question: item.question,
        context: item.context || '',
      }
      const result = await markAnswers(specPoint, [q], [userAnswer])
      const r = result.results[0]
      const passed = r.score >= r.maxScore
      const updated = recordRequiz(item.id, passed)
      setItems(updated)
      setInfo(
        `${item.specId}: ${r.score}/${r.maxScore} — ${
          passed ? 'passed ✓' : 'not full marks'
        }. ${r.feedback}`
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  function handleMaster(id) {
    setItems(removeError(id))
  }

  const filtered = items.filter((e) => {
    if (fModule !== 'all' && e.module !== Number(fModule)) return false
    if (fFreq !== 'all' && e.frequency !== fFreq) return false
    if ((e.missCount || 0) < Number(fMiss)) return false
    return true
  })

  return (
    <div>
      <h1>Error Log</h1>
      <p className="muted">
        Most-missed, highest-frequency topics first. Re-quiz to rebuild a streak;
        3 correct in a row unlocks "Mastered".
      </p>

      <div className="filter-bar">
        <label>
          Module
          <select value={fModule} onChange={(e) => setFModule(e.target.value)}>
            <option value="all">All</option>
            {MODULES.map((m) => (
              <option key={m} value={m}>
                Module {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          Frequency
          <select value={fFreq} onChange={(e) => setFFreq(e.target.value)}>
            <option value="all">All</option>
            <option value="HIGH">High</option>
            <option value="MED">Med</option>
            <option value="LOW">Low</option>
          </select>
        </label>
        <label>
          Min miss count
          <input
            type="number"
            min="0"
            value={fMiss}
            onChange={(e) => setFMiss(e.target.value)}
            style={{ width: 70 }}
          />
        </label>
      </div>

      {error && <div className="alert error">{error}</div>}
      {info && <div className="alert info">{info}</div>}

      {filtered.length === 0 ? (
        <div className="alert info">
          No error-log items{items.length ? ' match these filters' : ' yet'}. Get
          some questions wrong on the Quiz page and they'll appear here.
        </div>
      ) : (
        sortItems(filtered).map((item) => (
          <ErrorItem
            key={item.id}
            item={item}
            busy={busyId === item.id}
            onRequiz={handleRequiz}
            onMaster={handleMaster}
          />
        ))
      )}
    </div>
  )
}
