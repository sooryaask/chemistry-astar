#!/usr/bin/env node
/**
 * Agent Jerry — Claude Agent SDK QA Tester for chemistry-astar.
 *
 * An autonomous agent that reads source code, takes browser screenshots,
 * finds issues, and optionally fixes them. Built on the Claude Agent SDK
 * with Playwright for visual testing.
 *
 * Usage:
 *   node tests/qa-agent.js                          # Changed files only
 *   node tests/qa-agent.js --full                   # Review all source files
 *   node tests/qa-agent.js --focus "toolbar mobile"  # Focus on specific area
 *   node tests/qa-agent.js --fix                    # Enable auto-fix mode
 *   node tests/qa-agent.js --fix --focus "toolbar"  # Focused + fix mode
 *   node tests/qa-agent.js --browser webkit         # Test with Safari/WebKit engine
 *
 * Exit codes:
 *   0 = no critical findings
 *   1 = critical findings or errors
 */

import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { spawn, execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import path from 'path'
import crypto from 'crypto'

// ──────────────────────────────────────────────────
//  CONSTANTS & CLI PARSING
// ──────────────────────────────────────────────────

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..')
const DIVIDER = '═'.repeat(60)
const THIN = '─'.repeat(60)
const HISTORY_PATH = path.join(ROOT, 'tests', '.qa-history.json')
const VITE_PORT = 5199
const VITE_BASE = '/chemistry-astar/'
const VITE_URL = `http://localhost:${VITE_PORT}${VITE_BASE}`

const isFull = process.argv.includes('--full')
const fixMode = process.argv.includes('--fix')

// Parse --browser flag: chromium (default) or webkit (Safari engine)
let browserEngine = 'chromium'
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--browser' && process.argv[i + 1]) {
    browserEngine = process.argv[++i]
  }
}

const focusAreas = []
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--focus' && process.argv[i + 1]) {
    focusAreas.push(process.argv[++i])
  }
}
const hasFocus = focusAreas.length > 0

// Device profiles for realistic emulation (Playwright device descriptors)
const DEVICES = {
  'iphone-14': { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  'iphone-se': { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  'iphone-14-pro-max': { width: 430, height: 932, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  'pixel-7': { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' },
  'ipad': { width: 810, height: 1080, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  'laptop': { width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false, hasTouch: false, userAgent: '' },
}

const SOURCE_FILES = [
  'src/pages/Review.jsx',
  'src/pages/Decks.jsx',
  'src/components/ChemInput.jsx',
  'src/components/ChemInput.css',
  'src/index.css',
  'src/App.jsx',
  'src/utils/srs.js',
  'src/utils/localStorage.js',
  'src/data/cards.js',
  'src/api/anthropic.js',
  'src/config.js',
]

// ──────────────────────────────────────────────────
//  UTILITIES
// ──────────────────────────────────────────────────

function run(cmd, opts = {}) {
  try {
    return {
      ok: true,
      output: execSync(cmd, { cwd: ROOT, encoding: 'utf8', timeout: 120000, ...opts }).trim(),
    }
  } catch (err) {
    return {
      ok: false,
      output: (err.stdout || '') + '\n' + (err.stderr || ''),
    }
  }
}

function header(title) {
  console.log(`\n${DIVIDER}`)
  console.log(`  ${title}`)
  console.log(DIVIDER)
}

function section(title) {
  console.log(`\n${THIN}`)
  console.log(`  ${title}`)
  console.log(THIN)
}

function getApiKey() {
  const envPath = path.join(ROOT, '.env')
  if (!existsSync(envPath)) {
    console.error('  ERROR: .env file not found. Cannot call Claude API.')
    process.exit(1)
  }
  const envContent = readFileSync(envPath, 'utf8')
  const match = envContent.match(/VITE_ANTHROPIC_API_KEY=(.+)/)
  if (!match) {
    console.error('  ERROR: VITE_ANTHROPIC_API_KEY not found in .env')
    process.exit(1)
  }
  return match[1].trim()
}

function loadHistory() {
  if (!existsSync(HISTORY_PATH)) return []
  try {
    const data = JSON.parse(readFileSync(HISTORY_PATH, 'utf8'))
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    return data.filter((f) => f.timestamp > cutoff)
  } catch {
    return []
  }
}

function saveHistory(hist) {
  writeFileSync(HISTORY_PATH, JSON.stringify(hist, null, 2))
}

function fileHash(filePath) {
  const abs = path.join(ROOT, filePath)
  if (!existsSync(abs)) return null
  return crypto.createHash('md5').update(readFileSync(abs)).digest('hex')
}

// ──────────────────────────────────────────────────
//  VITE DEV SERVER LIFECYCLE
// ──────────────────────────────────────────────────

let viteProcess = null

async function startVite() {
  console.log(`  Starting Vite dev server on port ${VITE_PORT}...`)
  viteProcess = spawn('npx', ['vite', '--port', String(VITE_PORT)], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: false,
  })
  viteProcess.on('error', (err) => {
    console.error(`  Vite failed to start: ${err.message}`)
  })

  // Poll until the server responds
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(VITE_URL)
      if (res.ok) {
        console.log(`  Vite ready at ${VITE_URL}`)
        return
      }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('Vite dev server did not start within 20s')
}

function stopVite() {
  if (viteProcess && !viteProcess.killed) {
    viteProcess.kill()
    viteProcess = null
  }
}

// ──────────────────────────────────────────────────
//  PLAYWRIGHT BROWSER LIFECYCLE
// ──────────────────────────────────────────────────

let browser = null

async function startBrowser() {
  const pw = await import('playwright')
  const engine = browserEngine === 'webkit' ? pw.webkit : pw.chromium
  const label = browserEngine === 'webkit' ? 'WebKit (Safari)' : 'Chromium'
  console.log(`  Launching Playwright ${label}...`)
  browser = await engine.launch({ headless: true })
  console.log(`  ${label} browser ready`)
}

async function stopBrowser() {
  if (browser) {
    await browser.close()
    browser = null
  }
}

// ──────────────────────────────────────────────────
//  TOOL DEFINITIONS
// ──────────────────────────────────────────────────

const readFileTool = tool(
  'read_file',
  'Read the contents of a source file. Use relative paths from the project root (e.g. src/pages/Review.jsx).',
  { path: z.string().describe('Relative path from project root') },
  async (args) => {
    const abs = path.join(ROOT, args.path)
    if (!existsSync(abs)) {
      return { content: [{ type: 'text', text: `ERROR: File not found: ${args.path}` }], isError: true }
    }
    const content = readFileSync(abs, 'utf8')
    return { content: [{ type: 'text', text: content }] }
  },
  { annotations: { readOnlyHint: true } }
)

const globFilesTool = tool(
  'glob_files',
  'List files matching a pattern under src/. Returns newline-separated relative paths.',
  { pattern: z.string().describe('File name pattern to match, e.g. *.jsx, *.css, srs*') },
  async (args) => {
    const results = []
    function walk(dir) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git') continue
          walk(full)
        } else {
          const rel = path.relative(ROOT, full)
          // Simple pattern matching: convert glob to regex
          const regex = new RegExp(
            '^' + args.pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
          )
          if (regex.test(entry.name)) results.push(rel)
        }
      }
    }
    walk(path.join(ROOT, 'src'))
    return { content: [{ type: 'text', text: results.length ? results.join('\n') : 'No files matched.' }] }
  },
  { annotations: { readOnlyHint: true } }
)

const grepCodeTool = tool(
  'grep_code',
  'Search source code for a text pattern. Returns matching lines with file:line prefix.',
  {
    pattern: z.string().describe('Text or regex pattern to search for'),
    glob: z.string().default('*').describe('File name filter, e.g. *.jsx or *.css'),
  },
  async (args) => {
    const grepCmd = `grep -rn --include="${args.glob}" "${args.pattern}" src/ 2>/dev/null || true`
    const result = run(grepCmd)
    const output = result.output.trim()
    return { content: [{ type: 'text', text: output || 'No matches found.' }] }
  },
  { annotations: { readOnlyHint: true } }
)

const screenshotTool = tool(
  'screenshot',
  `Take a screenshot of the running app. Returns a PNG image. Use device names for realistic emulation or a custom viewport width.

Available devices: ${Object.keys(DEVICES).join(', ')}

Examples:
- screenshot(device="iphone-14") — iPhone 14 with touch, correct user agent
- screenshot(device="laptop") — 1440px desktop
- screenshot(viewport_width=375) — custom width without device emulation`,
  {
    url_path: z.string().default(VITE_BASE).describe('URL path, e.g. /chemistry-astar/ or /chemistry-astar/#/review/some-deck'),
    device: z.string().default('').describe(`Device name: ${Object.keys(DEVICES).join(', ')} — or leave empty for custom viewport_width`),
    viewport_width: z.number().int().default(375).describe('Viewport width in pixels (only used if device is empty)'),
  },
  async (args) => {
    if (!browser) {
      return { content: [{ type: 'text', text: 'ERROR: Browser not available' }], isError: true }
    }

    const dev = args.device && DEVICES[args.device]
    const contextOpts = dev
      ? {
          viewport: { width: dev.width, height: dev.height },
          deviceScaleFactor: dev.deviceScaleFactor,
          isMobile: dev.isMobile,
          hasTouch: dev.hasTouch,
          ...(dev.userAgent ? { userAgent: dev.userAgent } : {}),
        }
      : { viewport: { width: args.viewport_width, height: 900 } }

    const context = await browser.newContext(contextOpts)
    const page = await context.newPage()
    try {
      await page.goto(`http://localhost:${VITE_PORT}${args.url_path}`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      })
      await page.waitForTimeout(500)
      const buffer = await page.screenshot({ fullPage: true })
      const label = dev ? `${args.device} (${dev.width}x${dev.height})` : `${args.viewport_width}px`
      return {
        content: [
          { type: 'text', text: `Screenshot: ${label} on ${browserEngine}` },
          { type: 'image', data: buffer.toString('base64'), mimeType: 'image/png' },
        ],
      }
    } catch (err) {
      return { content: [{ type: 'text', text: `Screenshot failed: ${err.message}` }], isError: true }
    } finally {
      await page.close()
      await context.close()
    }
  }
)

const editFileTool = tool(
  'edit_file',
  'Replace an exact string in a source file. Read the file first to see current content. Only available in --fix mode.',
  {
    path: z.string().describe('Relative path from project root'),
    old_string: z.string().describe('Exact string to find (must match exactly, including whitespace)'),
    new_string: z.string().describe('Replacement string'),
  },
  async (args) => {
    const abs = path.join(ROOT, args.path)
    if (!existsSync(abs)) {
      return { content: [{ type: 'text', text: `ERROR: File not found: ${args.path}` }], isError: true }
    }
    let content = readFileSync(abs, 'utf8')
    if (!content.includes(args.old_string)) {
      return { content: [{ type: 'text', text: 'ERROR: old_string not found in file. Read the file first to get the exact content.' }], isError: true }
    }
    const count = content.split(args.old_string).length - 1
    if (count > 1) {
      return { content: [{ type: 'text', text: `ERROR: old_string matches ${count} times. Provide more context to make it unique.` }], isError: true }
    }
    content = content.replace(args.old_string, args.new_string)
    writeFileSync(abs, content)
    return { content: [{ type: 'text', text: `OK: Replaced in ${args.path}` }] }
  }
)

const runTestsTool = tool(
  'run_tests',
  'Run the Vitest test suite (npm test) and return the output. Use this after making edits to verify nothing broke.',
  {},
  async () => {
    const result = run('npx vitest run --reporter=verbose 2>&1')
    return {
      content: [{ type: 'text', text: result.output }],
      isError: !result.ok,
    }
  },
  { annotations: { readOnlyHint: true } }
)

// ──────────────────────────────────────────────────
//  MCP SERVER
// ──────────────────────────────────────────────────

function buildMcpServer() {
  const tools = [readFileTool, globFilesTool, grepCodeTool, screenshotTool, runTestsTool]
  if (fixMode) tools.push(editFileTool)

  return createSdkMcpServer({
    name: 'jerry',
    version: '1.0.0',
    instructions: 'Agent Jerry QA tools for reading code, taking screenshots, and testing.',
    tools,
  })
}

// ──────────────────────────────────────────────────
//  SYSTEM PROMPT
// ──────────────────────────────────────────────────

function buildSystemPrompt(previousTitles) {
  let prompt = `You are Agent Jerry, a meticulous QA tester for a chemistry study app. You are Sooryaa, a 16-year-old student testing this app on mobile (375px) and laptop (1440px). Your job is to find real problems by walking through the app as a user.

YOU HAVE TOOLS — USE THEM ACTIVELY:
- read_file: Read source files to understand the code. Don't guess — read.
- glob_files: Find files by pattern.
- grep_code: Search code for patterns.
- screenshot: Take screenshots using real device profiles. ALWAYS take at least one mobile screenshot (device="iphone-14") and one desktop (device="laptop"). Available devices: ${Object.keys(DEVICES).join(', ')}.
- run_tests: Run the test suite to verify nothing is broken.
${fixMode ? '- edit_file: Fix issues you find. After editing, ALWAYS run_tests to verify the fix.' : ''}

WALK THROUGH THESE FLOWS:

DECKS SCREEN:
- Information hierarchy, mastery percentage display, card counts clarity
- Empty states (no cards due, all mastered)
- Navigation to review

REVIEW SCREEN:
- Question image display and readability
- Answer input flow (typing, submitting)
- "Mark my answer" vs "Just show the answer" flow
- AI feedback panel (score, marking points)
- Mark scheme tick boxes
- Loading and error states during API calls
- Grade buttons (Again/Hard/Good/Easy)
- "All caught up" / empty state

CHEMINPUT TOOLBAR:
- Discoverability of chemistry symbols and formatting
- Mobile usability of toolbar buttons
- Mode indicators and switching

BOTTOM BAR:
- Skip vs grade button clarity
- Menu actions (suspend card, reset card)
- Progress counter chips

CROSS-CUTTING:
- Mobile responsiveness (375px viewport)
- Accessibility (ARIA labels, focus management, colour contrast)
- Error handling (localStorage full, images fail, API errors)
- Edge cases (very long answers, rapid clicks, empty answers)
- Visual consistency (spacing, font sizes, colours)`

  if (previousTitles.size > 0) {
    prompt += `\n\nSKIP these previously reported findings (already known):\n${[...previousTitles].map((t) => `- ${t}`).join('\n')}`
  }

  if (hasFocus) {
    prompt += `\n\nFOCUS YOUR REVIEW ON THESE SPECIFIC AREAS (ignore everything else):\n${focusAreas.map((a) => `- ${a}`).join('\n')}\n\nOnly report findings related to these focus areas. Be thorough and detailed about them — test every edge case within these areas.`
  }

  prompt += `\n\nAFTER YOUR INVESTIGATION, output your final findings as a JSON block:
\`\`\`json
{
  "findings": [
    {
      "severity": "critical|warning|suggestion|positive",
      "category": "ux|accessibility|error-handling|mobile|visual|edge-case",
      "component": "path/to/file.jsx",
      "title": "Short unique title",
      "description": "What you tried, what happened, what confused you",
      "suggestion": "How to fix it",
      "effort": "small|medium|large"
    }
  ]
}
\`\`\`

Return 5-15 findings. Include at least 1-2 positives. Every finding must have a unique, descriptive title.`

  return prompt
}

// ──────────────────────────────────────────────────
//  REPORT DISPLAY
// ──────────────────────────────────────────────────

function displayReport(findings) {
  const grouped = {
    critical: findings.filter((f) => f.severity === 'critical'),
    warning: findings.filter((f) => f.severity === 'warning'),
    suggestion: findings.filter((f) => f.severity === 'suggestion'),
    positive: findings.filter((f) => f.severity === 'positive'),
  }

  if (grouped.critical.length) {
    console.log('\n  CRITICAL (must fix):')
    for (const f of grouped.critical) {
      console.log(`    [X] ${f.title} — ${f.component}`)
      console.log(`        ${f.description}`)
      console.log(`        Fix: ${f.suggestion} [${f.effort}]`)
    }
  }

  if (grouped.warning.length) {
    console.log('\n  WARNINGS (should fix):')
    for (const f of grouped.warning) {
      console.log(`    [!] ${f.title} — ${f.component}`)
      console.log(`        ${f.description}`)
      console.log(`        Fix: ${f.suggestion} [${f.effort}]`)
    }
  }

  if (grouped.suggestion.length) {
    console.log('\n  SUGGESTIONS (nice to have):')
    for (const f of grouped.suggestion) {
      console.log(`    [?] ${f.title} — ${f.component}`)
      console.log(`        ${f.description}`)
      console.log(`        Idea: ${f.suggestion} [${f.effort}]`)
    }
  }

  if (grouped.positive.length) {
    console.log('\n  POSITIVES (what\'s working well):')
    for (const f of grouped.positive) {
      console.log(`    [+] ${f.title} — ${f.component}`)
      console.log(`        ${f.description}`)
    }
  }

  if (findings.length === 0) {
    console.log('  No new findings. The app looks good from a QA perspective.')
  }

  return grouped
}

// ──────────────────────────────────────────────────
//  MAIN
// ──────────────────────────────────────────────────

async function main() {
  header('AGENT JERRY — chemistry-astar QA')
  console.log(`  Time: ${new Date().toLocaleString()}`)
  console.log(`  Mode: ${hasFocus ? 'FOCUSED' : isFull ? 'FULL' : 'CHANGED FILES'}${fixMode ? ' + FIX' : ''}`)
  console.log(`  Browser: ${browserEngine === 'webkit' ? 'WebKit (Safari)' : 'Chromium'}`)
  if (hasFocus) console.log(`  Focus: ${focusAreas.join(' · ')}`)

  // ── Phase 1: History ──
  section('Phase 1: History Check')
  let history = loadHistory()
  history = history.filter((f) => {
    if (!f.component) return true
    return fileHash(f.component) === f.fileHash
  })
  const previousTitles = new Set(history.map((f) => f.title))
  console.log(`  Previous findings (not expired): ${previousTitles.size}`)

  // ── Phase 2: Start infrastructure ──
  section('Phase 2: Infrastructure')
  try {
    await startVite()
    await startBrowser()
  } catch (err) {
    console.error(`  ERROR: ${err.message}`)
    stopVite()
    process.exit(1)
  }

  // Register cleanup
  const cleanup = async () => {
    await stopBrowser()
    stopVite()
  }
  process.on('SIGINT', async () => { await cleanup(); process.exit(0) })
  process.on('SIGTERM', async () => { await cleanup(); process.exit(0) })

  // ── Phase 3: Build prompt ──
  section('Phase 3: Agent Run')

  // Determine which files to mention in the prompt
  let filesToMention = SOURCE_FILES
  if (!hasFocus && !isFull) {
    const detectResult = run('node tests/detect-changes.js')
    if (detectResult.ok) {
      try {
        const analysis = JSON.parse(detectResult.output)
        if (analysis.files && analysis.files.length > 0) {
          const changedPaths = analysis.files.map((f) => f.path || f)
          const matched = SOURCE_FILES.filter((sf) =>
            changedPaths.some((cp) => cp.includes(sf) || sf.includes(cp))
          )
          if (matched.length > 0) filesToMention = matched
        }
      } catch {
        // Fall through to full
      }
    }
  }

  const userPrompt = `Review the chemistry-astar React app for QA issues.

The app is running at ${VITE_URL} — use the screenshot tool to visually inspect it.

Source files to focus on:
${filesToMention.map((f) => `- ${f}`).join('\n')}

Start by reading the key source files, then take screenshots using device profiles (e.g. device="iphone-14" for mobile, device="laptop" for desktop). Report your findings as structured JSON at the end.`

  const systemPrompt = buildSystemPrompt(previousTitles)
  const qaServer = buildMcpServer()

  const allowedTools = [
    'mcp__jerry__read_file',
    'mcp__jerry__glob_files',
    'mcp__jerry__grep_code',
    'mcp__jerry__screenshot',
    'mcp__jerry__run_tests',
  ]
  if (fixMode) allowedTools.push('mcp__jerry__edit_file')

  console.log(`  Agent Jerry is investigating (max 20 turns)...`)
  console.log(`  Tools: ${allowedTools.map((t) => t.replace('mcp__jerry__', '')).join(', ')}`)
  console.log()

  let finalText = ''
  let turnCount = 0

  try {
    for await (const message of query({
      prompt: userPrompt,
      options: {
        model: 'sonnet',
        maxTurns: 20,
        systemPrompt,
        mcpServers: { jerry: qaServer },
        allowedTools,
        permissionMode: 'acceptEdits',
        cwd: ROOT,
        persistSession: false,
        env: { ...process.env, ANTHROPIC_API_KEY: getApiKey() },
      },
    })) {
      if (message.type === 'assistant') {
        turnCount++
        const content = message.message?.content || []
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            finalText += block.text
            // Print non-JSON text as progress
            const line = block.text.trim()
            if (line && !line.startsWith('{') && !line.startsWith('```')) {
              console.log(`  Jerry: ${line.slice(0, 120)}`)
            }
          }
          if (block.type === 'tool_use') {
            const args = block.input || {}
            const argStr = Object.entries(args)
              .map(([k, v]) => `${k}=${typeof v === 'string' ? v.slice(0, 40) : v}`)
              .join(', ')
            console.log(`  [tool] ${block.name}(${argStr})`)
          }
        }
      }
    }
  } catch (err) {
    console.error(`  Agent error: ${err.message}`)
  }

  console.log(`\n  Agent completed in ${turnCount} turns`)

  // ── Phase 4: Parse findings ──
  section('Phase 4: QA Report')

  let findings = []
  const jsonMatch = finalText.match(/```json\s*([\s\S]*?)```/) || finalText.match(/\{[\s\S]*"findings"[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      const parsed = JSON.parse(jsonStr)
      findings = parsed.findings || []
      findings = findings.filter((f) => !previousTitles.has(f.title))
      console.log(`  Parsed ${findings.length} new finding(s)`)
    } catch (err) {
      console.error(`  Could not parse findings JSON: ${err.message}`)
    }
  } else {
    console.log('  No structured findings JSON found in agent output.')
  }

  const grouped = displayReport(findings)

  // ── Phase 5: Save history ──
  const now = Date.now()
  const newEntries = findings.map((f) => ({
    title: f.title,
    severity: f.severity,
    component: f.component,
    timestamp: now,
    fileHash: fileHash(f.component),
  }))
  saveHistory([...history, ...newEntries])

  // ── Cleanup ──
  await cleanup()

  // ── Verdict ──
  header('VERDICT')
  const counts = {
    critical: grouped.critical.length,
    warnings: grouped.warning.length,
    suggestions: grouped.suggestion.length,
    positives: grouped.positive.length,
  }
  console.log(`  ${counts.critical} critical, ${counts.warnings} warnings, ${counts.suggestions} suggestions, ${counts.positives} positives`)

  if (counts.critical > 0) {
    console.log('  RESULT: CRITICAL ISSUES FOUND')
    console.log('  Action: Fix critical issues before shipping.\n')
    process.exit(1)
  } else if (counts.warnings > 0) {
    console.log('  RESULT: WARNINGS — review before shipping')
    console.log('  Action: Consider fixing the warnings above.\n')
    process.exit(0)
  } else {
    console.log('  RESULT: LOOKING GOOD')
    console.log('  Agent Jerry gives the thumbs up.\n')
    process.exit(0)
  }
}

main().catch((err) => {
  console.error(`\n  FATAL: ${err.message}`)
  stopVite()
  process.exit(1)
})
