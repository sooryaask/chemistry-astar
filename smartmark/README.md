# Smart Mark — Past Paper Practice

A local Streamlit tool for OCR A Chemistry past-paper practice. It renders pages
from past-paper PDFs you provide, lets you type an answer, sends the question
page image to Claude for OCR-style marking (mark + what went well + how to
improve), and shows the real mark scheme alongside.

**Personal private study only.** Exam PDFs are copyrighted — keep them on your
machine (the `papers/` folder is git-ignored).

## Setup

```bash
cd smartmark
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Your API key is read from `.env` (`ANTHROPIC_API_KEY`). A `.env` is already
created here; edit it to change the key.

## Add papers

Download OCR A Chemistry question papers **and** their mark schemes and drop the
PDFs into the `papers/` folder. See `papers/README.txt` for naming tips.

## Run

```bash
source .venv/bin/activate      # if not already active
streamlit run app.py
```

Streamlit opens in your browser (usually http://localhost:8501).

## Use

1. Sidebar: pick the **question paper** PDF and (optionally) its **mark scheme**.
2. Choose the page showing the question.
3. Type the **question number** (e.g. `2(a)`) and your answer.
4. Click **Assess with Smart Mark** → see your mark and feedback.
5. Tick **Reveal mark scheme** on the right to check the official answer.

## Notes

- Only the single page image you assess is sent to the API — never whole papers.
- Marking quality depends on the AI reading the page; clear scans work best.
- Uses the `claude-sonnet-4-6` vision model.
