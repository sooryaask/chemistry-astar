import { Routes, Route, useParams } from 'react-router-dom'
import Decks from './pages/Decks.jsx'
import Review from './pages/Review.jsx'

// Key the Review by deckId so switching decks remounts it (fresh session/queue)
// instead of reusing the previous deck's state.
function ReviewRoute() {
  const { deckId } = useParams()
  return <Review key={deckId} />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Decks />} />
      <Route path="/review/:deckId" element={<ReviewRoute />} />
    </Routes>
  )
}
