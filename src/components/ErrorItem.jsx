import { useState } from 'react'
import MicroLesson from './MicroLesson.jsx'

export default function ErrorItem({ item, onRequiz, onMaster, busy }) {
  const [showLesson, setShowLesson] = useState(false)
  const canMaster = (item.streak || 0) >= 3
  return (
    <div className={`list-item${item.passed ? ' result-pass' : ' result-fail'}`}>
      <div>
        <span className="spec-ref">{item.specId}</span>{' '}
        <span className={`badge ${item.frequency}`}>{item.frequency}</span>{' '}
        <span className="muted">
          missed x{item.missCount} · streak {item.streak || 0}/3
        </span>
      </div>
      <p className="q-text" style={{ marginTop: '0.4rem' }}>
        {item.question}
      </p>
      <p className="muted">
        <strong>Your answer:</strong> {item.userAnswer || '[blank]'}
      </p>
      <div className="model-answer">
        <strong>Model answer:</strong> {item.modelAnswer}
      </div>
      <p className="muted" style={{ marginTop: '0.4rem' }}>
        Last attempted: {new Date(item.timestamp).toLocaleString()}
      </p>

      {showLesson && (
        <MicroLesson
          specId={item.specId}
          question={item.question}
          userAnswer={item.userAnswer}
          modelAnswer={item.modelAnswer}
          score={0}
          maxScore={1}
        />
      )}

      <div className="row-actions">
        <button className="small" onClick={() => onRequiz(item)} disabled={busy}>
          {busy ? 'Marking...' : 'Re-quiz'}
        </button>
        <button
          className="small secondary"
          onClick={() => setShowLesson(!showLesson)}
        >
          {showLesson ? 'Hide lesson' : 'Re-learn this'}
        </button>
        <button
          className="small secondary"
          onClick={() => onMaster(item.id)}
          disabled={!canMaster}
          title={canMaster ? 'Remove from error log' : 'Needs 3 correct in a row'}
        >
          Mastered
        </button>
      </div>
    </div>
  )
}
