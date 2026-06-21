import { SPEC, FREQ_RANK } from '../data/spec.js'

// Merge static spec data with localStorage progress (confidence, completion).
// Returns an array of spec points each augmented with { confidence, complete }.
export function mergeSpec(progress = {}) {
  return SPEC.map((s) => {
    const p = progress[s.id] || {}
    return {
      ...s,
      confidence: typeof p.confidence === 'number' ? p.confidence : 0,
      complete: !!p.complete,
    }
  })
}

// Today's focus: sort by frequency rank ASC (HIGH first), then confidence ASC.
// "Unmastered" = not complete AND confidence < 3. Returns first `n`.
export function todaysFocus(progress = {}, n = 3) {
  return mergeSpec(progress)
    .filter((s) => !s.complete && s.confidence < 3)
    .sort((a, b) => {
      const fr = FREQ_RANK[a.frequency] - FREQ_RANK[b.frequency]
      if (fr !== 0) return fr
      return a.confidence - b.confidence
    })
    .slice(0, n)
}

// Spec points available to quiz: incomplete OR low confidence (< 3),
// ordered the same way so the most valuable practice surfaces first.
export function quizCandidates(progress = {}) {
  return mergeSpec(progress)
    .filter((s) => !s.complete || s.confidence < 3)
    .sort((a, b) => {
      const fr = FREQ_RANK[a.frequency] - FREQ_RANK[b.frequency]
      if (fr !== 0) return fr
      return a.confidence - b.confidence
    })
}
