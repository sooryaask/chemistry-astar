import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/plan', label: 'Plan' },
  { to: '/learn', label: 'Study' },
  { to: '/drill', label: 'Drill' },
  { to: '/quiz', label: 'Quiz' },
  { to: '/practice', label: 'Practice' },
  { to: '/spec', label: 'Progress' },
  { to: '/errors', label: 'Errors' },
  { to: '/papers', label: 'Papers' },
  { to: '/journal', label: 'Journal' },
]

export default function Nav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <NavLink to="/" className="nav-title">
          Zero to A* — OCR A Chemistry
        </NavLink>
        <div className="nav-links">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
