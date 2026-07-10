import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getPaperList } from '../data/cards.js'
import { deckCounts, masteryStats } from '../utils/srs.js'

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
  const isAi = paper.deckId === 'ai:generated'
  const totalMarks = paper.cards.reduce((s, c) => s + c.marks, 0)
  const m = useMemo(() => masteryStats(paper.cards), [paper.cards])
  return (
    <Link className="deck-row" to={`/review/${encodeURIComponent(paper.deckId)}`}>
      <span className="deck-label">
        {paper.title}
        <span className="deck-sub">{paper.cards.length} questions · {totalMarks} marks</span>
        <span className="deck-mastery">
          <span className="deck-mastery-bar">
            <span className="deck-mastery-fill" style={{ width: `${m.pct}%` }} />
          </span>
          <span className="deck-mastery-pct">{m.pct}%</span>
        </span>
      </span>
      {isAi ? <Counts cards={paper.cards} /> : (
        <span className="deck-card-count">{paper.cards.length}</span>
      )}
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
