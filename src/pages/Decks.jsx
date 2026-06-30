import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getPaperList } from '../data/cards.js'
import { deckCounts } from '../utils/srs.js'

function Counts({ cards }) {
  const c = useMemo(() => deckCounts(cards), [cards])
  return (
    <span className="counts" title="new + learning + due">
      <span className="c-new">{c.new}</span>
      <span className="c-sep">+</span>
      <span className="c-learn">{c.learning}</span>
      <span className="c-sep">+</span>
      <span className="c-due">{c.review}</span>
    </span>
  )
}

function PaperRow({ paper }) {
  const totalMarks = paper.cards.reduce((s, c) => s + c.marks, 0)
  return (
    <Link className="deck-row" to={`/review/${encodeURIComponent(paper.deckId)}`}>
      <span className="deck-label">
        {paper.label} — Paper 1
        <span className="deck-sub">{paper.cards.length} questions · {totalMarks} marks</span>
      </span>
      <Counts cards={paper.cards} />
    </Link>
  )
}

export default function Decks() {
  const papers = useMemo(() => getPaperList(), [])

  return (
    <div className="decks">
      <h1 className="decks-title">Chemistry · Past Papers</h1>

      <section className="module-block">
        <h2 className="module-head">OCR A Chemistry AS (H032) — Paper 1</h2>
        {papers.map((p) => (
          <PaperRow key={p.slug} paper={p} />
        ))}
      </section>
    </div>
  )
}
