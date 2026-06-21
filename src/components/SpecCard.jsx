import { CONFIDENCE_LABELS } from '../config.js'

export default function SpecCard({ point, onConfidence, onComplete }) {
  return (
    <div className={`spec-card${point.complete ? ' done' : ''}`}>
      <input
        type="checkbox"
        checked={point.complete}
        onChange={(e) => onComplete(point.id, e.target.checked)}
        aria-label={`Mark ${point.id} complete`}
        style={{ marginTop: '0.3rem' }}
      />
      <div className="spec-main">
        <div>
          <span className="spec-ref">{point.id}</span>{' '}
          <strong>{point.title}</strong>{' '}
          <span className={`badge ${point.frequency}`}>{point.frequency}</span>{' '}
          {point.gcseOverlap && (
            <span className="muted" title="Covered in GCSE Combined Science">
              · GCSE overlap
            </span>
          )}
        </div>
        <div className="spec-desc">{point.description}</div>
        <div className="confidence-row">
          <span>Confidence:</span>
          <input
            type="range"
            min="0"
            max="3"
            step="1"
            value={point.confidence}
            onChange={(e) => onConfidence(point.id, Number(e.target.value))}
          />
          <strong>{point.confidence}</strong>
          <span className="muted">{CONFIDENCE_LABELS[point.confidence]}</span>
        </div>
      </div>
    </div>
  )
}
