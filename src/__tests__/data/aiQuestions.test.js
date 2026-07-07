import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../data/aiQuestions')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
const batches = files.map((f) => ({
  file: f,
  questions: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')),
}))
const all = batches.flatMap((b) => b.questions)

// Topic names must exactly match the SmartMark topic names used in paperIndex.json
const VALID_TOPICS = new Set([
  'Moles',
  'Equilibrium',
  'Enthalpy & Energetics',
  'Redox',
  'Organic Synthesis & Analysis',
  'Acids & Bases',
  'Reaction Rates',
  'Alkenes',
  'Periodicity',
  'Atomic Structure & Isotopes',
  'Group 7 (Halogens)',
  'Basic Concepts of Organic Chemistry',
  'Electron Structure',
  'Shapes of Molecules & IMF',
  'Alkanes',
  'Alcohols',
  'Bonding & Structure',
  'Practical Skills',
  'Compounds Formulae & Equations',
  'Haloalkanes',
  'Group 2',
])

describe('aiQuestions batches', () => {
  it('every file is a non-empty array', () => {
    for (const b of batches) {
      expect(Array.isArray(b.questions), b.file).toBe(true)
      expect(b.questions.length, b.file).toBeGreaterThan(0)
    }
  })

  it('ids are unique across all batches', () => {
    const ids = all.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every question has required base fields', () => {
    for (const q of all) {
      expect(typeof q.id, q.id).toBe('string')
      expect(['mcq', 'written']).toContain(q.type)
      expect([1, 2, 3, 4]).toContain(q.module)
      expect(VALID_TOPICS.has(q.topic), `${q.id}: topic "${q.topic}"`).toBe(true)
      expect(typeof q.specRef, q.id).toBe('string')
      expect(typeof q.question, q.id).toBe('string')
      expect(q.question.trim().length, q.id).toBeGreaterThan(10)
    }
  })

  it('MCQs have four options, a valid correctOption, explanation and steps ending in Answer', () => {
    for (const q of all.filter((q) => q.type === 'mcq')) {
      expect(Object.keys(q.options).sort(), q.id).toEqual(['A', 'B', 'C', 'D'])
      for (const v of Object.values(q.options)) expect(typeof v, q.id).toBe('string')
      expect(['A', 'B', 'C', 'D']).toContain(q.correctOption)
      expect(typeof q.explanation, q.id).toBe('string')
      expect(q.explanation.trim().length, q.id).toBeGreaterThan(0)
      expect(Array.isArray(q.steps), q.id).toBe(true)
      expect(q.steps.length, q.id).toBeGreaterThan(0)
      const last = q.steps[q.steps.length - 1]
      expect(/\bAnswer\b/i.test(last), `${q.id}: last step "${last}"`).toBe(true)
      expect(last.includes(q.correctOption), `${q.id}: last step must name correctOption`).toBe(true)
    }
  })

  it('written questions have marks, matching markPoints, and a model answer', () => {
    for (const q of all.filter((q) => q.type === 'written')) {
      expect(Number.isInteger(q.marks), q.id).toBe(true)
      expect(q.marks, q.id).toBeGreaterThanOrEqual(1)
      expect(q.marks, q.id).toBeLessThanOrEqual(6)
      expect(Array.isArray(q.markPoints), q.id).toBe(true)
      expect(q.markPoints.length, `${q.id}: markPoints length must equal marks`).toBe(q.marks)
      for (const p of q.markPoints) expect(typeof p, q.id).toBe('string')
      expect(typeof q.modelAnswer, q.id).toBe('string')
      expect(q.modelAnswer.trim().length, q.id).toBeGreaterThan(0)
      expect(typeof q.explanation, q.id).toBe('string')
    }
  })

  it('questions are text-only (no references to diagrams or drawing)', () => {
    const banned = /\b(draw|sketch|label the diagram|shown in the diagram|in the figure|graph below|diagram below|table below)\b/i
    for (const q of all) {
      expect(banned.test(q.question), `${q.id}: question references a visual`).toBe(false)
    }
  })

  it('ids follow the {fileslug}-{nnn} convention within each file', () => {
    for (const b of batches) {
      const slug = b.file.replace(/\.json$/, '')
      for (const q of b.questions) {
        expect(q.id.startsWith(`${slug}-`), `${b.file}: id ${q.id}`).toBe(true)
      }
    }
  })
})
