// OCR A Chemistry (H032) AS-level spec points, Modules 1-4.
// This file is the SOURCE OF TRUTH. Confidence ratings and completion status are
// stored in localStorage keyed by spec point `id` and merged at runtime.
//
// frequency: HIGH | MED | LOW  (based on past-paper analysis)
// gcseOverlap: true if broadly covered in AQA Combined Science

export const SPEC = [
  // ===== MODULE 1: Development of practical skills =====
  {
    id: '1.1',
    module: 1,
    section: '1.1',
    subsection: '1.1',
    title: 'Practical skills assessed throughout',
    description:
      'Plan, implement, analyse and evaluate experiments; handle uncertainties, errors, significant figures and practical technique. Embedded throughout the course.',
    frequency: 'HIGH',
    gcseOverlap: true,
    tags: ['practical', 'evaluation'],
  },

  // ===== MODULE 2: Foundations in chemistry =====
  // 2.1.1 Atomic structure and isotopes
  {
    id: '2.1.1a',
    module: 2,
    section: '2.1',
    subsection: '2.1.1',
    title: 'Atomic structure',
    description:
      'Protons, neutrons and electrons: relative charges and masses; atomic (proton) number and mass (nucleon) number.',
    frequency: 'MED',
    gcseOverlap: true,
    tags: ['structure'],
  },
  {
    id: '2.1.1b',
    module: 2,
    section: '2.1',
    subsection: '2.1.1',
    title: 'Isotopes and relative masses',
    description:
      'Definition of isotopes; relative isotopic mass and relative atomic mass; calculation of relative atomic mass from isotopic abundances (mass spectrometry data).',
    frequency: 'MED',
    gcseOverlap: true,
    tags: ['calculation', 'isotopes'],
  },
  // 2.1.2 Compounds, formulae and equations
  {
    id: '2.1.2a',
    module: 2,
    section: '2.1',
    subsection: '2.1.2',
    title: 'Formulae and ions',
    description:
      'Formulae of common compounds and ions; construction of formulae from charges; use of oxidation numbers in naming.',
    frequency: 'LOW',
    gcseOverlap: true,
    tags: ['formulae'],
  },
  {
    id: '2.1.2b',
    module: 2,
    section: '2.1',
    subsection: '2.1.2',
    title: 'Balanced and ionic equations',
    description:
      'Writing and balancing full and ionic equations, including state symbols; equations for reactions studied.',
    frequency: 'LOW',
    gcseOverlap: true,
    tags: ['equations'],
  },
  // 2.1.3 Amount of substance (the mole)
  {
    id: '2.1.3a',
    module: 2,
    section: '2.1',
    subsection: '2.1.3',
    title: 'The mole',
    description:
      'Explain and use the terms: amount of substance, mole, Avogadro constant, molar mass, molar gas volume.',
    frequency: 'HIGH',
    gcseOverlap: true,
    tags: ['calculation', 'quantitative'],
  },
  {
    id: '2.1.3b',
    module: 2,
    section: '2.1',
    subsection: '2.1.3',
    title: 'Mole calculations',
    description:
      'Calculations using n = m/M, n = V/24000 (gas volumes at RTP), and the ideal gas equation pV = nRT.',
    frequency: 'HIGH',
    gcseOverlap: false,
    tags: ['calculation', 'quantitative'],
  },
  {
    id: '2.1.3c',
    module: 2,
    section: '2.1',
    subsection: '2.1.3',
    title: 'Empirical and molecular formulae; concentrations',
    description:
      'Determination of empirical and molecular formulae from composition data; calculation of concentration in mol dm⁻³ and g dm⁻³; percentage yield and atom economy.',
    frequency: 'HIGH',
    gcseOverlap: false,
    tags: ['calculation', 'quantitative'],
  },
  // 2.1.4 Acids
  {
    id: '2.1.4a',
    module: 2,
    section: '2.1',
    subsection: '2.1.4',
    title: 'Acids, bases and neutralisation',
    description:
      'Acids and bases; strong vs weak acids in terms of dissociation; reactions of acids with bases, carbonates and metals; salt preparation.',
    frequency: 'MED',
    gcseOverlap: true,
    tags: ['acids'],
  },
  {
    id: '2.1.4b',
    module: 2,
    section: '2.1',
    subsection: '2.1.4',
    title: 'Titration calculations',
    description:
      'Structured tasks involving acid–base titrations; calculation of concentrations, volumes and reacting masses from titration results.',
    frequency: 'HIGH',
    gcseOverlap: false,
    tags: ['calculation', 'practical', 'quantitative'],
  },
  // 2.1.5 Redox
  {
    id: '2.1.5a',
    module: 2,
    section: '2.1',
    subsection: '2.1.5',
    title: 'Oxidation numbers',
    description:
      'Rules for assigning oxidation numbers; use of oxidation numbers to identify oxidation and reduction and to name compounds.',
    frequency: 'HIGH',
    gcseOverlap: false,
    tags: ['redox'],
  },
  {
    id: '2.1.5b',
    module: 2,
    section: '2.1',
    subsection: '2.1.5',
    title: 'Redox half-equations',
    description:
      'Writing and combining half-equations; identifying oxidising and reducing agents; redox reactions of metals and acids.',
    frequency: 'HIGH',
    gcseOverlap: false,
    tags: ['redox', 'equations'],
  },

  // 2.2.1 Electron structure
  {
    id: '2.2.1a',
    module: 2,
    section: '2.2',
    subsection: '2.2.1',
    title: 'Shells, subshells and orbitals',
    description:
      'Energy levels, shells, subshells (s, p, d), atomic orbitals and their shapes; number of electrons per shell and subshell.',
    frequency: 'HIGH',
    gcseOverlap: false,
    tags: ['electrons'],
  },
  {
    id: '2.2.1b',
    module: 2,
    section: '2.2',
    subsection: '2.2.1',
    title: 'Electron configuration',
    description:
      'Filling of orbitals (Aufbau, Hund, Pauli); electron configurations of atoms and ions up to Z = 36 using s, p, d notation.',
    frequency: 'HIGH',
    gcseOverlap: false,
    tags: ['electrons', 'configuration'],
  },
  // 2.2.2 Bonding and structure
  {
    id: '2.2.2a',
    module: 2,
    section: '2.2',
    subsection: '2.2.2',
    title: 'Ionic and covalent bonding',
    description:
      'Ionic bonding and lattice structure; covalent and dative covalent bonding; bond strength; properties linked to structure.',
    frequency: 'MED',
    gcseOverlap: true,
    tags: ['bonding'],
  },
  {
    id: '2.2.2b',
    module: 2,
    section: '2.2',
    subsection: '2.2.2',
    title: 'Shapes of molecules (VSEPR)',
    description:
      'Electron-pair repulsion theory; predicting shapes and bond angles of molecules and ions; effect of lone pairs.',
    frequency: 'HIGH',
    gcseOverlap: false,
    tags: ['shapes', 'vsepr'],
  },
  {
    id: '2.2.2c',
    module: 2,
    section: '2.2',
    subsection: '2.2.2',
    title: 'Electronegativity and polarity',
    description:
      'Electronegativity; polar bonds and permanent dipoles; identifying polar molecules from shape and bond polarity.',
    frequency: 'MED',
    gcseOverlap: false,
    tags: ['bonding', 'polarity'],
  },
  // 2.2.3 Intermolecular forces
  {
    id: '2.2.3a',
    module: 2,
    section: '2.2',
    subsection: '2.2.3',
    title: 'Intermolecular forces',
    description:
      'Induced dipole–dipole (London) forces, permanent dipole–dipole interactions and hydrogen bonding; relative strengths.',
    frequency: 'MED',
    gcseOverlap: false,
    tags: ['intermolecular'],
  },
  {
    id: '2.2.3b',
    module: 2,
    section: '2.2',
    subsection: '2.2.3',
    title: 'Anomalous properties of water',
    description:
      'Hydrogen bonding in water; anomalous density of ice and relatively high boiling point explained by hydrogen bonding.',
    frequency: 'LOW',
    gcseOverlap: false,
    tags: ['intermolecular', 'water'],
  },

  // ===== MODULE 3: Periodic table and energy =====
  // 3.1.1 Periodicity
  {
    id: '3.1.1a',
    module: 3,
    section: '3.1',
    subsection: '3.1.1',
    title: 'The periodic table and periodicity',
    description:
      'Arrangement of elements by atomic number; periods and groups; periodic trends in electron configuration.',
    frequency: 'MED',
    gcseOverlap: true,
    tags: ['periodicity'],
  },
  {
    id: '3.1.1b',
    module: 3,
    section: '3.1',
    subsection: '3.1.1',
    title: 'Ionisation energies and trends',
    description:
      'First ionisation energy; trends across periods and down groups; successive ionisation energies as evidence for shell structure.',
    frequency: 'MED',
    gcseOverlap: false,
    tags: ['periodicity', 'ionisation'],
  },
  {
    id: '3.1.1c',
    module: 3,
    section: '3.1',
    subsection: '3.1.1',
    title: 'Trends in melting points',
    description:
      'Variation of melting point across Period 3 explained in terms of structure and bonding (metallic, giant covalent, simple molecular).',
    frequency: 'LOW',
    gcseOverlap: false,
    tags: ['periodicity'],
  },
  // 3.1.2 Group 2
  {
    id: '3.1.2a',
    module: 3,
    section: '3.1',
    subsection: '3.1.2',
    title: 'Group 2 reactions',
    description:
      'Redox reactions of Group 2 metals with oxygen, water; reactions of oxides and hydroxides; trends in reactivity.',
    frequency: 'MED',
    gcseOverlap: false,
    tags: ['group2'],
  },
  {
    id: '3.1.2b',
    module: 3,
    section: '3.1',
    subsection: '3.1.2',
    title: 'Group 2 trends and uses',
    description:
      'Trend in solubility of hydroxides and sulfates; uses of Group 2 compounds (e.g. neutralising agents).',
    frequency: 'LOW',
    gcseOverlap: false,
    tags: ['group2'],
  },
  // 3.1.3 Halogens / Group 7
  {
    id: '3.1.3a',
    module: 3,
    section: '3.1',
    subsection: '3.1.3',
    title: 'Halogens and displacement',
    description:
      'Trends in boiling point and reactivity of Group 7; displacement reactions; halogens as oxidising agents; disproportionation.',
    frequency: 'MED',
    gcseOverlap: true,
    tags: ['group7', 'redox'],
  },
  {
    id: '3.1.3b',
    module: 3,
    section: '3.1',
    subsection: '3.1.3',
    title: 'Halide ion tests',
    description:
      'Qualitative analysis of halide ions with silver nitrate and ammonia; tests for carbonate, sulfate and ammonium ions; correct test sequence.',
    frequency: 'MED',
    gcseOverlap: false,
    tags: ['group7', 'practical', 'qualitative'],
  },
  // 3.1.4 Enthalpy
  {
    id: '3.1.4a',
    module: 3,
    section: '3.1',
    subsection: '3.1.4',
    title: 'Enthalpy changes',
    description:
      'Exothermic and endothermic reactions; enthalpy change ΔH; standard enthalpy changes of reaction, formation, combustion and neutralisation.',
    frequency: 'HIGH',
    gcseOverlap: true,
    tags: ['enthalpy', 'energetics'],
  },
  {
    id: '3.1.4b',
    module: 3,
    section: '3.1',
    subsection: '3.1.4',
    title: 'Calorimetry and q = mcΔT',
    description:
      'Determination of enthalpy changes from calorimetry experiments using q = mcΔT; calculation of ΔH per mole.',
    frequency: 'HIGH',
    gcseOverlap: false,
    tags: ['enthalpy', 'calculation', 'practical'],
  },
  {
    id: '3.1.4c',
    module: 3,
    section: '3.1',
    subsection: '3.1.4',
    title: "Hess's law and bond enthalpies",
    description:
      "Hess's law cycles to calculate enthalpy changes; calculation of enthalpy changes from average bond enthalpies.",
    frequency: 'HIGH',
    gcseOverlap: false,
    tags: ['enthalpy', 'calculation'],
  },
  // 3.1.5 Reaction rates and equilibrium
  {
    id: '3.1.5a',
    module: 3,
    section: '3.1',
    subsection: '3.1.5',
    title: 'Reaction rates and catalysts',
    description:
      'Collision theory; effect of concentration, pressure, temperature and catalysts on rate; Boltzmann distribution; activation energy.',
    frequency: 'MED',
    gcseOverlap: true,
    tags: ['rates', 'kinetics'],
  },
  {
    id: '3.1.5b',
    module: 3,
    section: '3.1',
    subsection: '3.1.5',
    title: 'Dynamic equilibrium and Le Chatelier',
    description:
      "Dynamic equilibrium; Le Chatelier's principle; effect of changing concentration, pressure and temperature on position of equilibrium.",
    frequency: 'HIGH',
    gcseOverlap: false,
    tags: ['equilibrium'],
  },
  {
    id: '3.1.5c',
    module: 3,
    section: '3.1',
    subsection: '3.1.5',
    title: 'The equilibrium constant Kc',
    description:
      'Expression for Kc; calculation of Kc from equilibrium concentrations; effect of changing conditions on Kc.',
    frequency: 'HIGH',
    gcseOverlap: false,
    tags: ['equilibrium', 'calculation'],
  },

  // ===== MODULE 4: Core organic chemistry =====
  // 4.1.1 Basic concepts of organic chemistry
  {
    id: '4.1.1a',
    module: 4,
    section: '4.1',
    subsection: '4.1.1',
    title: 'Nomenclature and formulae',
    description:
      'IUPAC naming of organic compounds; general, structural, displayed, skeletal and molecular formulae; functional groups and homologous series.',
    frequency: 'MED',
    gcseOverlap: false,
    tags: ['organic', 'nomenclature'],
  },
  {
    id: '4.1.1b',
    module: 4,
    section: '4.1',
    subsection: '4.1.1',
    title: 'Isomerism',
    description:
      'Structural isomerism (chain, position, functional group) and E/Z stereoisomerism; CIP priority rules.',
    frequency: 'MED',
    gcseOverlap: false,
    tags: ['organic', 'isomerism'],
  },
  {
    id: '4.1.1c',
    module: 4,
    section: '4.1',
    subsection: '4.1.1',
    title: 'Reaction mechanisms and bond fission',
    description:
      'Homolytic and heterolytic fission; radicals, electrophiles and nucleophiles; use of curly arrows to represent mechanisms.',
    frequency: 'MED',
    gcseOverlap: false,
    tags: ['organic', 'mechanism'],
  },
  // 4.1.2 Alkanes
  {
    id: '4.1.2a',
    module: 4,
    section: '4.1',
    subsection: '4.1.2',
    title: 'Alkanes and combustion',
    description:
      'Bonding in alkanes; boiling point trends; complete and incomplete combustion; alkanes as fuels.',
    frequency: 'MED',
    gcseOverlap: true,
    tags: ['organic', 'alkanes'],
  },
  {
    id: '4.1.2b',
    module: 4,
    section: '4.1',
    subsection: '4.1.2',
    title: 'Free-radical substitution',
    description:
      'Mechanism of free-radical substitution of alkanes by halogens: initiation, propagation and termination steps; limitations.',
    frequency: 'MED',
    gcseOverlap: false,
    tags: ['organic', 'mechanism', 'alkanes'],
  },
  // 4.1.3 Alkenes
  {
    id: '4.1.3a',
    module: 4,
    section: '4.1',
    subsection: '4.1.3',
    title: 'Alkenes and the double bond',
    description:
      'Bonding in alkenes (sigma and pi bonds); restricted rotation; reactivity due to the C=C double bond.',
    frequency: 'MED',
    gcseOverlap: false,
    tags: ['organic', 'alkenes'],
  },
  {
    id: '4.1.3b',
    module: 4,
    section: '4.1',
    subsection: '4.1.3',
    title: 'Electrophilic addition',
    description:
      "Mechanism of electrophilic addition to alkenes; Markownikoff's rule and carbocation stability; addition polymerisation.",
    frequency: 'MED',
    gcseOverlap: false,
    tags: ['organic', 'mechanism', 'alkenes'],
  },
  // 4.2.1 Alcohols
  {
    id: '4.2.1a',
    module: 4,
    section: '4.2',
    subsection: '4.2.1',
    title: 'Alcohols: properties and oxidation',
    description:
      'Classification of alcohols; combustion; oxidation of primary and secondary alcohols; resistance of tertiary alcohols.',
    frequency: 'MED',
    gcseOverlap: false,
    tags: ['organic', 'alcohols'],
  },
  {
    id: '4.2.1b',
    module: 4,
    section: '4.2',
    subsection: '4.2.1',
    title: 'Alcohols: substitution and dehydration',
    description:
      'Esterification, dehydration to alkenes, and substitution to halogenoalkanes; conditions and products.',
    frequency: 'LOW',
    gcseOverlap: false,
    tags: ['organic', 'alcohols'],
  },
  // 4.2.2 Haloalkanes
  {
    id: '4.2.2a',
    module: 4,
    section: '4.2',
    subsection: '4.2.2',
    title: 'Haloalkanes: nucleophilic substitution',
    description:
      'Mechanism of nucleophilic substitution with aqueous hydroxide, water and ammonia; hydrolysis and rates linked to bond enthalpy.',
    frequency: 'MED',
    gcseOverlap: false,
    tags: ['organic', 'mechanism', 'haloalkanes'],
  },
  {
    id: '4.2.2b',
    module: 4,
    section: '4.2',
    subsection: '4.2.2',
    title: 'Haloalkanes and the environment',
    description:
      'Role of CFCs in ozone depletion; radical reactions of chlorine atoms with ozone; alternatives to CFCs.',
    frequency: 'LOW',
    gcseOverlap: false,
    tags: ['organic', 'haloalkanes', 'environment'],
  },
  // 4.2.3 Organic synthesis and analysis
  {
    id: '4.2.3a',
    module: 4,
    section: '4.2',
    subsection: '4.2.3',
    title: 'Organic synthesis routes',
    description:
      'Practical techniques for preparation and purification of organic liquids; two-stage synthetic routes between functional groups.',
    frequency: 'MED',
    gcseOverlap: false,
    tags: ['organic', 'synthesis', 'practical'],
  },
  {
    id: '4.2.3b',
    module: 4,
    section: '4.2',
    subsection: '4.2.3',
    title: 'Infrared spectroscopy',
    description:
      'Use of IR spectroscopy to identify functional groups from absorption ranges; identifying bonds; the fingerprint region.',
    frequency: 'MED',
    gcseOverlap: false,
    tags: ['analysis', 'spectroscopy', 'ir'],
  },
  {
    id: '4.2.3c',
    module: 4,
    section: '4.2',
    subsection: '4.2.3',
    title: 'Mass spectrometry',
    description:
      'Use of mass spectra to determine molecular mass from the M⁺ molecular ion peak; interpretation of fragmentation patterns.',
    frequency: 'MED',
    gcseOverlap: false,
    tags: ['analysis', 'spectroscopy', 'ms'],
  },
]

// Convenience: frequency rank for sorting (HIGH floats to top).
export const FREQ_RANK = { HIGH: 0, MED: 1, LOW: 2 }

export function getSpecPoint(id) {
  return SPEC.find((s) => s.id === id)
}
