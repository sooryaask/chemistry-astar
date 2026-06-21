import { MODEL, FAST_MODEL } from '../config.js'

const API_URL = 'https://api.anthropic.com/v1/messages'

// The carefully engineered examiner system prompt. Sent with every quiz call.
export const SYSTEM_PROMPT = `You are an expert OCR A Chemistry examiner and tutor. The student is Sooryaa, who has just finished GCSEs (AQA Combined Science) and is self-studying OCR A Chemistry AS-level from scratch in 21 days with the goal of achieving an A*.

Your job is to generate exactly 3 exam-style questions for the spec point provided, then mark the student's answers with strict OCR-style criteria.

QUESTION GENERATION RULES:
- Question 1: 1-mark recall question (state, identify, or name)
- Question 2: 2-mark question (describe, calculate, or give two points)
- Question 3: 3-mark explain or describe question
- Do NOT generate any question worth more than 3 marks. No 4, 5, or 6-mark extended-answer questions.
- Use OCR command words exactly: state, explain, describe, deduce, suggest, calculate, show that, outline
- Vary the surface context — use different molecules, elements, or scenarios than the most obvious examples. Never use the same molecule twice across the 3 questions.
- For calculation questions, always include units in the question and expect units in the answer
- Questions must be answerable from the specific spec point provided, not require knowledge from other spec points

MARKING RULES (strict — this is A* preparation):
- Mark against OCR-style mark scheme criteria
- Penalise imprecise language: 'electrons move' is wrong if 'delocalised electrons move' is required
- On ALL calculations: deduct 1 mark if units are missing or wrong, flag incorrect significant figures
- On multi-mark questions: count distinct marking points — full marks requires as many distinct correct statements as there are marks, not repetition of the same idea
- Flag when an answer uses GCSE-level phrasing that would not score at A-level (e.g. 'strong bonds' instead of 'high bond enthalpy')
- Give the exact OCR-style phrasing that would score full marks for each marking point missed

RESPONSE FORMAT for question generation — respond with valid JSON only:
{
  "questions": [
    { "id": 1, "marks": 1, "command": "State", "question": "...", "context": "..." },
    { "id": 2, "marks": 2, "command": "Describe", "question": "...", "context": "..." },
    { "id": 3, "marks": 3, "command": "Explain", "question": "...", "context": "..." }
  ]
}

RESPONSE FORMAT for marking — respond with valid JSON only:
{
  "results": [
    {
      "id": 1,
      "score": 1,
      "maxScore": 1,
      "passed": true,
      "feedback": "...",
      "modelAnswer": "...",
      "gcseFlag": false,
      "precisionFlag": false,
      "unitsFlag": false
    }
  ],
  "totalScore": 4,
  "totalMax": 6,
  "overallFeedback": "..."
}`

function getApiKey() {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!key || key === 'your_key_here') {
    throw new Error(
      'No Anthropic API key found. Create a .env file with VITE_ANTHROPIC_API_KEY and restart the dev server.'
    )
  }
  return key
}

// Core request. Returns the assistant's text content.
// Options default to the rigorous Sonnet model + full examiner system prompt so
// existing callers are unchanged; fast paths override model/system.
async function callClaude(userMessage, { maxTokens = 2048, model = MODEL, system = SYSTEM_PROMPT } = {}) {
  const key = getApiKey()
  let res
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        // Required for calling the API directly from a browser.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
  } catch (err) {
    throw new Error(
      `Network error calling Anthropic. If this is the deployed site, browser CORS or the missing key is the likely cause. (${err.message})`
    )
  }

  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body?.error?.message || JSON.stringify(body)
    } catch {
      detail = await res.text().catch(() => '')
    }
    throw new Error(`Anthropic API error ${res.status}: ${detail}`)
  }

  const data = await res.json()
  const text = data?.content?.map((b) => b.text).join('') ?? ''
  return text
}

// Pull a JSON object out of a model response that may include stray prose/fences.
function parseJson(text) {
  let cleaned = text.trim()
  // Strip markdown code fences if present.
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  // Fall back to the first {...} block.
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end !== -1) {
    cleaned = cleaned.slice(start, end + 1)
  }
  try {
    return JSON.parse(cleaned)
  } catch (err) {
    throw new Error(`Could not parse AI response as JSON. Raw: ${text.slice(0, 200)}…`)
  }
}

// Generate 3 questions for a spec point. `variation` nudges different contexts.
export async function generateQuestions(specPoint, variation = 0) {
  const prompt = `Generate 3 questions for this OCR A Chemistry spec point.

Spec reference: ${specPoint.id}
Title: ${specPoint.title}
Description: ${specPoint.description}
${variation > 0 ? `\nThis is regeneration attempt #${variation + 1}. Use entirely different molecules, elements, numbers and scenarios than typical first-choice examples.` : ''}

Respond with valid JSON only, using the question generation format.`

  const text = await callClaude(prompt, { maxTokens: 2048 })
  const json = parseJson(text)
  if (!Array.isArray(json.questions)) {
    throw new Error('AI response did not contain a questions array.')
  }
  return json.questions
}

// Lean system prompts for the rapid drill — short, so the fast model spends its
// time on the answer, not on re-reading a long examiner brief.
const DRILL_GEN_SYSTEM =
  'You are an OCR A Chemistry examiner. Write concise, accurate exam-style questions for an AS-level student. Always respond with valid JSON only.'

const DRILL_MARK_SYSTEM =
  'You are a strict OCR A Chemistry examiner marking ONE short answer for an A*-aiming AS student. Mark against OCR-style criteria. Penalise imprecise or GCSE-level phrasing (e.g. "strong bonds" instead of "high bond enthalpy"). On calculations, require correct units and significant figures. Be concise. Always respond with valid JSON only.'

// Generate ONE short recall/short-answer question (for the rapid flashcard drill).
export async function generateFlashcard(specPoint) {
  const prompt = `Generate ONE short exam-style question for this OCR A Chemistry spec point — a quick recall or short-answer question worth 1 or 2 marks only. Vary the molecule/element/context each time.

Spec reference: ${specPoint.id}
Title: ${specPoint.title}
Description: ${specPoint.description}

Respond with valid JSON only (a single object, no array):
{ "id": 1, "marks": 1, "command": "State", "question": "...", "context": "" }`

  const text = await callClaude(prompt, {
    maxTokens: 400,
    model: FAST_MODEL,
    system: DRILL_GEN_SYSTEM,
  })
  const q = parseJson(text)
  // Tolerate the model wrapping it as { questions: [...] }.
  if (Array.isArray(q.questions)) return q.questions[0]
  return q
}

// Fast, lean marking of ONE drill answer. Uses the quick model + a tiny output
// so results come back in ~1-2s. Returns the exact fields the Drill UI reads.
export async function markFlashcard(specPoint, question, answer) {
  const prompt = `Mark this single answer for OCR A Chemistry spec point ${specPoint.id} (${specPoint.title}).

Question (${question.marks} mark${question.marks > 1 ? 's' : ''}, ${question.command}): ${question.context ? question.context + ' ' : ''}${question.question}

Student's answer: ${answer?.trim() ? answer : '[no answer given]'}

Give the model answer with the exact phrasing that scores full marks. Respond with valid JSON only:
{ "score": 0, "maxScore": ${question.marks}, "passed": false, "feedback": "one or two sentences", "modelAnswer": "...", "gcseFlag": false, "precisionFlag": false, "unitsFlag": false }`

  const text = await callClaude(prompt, {
    maxTokens: 400,
    model: FAST_MODEL,
    system: DRILL_MARK_SYSTEM,
  })
  return parseJson(text)
}

// Teach a spec point from scratch — a concise, exam-focused lesson that bridges
// GCSE Combined Science up to A-level and is pitched at scoring full marks.
export async function generateLesson(specPoint) {
  const prompt = `Teach this OCR A Chemistry spec point to Sooryaa, who has only GCSE Combined Science and is aiming for full marks. Write like a Save My Exams revision note: concise, organised by what actually earns marks, in mark-scheme language, bridging GCSE to the extra A-level depth. This is for fast learning in a 3-week sprint, not a textbook chapter.

Spec reference: ${specPoint.id}
Title: ${specPoint.title}
Description: ${specPoint.description}

Respond with valid JSON only:
{
  "keyIdeas": ["the 4-7 core points to understand, each one sentence"],
  "mustKnow": [{ "term": "...", "definition": "exact A-level definition" }],
  "markSchemePhrases": ["precise phrases OCR rewards, e.g. 'delocalised electrons'"],
  "commandWords": "how this topic is typically examined and what each command word (state/explain/describe/calculate/deduce) demands here",
  "examinerTips": ["3-5 specific exam-technique tips an examiner would give for this topic"],
  "workedExample": "one worked example or model answer showing the method/structure expected",
  "commonTraps": ["mistakes that lose marks, especially GCSE-level phrasing to avoid"]
}`

  const text = await callClaude(prompt, { maxTokens: 2048 })
  return parseJson(text)
}

// ---- Past-paper practice (vision) ----

const PAPER_MARKING_PROMPT = `You are an expert OCR A Chemistry examiner marking the work of Sooryaa, an A-level student aiming for an A*.

You are shown TWO images:
1. A page from a REAL OCR past paper containing the question.
2. The corresponding page from the OFFICIAL OCR mark scheme.

The student has typed their answer to ONE specific question. Find that question on the paper image, read the mark scheme for it, then mark the student's answer strictly against the official mark scheme.

MARKING RULES (strict — A* preparation):
- Mark point-by-point against the OFFICIAL mark scheme shown in image 2.
- Award marks only for points that match the mark scheme criteria.
- Penalise imprecise language (e.g. 'electrons move' where 'delocalised electrons move' is required).
- On calculations: deduct a mark for missing/wrong units or wrong significant figures.
- Flag GCSE-level phrasing that would not score at A-level.
- If the question has multiple parts, only mark the specific part the student answered.

If you cannot find the question on the page, set "found": false.

Respond with VALID JSON ONLY:
{
  "found": true,
  "questionMarks": 3,
  "score": 2,
  "whatWentWell": "Specific praise for what scored.",
  "howToImprove": "Specific, actionable next steps to gain the missed marks.",
  "markSchemeAnswer": "The exact mark-scheme phrasing that would score full marks, point by point."
}`

const MCQ_MARKING_PROMPT = `You are an expert OCR A Chemistry examiner helping Sooryaa, an A-level student aiming for an A*.

You are shown TWO images:
1. A page from a REAL OCR past paper containing a MULTIPLE CHOICE question.
2. The corresponding page from the OFFICIAL OCR mark scheme.

The student has selected one of A, B, C, or D. Check against the mark scheme whether they chose correctly.

IMPORTANT: Whether the student is RIGHT or WRONG, you MUST provide a thorough, structured explanation. A correct answer could easily be a guess — the student needs to genuinely understand the concept.

Your explanation must be broken into FOUR distinct sections:

1. "simpleExplanation" — Explain the answer in plain, accessible language as if the student has never seen this type of question before. Use a real-world analogy or simple comparison if helpful.

2. "stepByStep" — Walk through the exact working/reasoning as numbered steps (e.g. "Step 1: Find moles of Cl2 = 0.0100 mol. Step 2: ..."). For calculations, show every line of working. For conceptual questions, break the logic into clear steps.

3. "whyOtherOptionsWrong" — For EACH wrong option (A, B, C, D minus the correct one), write one sentence explaining exactly why it is wrong and what mistake or misconception would lead someone to pick it.

4. "examTip" — A short, punchy tip the student can remember for similar questions in future exams. Start with a verb (e.g. "Always check...", "Remember that...", "Look for...").

Respond with VALID JSON ONLY:
{
  "found": true,
  "questionMarks": 1,
  "score": 0,
  "correctOption": "B",
  "simpleExplanation": "Plain-language explanation of why the correct answer is correct.",
  "stepByStep": "Step 1: ... Step 2: ... Step 3: ...",
  "whyOtherOptionsWrong": "A: reason. C: reason. D: reason.",
  "examTip": "A memorable tip for this type of question."
}`

// Fetch a PNG from public/ and return its base64 data.
async function fetchImageBase64(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load image: ${url}`)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      // Strip the data:image/png;base64, prefix
      const b64 = reader.result.split(',')[1]
      resolve(b64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Assess a past-paper answer using vision (QP page + MS page + typed answer).
export async function assessPaperQuestion({ qpImageUrl, msImageUrls, questionNo, answer, isMcq = false }) {
  const key = getApiKey()

  // Fetch all images in parallel
  const [qpB64, ...msB64s] = await Promise.all([
    fetchImageBase64(qpImageUrl),
    ...msImageUrls.map((url) => fetchImageBase64(url)),
  ])

  // Build content blocks: QP image, then MS image(s), then text
  const content = [
    {
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: qpB64 },
    },
    ...msB64s.map((data) => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data },
    })),
    {
      type: 'text',
      text:
        `Image 1 is the question paper page. Image${msB64s.length > 1 ? 's' : ''} ${msB64s.map((_, i) => i + 2).join(' and ')} ${msB64s.length > 1 ? 'are' : 'is'} the official mark scheme.\n\n` +
        `Mark my answer to question ${questionNo} on this page.\n\n` +
        `My answer:\n${answer.trim() || '[no answer given]'}\n\n` +
        `Respond with valid JSON only.`,
    },
  ]

  let res
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: isMcq ? MCQ_MARKING_PROMPT : PAPER_MARKING_PROMPT,
        messages: [{ role: 'user', content }],
      }),
    })
  } catch (err) {
    throw new Error(`Network error calling Anthropic: ${err.message}`)
  }

  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body?.error?.message || JSON.stringify(body)
    } catch {
      detail = await res.text().catch(() => '')
    }
    throw new Error(`Anthropic API error ${res.status}: ${detail}`)
  }

  const data = await res.json()
  const text = data?.content?.map((b) => b.text).join('') ?? ''
  return parseJson(text)
}

// Mark a set of answers against their questions.
export async function markAnswers(specPoint, questions, answers) {
  const qa = questions
    .map((q, i) => {
      return `Question ${q.id} (${q.marks} mark${q.marks > 1 ? 's' : ''}, command word: ${q.command}):
${q.context ? q.context + '\n' : ''}${q.question}

Student's answer:
${answers[i]?.trim() ? answers[i] : '[no answer given]'}`
    })
    .join('\n\n---\n\n')

  const prompt = `Mark the student's answers below for spec point ${specPoint.id} (${specPoint.title}). Apply strict OCR A* marking. For each question give a model answer with the exact phrasing that scores full marks.

${qa}

Respond with valid JSON only, using the marking response format. There must be one result object per question, in order.`

  const text = await callClaude(prompt, { maxTokens: 3072 })
  const json = parseJson(text)
  if (!Array.isArray(json.results)) {
    throw new Error('AI response did not contain a results array.')
  }
  return json
}
