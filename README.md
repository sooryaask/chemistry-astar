# Zero to A* — OCR A Chemistry in 21 Days

A personal AI-powered study tool and **public experiment log**. The challenge:
go from zero A-level chemistry knowledge (just finished GCSEs) to A\* in OCR A
Chemistry (H032), in 21 days, using this site as the only study tool.

Built with React + Vite, plain CSS, React Router, and the Anthropic API
(`claude-sonnet-4-6`) for AI question generation and strict OCR-style marking.
All progress lives in `localStorage`.

## Pages

- **Dashboard** — Day X of 21, key metrics, auto-prioritised "today's focus", error log due.
- **Spec Tracker** — every Module 1–4 spec point, with confidence sliders and completion.
- **Quiz** — AI generates 3 exam questions (1/3/6 marks) on a spec point, then marks your answers.
- **Error Log** — every below-full-marks question, ranked by frequency then miss count; re-quiz to master.
- **Daily Log** — one reflection per day plus an SVG score-trend chart.
- **Past Papers** — official OCR links + a manual score logger (the experiment endpoint).

## Run locally

```bash
npm install
cp .env.example .env     # then edit .env and paste your key
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

### Adding your API key

1. Copy `.env.example` to `.env`.
2. Set `VITE_ANTHROPIC_API_KEY=sk-ant-...` with your real key.
3. **Restart `npm run dev`** — Vite only reads env vars at startup.

## ⚠️ Security — read this before deploying publicly

This app calls the Anthropic API **directly from the browser**, so the API key is
bundled into the client JavaScript. On a **public** GitHub Pages site, anyone can
open dev tools and extract your key, then spend your credits.

Options:

- **Recommended:** keep the deployed site key-less (quiz/marking simply won't work
  online) and only run the AI features locally with your `.env`. The tracker,
  spec, error log, journal and papers all work without a key.
- Or put the site behind a private repo / restricted Pages, and accept the risk.
- Or (best for a real public deploy) front the API with a small serverless proxy
  that holds the key server-side and have the app call that instead. This repo
  ships the direct-browser version per the original brief.

`.env` is git-ignored so your key is never committed.

## Deploy to GitHub Pages

1. Create a GitHub repo named **`chemistry-astar`** (the name must match `base`
   in `vite.config.js`). If you use a different name, update `base` to match.
2. Push this project to it.
3. Deploy:

   ```bash
   npm run deploy
   ```

   This runs `predeploy` (`npm run build`) then pushes `dist/` to a `gh-pages`
   branch via the `gh-pages` package.

### GitHub repo settings for Pages

- Go to **Settings → Pages**.
- Under **Build and deployment → Source**, choose **Deploy from a branch**.
- Set **Branch** to **`gh-pages`** and folder **`/ (root)`**, then Save.
- Your site appears at `https://<your-username>.github.io/chemistry-astar/`.

The app uses `HashRouter`, so deep links and refreshes work on Pages without any
extra 404 redirect configuration.

## Updating the challenge start date

Edit `START_DATE` in [`src/config.js`](src/config.js). "Day X of 21" is computed
from it.
