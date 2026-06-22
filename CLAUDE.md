# CLAUDE.md (repo root)

This is the `chemistry-astar` project. Read this fully — it is inherited by every
sub-agent the orchestrator spawns.

## What this repo is
A personal AI study tool + public experiment: reach A\*-equivalent (90%+) on
**OCR A Chemistry AS Paper 1 (H032)**, Modules 1–4, in 21 days. `src/` is a
React + Vite SPA (state in `localStorage`); `smartmark/` is a local-only Streamlit
past-paper marker.

## The multi-agent system
A coordinator drives the 21-day build. Full design is in
`coordinator/README.md`; shared rules in `coordinator/CLAUDE.md`. The agents are
defined in `.claude/agents/`:

- **chem-supervisor** — scheduler. Run/Complete a day; dispatches workers; owns
  `coordinator/state.json`; commits.
- **chem-explainer** — study-note packs → `content/notes/{specId}.json`.
- **chem-question-generator** — question banks → `content/questions/{specId}.json`.
- **chem-mock-runner** — assembles + runs mocks on review days.
- **chem-validator** — strict OCR marking + content QA gate.
- **chem-feature-builder** — the only agent that edits `src/`/`smartmark/`.

To drive a day: tell the main session, or the chem-supervisor agent,
**"Run Day N"** (then later **"Complete Day N"**). Today's day is derived from
`START_DATE` in `src/config.js` (2026-06-16); the challenge is 21 days.

## Golden rules (every agent obeys these)
- **Board is OCR A H032** — never AQA. The student's GCSE board is irrelevant here.
- **Original questions only in committed content.** Real OCR papers/mark schemes
  are copyrighted, live in `smartmark/papers/` (git-ignored), and are only ever
  sent one page-image at a time by SmartMark. Never copy past-paper text into
  `content/` or git.
- **Match the app's exact JSON schemas** in `src/api/anthropic.js`
  (`generateLesson`, `generateQuestions`, `markAnswers`, `paperScores`). Generated
  content must be drop-in compatible.
- **Single source of truth:** curriculum lives in `src/data/spec.js` (46 spec
  points), `src/data/plan.js` (the 21-day plan), `src/data/paperIndex.json`,
  `smartmark/topics.py`. Reference these by id; never fork or duplicate them.
- **Runtime model split:** `claude-sonnet-4-6` (rigorous) / `claude-haiku-4-5`
  (fast drill) in `src/config.js`. Preserve it when editing app code.
- **Never commit secrets or papers:** `.env`, `smartmark/papers/*.pdf`,
  `smartmark/rendered/`, `imports/` stay out of git.

## Why this exists
The deployed app exposes its API key in the browser bundle (root `README.md` →
Security). The agents authenticate through Claude Code, so they **pre-generate** a
content pack the app imports into `localStorage` — instant, key-free study
material. Prefer pre-generation over live calls.
