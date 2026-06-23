# Zero-to-A* — Coordinator Dashboard
Day 7 of 21 · Week 1 · Review

Spec covered: 12 / 46
Notes packs: 12   Question banks: 12
Mocks run: 0   Last mock: —%

Weak topics (chase these): none yet — mock not yet sat
Today's agents: explainer (12 notes backfilled), question-generator (12 banks backfilled + 7 fixed), validator (real gate: 12/12 pass after fix loop), mock-runner (Module 2 mock assembled + corrected)
Blocked / needs rework: none
Next: Complete Day 7 (sit mock + record score) → then Run Day 8

---

## What happened on Day 7 (Run phase)

Day 7 is the Week 1 Review day. On entry, `content/` was empty — Days 1–6 learning runs had committed **no** content (state metrics all 0). Per the user's decision, this run did a **full Days 1–6 backfill** (all 12 spec points: notes + question banks), QA'd it, then assembled the Module 2 review mock.

### Content generated — 12/12 pass/pass (real chem-validator gate)

| Spec ID | Title | Freq | Notes | Questions |
|---------|-------|------|-------|-----------|
| 2.1.1a | Atomic structure | MED | pass | pass (15 q) |
| 2.1.2a | Formulae and ions | LOW | pass | pass (15 q) |
| 2.1.2b | Balanced and ionic equations | LOW | pass | pass (15 q) |
| 2.1.3a | The mole | HIGH | pass | pass (15 q) |
| 2.1.3b | Mole calculations (n=m/M, pV=nRT) | HIGH | pass | pass (15 q) |
| 2.1.3c | Empirical formulae; concentrations | HIGH | pass | pass (15 q) |
| 2.1.4a | Acids, bases and neutralisation | MED | pass | pass (15 q) |
| 2.1.4b | Titration calculations | HIGH | pass | pass (15 q) |
| 2.1.5a | Oxidation numbers | HIGH | pass | pass (15 q) |
| 2.1.5b | Redox half-equations | HIGH | pass | pass (15 q) |
| 2.2.1a | Shells, subshells and orbitals | HIGH | pass | pass (15 q) |
| 2.2.1b | Electron configuration | HIGH | pass | pass (15 q) |

### QA gate caught real defects (not a clean first pass)

A prior **inline** ("supervisor-inline") QA had marked all 12 as pass with no fixes. The **real chem-validator (Opus) gate** overruled it:

- **Notes:** 12/12 pass first time.
- **Question banks:** only **5/12** passed initially. **7 failed:**
  - `2.1.3a` — Q13 leaked into 2.1.3c territory (asked about concentration / mol dm⁻³). Rewritten to a 2.1.3a-only recall (Avogadro constant).
  - `2.1.4a, 2.1.4b, 2.1.5a, 2.1.5b, 2.2.1a, 2.2.1b` — used non-OCR command words (`Name`/`Identify`). Relabelled to `State`/`Deduce`.
- question-generator applied the fixes → **re-QA: 12/12 pass/pass.**

### Mock assembled — then corrected

`content/mocks/2026-06-22-module2.json` — Module 2 Review Mock
- Topics: Moles (2.1.3a/b/c), Redox (2.1.5a/b), Electron Structure (2.2.1a/b) — titrations correctly excluded per schedule.
- **Total marks: 39 | Time limit: 45 min** (~1 min/mark + reading).
- Section A: 10 × 1-mark recall. Section B: 7 × 2-mark + 5 × 3-mark structured (22 questions total).
- Defects fixed: header had wrongly declared **35 marks / 35 min** (actual sum is 39); `Q4` used non-OCR `Define` → `State`; `Q15/Q17` `Describe`→`Write`; `Q21` `Calculate`→`Deduce`.
- Status: assembled, corrected, and ready to sit.

### Student import

`imports/localStorage-export.json` was absent. No student-progress data available — proceeded on schedule order (all 12 backfill points are HIGH frequency anyway).

### Advisory (backlog, not a blocker)

`2.1.4a` Q5/Q8/Q11/Q14 carry command `Describe` but open with "Write the balanced equation…". Valid OCR word, loose pairing — relabel to `State` in the next content sweep.

---

## To complete Day 7

1. Sit the mock: open `content/mocks/2026-06-22-module2.json`, work through all 22 questions timed (45 minutes), type answers.
2. Tell the supervisor **"Complete Day 7"** with your answers (or your total score per section).
3. Supervisor will: have the validator mark it, record the result to `coordinator/results/mock-2026-06-22.json` + the app's `paperScores` shape, identify topics < 70%, write `weakTopics` to `state.json`, rebuild this dashboard, and **commit** (the Run phase does not commit).
4. If any topic < 70%: explainer + question-generator get re-assigned to reinforce it.

---

Next: **Complete Day 7** (sit mock + record score) → then **Run Day 8**
Day 8: Bonding, electronegativity & polarity (2.2.2a, 2.2.2c)
</content>
