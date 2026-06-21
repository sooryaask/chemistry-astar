// 21-day study plan, configured for the REAL experiment:
//   Target: A*-equivalent (90%+) on OCR A AS Paper 1 (Modules 1-4)
//   Starting point: GCSE Combined Science (AQA) only
//   Time budget: 1-2 hours/day  (~21-40 hours total)
//
// Strategy: chase marks by FREQUENCY, not coverage. High-frequency topics and
// GCSE-overlap quick-wins come first. Low-frequency topics are deliberately left
// OFF the schedule (see STRETCH list) — only touch them if you get ahead.
//
// Each day ≈ learn the topic (~40-60 min) + practise real past-paper questions on
// it in the Smart Mark tool (~30-45 min) + clear your error log (~15 min).

export const PLAN = [
  // ---------- WEEK 1: high-frequency core + GCSE quick wins ----------
  { day: 1, phase: 'Week 1 · Foundations', title: 'Atoms, formulae & equations', specIds: ['2.1.1a', '2.1.2a', '2.1.2b'], smartTopic: 'Compounds, Formulae & Equations', minutes: 75, note: 'GCSE overlap — go fast. Nail writing/balancing equations and ions.' },
  { day: 2, phase: 'Week 1 · Foundations', title: 'The mole + core calculations', specIds: ['2.1.3a', '2.1.3b'], smartTopic: 'Amount of Substance (Moles)', minutes: 90, note: 'HIGHEST-frequency topic on the paper. n=m/M, gas volumes, pV=nRT.' },
  { day: 3, phase: 'Week 1 · Foundations', title: 'Empirical formulae, concentration, yield', specIds: ['2.1.3c'], smartTopic: 'Amount of Substance (Moles)', minutes: 90, note: 'Empirical/molecular formula, mol dm⁻³, % yield, atom economy.' },
  { day: 4, phase: 'Week 1 · Foundations', title: 'Acids & titration calculations', specIds: ['2.1.4a', '2.1.4b'], smartTopic: 'Acids & Bases', minutes: 90, note: 'HIGH. Titration sums are guaranteed marks — drill the method.' },
  { day: 5, phase: 'Week 1 · Foundations', title: 'Redox & half-equations', specIds: ['2.1.5a', '2.1.5b'], smartTopic: 'Redox', minutes: 75, note: 'HIGH. Oxidation numbers rules + combining half-equations.' },
  { day: 6, phase: 'Week 1 · Foundations', title: 'Electron structure & configuration', specIds: ['2.2.1a', '2.2.1b'], smartTopic: 'Electron Structure', minutes: 75, note: 'HIGH. s/p/d notation up to Z=36, including ions.' },
  { day: 7, phase: 'Week 1 · Review', title: 'Module 2 past-paper practice', specIds: [], smartTopic: 'Amount of Substance (Moles)', minutes: 90, note: 'No new content. Smart Mark: Moles, Redox, Electron Structure. Clear error log.' },

  // ---------- WEEK 2: high-frequency new content ----------
  { day: 8, phase: 'Week 2 · Bonding & energy', title: 'Bonding, electronegativity & polarity', specIds: ['2.2.2a', '2.2.2c'], smartTopic: 'Bonding & Structure', minutes: 75, note: 'Some GCSE overlap. Add dative bonds, electronegativity, polar molecules.' },
  { day: 9, phase: 'Week 2 · Bonding & energy', title: 'Shapes of molecules (VSEPR) + IMFs', specIds: ['2.2.2b', '2.2.3a'], smartTopic: 'Shapes of Molecules & Intermolecular Forces', minutes: 90, note: 'HIGH. Learn shapes/angles + lone-pair effect; H-bonding vs London.' },
  { day: 10, phase: 'Week 2 · Bonding & energy', title: 'Enthalpy & calorimetry', specIds: ['3.1.4a', '3.1.4b'], smartTopic: 'Enthalpy & Energetics', minutes: 90, note: 'HIGH. Definitions + q=mcΔT, then ΔH per mole.' },
  { day: 11, phase: 'Week 2 · Bonding & energy', title: "Hess's law & bond enthalpies", specIds: ['3.1.4c'], smartTopic: 'Enthalpy & Energetics', minutes: 90, note: 'HIGH. Hess cycles + average bond enthalpy calculations.' },
  { day: 12, phase: 'Week 2 · Bonding & energy', title: 'Equilibrium & Le Chatelier + Kc', specIds: ['3.1.5b', '3.1.5c'], smartTopic: 'Equilibrium', minutes: 90, note: 'HIGH. Predict shifts; write and calculate Kc.' },
  { day: 13, phase: 'Week 2 · Bonding & energy', title: 'Reaction rates', specIds: ['3.1.5a'], smartTopic: 'Reaction Rates', minutes: 60, note: 'MED. Collision theory, Boltzmann distribution, catalysts.' },
  { day: 14, phase: 'Week 2 · Review', title: 'Module 3 past-paper practice', specIds: [], smartTopic: 'Enthalpy & Energetics', minutes: 90, note: 'No new content. Smart Mark: Enthalpy, Equilibrium. Clear error log.' },

  // ---------- WEEK 3: remaining MED topics + organic + exam practice ----------
  { day: 15, phase: 'Week 3 · Inorganic & organic', title: 'Periodicity & ionisation energies', specIds: ['3.1.1a', '3.1.1b'], smartTopic: 'Periodicity', minutes: 75, note: 'MED. Trends across/down; successive IE as evidence for shells.' },
  { day: 16, phase: 'Week 3 · Inorganic & organic', title: 'Groups 2 & 7 + ion tests', specIds: ['3.1.2a', '3.1.3a', '3.1.3b'], smartTopic: 'Group 7 (Halogens)', minutes: 90, note: 'MED. Reactivity trends, displacement, disproportionation, qualitative tests.' },
  { day: 17, phase: 'Week 3 · Inorganic & organic', title: 'Organic basics: naming, isomers, mechanisms', specIds: ['4.1.1a', '4.1.1b', '4.1.1c'], smartTopic: 'Basic Concepts of Organic Chemistry', minutes: 90, note: 'MED. IUPAC names, E/Z, curly arrows — underpins all organic marks.' },
  { day: 18, phase: 'Week 3 · Inorganic & organic', title: 'Alkanes & alkenes mechanisms', specIds: ['4.1.2a', '4.1.2b', '4.1.3a', '4.1.3b'], smartTopic: 'Alkenes', minutes: 90, note: 'MED. Free-radical substitution + electrophilic addition (learn the steps).' },
  { day: 19, phase: 'Week 3 · Inorganic & organic', title: 'Alcohols & haloalkanes', specIds: ['4.2.1a', '4.2.2a'], smartTopic: 'Alcohols', minutes: 75, note: 'MED. Oxidation of alcohols; nucleophilic substitution & hydrolysis.' },
  { day: 20, phase: 'Week 3 · Inorganic & organic', title: 'IR & mass spectrometry + practical skills', specIds: ['4.2.3b', '4.2.3c', '1.1'], smartTopic: 'Organic Synthesis & Analysis (IR/MS)', minutes: 90, note: 'MED. IR bond ranges, M⁺ peak/fragmentation, practical evaluation language.' },
  { day: 21, phase: 'Week 3 · Final', title: 'Timed full paper + weakness blitz', specIds: [], smartTopic: 'Amount of Substance (Moles)', minutes: 120, note: 'Sit a full Paper 1 timed. Log the % in Past Papers. Blitz weakest HIGH topics in the error log. This is the experiment result.' },
]

// Deliberately OFF the schedule. Only attempt if you finish a day early.
export const STRETCH = [
  { id: '2.2.3b', why: 'Anomalous properties of water — LOW frequency.' },
  { id: '3.1.1c', why: 'Period 3 melting-point trends — LOW frequency.' },
  { id: '3.1.2b', why: 'Group 2 solubility/uses — LOW frequency.' },
  { id: '4.2.1b', why: 'Alcohol dehydration/substitution detail — LOW frequency.' },
  { id: '4.2.2b', why: 'CFCs & ozone — LOW frequency.' },
  { id: '4.2.3a', why: 'Practical synthesis routes — LOW frequency (still know the techniques).' },
]
