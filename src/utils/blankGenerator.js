// Seneca-style active recall: generate fill-in-the-blank challenges from lesson data

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'may', 'might', 'must', 'can', 'could', 'of', 'in', 'to',
  'for', 'with', 'on', 'at', 'from', 'by', 'as', 'into', 'about',
  'between', 'through', 'during', 'before', 'after', 'above', 'below',
  'and', 'or', 'but', 'nor', 'not', 'so', 'yet', 'both', 'either',
  'neither', 'each', 'every', 'all', 'any', 'some', 'no', 'only',
  'very', 'too', 'also', 'just', 'more', 'most', 'other', 'such',
  'than', 'then', 'that', 'this', 'these', 'those', 'it', 'its',
  'they', 'them', 'their', 'there', 'here', 'when', 'where', 'which',
  'what', 'who', 'whom', 'how', 'if', 'up', 'out', 'same', 'used',
  'using', 'use', 'e.g.', 'i.e.', 'etc', 'often', 'always', 'never',
])

function stripPunctuation(word) {
  return word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
}

function isCandidate(token) {
  const stripped = stripPunctuation(token).toLowerCase()
  if (stripped.length <= 2) return false
  if (STOPWORDS.has(stripped)) return false
  return true
}

function hasChemistrySignal(token) {
  const s = stripPunctuation(token)
  // Contains digits (formulae, numbers)
  if (/\d/.test(s)) return true
  // Contains uppercase mid-word (pH, NaCl)
  if (/[a-z][A-Z]/.test(s)) return true
  // Chemical formula pattern (starts uppercase, has lowercase)
  if (/^[A-Z][a-z]?[A-Z0-9]/.test(s)) return true
  // Subscript/superscript characters
  if (/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀₁₂₃₄₅₆₇₈₉]/.test(s)) return true
  return false
}

/** Score a candidate token for blank-worthiness (higher = more likely to be blanked) */
function blankScore(token) {
  const s = stripPunctuation(token)
  let score = s.length // longer words more valuable
  if (hasChemistrySignal(token)) score += 10
  if (s.length > 6) score += 3
  return score
}

/**
 * Given a sentence, produce segments with some key terms blanked out.
 * Returns [{ text, isBlank, answer? }]
 */
function blankSentence(sentence, aggressiveness = 0.3) {
  const tokens = sentence.split(/(\s+)/)
  const wordIndices = []
  tokens.forEach((t, i) => {
    if (t.trim()) wordIndices.push(i)
  })

  if (wordIndices.length <= 2) {
    return [{ text: sentence, isBlank: false }]
  }

  // Score each word token
  const scored = wordIndices
    .filter((i) => isCandidate(tokens[i]))
    .map((i) => ({ index: i, score: blankScore(tokens[i]) }))
    .sort((a, b) => b.score - a.score)

  // Pick top N blanks
  const maxBlanks = Math.min(3, Math.max(1, Math.ceil(scored.length * aggressiveness)))
  const blankSet = new Set(scored.slice(0, maxBlanks).map((s) => s.index))

  // Group adjacent blanked tokens into single blanks
  const segments = []
  let i = 0
  while (i < tokens.length) {
    if (blankSet.has(i)) {
      // Collect consecutive blanked tokens (including whitespace between them)
      let blankText = tokens[i]
      let j = i + 1
      while (j < tokens.length && (blankSet.has(j) || (tokens[j].trim() === '' && j + 1 < tokens.length && blankSet.has(j + 1)))) {
        blankText += tokens[j]
        j++
      }
      segments.push({ text: blankText, isBlank: true, answer: stripPunctuation(blankText) || blankText.trim() })
      i = j
    } else {
      segments.push({ text: tokens[i], isBlank: false })
      i++
    }
  }

  return segments
}


// ── Public API ──────────────────────────────────────────────────────────

export function generateMustKnowBlanks(mustKnow) {
  if (!mustKnow || !mustKnow.length) return []
  return mustKnow.map((item, i) => {
    // Alternate: even indices = blank the term, odd = blank the definition
    const blankTerm = i % 2 === 0
    return {
      id: `mk-${i}`,
      type: 'mustKnow',
      prompt: blankTerm ? item.definition : item.term,
      answer: blankTerm ? item.term : item.definition,
      blankLabel: blankTerm ? 'Term' : 'Definition',
    }
  })
}

export function generateKeyIdeaBlanks(keyIdeas) {
  if (!keyIdeas || !keyIdeas.length) return []
  return keyIdeas.map((idea, i) => ({
    id: `ki-${i}`,
    type: 'keyIdea',
    segments: blankSentence(idea, 0.3),
    original: idea,
  }))
}

export function generateMarkSchemeBlanks(markSchemePhrases) {
  if (!markSchemePhrases || !markSchemePhrases.length) return []
  return markSchemePhrases.map((phrase, i) => ({
    id: `ms-${i}`,
    type: 'markScheme',
    segments: blankSentence(phrase, 0.5),
    original: phrase,
  }))
}

/** Normalize a string for comparison */
function normalize(s) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\u2212\u2013\u2014]/g, '-') // unicode minus, en-dash, em-dash → hyphen
    .replace(/[()[\]{},;:.!?'"]/g, '')     // strip punctuation
    .replace(/\s+/g, ' ')                  // collapse whitespace
}

/** Levenshtein distance for short strings */
function levenshtein(a, b) {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/**
 * Fuzzy-match user input against expected answer.
 * Returns "correct" | "close" | "wrong"
 */
export function fuzzyMatch(userInput, expected) {
  if (!userInput || !expected) return 'wrong'
  const a = normalize(userInput)
  const b = normalize(expected)
  if (a === b) return 'correct'
  // Also check if one contains the other (for "proton number (Z)" vs "proton number")
  if (a.includes(b) || b.includes(a)) return 'correct'
  const threshold = Math.max(1, Math.floor(b.length / 5))
  if (levenshtein(a, b) <= threshold) return 'close'
  return 'wrong'
}

/** Collect all blank IDs from a mixed blanks array */
export function collectBlankIds(blanks) {
  const ids = []
  for (const b of blanks) {
    if (b.type === 'mustKnow') {
      ids.push(b.id)
    } else {
      // inline segments
      b.segments.forEach((seg, si) => {
        if (seg.isBlank) ids.push(`${b.id}-${si}`)
      })
    }
  }
  return ids
}

/** Get the expected answer for a blank ID */
export function getAnswer(blanks, blankId) {
  for (const b of blanks) {
    if (b.type === 'mustKnow' && b.id === blankId) return b.answer
    if (b.segments) {
      for (let si = 0; si < b.segments.length; si++) {
        if (`${b.id}-${si}` === blankId && b.segments[si].isBlank) {
          return b.segments[si].answer
        }
      }
    }
  }
  return ''
}
