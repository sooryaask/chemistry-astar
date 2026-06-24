// The deck spine. Reconciles three things into one tree:
//   - the 21 SmartMark past-paper topics (smartmark/topics.py / paperIndex.json `topic`)
//   - the 46 OCR spec points (src/data/spec.js)
//   - the 4 modules
//
// Each TOPIC is a deck. Its `specIds` drive the "Learn & topic questions" text
// cards; its `name` matches the past-paper index `topic` for the "Past papers"
// image-card sub-deck. This is the single source of truth for grouping — never
// fork it; reference TOPICS by `id`.

export const MODULES = {
  1: 'Module 1 · Practical skills',
  2: 'Module 2 · Foundations in chemistry',
  3: 'Module 3 · Periodic table & energy',
  4: 'Module 4 · Core organic chemistry',
}

export const TOPICS = [
  // ---- Module 1 ----
  { id: 'practical', module: 1, name: 'Practical Skills', specIds: ['1.1'] },

  // ---- Module 2 ----
  { id: 'atomic', module: 2, name: 'Atomic Structure & Isotopes', specIds: ['2.1.1a', '2.1.1b'] },
  { id: 'formulae', module: 2, name: 'Compounds, Formulae & Equations', specIds: ['2.1.2a', '2.1.2b'] },
  { id: 'moles', module: 2, name: 'Amount of Substance (Moles)', specIds: ['2.1.3a', '2.1.3b', '2.1.3c'] },
  { id: 'acids', module: 2, name: 'Acids & Bases', specIds: ['2.1.4a', '2.1.4b'] },
  { id: 'redox', module: 2, name: 'Redox', specIds: ['2.1.5a', '2.1.5b'] },
  { id: 'electrons', module: 2, name: 'Electron Structure', specIds: ['2.2.1a', '2.2.1b'] },
  { id: 'bonding', module: 2, name: 'Bonding & Structure', specIds: ['2.2.2a', '2.2.2c'] },
  { id: 'shapes', module: 2, name: 'Shapes of Molecules & Intermolecular Forces', specIds: ['2.2.2b', '2.2.3a', '2.2.3b'] },

  // ---- Module 3 ----
  { id: 'periodicity', module: 3, name: 'Periodicity', specIds: ['3.1.1a', '3.1.1b', '3.1.1c'] },
  { id: 'group2', module: 3, name: 'Group 2', specIds: ['3.1.2a', '3.1.2b'] },
  { id: 'group7', module: 3, name: 'Group 7 (Halogens)', specIds: ['3.1.3a', '3.1.3b'] },
  { id: 'enthalpy', module: 3, name: 'Enthalpy & Energetics', specIds: ['3.1.4a', '3.1.4b', '3.1.4c'] },
  { id: 'rates', module: 3, name: 'Reaction Rates', specIds: ['3.1.5a'] },
  { id: 'equilibrium', module: 3, name: 'Equilibrium', specIds: ['3.1.5b', '3.1.5c'] },

  // ---- Module 4 ----
  { id: 'organic-basics', module: 4, name: 'Basic Concepts of Organic Chemistry', specIds: ['4.1.1a', '4.1.1b', '4.1.1c'] },
  { id: 'alkanes', module: 4, name: 'Alkanes', specIds: ['4.1.2a', '4.1.2b'] },
  { id: 'alkenes', module: 4, name: 'Alkenes', specIds: ['4.1.3a', '4.1.3b'] },
  { id: 'alcohols', module: 4, name: 'Alcohols', specIds: ['4.2.1a', '4.2.1b'] },
  { id: 'haloalkanes', module: 4, name: 'Haloalkanes', specIds: ['4.2.2a', '4.2.2b'] },
  { id: 'analysis', module: 4, name: 'Organic Synthesis & Analysis (IR/MS)', specIds: ['4.2.3a', '4.2.3b', '4.2.3c'] },
]

// Past-paper topic name -> TOPIC id (for slotting image cards under the right deck).
export const PP_TOPIC_TO_ID = TOPICS.reduce((acc, t) => {
  acc[t.name] = t.id
  return acc
}, {})

export function getTopic(id) {
  return TOPICS.find((t) => t.id === id)
}

// Spec id -> TOPIC (every one of the 46 spec points belongs to exactly one topic).
export const SPEC_TO_TOPIC = TOPICS.reduce((acc, t) => {
  for (const sid of t.specIds) acc[sid] = t
  return acc
}, {})
