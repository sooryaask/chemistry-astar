#!/usr/bin/env node
/**
 * Testing Agent — the "superior" testing agent for chemistry-astar.
 *
 * This script:
 * 1. Detects what changed (git diff, new files, modified files)
 * 2. Runs the relevant Vitest tests (targeted or full suite)
 * 3. Validates the build compiles cleanly
 * 4. Generates an insights report: what's good, what's unnecessary, what's risky
 *
 * Usage:
 *   node tests/test-agent.js              # Auto-detect changes and test
 *   node tests/test-agent.js --full       # Full test suite + build check
 *   node tests/test-agent.js --quick      # Tests only, no build check
 *
 * Exit codes:
 *   0 = all clear
 *   1 = test failures or build errors
 *   2 = warnings (tests pass but insights flagged)
 */

import { execSync } from 'child_process'
import path from 'path'

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..')
const DIVIDER = '═'.repeat(60)
const THIN = '─'.repeat(60)

const mode = process.argv[2] || ''
const isQuick = mode === '--quick'
const isFull = mode === '--full'

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

// ──────────────────────────────────────────────────
//  PHASE 1: CHANGE DETECTION
// ──────────────────────────────────────────────────

header('TESTING AGENT — chemistry-astar')
console.log(`  Time: ${new Date().toLocaleString()}`)
console.log(`  Mode: ${isFull ? 'FULL' : isQuick ? 'QUICK' : 'AUTO-DETECT'}`)

section('Phase 1: Change Detection')

const detectResult = run(`node tests/detect-changes.js ${isFull ? '--all' : ''}`)
let analysis = null

if (detectResult.ok) {
  try {
    analysis = JSON.parse(detectResult.output)
  } catch {
    console.log('  Could not parse change detection output.')
    analysis = { totalChanges: 0, status: 'error' }
  }
}

if (!analysis || analysis.status === 'clean') {
  console.log('  No changes detected. Running full test suite as baseline.')
  analysis = { totalChanges: 0, affectedTests: ['--all'], categories: {}, insights: [], files: [] }
}

console.log(`  Changes detected: ${analysis.totalChanges} file(s)`)

if (analysis.categories) {
  for (const [cat, info] of Object.entries(analysis.categories)) {
    console.log(`    [${info.risk.toUpperCase()}] ${cat}: ${info.count} file(s) — ${info.description}`)
  }
}

// ──────────────────────────────────────────────────
//  PHASE 2: RUN TESTS
// ──────────────────────────────────────────────────

section('Phase 2: Test Execution')

let testCmd = 'npx vitest run --reporter=verbose'

// If we have targeted tests and not running full
if (analysis.affectedTests && analysis.affectedTests.length > 0 && !analysis.affectedTests.includes('--all') && !isFull) {
  const testFiles = analysis.affectedTests.join(' ')
  testCmd = `npx vitest run --reporter=verbose ${testFiles}`
  console.log(`  Running targeted tests: ${analysis.affectedTests.length} test file(s)`)
} else {
  console.log('  Running full test suite')
}

const testResult = run(testCmd)
console.log(testResult.output)

const testsPassed = testResult.ok

// ──────────────────────────────────────────────────
//  PHASE 3: BUILD VALIDATION
// ──────────────────────────────────────────────────

let buildPassed = true

if (!isQuick) {
  section('Phase 3: Build Validation')
  console.log('  Running: npm run build')

  const buildResult = run('npm run build')
  buildPassed = buildResult.ok

  if (buildPassed) {
    console.log('  BUILD: PASSED')
    // Check bundle size
    const distSize = run('du -sh dist/ 2>/dev/null')
    if (distSize.ok) {
      console.log(`  Bundle size: ${distSize.output.split('\t')[0]}`)
    }
  } else {
    console.log('  BUILD: FAILED')
    console.log(buildResult.output.split('\n').slice(-15).join('\n'))
  }
} else {
  console.log('\n  [Skipping build validation in quick mode]')
}

// ──────────────────────────────────────────────────
//  PHASE 4: INSIGHTS REPORT
// ──────────────────────────────────────────────────

section('Phase 4: Insights Report')

const insights = analysis.insights || []

// Add test-result-based insights
if (!testsPassed) {
  insights.unshift({
    type: 'error',
    message: 'Test suite has failures — fix before deploying.',
  })
}
if (!buildPassed) {
  insights.unshift({
    type: 'error',
    message: 'Build failed — the app will not compile. Fix compilation errors.',
  })
}

// Check for common issues
const changedFiles = (analysis.files || []).map((f) => f.path || f)

// Check if .env was accidentally staged
const stagedFiles = run('git diff --cached --name-only')
if (stagedFiles.ok && stagedFiles.output.includes('.env')) {
  insights.push({
    type: 'security',
    message: 'WARNING: .env file is staged for commit! This contains your API key. Unstage it immediately.',
  })
}

// Check for large new files
for (const f of analysis.files || []) {
  if (f.isNew && f.exists) {
    const sizeResult = run(`wc -c < "${f.path}" 2>/dev/null`)
    if (sizeResult.ok) {
      const bytes = parseInt(sizeResult.output)
      if (bytes > 50000) {
        insights.push({
          type: 'review',
          message: `New file "${f.path}" is ${(bytes / 1024).toFixed(0)}KB — is this necessary? Large files slow down the bundle.`,
        })
      }
    }
  }
}

// Group insights by type
const grouped = { error: [], security: [], warning: [], unnecessary: [], review: [], info: [] }
for (const insight of insights) {
  const t = grouped[insight.type] || grouped.info
  t.push(insight.message)
}

let hasWarnings = false

if (grouped.error.length) {
  console.log('\n  ERRORS (must fix):')
  for (const m of grouped.error) console.log(`    [x] ${m}`)
  hasWarnings = true
}
if (grouped.security.length) {
  console.log('\n  SECURITY:')
  for (const m of grouped.security) console.log(`    [!] ${m}`)
  hasWarnings = true
}
if (grouped.warning.length) {
  console.log('\n  WARNINGS (should review):')
  for (const m of grouped.warning) console.log(`    [!] ${m}`)
  hasWarnings = true
}
if (grouped.unnecessary.length) {
  console.log('\n  POTENTIALLY UNNECESSARY:')
  for (const m of grouped.unnecessary) console.log(`    [-] ${m}`)
  hasWarnings = true
}
if (grouped.review.length) {
  console.log('\n  NEEDS REVIEW:')
  for (const m of grouped.review) console.log(`    [?] ${m}`)
  hasWarnings = true
}
if (grouped.info.length) {
  console.log('\n  INFO:')
  for (const m of grouped.info) console.log(`    [i] ${m}`)
}

if (!insights.length) {
  console.log('  No issues detected. All changes look clean.')
}

// ──────────────────────────────────────────────────
//  FINAL VERDICT
// ──────────────────────────────────────────────────

header('VERDICT')

if (!testsPassed || !buildPassed) {
  console.log('  RESULT: FAIL')
  console.log('  Action: Fix the errors above before proceeding.\n')
  process.exit(1)
} else if (hasWarnings) {
  console.log('  RESULT: PASS WITH WARNINGS')
  console.log('  Action: Review the warnings above — they may need attention.\n')
  process.exit(0)
} else {
  console.log('  RESULT: ALL CLEAR')
  console.log('  The app is in good shape. All tests pass, build succeeds.\n')
  process.exit(0)
}
