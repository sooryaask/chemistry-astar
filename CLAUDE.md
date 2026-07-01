# CLAUDE.md (repo root)

This is the `chemistry-astar` project.

## What this repo is
A personal study tool to reach A\*-equivalent performance on **OCR A Chemistry AS
Paper 1 (H032)**, Modules 1–4. It is a spaced-repetition reviewer built from real
past papers:

- `src/` — a React + Vite single-page app (state in `localStorage`). Two screens:
  **Decks** (one deck per past paper) and **Review** (an Anki-style reviewer).
- `smartmark/` — a **local-only** Python pipeline that renders the past-paper PDFs
  into per-question and per-sub-part PNG crops used by the app.

## How the app works
- Each past-paper written question is split into one card **per sub-part** (a),(b),(c)…
  Multiple-choice and calculation questions are filtered out.
- A card shows the cropped question image and dotted answer lines. The student types
  an answer, then either:
  - **Mark my answer** — sends the answer + the cropped question + that sub-part's
    cropped mark scheme to Claude (`assessPaperQuestion` in `src/api/anthropic.js`),
    which returns a score, what-went-well, how-to-improve and the model answer, and
    pre-fills the tick boxes; or
  - **Just show the answer** — reveals the mark scheme for manual self-marking.
- Grading (Again/Hard/Good/Easy) drives the spaced-repetition schedule in
  `src/utils/srs.js` (persisted to `localStorage`).

Card data is built in `src/data/cards.js` from `src/data/paperIndex.json`, which
records, per question: the QP page crops, the per-sub-part image crops
(`subPartImgs`), the per-sub-part mark-scheme crops (`msSubPartImgs`), and the
per-sub-part marks (`subPartMarks`).

## The image pipeline (`smartmark/`)
The PDFs in `smartmark/papers/` (git-ignored, copyrighted) are rendered into
`smartmark/rendered/` (also git-ignored). `public/rendered` is a symlink to that
folder, so the app serves the crops directly. The rendered PNGs are **not** in git —
regenerate them locally from the papers with the `smartmark/` scripts if needed.

## Golden rules
- **Board is OCR A H032** — never AQA.
- **Never commit copyrighted papers or secrets:** `.env`, `smartmark/papers/*.pdf`,
  `smartmark/rendered/`, `smartmark/index.json` stay out of git. Mark-scheme and
  question images are only ever sent to the API one crop at a time at mark time.
- **Model split** (`src/config.js`): `claude-sonnet-4-6` (rigorous, e.g. marking) /
  `claude-haiku-4-5` (fast). Preserve it when editing app code.
- **The API key is baked into the browser bundle** via `VITE_ANTHROPIC_API_KEY`
  (see `README.md` → Security). Each "Mark my answer" is a live, paid API call.

## Dev
- `npm run dev` / `npm run build` (config in `.claude/launch.json` for the preview).
- `src/data/paperIndex.json` is the single source of truth for card content.
