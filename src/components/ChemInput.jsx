import { useRef, useState, useCallback, useEffect } from 'react'
import './ChemInput.css'

// Unicode mapping tables
const SUB_DIGITS = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉' }
const SUP_DIGITS = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹' }
const SUP_SIGNS  = { '+':'⁺', '-':'⁻' }

// Quick-insert charge sequences
const CHARGES = [
  { label: '²⁺', chars: '²⁺' },
  { label: '⁻',  chars: '⁻'  },
  { label: '²⁻', chars: '²⁻' },
  { label: '³⁺', chars: '³⁺' },
]

// One-tap symbol buttons
const SYMBOLS = [
  { label: '→', char: '→' },
  { label: '⇌', char: '⇌' },
  { label: 'Δ', char: 'Δ' },
]

const MATH = [
  { label: '×', char: '×' },
  { label: '÷', char: '÷' },
]

export default function ChemInput({ value, onChange, placeholder, rows, autoFocus }) {
  const ref = useRef(null)
  const toolbarRef = useRef(null)
  const [mode, setMode] = useState(null) // null | 'sub' | 'super'
  const [scrollable, setScrollable] = useState(false)
  const [scrolledEnd, setScrolledEnd] = useState(false)

  useEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const check = () => {
      const canScroll = el.scrollWidth > el.clientWidth + 1
      setScrollable(canScroll)
      setScrolledEnd(canScroll && el.scrollLeft + el.clientWidth >= el.scrollWidth - 1)
    }
    check()
    el.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      el.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [])

  // Insert text at cursor position and restore cursor
  const insertAt = useCallback((text) => {
    const ta = ref.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = value.slice(0, start)
    const after = value.slice(end)
    const next = before + text + after
    onChange(next)
    // Restore cursor after React re-render
    const newPos = start + text.length
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(newPos, newPos)
    })
  }, [value, onChange])

  // Handle key interception for sub/super modes
  const handleKeyDown = useCallback((e) => {
    if (!mode) return

    const key = e.key

    if (mode === 'sub') {
      if (SUB_DIGITS[key]) {
        e.preventDefault()
        insertAt(SUB_DIGITS[key])
        return
      }
      // Any non-digit exits subscript mode
      setMode(null)
    }

    if (mode === 'super') {
      if (SUP_DIGITS[key]) {
        e.preventDefault()
        insertAt(SUP_DIGITS[key])
        return
      }
      if (SUP_SIGNS[key]) {
        e.preventDefault()
        insertAt(SUP_SIGNS[key])
        return
      }
      // Any non-digit/sign exits superscript mode
      setMode(null)
    }
  }, [mode, insertAt])

  // Global keyboard shortcuts: Ctrl+Shift+ArrowDown/Up for sub/super
  const handleKeyDownGlobal = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMode((m) => m === 'sub' ? null : 'sub')
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMode((m) => m === 'super' ? null : 'super')
        return
      }
    }
    handleKeyDown(e)
  }, [handleKeyDown])

  const toggleMode = (m) => {
    setMode((prev) => prev === m ? null : m)
    ref.current?.focus()
  }

  const insertSymbol = (char) => {
    insertAt(char)
  }

  return (
    <div className="chem-input-wrap">
      <div ref={toolbarRef} className={`chem-toolbar${scrollable ? ' scrollable' : ''}${scrolledEnd ? ' scrolled-end' : ''}`}>
        {/* Mode toggles */}
        <button
          type="button"
          className={`chem-btn ${mode === 'sub' ? 'active' : ''}`}
          onClick={() => toggleMode('sub')}
          title="Subscript mode (Ctrl+Shift+↓)"
        >
          x₂
        </button>
        <button
          type="button"
          className={`chem-btn ${mode === 'super' ? 'active' : ''}`}
          onClick={() => toggleMode('super')}
          title="Superscript mode (Ctrl+Shift+↑)"
        >
          x²⁺
        </button>

        <span className="chem-sep" />

        {/* Arrows & Greek */}
        {SYMBOLS.map((s) => (
          <button
            type="button"
            key={s.label}
            className="chem-btn"
            onClick={() => insertSymbol(s.char)}
            title={`Insert ${s.label}`}
          >
            {s.label}
          </button>
        ))}

        <span className="chem-sep" />

        {/* Common charges */}
        {CHARGES.map((c) => (
          <button
            type="button"
            key={c.label}
            className="chem-btn charge"
            onClick={() => insertSymbol(c.chars)}
            title={`Insert ${c.label}`}
          >
            {c.label}
          </button>
        ))}

        <span className="chem-sep" />

        {/* Math symbols */}
        {MATH.map((m) => (
          <button
            type="button"
            key={m.label}
            className="chem-btn"
            onClick={() => insertSymbol(m.char)}
            title={`Insert ${m.label}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <textarea
        ref={ref}
        className="answer-box"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDownGlobal}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={rows}
      />
    </div>
  )
}
