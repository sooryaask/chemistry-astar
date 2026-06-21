import { getSpecPoint } from '../data/spec.js'

export default function JournalEntry({ entry }) {
  return (
    <div className="list-item">
      <h3 style={{ marginBottom: '0.25rem' }}>
        {new Date(entry.date).toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </h3>
      {entry.scoreSummary && (
        <p className="muted">Quiz: {entry.scoreSummary}</p>
      )}
      {entry.specPoints?.length > 0 && (
        <p className="muted">
          Studied:{' '}
          {entry.specPoints
            .map((id) => {
              const sp = getSpecPoint(id)
              return sp ? `${id} ${sp.title}` : id
            })
            .join(' · ')}
        </p>
      )}
      {entry.reflection && (
        <p style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
          {entry.reflection}
        </p>
      )}
    </div>
  )
}
