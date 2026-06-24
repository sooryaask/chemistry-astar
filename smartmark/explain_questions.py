"""
Pre-generate a step-by-step worked solution for every indexed past-paper question,
so the app can teach the method (especially for calculations) — not just show the
official answer. Runs at build time; results are baked into index.json, so the app
needs no API key at runtime.

For each question it sends the rendered QP crop + MS crop image(s) to Claude and
stores, on the question:
  "explanation": one or two sentences on the key idea / why the answer is right
  "steps":       ordered worked steps; for calculations, the formula then each line
                 of working with units and significant figures

Run:  python explain_questions.py            (only questions without an explanation)
      python explain_questions.py --force    (regenerate all)
      python explain_questions.py --calc     (only calculation-style questions)
"""

import base64
import json
import os
import sys
from pathlib import Path

from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv(override=True)

RENDERED_DIR = Path(__file__).parent / "rendered"
INDEX_PATH = Path(__file__).parent / "index.json"
MODEL = "claude-sonnet-4-6"

CALC_TOPICS = {"Amount of Substance (Moles)", "Enthalpy & Energetics", "Equilibrium"}
CALC_WORDS = ("calculat", "mole", "concentration", "enthalp", "yield", "atom econ",
              "empirical", "titrat", "uncertaint", "percentage", "volume", "mass",
              "relative atomic", "rate")


def slug(pdf_name: str) -> str:
    return pdf_name.split(" - ")[0].replace(" ", "_")


def is_calc(q) -> bool:
    s = (q.get("summary") or "").lower()
    return q.get("topic") in CALC_TOPICS or any(w in s for w in CALC_WORDS)


def b64(path: Path):
    if not path.exists():
        return None
    return base64.standard_b64encode(path.read_bytes()).decode()


def parse_json(text: str):
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1]
        if t.lstrip().startswith("json"):
            t = t.lstrip()[4:]
    a, b = t.find("{"), t.rfind("}")
    if a != -1 and b != -1:
        t = t[a:b + 1]
    return json.loads(t)


SYSTEM = (
    "You are an OCR A Chemistry tutor helping an AS student who is learning from "
    "scratch. You are shown a real past-paper question (image 1) and its official "
    "mark scheme (the remaining image(s)). Write a short, clear worked solution that "
    "teaches the METHOD to reach the official answer.\n\n"
    "Rules:\n"
    "- For calculations: state the formula first, then show each line of working with "
    "substituted numbers, units, and the final answer to the correct significant figures.\n"
    "- For multiple-choice: show the reasoning/working that leads to the correct letter.\n"
    "- For written questions: give the key points the mark scheme rewards, in order.\n"
    "- Be concise and concrete. Use real numbers from the question. No waffle.\n\n"
    "Respond with VALID JSON ONLY:\n"
    '{ "explanation": "1-2 sentences on the key idea / why the answer is correct", '
    '"steps": ["Step 1 ...", "Step 2 ...", "Answer: ..."] }'
)


def explain(client, qp_imgs, ms_imgs, q):
    content = []
    for data in qp_imgs + ms_imgs:
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": data}})
    content.append({"type": "text", "text": (
        f"Image 1 is question {q['number']} ({q.get('marks')} mark(s)). The remaining "
        f"image(s) are its official mark scheme. Produce the worked solution as JSON."
    )})
    msg = client.messages.create(model=MODEL, max_tokens=900, system=SYSTEM,
                                 messages=[{"role": "user", "content": content}])
    out = "".join(b.text for b in msg.content if b.type == "text")
    return parse_json(out)


def main():
    force = "--force" in sys.argv
    calc_only = "--calc" in sys.argv
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key or "your-key" in key:
        sys.exit("No ANTHROPIC_API_KEY in .env")
    client = Anthropic(api_key=key)
    index = json.loads(INDEX_PATH.read_text())

    done = failed = skipped = 0
    for qp_name, data in index.items():
        for q in data.get("questions", []):
            if q.get("explanation") and not force:
                skipped += 1
                continue
            if calc_only and not is_calc(q):
                continue
            qp_img = b64(RENDERED_DIR / f"{slug(qp_name)}_p{q['page']}_q{q['number']}.png")
            if not qp_img:
                continue
            ms_name = q.get("msPaper", "")
            ms_imgs = []
            for p in q.get("msPages", []):
                d = b64(RENDERED_DIR / f"{slug(ms_name)}_p{p}_q{q['number']}.png")
                if d:
                    ms_imgs.append(d)
            try:
                res = explain(client, [qp_img], ms_imgs, q)
                q["explanation"] = res.get("explanation", "")
                q["steps"] = res.get("steps", [])
                done += 1
                INDEX_PATH.write_text(json.dumps(index, indent=2))  # incremental save
                print(f"  ok  {slug(qp_name)} Q{q['number']}", flush=True)
            except Exception as e:  # noqa: BLE001
                failed += 1
                print(f"  !!  {slug(qp_name)} Q{q['number']}: {e}", flush=True)

    print(f"\nDone. explained {done}, skipped {skipped}, failed {failed}.")


if __name__ == "__main__":
    main()
