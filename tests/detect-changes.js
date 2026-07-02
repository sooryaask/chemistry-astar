#!/usr/bin/env node
/**
 * Change Detection Script
 *
 * Detects what changed in the project since the last commit (or between two commits)
 * and maps changes to affected test modules. Used by the testing agent to run only
 * the relevant tests and generate targeted insights.
 *
 * Usage:
 *   node tests/detect-changes.js              # Changes since last commit
 *   node tests/detect-changes.js --all        # Detect everything (full scan)
 *   node tests/detect-changes.js --staged     # Only staged changes
 */

import { execSync } from 'child_process'
import { existsSync, statSync } from 'fs'
import path from 'path'

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..')

// Map source files to their test modules
const FILE_TO_TEST_MAP = {
  'src/utils/srs.js': 'src/__tests__/utils/srs.test.js',
  'src/utils/localStorage.js': 'src/__tests__/utils/localStorage.test.js',
  'src/data/cards.js': 'src/__tests__/data/cards.test.js',
  'src/data/paperIndex.json': 'src/__tests__/data/cards.test.js',
  'src/api/anthropic.js': 'src/__tests__/api/anthropic.test.js',
  'src/pages/Decks.jsx': 'src/__tests__/pages/Decks.test.jsx',
  'src/pages/Review.jsx': 'src/__tests__/pages/Review.test.jsx',
  'src/App.jsx': 'src/__tests__/App.test.jsx',
  'src/main.jsx': 'src/__tests__/App.test.jsx',
  'src/config.js': 'src/__tests__/api/anthropic.test.js',
}

// Broader category mapping
const CATEGORY_MAP = {
  'src/utils/': { category: 'utilities', risk: 'high', description: 'Core utility functions (SRS algorithm, storage)' },
  'src/api/': { category: 'api', risk: 'high', description: 'Claude API integration (marking, generation)' },
  'src/data/': { category: 'data', risk: 'high', description: 'Card data layer and paper index' },
  'src/pages/': { category: 'ui', risk: 'medium', description: 'Page components (Decks, Review)' },
  'src/index.css': { category: 'styles', risk: 'low', description: 'CSS styling' },
  'src/config.js': { category: 'config', risk: 'high', description: 'App configuration (models, dates)' },
  'package.json': { category: 'deps', risk: 'medium', description: 'Dependencies' },
  'vite.config.js': { category: 'build', risk: 'medium', description: 'Build configuration' },
  'smartmark/': { category: 'pipeline', risk: 'low', description: 'Python image pipeline (separate from web app)' },
}

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function getChangedFiles(mode) {
  if (mode === '--all') {
    // Return all tracked source files
    return run('git ls-files -- src/ package.json vite.config.js').split('\n').filter(Boolean)
  }
  if (mode === '--staged') {
    return run('git diff --cached --name-only').split('\n').filter(Boolean)
  }
  // Default: uncommitted changes (staged + unstaged + untracked in src/)
  const staged = run('git diff --cached --name-only')
  const unstaged = run('git diff --name-only')
  const untracked = run('git ls-files --others --exclude-standard -- src/')
  const all = [...staged.split('\n'), ...unstaged.split('\n'), ...untracked.split('\n')]
  return [...new Set(all.filter(Boolean))]
}

function categoriseFile(filePath) {
  for (const [prefix, info] of Object.entries(CATEGORY_MAP)) {
    if (filePath.startsWith(prefix)) return info
  }
  return { category: 'other', risk: 'low', description: 'Other file' }
}

function getAffectedTests(changedFiles) {
  const tests = new Set()
  for (const file of changedFiles) {
    // Direct mapping
    if (FILE_TO_TEST_MAP[file]) {
      tests.add(FILE_TO_TEST_MAP[file])
    }
    // If a test file itself changed, include it
    if (file.includes('.test.')) {
      tests.add(file)
    }
    // If config or package changed, run all tests
    if (file === 'package.json' || file === 'vite.config.js' || file === 'vitest.config.js') {
      return ['--all']
    }
  }
  return [...tests]
}

function analyseChanges(changedFiles) {
  const analysis = {
    timestamp: new Date().toISOString(),
    totalChanges: changedFiles.length,
    files: [],
    categories: {},
    affectedTests: [],
    riskLevel: 'low',
    insights: [],
  }

  for (const file of changedFiles) {
    const cat = categoriseFile(file)
    const exists = existsSync(path.join(ROOT, file))
    const isNew = !run(`git ls-files -- "${file}"`)
    const isDeleted = !exists

    analysis.files.push({
      path: file,
      category: cat.category,
      risk: cat.risk,
      isNew,
      isDeleted,
      exists,
    })

    if (!analysis.categories[cat.category]) {
      analysis.categories[cat.category] = { ...cat, files: [], count: 0 }
    }
    analysis.categories[cat.category].files.push(file)
    analysis.categories[cat.category].count++

    // Elevate risk level
    if (cat.risk === 'high') analysis.riskLevel = 'high'
    else if (cat.risk === 'medium' && analysis.riskLevel !== 'high') analysis.riskLevel = 'medium'
  }

  analysis.affectedTests = getAffectedTests(changedFiles)

  // Generate insights
  if (changedFiles.some((f) => f.includes('srs.js'))) {
    analysis.insights.push({
      type: 'warning',
      message: 'SRS algorithm changed — verify scheduling correctness. This affects how cards are scheduled and mastery is tracked.',
    })
  }
  if (changedFiles.some((f) => f.includes('anthropic.js'))) {
    analysis.insights.push({
      type: 'warning',
      message: 'API module changed — verify prompt engineering and response parsing. Changes here affect marking accuracy.',
    })
  }
  if (changedFiles.some((f) => f.includes('config.js'))) {
    analysis.insights.push({
      type: 'warning',
      message: 'Config changed — check model names (claude-sonnet-4-6/claude-haiku-4-5) and dates are correct.',
    })
  }
  if (changedFiles.some((f) => f.endsWith('.css'))) {
    analysis.insights.push({
      type: 'info',
      message: 'CSS changed — visual regression possible. Check mobile layout and dark theme.',
    })
  }
  if (changedFiles.some((f) => f.includes('cards.js') || f.includes('paperIndex.json'))) {
    analysis.insights.push({
      type: 'warning',
      message: 'Card data layer changed — verify MCQ/calculation filtering still works and card IDs are stable.',
    })
  }
  if (changedFiles.some((f) => f.includes('package.json'))) {
    analysis.insights.push({
      type: 'info',
      message: 'Dependencies changed — run npm install and check for breaking changes.',
    })
  }

  // Detect potentially unnecessary additions
  const newFiles = changedFiles.filter((f) => !run(`git ls-files -- "${f}"`))
  if (newFiles.length > 0) {
    for (const f of newFiles) {
      if (f.endsWith('.md') && !f.includes('CLAUDE') && !f.includes('README')) {
        analysis.insights.push({
          type: 'unnecessary',
          message: `New documentation file "${f}" — is this needed? The project avoids unnecessary docs.`,
        })
      }
      if (f.includes('helper') || f.includes('util') && !f.includes('test')) {
        analysis.insights.push({
          type: 'review',
          message: `New utility file "${f}" — ensure it's not a premature abstraction.`,
        })
      }
    }
  }

  return analysis
}

// Main
const mode = process.argv[2] || ''
const changedFiles = getChangedFiles(mode)

if (changedFiles.length === 0) {
  console.log(JSON.stringify({ status: 'clean', message: 'No changes detected.', totalChanges: 0 }, null, 2))
  process.exit(0)
}

const analysis = analyseChanges(changedFiles)
console.log(JSON.stringify(analysis, null, 2))
