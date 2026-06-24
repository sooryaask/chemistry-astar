import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getDeckTree, calcCards } from '../data/cards.js'
import { MODULES } from '../data/topicMap.js'
import { deckCounts } from '../utils/srs.js'

// The little blue + red + green counter from the Anki mockup.
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

function DeckRow({ to, label, sub, cards }) {
  return (
    <Link className="deck-row" to={to}>
      <span className="deck-label">
        {label}
        {sub && <span className="deck-sub">{sub}</span>}
      </span>
      <Counts cards={cards} />
    </Link>
  )
}

export default function Decks() {
  const tree = useMemo(() => getDeckTree(), [])
  const calc = useMemo(() => calcCards(), [])
  const moduleIds = Object.keys(tree).sort()

  return (
    <div className="decks">
      <h1 className="decks-title">Chemistry</h1>

      {calc.length > 0 && (
        <section className="module-block">
          <h2 className="module-head">Cross-topic</h2>
          <DeckRow
            to={`/review/${encodeURIComponent('calc')}`}
            label="Calculations"
            sub="every calc question, all topics"
            cards={calc}
          />
        </section>
      )}

      {moduleIds.map((mid) => (
        <section className="module-block" key={mid}>
          <h2 className="module-head">{MODULES[mid]}</h2>
          {tree[mid].map((topic) => (
            <div className="topic-group" key={topic.topicId}>
              <div className="topic-name">{topic.name}</div>
              {topic.subdecks.map((sd) => (
                <DeckRow
                  key={sd.deckId}
                  to={`/review/${encodeURIComponent(sd.deckId)}`}
                  label={sd.label}
                  cards={sd.cards}
                />
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
