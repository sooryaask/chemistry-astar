import { useState } from 'react'
import { generateMicroLesson } from '../api/anthropic.js'
import { getSpecPoint } from '../data/spec.js'

export default function MicroLesson({ specId, question, userAnswer, modelAnswer, score, maxScore }) {
  const [open, setOpen] = useState(false)
  const [lesson, setLesson] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Don't render if the answer was correct
  if (score >= maxScore) return null

  async function handleOpen() {
    if (open && lesson) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (lesson) return // already loaded

    setLoading(true)
    setError('')
    try {
      const sp = getSpecPoint(specId) || { id: specId, title: specId }
      const result = await generateMicroLesson(sp, question, userAnswer, modelAnswer)
      setLesson(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="micro-lesson-wrapper">
      <button className="micro-lesson-toggle" onClick={handleOpen}>
        {open ? '▾' : '▸'} Why was this wrong?
      </button>
      {open && (
        <div className="micro-lesson">
          {loading && <p className="muted">Analysing your mistake...</p>}
          {error && <p className="alert error" style={{ margin: '0.5rem 0' }}>{error}</p>}
          {lesson && (
            <>
              <p style={{ margin: '0 0 0.5rem' }}>{lesson.explanation}</p>
              <div className="micro-lesson-gap">
                <strong>Concept gap:</strong> {lesson.conceptGap}
              </div>
              <div className="micro-lesson-relearn">
                <strong>Memorise:</strong> {lesson.relearn}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
