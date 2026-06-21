"""
Smart Mark — past-paper practice with AI marking.

Drop OCR past-paper + mark-scheme PDFs into ./papers, render a question page,
type your answer, and Claude marks it (mark + what went well + how to improve)
against OCR-style criteria. The real mark scheme is shown alongside.

Run:  streamlit run app.py
"""

import base64
import json
import os
from collections import defaultdict
from pathlib import Path

import fitz  # PyMuPDF
import streamlit as st
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv(override=True)  # override any empty ANTHROPIC_API_KEY in the shell

PAPERS_DIR = Path(__file__).parent / "papers"
INDEX_PATH = Path(__file__).parent / "index.json"
MODEL = "claude-sonnet-4-6"
RENDER_DPI = 150


def load_index() -> dict:
    if INDEX_PATH.exists():
        try:
            return json.loads(INDEX_PATH.read_text())
        except Exception:  # noqa: BLE001
            return {}
    return {}


def topic_map(index: dict):
    """topic -> list of {paper, number, marks, page, summary}."""
    m = defaultdict(list)
    for paper, data in index.items():
        for q in data.get("questions", []):
            m[q.get("topic", "Uncategorised")].append({**q, "paper": paper})
    return m

SYSTEM_PROMPT = """You are an expert OCR A Chemistry examiner marking the work of Sooryaa, an A-level student aiming for an A*.

You are shown an IMAGE of a real past-paper page and the student's typed answer to ONE specific question on that page. Find that question on the page, read it and its mark allocation, then mark the student's answer with strict OCR-style criteria.

MARKING RULES (strict — A* preparation):
- Mark against OCR-style mark scheme criteria for that exact question.
- Award marks point-by-point: full marks needs as many distinct correct points as the question is worth.
- Penalise imprecise language (e.g. 'electrons move' where 'delocalised electrons move' is required).
- On calculations: deduct a mark for missing/wrong units or wrong significant figures.
- Flag GCSE-level phrasing that would not score at A-level (e.g. 'strong bonds' instead of 'high bond enthalpy').

If you genuinely cannot find the question number on the page, set "found": false and explain in howToImprove.

Respond with VALID JSON ONLY, no prose, in this exact shape:
{
  "found": true,
  "questionMarks": 3,
  "score": 2,
  "whatWentWell": "Specific praise for what scored.",
  "howToImprove": "Specific, actionable next steps to gain the missed marks.",
  "markSchemeAnswer": "The exact OCR-style phrasing that would score full marks, point by point."
}"""


def list_pdfs():
    if not PAPERS_DIR.exists():
        return []
    return sorted(p.name for p in PAPERS_DIR.glob("*.pdf"))


@st.cache_data(show_spinner=False)
def render_page(pdf_name: str, page_index: int, dpi: int = RENDER_DPI) -> bytes:
    """Render a single PDF page to PNG bytes. Cached per (file, page)."""
    doc = fitz.open(PAPERS_DIR / pdf_name)
    page = doc[page_index]
    pix = page.get_pixmap(dpi=dpi)
    data = pix.tobytes("png")
    doc.close()
    return data


@st.cache_data(show_spinner=False)
def page_count(pdf_name: str) -> int:
    doc = fitz.open(PAPERS_DIR / pdf_name)
    n = doc.page_count
    doc.close()
    return n


def parse_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```", 2)[1]
        if cleaned.lstrip().startswith("json"):
            cleaned = cleaned.lstrip()[4:]
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end != -1:
        cleaned = cleaned[start : end + 1]
    return json.loads(cleaned)


def assess(page_png: bytes, question_no: str, answer: str) -> dict:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key or "your-key" in key:
        raise RuntimeError(
            "No API key. Copy .env.example to .env and add your ANTHROPIC_API_KEY."
        )
    client = Anthropic(api_key=key)
    b64 = base64.standard_b64encode(page_png).decode()
    msg = client.messages.create(
        model=MODEL,
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            f"Mark my answer to question {question_no} on this page.\n\n"
                            f"My answer:\n{answer.strip() or '[no answer given]'}\n\n"
                            "Respond with valid JSON only."
                        ),
                    },
                ],
            }
        ],
    )
    text = "".join(b.text for b in msg.content if b.type == "text")
    return parse_json(text)


# ----------------------------- UI -----------------------------
st.set_page_config(page_title="Smart Mark — Past Papers", layout="wide")
st.title("Smart Mark — Past Paper Practice")
st.caption(
    "Real questions from your PDFs · AI marking · mark scheme alongside · "
    "OCR A Chemistry"
)

pdfs = list_pdfs()
if not pdfs:
    st.warning(
        "No PDFs found. Put past-paper and mark-scheme PDFs in the `papers/` "
        "folder, then refresh. (See papers/README.txt.)"
    )
    st.stop()

index = load_index()

# A "jump" from the topic browser sets widget keys BEFORE widgets are created.
if "jump" in st.session_state:
    j = st.session_state.pop("jump")
    st.session_state["qp"] = j["paper"]
    st.session_state["q_page"] = j["page"]
    st.session_state["qno"] = j["number"]
    st.session_state["mode"] = "🎯 Practice"
    st.session_state.pop("result", None)

with st.sidebar:
    st.header("Mode")
    mode = st.radio(
        "View", ["🎯 Practice", "📚 Browse by topic"], key="mode",
        label_visibility="collapsed",
    )
    st.divider()
    st.header("Papers")
    qp = st.selectbox("Question paper", pdfs, key="qp")
    ms_options = ["(none)"] + pdfs
    ms = st.selectbox("Mark scheme", ms_options, key="ms")
    st.divider()
    st.markdown(
        "**Workflow**\n\n"
        "1. Pick the question-paper page (or jump from a topic).\n"
        "2. Enter the question number.\n"
        "3. Type your answer & assess.\n"
        "4. Reveal the mark scheme to check."
    )

# =================== BROWSE BY TOPIC ===================
if mode == "📚 Browse by topic":
    st.subheader("Browse questions by topic")
    if not index:
        st.warning(
            "No topic index yet. Run `python index_papers.py` in the terminal to "
            "build it, then refresh."
        )
        st.stop()

    tmap = topic_map(index)
    topics_sorted = sorted(tmap.keys(), key=lambda t: (-len(tmap[t]), t))
    topic = st.selectbox(
        "Topic",
        topics_sorted,
        format_func=lambda t: f"{t}  ({len(tmap[t])} questions)",
    )
    st.caption(
        f"{len(tmap[topic])} questions on **{topic}** across {len(index)} papers. "
        "Click a question to open it in Practice."
    )

    # Group the topic's questions by paper for a tidy list.
    by_paper = defaultdict(list)
    for q in tmap[topic]:
        by_paper[q["paper"]].append(q)

    for paper in sorted(by_paper):
        nice = paper.replace(" - Paper 1 OCR (A) Chemistry AS-Level.pdf", "")
        nice = nice.replace(" - Paper 1 OCR (A) Chemistry AS-level.pdf", "")
        st.markdown(f"**{nice}**")
        for q in sorted(by_paper[paper], key=lambda x: x["page"]):
            c1, c2 = st.columns([5, 1])
            with c1:
                st.write(
                    f"Q{q['number']} · p{q['page']} · {q['marks']} mark"
                    f"{'s' if q['marks'] != 1 else ''} — {q.get('summary', '')}"
                )
            with c2:
                if st.button("Open ▶", key=f"open-{paper}-{q['number']}"):
                    st.session_state["jump"] = {
                        "paper": paper,
                        "page": int(q["page"]),
                        "number": str(q["number"]),
                    }
                    st.rerun()
    st.stop()

# =================== PRACTICE ===================
left, right = st.columns(2)

# ---- Left: question paper + answer ----
with left:
    st.subheader("Question paper")
    n_pages = page_count(qp)
    q_page = st.number_input(
        "Page", min_value=1, max_value=n_pages, value=1, step=1, key="q_page"
    )
    st.image(render_page(qp, q_page - 1), use_container_width=True)

    st.markdown("---")
    question_no = st.text_input("Question number (e.g. 2(a) or 3)", key="qno")
    answer = st.text_area("Your answer", height=180, key="answer")

    if st.button("✨ Assess with Smart Mark", type="primary"):
        if not question_no.strip():
            st.error("Enter the question number you're answering.")
        else:
            with st.spinner("Marking…"):
                try:
                    page_png = render_page(qp, q_page - 1)
                    st.session_state["result"] = assess(
                        page_png, question_no, answer
                    )
                except Exception as e:  # noqa: BLE001
                    st.session_state["result"] = None
                    st.error(f"Could not mark: {e}")

    result = st.session_state.get("result")
    if result:
        if not result.get("found", True):
            st.warning("Couldn't locate that question on the page.")
        max_m = result.get("questionMarks", "?")
        score = result.get("score", "?")
        st.success(f"### Your mark: {score} / {max_m}")
        st.markdown("**✅ What went well**")
        st.write(result.get("whatWentWell", "—"))
        st.markdown("**📈 How to improve**")
        st.write(result.get("howToImprove", "—"))
        with st.expander("AI mark-scheme answer (full marks)"):
            st.write(result.get("markSchemeAnswer", "—"))

# ---- Right: official mark scheme ----
with right:
    st.subheader("Official mark scheme")
    if ms == "(none)":
        st.info("Select a mark-scheme PDF in the sidebar to view it here.")
    else:
        reveal = st.checkbox("Reveal mark scheme", key="reveal")
        if reveal:
            ms_pages = page_count(ms)
            ms_page = st.number_input(
                "Page",
                min_value=1,
                max_value=ms_pages,
                value=1,
                step=1,
                key="ms_page",
            )
            st.image(render_page(ms, ms_page - 1), use_container_width=True)
        else:
            st.caption("Hidden — tick the box to reveal (try your answer first!).")
