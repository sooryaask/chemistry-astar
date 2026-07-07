# Chemistry A* — OCR A AS Paper 1 Reviewer

A spaced-repetition study tool for **OCR A Chemistry AS Paper 1 (H032)**, Modules 1–4. Built with React + Vite, plain CSS, and the Anthropic API for AI-powered marking against real mark schemes. Includes **1,000 AI-generated exam-style questions** covering all 23 topics across Modules 1–4 plus past-paper image cards from 9 exam sessions.

## How it works

Two card sources feed into an Anki-style spaced-repetition reviewer:

1. **Past-paper image cards** — real OCR questions split into one card per sub-part, with cropped question and mark-scheme images from 9 exam sessions.
2. **AI-generated text cards** — 1,000 original exam-style questions (MCQ + written) generated from the OCR A H032 specification, covering all 23 topics. MCQs are marked locally; written questions carry their own mark points for AI or manual marking.

Two screens:

- **Decks** — one deck per past paper + an AI Questions deck, showing mastery percentage and SRS counts (new + learning + due).
- **Review** — an Anki-style reviewer. Type your answer, then either:
  - **Mark my answer** — sends your answer + the question crop + mark scheme crop to Claude (`claude-sonnet-4-6`), which returns a score, per-point awarded/missed breakdown, and pre-fills the tick boxes.
  - **Just show the answer** — reveals the mark scheme for manual self-marking.
  - Grade with Again/Hard/Good/Easy to drive the spaced-repetition scheduler.

All progress lives in `localStorage`. No backend, no accounts.

## Run locally

```bash
npm install
cp .env.example .env     # then paste your Anthropic API key
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173/chemistry-astar/`).

### API key

1. Copy `.env.example` to `.env`.
2. Set `VITE_ANTHROPIC_API_KEY=sk-ant-...` with your real key.
3. **Restart `npm run dev`** — Vite only reads env vars at startup.

## Security

The API key is bundled into the client JavaScript via Vite. On a public site, anyone can extract it from dev tools.

- **Recommended:** keep the deployed site key-less (marking won't work online) and only use AI features locally. The decks, review, and SRS all work without a key.
- Or put the site behind a private repo / restricted Pages.
- `.env` is git-ignored so your key is never committed.

## Testing

```bash
npm test                # Vitest suite (127 unit + component tests)
npm run test:agent      # Full pipeline: change detection + tests + build + insights
```

### Agent Jerry — QA tester

An autonomous QA agent built on the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript) with Playwright for visual testing. It reads source code, takes browser screenshots at different viewports, finds issues, and optionally fixes them.

```bash
node tests/qa-agent.js                          # Changed files only
node tests/qa-agent.js --full                   # Review all source files
node tests/qa-agent.js --focus "toolbar mobile" # Focus on a specific area
node tests/qa-agent.js --fix                    # Auto-fix mode
node tests/qa-agent.js --fix --focus "toolbar"  # Focused + fix
```

Tools available to Jerry: `read_file`, `glob_files`, `grep_code`, `screenshot`, `edit_file` (fix mode only), `run_tests`.

## Deploy to GitHub Pages

```bash
npm run deploy
```

This builds the app and pushes `dist/` to a `gh-pages` branch. Then in **Settings → Pages**, set the source to the `gh-pages` branch.

The app uses `HashRouter`, so deep links and refreshes work on Pages without extra configuration.

## AI-generated questions

`src/data/aiQuestions/` contains **1,000 exam-style questions** across 23 topic files, generated from the OCR A H032 specification. Each file is a JSON array of question objects in two formats:

- **MCQ** — four options, correct answer, step-by-step explanation, and worked solution.
- **Written** — 1–6 marks, per-mark marking points, model answer, and examiner commentary.

Questions are auto-loaded via `import.meta.glob` in `src/data/cards.js` and appear as a dedicated "AI Generated questions" deck. The test suite (`src/__tests__/data/aiQuestions.test.js`) validates schema integrity, ID uniqueness, mark-point counts, and text-only constraints across all 1,000 questions.

## Image pipeline

The `smartmark/` directory contains a local-only Python pipeline that renders past-paper PDFs into per-question and per-sub-part PNG crops used by the app. PDFs and rendered images are git-ignored (copyrighted material). `public/rendered` is a symlink to `smartmark/rendered/`.
