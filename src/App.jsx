import { Routes, Route } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import PomodoroTimer from './components/PomodoroTimer.jsx'
import Dashboard from './pages/Dashboard.jsx'
import StudyPlan from './pages/StudyPlan.jsx'
import SpecTracker from './pages/SpecTracker.jsx'
import Learn from './pages/Learn.jsx'
import Quiz from './pages/Quiz.jsx'
import Flashcards from './pages/Flashcards.jsx'
import ErrorLog from './pages/ErrorLog.jsx'
import Journal from './pages/Journal.jsx'
import PastPapers from './pages/PastPapers.jsx'
import PaperPractice from './pages/PaperPractice.jsx'
import MixedPractice from './pages/MixedPractice.jsx'
import ExamSimulator from './pages/ExamSimulator.jsx'

export default function App() {
  return (
    <>
      <Nav />
      <PomodoroTimer />
      <div className="main-content">
        <main className="container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/plan" element={<StudyPlan />} />
            <Route path="/spec" element={<SpecTracker />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/drill" element={<Flashcards />} />
            <Route path="/errors" element={<ErrorLog />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/papers" element={<PastPapers />} />
            <Route path="/practice" element={<PaperPractice />} />
            <Route path="/mixed" element={<MixedPractice />} />
            <Route path="/exam" element={<ExamSimulator />} />
          </Routes>
        </main>
        <footer className="site-footer">
          Zero to A* — a public experiment by Sooryaa · OCR A Chemistry (H032)
        </footer>
      </div>
    </>
  )
}
