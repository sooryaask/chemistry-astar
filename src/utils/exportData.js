import { getItem, KEYS } from './localStorage.js'
import { SPEC } from '../data/spec.js'
import { getErrors } from './errorLog.js'
import { getDeck } from './reviewDeck.js'

export function generateJournalMarkdown() {
  const journal = getItem(KEYS.journal, [])
  const progress = getItem(KEYS.specProgress, {})
  const attempts = getItem(KEYS.quizAttempts, {})
  const errors = getErrors()
  const paperScores = getItem(KEYS.paperScores, {})

  const lines = []
  lines.push('# Zero to A* — Chemistry Study Log')
  lines.push('')
  lines.push(`Exported: ${new Date().toLocaleString()}`)
  lines.push('')

  // Progress summary
  const complete = SPEC.filter((s) => progress[s.id]?.complete).length
  lines.push('## Progress Summary')
  lines.push(`- **Spec points complete:** ${complete}/${SPEC.length}`)
  lines.push(`- **Error log items:** ${errors.length}`)
  lines.push(`- **Review deck cards:** ${getDeck().length}`)
  lines.push('')

  // Quiz attempt history
  const days = Object.keys(attempts).sort()
  if (days.length > 0) {
    lines.push('## Quiz Scores by Day')
    for (const day of days) {
      const list = attempts[day]
      const score = list.reduce((a, x) => a + (x.totalScore || 0), 0)
      const max = list.reduce((a, x) => a + (x.totalMax || 0), 0)
      const pct = max > 0 ? Math.round((score / max) * 100) : 0
      lines.push(`- **${day}**: ${score}/${max} (${pct}%) — ${list.length} attempt${list.length > 1 ? 's' : ''}`)
    }
    lines.push('')
  }

  // Paper scores
  const papers = Object.keys(paperScores)
  if (papers.length > 0) {
    lines.push('## Past Paper Scores')
    for (const key of papers) {
      const p = paperScores[key]
      lines.push(`- **${key}**: ${p.score}/${p.max} (${p.pct}%)`)
    }
    lines.push('')
  }

  // Error log
  if (errors.length > 0) {
    lines.push('## Error Log (top mistakes)')
    for (const e of errors.slice(0, 20)) {
      lines.push(`- **${e.specId}** (${e.frequency}) — missed x${e.missCount}, streak ${e.streak || 0}/3`)
      lines.push(`  - Q: ${e.question}`)
      lines.push(`  - Your answer: ${e.userAnswer || '[blank]'}`)
      lines.push(`  - Model answer: ${e.modelAnswer}`)
    }
    lines.push('')
  }

  // Journal entries
  if (journal.length > 0) {
    lines.push('## Daily Journal')
    for (const entry of journal) {
      lines.push(`### ${entry.date}`)
      if (entry.scoreSummary) lines.push(`Quiz: ${entry.scoreSummary}`)
      if (entry.specPoints?.length > 0) {
        lines.push(`Topics studied: ${entry.specPoints.join(', ')}`)
      }
      if (entry.reflection) lines.push(`\n${entry.reflection}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

export function generateAllDataJson() {
  return JSON.stringify({
    specProgress: getItem(KEYS.specProgress, {}),
    errorLog: getErrors(),
    journal: getItem(KEYS.journal, []),
    quizAttempts: getItem(KEYS.quizAttempts, {}),
    paperScores: getItem(KEYS.paperScores, {}),
    reviewDeck: getDeck(),
    timerLog: getItem(KEYS.timerLog, {}),
    mixedPracticeHistory: getItem(KEYS.mixedPracticeHistory, []),
    examAttempts: getItem(KEYS.examAttempts, []),
    exportedAt: new Date().toISOString(),
  }, null, 2)
}

export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
