// Simple dependency-free SVG line chart.
// data: [{ label, value }] where value is a percentage 0-100.
export default function ScoreChart({ data, height = 180, yLabel = 'Score %' }) {
  if (!data || data.length === 0) {
    return <p className="muted">No data yet — log some scores to see the trend.</p>
  }

  const width = 640
  const padL = 40
  const padR = 16
  const padT = 16
  const padB = 28
  const innerW = width - padL - padR
  const innerH = height - padT - padB

  const n = data.length
  const xFor = (i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const yFor = (v) => padT + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH

  const points = data.map((d, i) => `${xFor(i)},${yFor(d.value)}`).join(' ')
  const gridY = [0, 25, 50, 75, 100]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label={`${yLabel} over time`}
      style={{ maxWidth: width }}
    >
      {gridY.map((g) => (
        <g key={g}>
          <line
            x1={padL}
            x2={width - padR}
            y1={yFor(g)}
            y2={yFor(g)}
            style={{ stroke: 'var(--color-border)' }}
          />
          <text x={4} y={yFor(g) + 4} fontSize="10" style={{ fill: 'var(--color-secondary)' }}>
            {g}
          </text>
        </g>
      ))}

      <polyline
        fill="none"
        style={{ stroke: 'var(--color-accent)' }}
        strokeWidth="2"
        points={points}
      />

      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xFor(i)} cy={yFor(d.value)} r="3.5" style={{ fill: 'var(--color-accent)' }} />
          {(n <= 12 || i % Math.ceil(n / 12) === 0) && (
            <text
              x={xFor(i)}
              y={height - 8}
              fontSize="9"
              style={{ fill: 'var(--color-secondary)' }}
              textAnchor="middle"
            >
              {d.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
