import { useState, useMemo } from 'react'
import {
  generateMustKnowBlanks,
  generateKeyIdeaBlanks,
  generateMarkSchemeBlanks,
  fuzzyMatch,
  collectBlankIds,
  getAnswer,
} from '../utils/blankGenerator.js'

export default function ActiveRecall({ lesson }) {
  const [phase, setPhase] = useState('ready') // ready | filling | checked
  const [answers, setAnswers] = useState({})
  const [results, setResults] = useState({})
  const [revealed, setRevealed] = useState(new Set())

  const blanks = useMemo(() => {
    if (!lesson) return []
    return [
      ...generateMustKnowBlanks(lesson.mustKnow),
      ...generateKeyIdeaBlanks(lesson.keyIdeas),
      ...generateMarkSchemeBlanks(lesson.markSchemePhrases),
    ]
  }, [lesson])

  const allIds = useMemo(() => collectBlankIds(blanks), [blanks])

  function start() {
    setAnswers({})
    setResults({})
    setRevealed(new Set())
    setPhase('filling')
  }

  function updateAnswer(id, value) {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  function revealOne(id) {
    setRevealed((prev) => new Set(prev).add(id))
  }

  function revealAll() {
    setRevealed(new Set(allIds))
  }

  function checkAll() {
    const r = {}
    for (const id of allIds) {
      const expected = getAnswer(blanks, id)
      r[id] = fuzzyMatch(answers[id] || '', expected)
    }
    setResults(r)
    setPhase('checked')
  }

  function retryMistakes() {
    const next = { ...answers }
    const nextRevealed = new Set()
    for (const id of allIds) {
      if (results[id] === 'wrong') {
        delete next[id]
      }
    }
    setAnswers(next)
    setResults({})
    setRevealed(nextRevealed)
    setPhase('filling')
  }

  // Score summary
  const score = useMemo(() => {
    if (phase !== 'checked') return null
    const vals = Object.values(results)
    const correct = vals.filter((v) => v === 'correct' || v === 'close').length
    return { correct, total: vals.length, pct: vals.length ? Math.round((correct / vals.length) * 100) : 0 }
  }, [results, phase])

  if (!lesson) return null

  const mustKnowBlanks = blanks.filter((b) => b.type === 'mustKnow')
  const keyIdeaBlanks = blanks.filter((b) => b.type === 'keyIdea')
  const markSchemeBlanks = blanks.filter((b) => b.type === 'markScheme')

  if (phase === 'ready') {
    return (
      <div className="card">
        <p>
          Test yourself on what you just read. Key terms will be blanked out — type
          them from memory to lock the knowledge in.
        </p>
        <button onClick={start} disabled={allIds.length === 0}>
          Start Recall
        </button>
        {allIds.length === 0 && (
          <span className="muted" style={{ marginLeft: '0.5rem' }}>
            No content to recall from this lesson.
          </span>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Score bar (checked phase) */}
      {score && (
        <div className="recall-score">
          <strong>
            {score.correct}/{score.total}
          </strong>
          <span className="muted">({score.pct}%)</span>
          <span
            className={`badge ${score.pct >= 80 ? 'LOW' : score.pct >= 50 ? 'MED' : 'HIGH'}`}
          >
            {score.pct >= 80 ? 'Strong' : score.pct >= 50 ? 'Getting there' : 'Keep practising'}
          </span>
          {score.correct < score.total && (
            <button onClick={retryMistakes} style={{ marginLeft: 'auto' }}>
              Retry mistakes
            </button>
          )}
        </div>
      )}

      {/* Must-know definitions */}
      {mustKnowBlanks.length > 0 && (
        <div className="recall-section">
          <h4>Must-know definitions</h4>
          {mustKnowBlanks.map((b) => (
            <MustKnowBlank
              key={b.id}
              blank={b}
              value={answers[b.id] || ''}
              result={results[b.id]}
              isRevealed={revealed.has(b.id)}
              onChange={(v) => updateAnswer(b.id, v)}
              onReveal={() => revealOne(b.id)}
              disabled={phase === 'checked'}
            />
          ))}
        </div>
      )}

      {/* Key ideas */}
      {keyIdeaBlanks.length > 0 && (
        <div className="recall-section">
          <h4>Key ideas</h4>
          {keyIdeaBlanks.map((b) => (
            <InlineBlank
              key={b.id}
              blank={b}
              answers={answers}
              results={results}
              revealed={revealed}
              onChange={updateAnswer}
              onReveal={revealOne}
              disabled={phase === 'checked'}
            />
          ))}
        </div>
      )}

      {/* Mark-scheme phrases */}
      {markSchemeBlanks.length > 0 && (
        <div className="recall-section">
          <h4>Mark-scheme phrases</h4>
          {markSchemeBlanks.map((b) => (
            <InlineBlank
              key={b.id}
              blank={b}
              answers={answers}
              results={results}
              revealed={revealed}
              onChange={updateAnswer}
              onReveal={revealOne}
              disabled={phase === 'checked'}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="row-actions" style={{ marginTop: '1rem' }}>
        {phase === 'filling' && (
          <>
            <button onClick={checkAll}>Check all</button>
            <button onClick={revealAll} className="recall-reveal-btn" style={{ padding: '0.4rem 0.8rem', fontSize: 'inherit' }}>
              Reveal all
            </button>
          </>
        )}
        {phase === 'checked' && (
          <button onClick={start}>Start fresh</button>
        )}
      </div>
    </div>
  )
}

/** Must-know: prompt text + single input for the answer */
function MustKnowBlank({ blank, value, result, isRevealed, onChange, onReveal, disabled }) {
  const inputClass = result
    ? `recall-inline-input ${result}`
    : 'recall-inline-input'

  return (
    <div className="card" style={{ marginBottom: '0.6rem', padding: '0.75rem 1rem' }}>
      <div className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>
        {blank.blankLabel === 'Term' ? 'What is the term?' : 'What is the definition?'}
      </div>
      <p style={{ margin: '0 0 0.5rem' }}>{blank.prompt}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={`Type the ${blank.blankLabel.toLowerCase()}…`}
          style={{ minWidth: '12rem', flex: 1, maxWidth: '28rem' }}
        />
        {!disabled && !isRevealed && (
          <button className="recall-reveal-btn" onClick={onReveal}>
            Reveal
          </button>
        )}
      </div>
      {isRevealed && <span className="recall-answer-hint">{blank.answer}</span>}
      {result === 'wrong' && !isRevealed && (
        <div className="recall-answer-hint" style={{ color: 'var(--color-fail)', marginTop: '0.3rem' }}>
          Answer: {blank.answer}
        </div>
      )}
      {result === 'close' && (
        <div className="recall-answer-hint" style={{ color: 'var(--color-high)', marginTop: '0.3rem' }}>
          Accepted (minor typo) — exact: {blank.answer}
        </div>
      )}
    </div>
  )
}

/** Inline blanks: sentence with inputs replacing blanked segments */
function InlineBlank({ blank, answers, results, revealed, onChange, onReveal, disabled }) {
  return (
    <div className="recall-prompt">
      {blank.segments.map((seg, si) => {
        if (!seg.isBlank) return <span key={si}>{seg.text}</span>

        const id = `${blank.id}-${si}`
        const result = results[id]
        const isRevealed = revealed.has(id)
        const inputClass = result
          ? `recall-inline-input ${result}`
          : 'recall-inline-input'
        const width = Math.max(seg.answer.length * 0.65, 4) + 'ch'

        return (
          <span key={si} style={{ whiteSpace: 'nowrap' }}>
            <input
              type="text"
              className={inputClass}
              value={answers[id] || ''}
              onChange={(e) => onChange(id, e.target.value)}
              disabled={disabled}
              style={{ width }}
            />
            {!disabled && !isRevealed && (
              <button className="recall-reveal-btn" onClick={() => onReveal(id)}>
                ?
              </button>
            )}
            {isRevealed && <span className="recall-answer-hint">{seg.answer}</span>}
            {result === 'wrong' && !isRevealed && (
              <span className="recall-answer-hint" style={{ color: 'var(--color-fail)' }}>
                {seg.answer}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
