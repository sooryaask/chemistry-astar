// Live superscript input: typing '^' starts superscript mode, and the following
// digits/signs are inserted as Unicode superscript glyphs (10^23 -> 10²³).
// Keeps the field as plain text so AI marking is unaffected.

export const SUPERSCRIPT = {
  0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴',
  5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  n: 'ⁿ', i: 'ⁱ',
}

// Handle a keydown on a text input/textarea. `modeRef` is a useRef(false) that
// tracks superscript mode. `value`/`setValue` are the controlled-field state.
// Returns true if the event was consumed (caller should stop processing it).
export function applySuperscript(e, modeRef, value, setValue) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false
  const el = e.target

  // '^' toggles into superscript mode and is not itself inserted.
  if (e.key === '^') {
    e.preventDefault()
    modeRef.current = true
    return true
  }

  if (modeRef.current && e.key.length === 1) {
    const mapped = SUPERSCRIPT[e.key]
    if (mapped) {
      e.preventDefault()
      const start = el.selectionStart ?? value.length
      const end = el.selectionEnd ?? value.length
      const next = value.slice(0, start) + mapped + value.slice(end)
      setValue(next)
      requestAnimationFrame(() => {
        try {
          el.selectionStart = el.selectionEnd = start + mapped.length
        } catch {
          /* ignore */
        }
      })
      return true
    }
    // Any other character (space, letter, etc.) ends superscript mode and is
    // inserted normally by the field's own onChange.
    modeRef.current = false
  }
  return false
}
