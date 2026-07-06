import { useRef, useState, useCallback, useEffect } from 'react'
import { addStyles, EditableMathField, StaticMathField } from 'react-mathquill'
import './ChemInput.css'

// Inject MathQuill CSS once
addStyles()

// Chemistry-specific symbols (insert as LaTeX commands)
const CHEM_SYMBOLS = [
  { label: '→', latex: '\\rightarrow' },
  { label: '⇌', latex: '\\rightleftharpoons' },
  { label: 'Δ', latex: '\\Delta' },
]

const CHARGES = [
  { label: '²⁺', latex: '^{2+}' },
  { label: '⁻', latex: '^{-}' },
  { label: '²⁻', latex: '^{2-}' },
  { label: '³⁺', latex: '^{3+}' },
]

const STRUCTURES = [
  { label: 'x₂', latex: '_{2}', title: 'Subscript 2' },
  { label: 'x²', latex: '^{2}', title: 'Superscript 2' },
  { label: '½', latex: '\\frac{}{}', title: 'Fraction' },
  { label: '√', latex: '\\sqrt{}', title: 'Square root' },
]

export default function ChemInput({ value, onChange, placeholder, autoFocus, rows }) {
  const mqRef = useRef(null)
  const toolbarRef = useRef(null)
  const [scrollable, setScrollable] = useState(false)
  const [scrolledEnd, setScrolledEnd] = useState(false)
  const [isEmpty, setIsEmpty] = useState(!value)

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

  const insertLatex = useCallback((latex) => {
    const mf = mqRef.current
    if (!mf) return
    mf.write(latex)
    mf.focus()
  }, [])

  const handleChange = useCallback((mf) => {
    const latex = mf.latex()
    setIsEmpty(!latex)
    onChange(latex)
  }, [onChange])

  const handleMount = useCallback((mf) => {
    mqRef.current = mf
    if (autoFocus) mf.focus()
  }, [autoFocus])

  // Calculate min-height from rows prop
  const minHeight = rows ? `${Math.max(rows * 1.6, 3.2)}em` : '3.2em'

  return (
    <div className="chem-input-wrap">
      <div className="mq-field-wrap" style={{ minHeight }}>
        <EditableMathField
          latex={value}
          onChange={handleChange}
          mathquillDidMount={handleMount}
          className="chem-mq-field"
        />
        {isEmpty && placeholder && (
          <span className="mq-placeholder">{placeholder}</span>
        )}
      </div>

      <div
        ref={toolbarRef}
        className={`chem-toolbar${scrollable ? ' scrollable' : ''}${scrolledEnd ? ' scrolled-end' : ''}`}
      >
        {/* Math structures */}
        {STRUCTURES.map((s) => (
          <button
            type="button"
            key={s.label}
            className="chem-btn"
            onClick={() => insertLatex(s.latex)}
            title={s.title}
          >
            {s.label}
          </button>
        ))}

        <span className="chem-sep" />

        {/* Chemistry arrows & Greek */}
        {CHEM_SYMBOLS.map((s) => (
          <button
            type="button"
            key={s.label}
            className="chem-btn"
            onClick={() => insertLatex(s.latex)}
            title={`Insert ${s.label}`}
          >
            {s.label}
          </button>
        ))}

        <span className="chem-sep" />

        {/* Ion charges */}
        {CHARGES.map((c) => (
          <button
            type="button"
            key={c.label}
            className="chem-btn charge"
            onClick={() => insertLatex(c.latex)}
            title={`Insert ${c.label}`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Re-export StaticMathField for use in Review.jsx
export { StaticMathField }
