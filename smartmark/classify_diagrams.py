"""
Classify each question sub-part as 'diagram' or 'written' using Claude Vision.

Diagram questions (draw, label, sketch, complete a structure) can't be answered
in a text/math input, so the app filters them out. This script sends each sub-part's
cropped question image to Claude Haiku and writes the classification back to
index.json and paperIndex.json.

Run:  python classify_diagrams.py            (only unclassified questions)
      python classify_diagrams.py --force    (reclassify all)
"""

import base64
import json
import sys
from pathlib import Path

from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv(override=True)

RENDERED_DIR = Path(__file__).parent / "rendered"
INDEX_PATH = Path(__file__).parent / "index.json"
OUT_PATH = Path(__file__).parent.parent / "src" / "data" / "paperIndex.json"
MODEL = "claude-haiku-4-5"

force = "--force" in sys.argv


def slug(pdf_name: str) -> str:
    return pdf_name.split(" - ")[0].replace(" ", "_")


def b64(path: Path):
    if not path.exists():
        return None
    return base64.standard_b64encode(path.read_bytes()).decode()


def classify(client, img_data):
    """Send a cropped question image to Claude and get 'diagram' or 'written'."""
    msg = client.messages.create(
        model=MODEL,
        max_tokens=10,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img_data}},
                {"type": "text", "text": (
                    "Look at this exam question image. Does the student need to DRAW, LABEL, "
                    "SKETCH, complete a DIAGRAM, draw curly arrows, draw a mechanism, draw a "
                    "dot-and-cross diagram, draw electron configurations, or draw/complete any "
                    "visual structure to answer it?\n\n"
                    "Or is it a WRITTEN text answer (describe, explain, state, suggest, "
                    "outline, evaluate, name, identify, deduce, compare, etc.)?\n\n"
                    "Note: if the question asks to NAME, IDENTIFY, STATE, or PREDICT something "
                    "shown in a diagram, that is WRITTEN (the student reads the diagram and "
                    "types text). Only classify as 'diagram' if the student must PRODUCE a "
                    "drawing themselves.\n\n"
                    "Reply with ONLY the word 'diagram' or 'written'."
                )}
            ]
        }]
    )
    answer = msg.content[0].text.strip().lower()
    # Normalise — sometimes the model adds punctuation
    if "diagram" in answer:
        return "diagram"
    return "written"


def classify_whole(client, page_imgs, q):
    """Classify a whole question's sub-parts by sending the full page image(s).
    Returns 'all_diagram', a list of diagram sub-part labels, or 'written'."""
    content = []
    for img_data in page_imgs:
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img_data}})

    slots = q.get("slots", [])
    slot_labels = [s.get("label", "") for s in slots if s.get("label")]
    # If no slot labels, try to infer from subPartMarks or just ask about (a), (b), etc.
    if not slot_labels:
        spm = q.get("subPartMarks", {})
        if spm:
            slot_labels = [f"({k})" for k in sorted(spm.keys())]

    parts_str = ", ".join(slot_labels) if slot_labels else "(a), (b), (c) etc."

    content.append({"type": "text", "text": (
        f"This image shows question {q['number']} from a chemistry exam paper. "
        f"The question has these sub-parts: {parts_str}\n\n"
        "For EACH sub-part, classify whether the student needs to DRAW/LABEL/SKETCH "
        "a diagram or structure, OR give a WRITTEN text answer.\n\n"
        "A sub-part is 'diagram' ONLY if the student must PRODUCE a drawing (dot-and-cross, "
        "mechanism arrows, electron config boxes, structural formula, etc.). "
        "If they just need to read a given diagram and type text, that's 'written'.\n\n"
        "Reply with ONLY a JSON object like: {\"a\": \"written\", \"b\": \"diagram\", \"c\": \"written\"}\n"
        "Use lowercase part letters as keys. No other text."
    )})

    msg = client.messages.create(
        model=MODEL,
        max_tokens=100,
        messages=[{"role": "user", "content": content}]
    )

    text = msg.content[0].text.strip()
    # Parse the JSON response
    try:
        # Handle markdown fences
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        a, b = text.find("{"), text.rfind("}")
        if a != -1 and b != -1:
            text = text[a:b + 1]
        parts = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        print(f"    WARN: Could not parse response: {text[:100]}")
        return "written"

    diagram_parts = [k for k, v in parts.items() if "diagram" in str(v).lower()]
    written_parts = [k for k, v in parts.items() if "written" in str(v).lower()]

    if diagram_parts and not written_parts:
        return "all_diagram"
    elif diagram_parts:
        return diagram_parts
    return "written"


def main():
    client = Anthropic()

    with open(INDEX_PATH) as f:
        index = json.load(f)

    total = 0
    classified = 0
    diagram_count = 0

    for paper, data in index.items():
        ps = slug(paper)
        for q in data.get("questions", []):
            if q.get("marks", 0) <= 1:
                continue  # MCQ
            if q.get("isCalculation"):
                continue  # already filtered

            sub_imgs = q.get("subPartImgs", {})

            if sub_imgs and len(sub_imgs) >= 2:
                # Per-sub-part classification
                already_done = q.get("diagramSubParts") is not None and not force
                if already_done:
                    continue

                diagram_parts = []
                calc_parts = set(q.get("calcSubParts", []))

                for lbl, fnames in sub_imgs.items():
                    if lbl in calc_parts:
                        continue  # skip calc parts, already handled

                    # Load the first cropped image for this sub-part
                    img_path = RENDERED_DIR / fnames[0]
                    img_data = b64(img_path)
                    if not img_data:
                        print(f"  SKIP {ps} Q{q['number']}({lbl}) — image not found: {fnames[0]}")
                        continue

                    total += 1
                    result = classify(client, img_data)
                    classified += 1

                    label = f"{ps} Q{q['number']}({lbl})"
                    if result == "diagram":
                        diagram_parts.append(lbl)
                        diagram_count += 1
                        print(f"  DIAGRAM  {label}")
                    else:
                        print(f"  written  {label}")

                if diagram_parts:
                    non_calc_parts = [lbl for lbl in sub_imgs if lbl not in calc_parts]
                    if set(diagram_parts) == set(non_calc_parts):
                        # All non-calc sub-parts are diagrams → whole question is diagram
                        q["isDiagram"] = True
                        print(f"  → Q{q['number']} marked as isDiagram (all parts are diagrams)")
                    else:
                        q["diagramSubParts"] = sorted(diagram_parts)
                        print(f"  → Q{q['number']} diagramSubParts = {diagram_parts}")
                else:
                    # Explicitly mark as no diagram parts (so --force can re-check)
                    if "diagramSubParts" in q:
                        del q["diagramSubParts"]

            else:
                # Whole question (no per-sub-part crops) — send the full page
                # and ask Claude to classify each sub-part individually.
                already_done = q.get("_diagramClassified") and not force
                if already_done:
                    continue

                qp_pages = q.get("qpPages", [q.get("page")])
                if not qp_pages or not qp_pages[0]:
                    continue

                # Load all QP page images for this question
                page_imgs = []
                for p in qp_pages:
                    img_path = RENDERED_DIR / f"{ps}_p{p}.png"
                    d = b64(img_path)
                    if d:
                        page_imgs.append(d)
                if not page_imgs:
                    continue

                total += 1
                result = classify_whole(client, page_imgs, q)
                classified += 1

                label = f"{ps} Q{q['number']}"
                q["_diagramClassified"] = True

                if result == "all_diagram":
                    q["isDiagram"] = True
                    diagram_count += 1
                    print(f"  DIAGRAM  {label} (whole question)")
                elif isinstance(result, list) and len(result) > 0:
                    q["diagramSubParts"] = sorted(result)
                    diagram_count += len(result)
                    print(f"  MIXED    {label} diagramSubParts={result}")
                else:
                    # Clean up any previous isDiagram
                    q.pop("isDiagram", None)
                    print(f"  written  {label}")

    # Save back
    with open(INDEX_PATH, "w") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
    with open(OUT_PATH, "w") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)

    print(f"\nDone: {classified}/{total} classified, {diagram_count} diagram parts found.")


if __name__ == "__main__":
    main()
