# CLAUDE.md — shared context for every sub-agent

Read this before doing anything. Every agent in the `coordinator/` system shares
these facts. Do not contradict them.

## What this repo is

`chemistry-astar` — a personal AI study tool + public experiment: go from a GCSE
science base to A\*-equivalent (90%+) on **OCR A Chemistry AS Paper 1 (H032)**,
Modules 1–4, in 21 days, using this site as the only study tool.

Two distinct halves:

- **`src/`** — a React + Vite single-page app (the student-facing study tool).
  State lives entirely in `localStorage`. Routes: Dashboard, Plan, Learn, Drill,
  Quiz, Practice, Progress (Spec Tracker), Errors, Journal, Papers.
- **`smartmark/`** — a *local-only* Streamlit tool that marks real past-paper PDF
  pages with Claude vision. Copyrighted PDFs never leave the machine.

## The two layers — do not confuse them

1. **Build/ops layer (this is us).** Claude Code sub-agents that *build and feed*
   the app: generate study-note packs, question banks, mocks; QA content; edit
   code; run scripts; commit. We authenticate through Claude Code, **not** the
   app's API key.
2. **Runtime layer (the app).** The browser app's own calls in
   `src/api/anthropic.js` that quiz/mark the student live at runtime.

Our job is to produce artifacts the runtime layer consumes, and to improve the
runtime layer's code — never to impersonate it.

## Golden rules (violating these breaks the project)

- **Board is OCR A, H032.** Not AQA. Do not import AQA/GCSE-Combined framing into
  A-level content. The student's GCSE board is irrelevant here.
- **Original questions only in committed content.** Real OCR past papers and mark
  schemes are copyrighted; they live in `smartmark/papers/` (git-ignored) and are
  only ever sent one page-image at a time by SmartMark. Never copy past-paper
  text, mark-scheme wording, or whole questions into anything under `content/` or
  into git. Write OCR-*style* originals.
- **Match the app's exact JSON schemas.** Any content an agent generates for the
  app must conform byte-for-byte to the shapes already defined in
  `src/api/anthropic.js` (`generateLesson`, `generateQuestions`, `markAnswers`).
  See each agent file for the exact schema. Drop-in compatibility is the whole
  point.
- **Single source of truth.** The curriculum is NOT redefined here. It lives in:
  - `src/data/spec.js` — 46 spec points (Modules 1–4), each with `frequency`
    (HIGH/MED/LOW) and `gcseOverlap`.
  - `src/data/plan.js` — the 21-day frequency-first plan (`specIds`,
    `smartTopic`, `minutes`, `note`).
  - `src/data/paperIndex.json` — indexed real papers (June 2017–2024) by topic.
  - `smartmark/topics.py` — the 21-topic SmartMark taxonomy.
  Agents READ these. They never fork or duplicate them.
- **Model split.** Runtime: `claude-sonnet-4-6` for rigorous marking/lessons,
  `claude-haiku-4-5` for the fast drill (`src/config.js`). Preserve this whenever
  you touch app code.
- **Never commit secrets or papers.** `.env`, `smartmark/papers/*.pdf`,
  `smartmark/rendered/`, `smartmark/index.json` are git-ignored. Keep it that way.

## Day computation

`START_DATE = '2026-06-16'` in `src/config.js`; challenge is 21 days. Day N =
`floor((today − START_DATE)/1 day) + 1`, clamped ≥ 1. Always recompute; never
hard-code the day except in `coordinator/state.json`, which the supervisor owns.

## Key safety win you should exploit

The deployed app exposes its API key in the browser bundle (see root `README.md`
"Security"). That makes live AI features risky to run publicly. Our build layer
authenticates separately, so we can **pre-generate** lesson and question packs
offline and ship them as static content the app imports into `localStorage` —
the student then gets instant, key-free notes/quizzes. This is the main reason
the multi-agent layer exists. Prefer pre-generation over live calls wherever
possible.
