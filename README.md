# Chemistry A* — OCR A AS Paper 1 Reviewer

A spaced-repetition study tool for **OCR A Chemistry AS Paper 1 (H032)**, Modules 1–4. Built with React + Vite, plain CSS, and the Anthropic API for AI-powered marking against real mark schemes.

## How it works

Each past-paper written question is split into one card per sub-part. Two screens:

- **Decks** — one deck per past paper, showing mastery percentage and SRS counts (new + learning + due).
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
npm test                # Vitest suite (116 unit + component tests)
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

## Image pipeline

The `smartmark/` directory contains a local-only Python pipeline that renders past-paper PDFs into per-question and per-sub-part PNG crops used by the app. PDFs and rendered images are git-ignored (copyrighted material). `public/rendered` is a symlink to `smartmark/rendered/`.
