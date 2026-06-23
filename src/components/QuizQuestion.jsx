import { useRef } from 'react'
import { applySuperscript } from '../utils/superscript.js'
import MicroLesson from './MicroLesson.jsx'

export default function QuizQuestion({ question, answer, onChange, result, disabled, specId }) {
  const superRef = useRef(false)
  return (
    <div
      className={`question-block${
        result ? (result.passed ? ' result-pass' : ' result-fail') : ''
      }`}
    >
      <div className="q-meta">
        Question {question.id} · {question.command} · {question.marks} mark
        {question.marks > 1 ? 's' : ''}
      </div>
      {question.context && <div className="q-context">{question.context}</div>}
      <div className="q-text">{question.question}</div>

      <textarea
        rows={question.marks >= 6 ? 7 : question.marks >= 3 ? 4 : 2}
        value={answer}
        placeholder="Type your answer…  (type ^ then digits for powers: 10^23 → 10²³)"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => applySuperscript(e, superRef, answer, onChange)}
        onFocus={() => (superRef.current = false)}
        disabled={disabled}
      />

      {result && (
        <div style={{ marginTop: '0.75rem' }}>
          <div className={`score-line ${result.passed ? 'pass' : 'fail'}`}>
            {result.score} / {result.maxScore} marks
          </div>
          <div style={{ margin: '0.35rem 0' }}>
            {result.gcseFlag && <span className="flag">GCSE phrasing</span>}
            {result.precisionFlag && <span className="flag">Imprecise language</span>}
            {result.unitsFlag && <span className="flag">Units / sig figs</span>}
          </div>
          <p style={{ margin: '0.35rem 0' }}>{result.feedback}</p>
          {result.modelAnswer && (
            <div className="model-answer">
              <strong>Mark-scheme answer:</strong> {result.modelAnswer}
            </div>
          )}
          {specId && result.score < result.maxScore && (
            <MicroLesson
              specId={specId}
              question={question.question}
              userAnswer={answer}
              modelAnswer={result.modelAnswer}
              score={result.score}
              maxScore={result.maxScore}
            />
          )}
        </div>
      )}
    </div>
  )
}
