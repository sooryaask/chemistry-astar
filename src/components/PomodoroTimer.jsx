import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { getItem, setItem, KEYS, todayISO } from '../utils/localStorage.js'

const PRESETS = [
  { label: '25 / 5', work: 25, brk: 5 },
  { label: '30 / 5', work: 30, brk: 5 },
  { label: '45 / 10', work: 45, brk: 10 },
  { label: '50 / 10', work: 50, brk: 10 },
  { label: '90 / 20', work: 90, brk: 20 },
]

const PAGE_LABELS = {
  '/learn': 'Study',
  '/drill': 'Drill',
  '/quiz': 'Quiz',
  '/practice': 'Practice',
  '/spec': 'Progress',
  '/errors': 'Errors',
  '/papers': 'Papers',
}

function formatTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function loadSavedSplit() {
  const saved = getItem('pomodoroSplit', null)
  if (saved && saved.work && saved.brk) return saved
  return { work: 25, brk: 5 }
}

export function getTodayTime() {
  const log = getItem(KEYS.timerLog, {})
  const today = log[todayISO()]
  if (!today) return { total: 0, byPage: {} }
  const byPage = {}
  let total = 0
  for (const entry of today) {
    total += entry.minutes
    byPage[entry.page] = (byPage[entry.page] || 0) + entry.minutes
  }
  return { total: Math.round(total), byPage }
}

export default function PomodoroTimer() {
  const [split, setSplit] = useState(loadSavedSplit)
  const workSecs = split.work * 60
  const breakSecs = split.brk * 60

  const [secondsLeft, setSecondsLeft] = useState(workSecs)
  const [running, setRunning] = useState(false)
  const [isBreak, setIsBreak] = useState(false)
  const [minimized, setMinimized] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [customWork, setCustomWork] = useState(split.work)
  const [customBreak, setCustomBreak] = useState(split.brk)
  const intervalRef = useRef(null)
  const startTimeRef = useRef(null)
  const location = useLocation()

  const currentPage = PAGE_LABELS[location.pathname] || 'Other'

  function applySplit(work, brk) {
    const next = { work, brk }
    setSplit(next)
    setItem('pomodoroSplit', next)
    setSecondsLeft(work * 60)
    setRunning(false)
    setIsBreak(false)
    setShowPicker(false)
    startTimeRef.current = null
  }

  const logSession = useCallback((elapsed) => {
    if (elapsed < 30) return
    const minutes = Math.round(elapsed / 60 * 10) / 10
    const log = getItem(KEYS.timerLog, {})
    const day = todayISO()
    if (!log[day]) log[day] = []
    log[day].push({ page: currentPage, minutes, ts: Date.now() })
    setItem(KEYS.timerLog, log)
  }, [currentPage])

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          if (!isBreak) {
            logSession(workSecs)
          }
          setIsBreak(!isBreak)
          setRunning(false)
          return isBreak ? workSecs : breakSecs
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [running, isBreak, workSecs, breakSecs, logSession])

  function start() {
    startTimeRef.current = Date.now()
    setRunning(true)
  }

  function pause() {
    setRunning(false)
    if (!isBreak && startTimeRef.current) {
      const elapsed = workSecs - secondsLeft
      logSession(elapsed)
    }
  }

  function reset() {
    setRunning(false)
    setIsBreak(false)
    setSecondsLeft(workSecs)
    startTimeRef.current = null
  }

  const totalSecs = isBreak ? breakSecs : workSecs
  const pct = ((totalSecs - secondsLeft) / totalSecs) * 100

  if (minimized) {
    return (
      <button
        className="pomodoro-fab"
        onClick={() => setMinimized(false)}
        title="Pomodoro Timer"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {running && <span className="pomodoro-fab-time">{formatTime(secondsLeft)}</span>}
      </button>
    )
  }

  const { total, byPage } = getTodayTime()

  return (
    <div className="pomodoro-panel">
      <div className="pomodoro-header">
        <strong>{isBreak ? 'Break' : 'Focus'}</strong>
        <span className="muted" style={{ fontSize: '0.75rem' }}>{currentPage}</span>
        <button
          className="small secondary"
          onClick={() => setMinimized(true)}
          style={{ marginLeft: 'auto', padding: '0.15rem 0.4rem' }}
        >
          _
        </button>
      </div>

      {/* Split selector */}
      <div className="pomodoro-split-row">
        <button
          className="small secondary"
          onClick={() => setShowPicker(!showPicker)}
          style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', width: '100%' }}
        >
          {split.work}/{split.brk} min {showPicker ? '▴' : '▾'}
        </button>
      </div>

      {showPicker && (
        <div className="pomodoro-picker">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className={`small ${p.work === split.work && p.brk === split.brk ? '' : 'secondary'}`}
              onClick={() => applySplit(p.work, p.brk)}
              style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
            >
              {p.label}
            </button>
          ))}
          <div className="pomodoro-custom">
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              <input
                type="number"
                value={customWork}
                onChange={(e) => setCustomWork(Math.max(1, Number(e.target.value)))}
                min={1} max={180}
                style={{ width: 42, fontSize: '0.72rem', padding: '0.15rem 0.25rem' }}
              />
              <span style={{ fontSize: '0.7rem' }}>/</span>
              <input
                type="number"
                value={customBreak}
                onChange={(e) => setCustomBreak(Math.max(1, Number(e.target.value)))}
                min={1} max={60}
                style={{ width: 42, fontSize: '0.72rem', padding: '0.15rem 0.25rem' }}
              />
              <button
                className="small"
                onClick={() => applySplit(customWork, customBreak)}
                style={{ fontSize: '0.65rem', padding: '0.15rem 0.35rem' }}
              >
                Set
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pomodoro-ring">
        <svg viewBox="0 0 100 100" width="120" height="120">
          <circle cx="50" cy="50" r="42" fill="none" style={{ stroke: 'var(--color-border)' }} strokeWidth="6" />
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            style={{ stroke: isBreak ? 'var(--color-pass)' : 'var(--color-accent)' }}
            strokeWidth="6"
            strokeDasharray={`${2 * Math.PI * 42}`}
            strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
          <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
            style={{ fill: 'var(--color-primary)', fontSize: '18px', fontWeight: 700 }}>
            {formatTime(secondsLeft)}
          </text>
        </svg>
      </div>

      <div className="pomodoro-controls">
        {!running ? (
          <button className="small" onClick={start}>Start</button>
        ) : (
          <button className="small secondary" onClick={pause}>Pause</button>
        )}
        <button className="small secondary" onClick={reset}>Reset</button>
      </div>

      {total > 0 && (
        <div className="pomodoro-today">
          <div className="muted" style={{ fontSize: '0.72rem', marginBottom: '0.25rem' }}>Today: {total} min</div>
          {Object.entries(byPage).map(([page, mins]) => (
            <div key={page} style={{ fontSize: '0.72rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>{page}</span>
              <span>{Math.round(mins)} min</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
