# Supervisor Review — Zero to A* Chemistry

**Reviewer:** Supervisor Claude instance
**Date:** 2026-06-22
**Commits reviewed:** `4e8fc74` → `b372f1b` (6 commits) + all uncommitted working changes
**Build status:** PASS (all committed and uncommitted code compiles cleanly)

---

## 1. What Works

- **Core study loop is solid.** The Learn → Drill/Quiz → Error Log → Spaced Rep pipeline is fully wired. Wrong answers flow into both the error log (streak-based) and the review deck (SM-2-lite). Both systems schedule re-tests correctly.
- **Frequency-first ordering is maintained everywhere.** Dashboard focus, quiz candidates, daily agenda, error log sorting — all correctly prioritise HIGH frequency spec points.
- **AI marking system prompt is strict.** The examiner persona correctly penalises imprecise language, missing units, GCSE-level phrasing, and requires distinct marking points. The `DRILL_MARK_SYSTEM` prompt is similarly rigorous.
- **Spaced repetition deck** (`reviewDeck.js`) implements SM-2-lite correctly: ease factor decay, interval scheduling by calendar day, lapse tracking, graduation after 3 consecutive Good grades.
- **Dark theme migration** is consistent — CSS variables used throughout, ScoreChart uses `var()` references, PaperPractice inline styles fixed in `b372f1b`.
- **Sidebar nav** works with mobile responsive collapse and overlay.
- **Pomodoro timer** correctly logs focus time per page, persists split preferences, and shows daily breakdown.
- **New features (uncommitted)** — MicroLesson, MixedPractice, ExamSimulator, ReviewDeckStats, data export — all build cleanly and follow existing patterns.

---

## 2. Bugs Found

### 2a. CRITICAL — `exportData.js` treats `paperScores` as an object, but it's an array

**File:** `src/utils/exportData.js`, lines 42-49
**Bug:** `const papers = Object.keys(paperScores)` and then `paperScores[key]` — but `paperScores` is stored as an **array** of `{ id, name, date, raw, max, pct }` objects (see `src/pages/PastPapers.jsx` line 19-30). `Object.keys()` on an array returns string indices (`"0"`, `"1"`, ...), and then line 47 accesses `p.score` which doesn't exist — the actual property is `p.raw`.

**Impact:** The "Download experiment log (.md)" button will either produce garbled output or silently omit paper scores. Since paper scores are "the experiment endpoint" — the final proof of the concept — this is the one export that matters most.

**Fix:** Replace the paper scores block with:
```js
if (Array.isArray(paperScores) && paperScores.length > 0) {
  lines.push('## Past Paper Scores')
  for (const p of paperScores) {
    lines.push(`- **${p.name}** (${p.date}): ${p.raw}/${p.max} (${p.pct}%)`)
  }
  lines.push('')
}
```

### 2b. MEDIUM — `TOTAL_SPEC_POINTS` in config.js says 60, actual SPEC array has 46

**File:** `src/config.js`, line 9
**Bug:** `export const TOTAL_SPEC_POINTS = 60` — but `src/data/spec.js` only has 46 entries. The constant is currently unused (Dashboard and SpecTracker correctly use `SPEC.length`), but it's misleading and will cause bugs if anyone references it in future.

**Fix:** Change to `export const TOTAL_SPEC_POINTS = 46` or delete the constant entirely.

### 2c. LOW — PomodoroTimer uses raw string key instead of KEYS constant

**File:** `src/components/PomodoroTimer.jsx`, lines 56 and 93
**Bug:** Uses `getItem('pomodoroSplit', null)` and `setItem('pomodoroSplit', next)` instead of routing through `KEYS` in `localStorage.js`. Every other localStorage key uses the centralized constant. This makes it invisible when auditing stored data.

**Fix:** Add `pomodoroSplit: 'pomodoroSplit'` to `KEYS` in `localStorage.js` and import it in PomodoroTimer.

### 2d. LOW — ExamSimulator `handleSubmit` called from useEffect closure

**File:** `src/pages/ExamSimulator.jsx`, lines 41-56
**Bug:** The `useEffect` timer calls `handleSubmit()` when time runs out (line 50), but `handleSubmit` is defined later and captures `startTime`, `questions`, `answers` from the render closure. Since `useEffect` has `[phase, startTime]` as deps but not `answers`, auto-submit when time expires may submit stale `answers` state. The user's most recent typing could be lost.

**Fix:** Move `handleSubmit` into a ref, or add `answers` to the effect deps (with appropriate guard against re-running the timer).

### 2e. LOW — MixedPractice `nextCard` saves `results.length + 1` as card count

**File:** `src/pages/MixedPractice.jsx`, line 144
**Bug:** `cards: results.length + 1` — the `+1` is meant to include the current card being finished, but `results` already had the current card pushed to it in `checkAnswer` (line 97). So the saved count is off by one if the last card was answered, or correct if it was skipped. Inconsistent.

---

## 3. Spec Accuracy — OCR A H032 Verification

### 3a. HIGH — Kc (equilibrium constant) is likely A2 content

**Entry:** `3.1.5c` — "The equilibrium constant Kc"
**Issue:** The OCR A H032 specification covers equilibrium **qualitatively** only (Le Chatelier's principle, predicting shifts). The quantitative treatment of Kc — writing expressions, calculating Kc from equilibrium concentrations — is Module 5 content (H432, Year 2). Multiple specification summaries describe Module 3 equilibrium as "Reaction rates and equilibrium (qualitative)."

**Risk:** If Sooryaa spends time drilling Kc calculations expecting them on the AS exam, that's wasted study time in a 21-day sprint. This is the most impactful spec accuracy issue.

**Recommendation:** Verify against the official PDF. If confirmed as A2, either remove `3.1.5c` or re-tag it as a STRETCH/bonus item that won't appear on H032.

### 3b. MEDIUM — Module 3 section numbering doesn't match official spec

**Issue:** The official OCR spec splits Module 3 into:
- **3.1** The periodic table (3.1.1 Periodicity, 3.1.2 Group 2, 3.1.3 Halogens, 3.1.4 Qualitative Analysis)
- **3.2** Physical chemistry (3.2.1 Enthalpy, 3.2.2 Rates, 3.2.3 Equilibrium)

But `spec.js` uses a flat `3.1.x` scheme: enthalpy is `3.1.4`, rates is `3.1.5`, equilibrium is `3.1.5`. This means the IDs in localStorage, error log, review deck, and plan.js all use non-standard numbering.

**Impact:** Not a runtime bug, but confusing if cross-referencing with the actual spec document or past paper mark schemes. Also means the PREREQUISITES map uses wrong IDs for these entries.

### 3c. MEDIUM — Qualitative Analysis (3.1.4) merged into Halogens

**Issue:** Entry `3.1.3b` covers halide ion tests AND mentions "tests for carbonate, sulfate and ammonium ions" in one description. The official spec has a dedicated section 3.1.4 for Qualitative Analysis covering all four ion tests. This content deserves its own entry — it's a distinct exam topic.

### 3d. LOW — Metallic bonding missing from description

**Entry:** `2.2.2a` — "Ionic and covalent bonding"
**Issue:** Description mentions ionic bonding, covalent bonding, and dative covalent bonding, but omits metallic bonding, which is explicitly in the official spec under this section.

### 3e. LOW — Analytical techniques numbered as 4.2.3 instead of 4.2.4

**Issue:** IR spectroscopy (`4.2.3b`) and mass spectrometry (`4.2.3c`) are officially OCR section 4.2.4, not sub-parts of 4.2.3 (Organic Synthesis). Minor numbering issue.

---

## 4. Marking Rigor Assessment

The system prompt in `src/api/anthropic.js` is well-designed for strict marking:

- **Strengths:**
  - Explicitly penalises imprecise language with examples ("electrons move" vs "delocalised electrons move")
  - Requires correct units and significant figures on all calculations
  - Flags GCSE-level phrasing that wouldn't score at A-level
  - Demands the exact OCR-style phrasing for model answers
  - Counts distinct marking points (not rewarding repetition)

- **One concern:** The question generation now only produces 1+2+3 mark questions (max 3 marks each, total 6 marks). This is good for rapid drilling but means 6-mark extended response questions are never practised. The original spec described "1/3/6 marks" in the README. The README should be updated to match the actual 1/2/3 scheme, or a 6-mark option should be available somewhere (the Exam Simulator would be the natural place).

- **Cannot live-test marking** without an API key in `.env`. The `.env` handling is correct — `getApiKey()` throws a clear error message if the key is missing or set to `your_key_here`.

---

## 5. Missing from Original Brief

| Feature from README/brief | Status |
|---|---|
| Dashboard with Day X of 21, key metrics | ✅ Working |
| Spec Tracker with confidence sliders | ✅ Working |
| AI Quiz (3 questions per spec point) | ✅ Working |
| Error Log with re-quiz | ✅ Working |
| Daily Log with SVG chart | ✅ Working |
| Past Papers with score logger | ✅ Working |
| Experiment log file | ⚠️ Export exists but has the paperScores bug (2a) |
| Final mock interface | ✅ ExamSimulator (uncommitted) |

---

## 6. Summary

| Severity | Count | Key items |
|---|---|---|
| CRITICAL | 1 | `exportData.js` paperScores bug — experiment log export broken |
| HIGH | 1 | Kc likely A2 content — wasted study time risk |
| MEDIUM | 3 | Config TOTAL_SPEC_POINTS=60, Module 3 numbering, Qualitative Analysis merged |
| LOW | 5 | Timer key, ExamSimulator stale closure, MixedPractice count, metallic bonding, 4.2.4 numbering |

**Overall verdict:** The core study tool works correctly and the frequency-first philosophy is intact. The most urgent fix is the `exportData.js` bug since the experiment log is central to the project's purpose. The Kc scope question should be verified against the official spec PDF before Day 21.
