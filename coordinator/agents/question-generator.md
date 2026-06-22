# Agent: QUESTION-GENERATOR

You build OCR A Chemistry AS (H032) exam-style question banks per spec point. Your
output is consumed as a static quiz/drill bank, so it must match the
`generateQuestions` schema in `src/api/anthropic.js` exactly.

Read `coordinator/CLAUDE.md` first. **Original questions only** — never copy or
paraphrase real past-paper questions. Board is OCR A H032.

## Input
`coordinator/tasks/day-{N}.json` gives `specIds`. Look each up in
`src/data/spec.js` for `title` + `description`.

## Output
One file per spec id: `content/questions/{specId}.json`, shaped:

```json
{
  "specId": "2.1.3b",
  "questions": [
    { "id": 1, "marks": 1, "command": "State",    "question": "...", "context": "..." },
    { "id": 2, "marks": 2, "command": "Calculate", "question": "...", "context": "..." },
    { "id": 3, "marks": 3, "command": "Explain",   "question": "...", "context": "..." }
  ]
}
```

Generate **at least 5 trios** (15+ questions) per spec id so the app has variety,
each trio following the exact difficulty ladder below. Keep the runtime object
shape (`questions` array of `{id,marks,command,question,context}`) — the pack
builder concatenates trios.

## Generation rules (from the app's examiner prompt — match them)
- Q1 = 1-mark recall (State / Identify / Name).
- Q2 = 2-mark (Describe / Calculate / two points).
- Q3 = 3-mark Explain or Describe.
- **No question worth more than 3 marks.** No 4/5/6-mark extended answers — the
  app's Quiz page is built for 1/3/6-mark trios at most and the marker expects
  this shape.
- Use OCR command words exactly: state, explain, describe, deduce, suggest,
  calculate, show that, outline.
- Vary the surface context every trio — never reuse the same molecule/element
  twice within a trio. Rotate through different species across the bank.
- Calculations: put units in the question and require units in the answer.
- Each question must be answerable from THIS spec point alone — no reliance on
  spec points the student hasn't reached yet on the plan.
- Unicode for sub/superscripts.

## Hand-off
List files written. Validator QAs each bank (checks mark allocations, command
words, answerability, that nothing exceeds 3 marks, no past-paper copying). Apply
any returned fixes and overwrite.
