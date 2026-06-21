import { useEffect, useMemo, useState } from 'react'
import { getItem, setItem, KEYS } from '../utils/localStorage.js'
import { SPEC } from '../data/spec.js'
import { mergeSpec } from '../utils/priority.js'
import SpecCard from '../components/SpecCard.jsx'

const MODULES = [1, 2, 3, 4]

export default function SpecTracker() {
  const [progress, setProgress] = useState({})
  const [fModule, setFModule] = useState('all')
  const [fFreq, setFFreq] = useState('all')
  const [fConf, setFConf] = useState('all')
  const [fDone, setFDone] = useState('all')

  useEffect(() => {
    setProgress(getItem(KEYS.specProgress, {}))
  }, [])

  function persist(next) {
    setProgress(next)
    setItem(KEYS.specProgress, next)
  }

  function setConfidence(id, value) {
    persist({ ...progress, [id]: { ...progress[id], confidence: value } })
  }
  function setComplete(id, value) {
    persist({ ...progress, [id]: { ...progress[id], complete: value } })
  }

  const merged = mergeSpec(progress)
  const completeCount = merged.filter((s) => s.complete).length

  const perModule = useMemo(() => {
    const out = {}
    MODULES.forEach((m) => {
      const items = merged.filter((s) => s.module === m)
      out[m] = { total: items.length, done: items.filter((s) => s.complete).length }
    })
    return out
  }, [merged])

  const filtered = merged.filter((s) => {
    if (fModule !== 'all' && s.module !== Number(fModule)) return false
    if (fFreq !== 'all' && s.frequency !== fFreq) return false
    if (fConf !== 'all' && s.confidence !== Number(fConf)) return false
    if (fDone === 'done' && !s.complete) return false
    if (fDone === 'todo' && s.complete) return false
    return true
  })

  // Group filtered points by module then section.
  const grouped = useMemo(() => {
    const g = {}
    filtered.forEach((s) => {
      g[s.module] = g[s.module] || {}
      g[s.module][s.section] = g[s.module][s.section] || []
      g[s.module][s.section].push(s)
    })
    return g
  }, [filtered])

  return (
    <div>
      <h1>Spec Tracker</h1>

      <div className="summary-bar">
        <div>
          <span className="big">
            {completeCount}/{SPEC.length}
          </span>{' '}
          complete
        </div>
        {MODULES.map((m) => (
          <div key={m} className="muted">
            Module {m}: {perModule[m].done}/{perModule[m].total}
          </div>
        ))}
      </div>

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
          Confidence
          <select value={fConf} onChange={(e) => setFConf(e.target.value)}>
            <option value="all">All</option>
            <option value="0">0 — No idea</option>
            <option value="1">1 — Shaky</option>
            <option value="2">2 — Okay</option>
            <option value="3">3 — Confident</option>
          </select>
        </label>
        <label>
          Status
          <select value={fDone} onChange={(e) => setFDone(e.target.value)}>
            <option value="all">All</option>
            <option value="todo">Incomplete</option>
            <option value="done">Complete</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 && (
        <div className="alert info">No spec points match these filters.</div>
      )}

      {Object.keys(grouped)
        .sort()
        .map((mod) => (
          <div key={mod} className="module-group">
            <h2>Module {mod}</h2>
            {Object.keys(grouped[mod])
              .sort()
              .map((section) => (
                <div key={section}>
                  <h3>{section}</h3>
                  {grouped[mod][section].map((s) => (
                    <SpecCard
                      key={s.id}
                      point={s}
                      onConfidence={setConfidence}
                      onComplete={setComplete}
                    />
                  ))}
                </div>
              ))}
          </div>
        ))}
    </div>
  )
}
