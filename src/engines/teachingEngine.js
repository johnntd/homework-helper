// Teaching Engine — Pure JS module
// Centralizes subject definitions, visual processing, and teaching logic.
// NO React imports. Icon names are stored as strings; App.jsx resolves them to components.

import { extractJSON, validateSunnyResponse } from '../utils/sunnyPrompts.js';

// ─── Age / Level helpers ────────────────────────────────────────────────────

export function getAgeGroup(age) {
  const ageNum = parseInt(age);
  if (ageNum >= 4 && ageNum <= 6) return '4-6';
  if (ageNum >= 7 && ageNum <= 9) return '7-9';
  if (ageNum >= 10 && ageNum <= 13) return '10-13';
  if (ageNum >= 14 && ageNum <= 18) return '14-18';
  return '10-13';
}

export function getStartingLevel(age, subjectKey) {
  const ageNum = parseInt(age);
  if (subjectKey === 'math') {
    if (ageNum <= 13) return 0;
    if (ageNum === 14) return 0;
    if (ageNum === 15) return 1;
    if (ageNum === 16) return 2;
    if (ageNum >= 17) return 3;
  }
  return 0;
}

// ─── Non-scoring / adult helpers ────────────────────────────────────────────

export const NON_SCORING_SUBJECTS = [
  'accent', 'trading', 'research', '0dte', 'options-desk',
  'interview', 'life-coach', 'skills', 'followup', 'resume', 'agents',
  'college', 'law', 'accounting', 'cpa', 'pro-coaching',
  'family-medicine', 'pharmacy', 'physical-therapy', 'nursing',
  'rtl-design', 'physical-design', 'lab-debug'
];

export function isAdultSubject(subjectKey) {
  return ['skills', 'interview', 'life-coach', 'resume', 'followup', 'accent', 'trading', 'agents',
          'college', 'law', 'accounting', 'cpa', 'pro-coaching',
          'family-medicine', 'pharmacy', 'physical-therapy', 'nursing',
          'rtl-design', 'physical-design', 'lab-debug'].includes(subjectKey);
}

// ─── Adult subjects ─────────────────────────────────────────────────────────

export const ADULT_SUBJECTS = {
  'languages':     { name: 'Language Learning',      icon: '🌍', desc: 'Daily conversations, practical phrases for real life' },
  'skills':        { name: 'Skills Training',        icon: '💻', desc: 'Coding & engineering — practical, learn fast' },
  'interview':     { name: 'Interview Prep',         icon: '🎯', desc: 'Land your next job with targeted coaching' },
  'life-coach':    { name: 'Life Coach',             icon: '🌟', desc: 'Law, health, documents — your knowledgeable advisor' },
  'resume':        { name: 'Resume Review',          icon: '📄', desc: 'Tailor & polish your resume for the job' },
  'followup':      { name: 'Interview Follow-up',    icon: '✉️',  desc: 'Thank you letters & reply to interviewers' },
  'accent':        { name: 'Accent Coach',           icon: '🗣️', desc: 'Perfect your English — fix pronunciation with AI feedback' },
  'trading':       { name: 'Stock Trading',          icon: '📈', desc: 'Read charts, spot patterns — beginner to advanced' },
  // ── Professional & Academic Tracks ──────────────────────────────────────
  'college':       { name: 'College Courses',        icon: '🎓', desc: 'Course help — accounting, stats, writing, econ, and more' },
  'law':           { name: 'Legal Studies',          icon: '⚖️', desc: 'Legal reading, case briefing, issue spotting, legal writing' },
  'accounting':    { name: 'Accounting',             icon: '📊', desc: 'Concepts, journal entries, financial statements, auditing' },
  'cpa':           { name: 'CPA Exam Prep',          icon: '📋', desc: 'FAR, AUD, REG, ISC/TCP/BAR — adaptive practice and review' },
  'pro-coaching':  { name: 'Professional Coaching',  icon: '💼', desc: 'Communication, presentations, structured thinking, roleplay' },
  // ── Health Education Tracks ──────────────────────────────────────────────
  'family-medicine':  { name: 'Family Medicine',   icon: '🩺', desc: 'Clinical reasoning, patient assessment, differential diagnosis' },
  'pharmacy':         { name: 'Pharmacy',          icon: '💊', desc: 'Pharmacology, drug interactions, dosage calculations, counseling' },
  'physical-therapy': { name: 'Physical Therapy',  icon: '🦴', desc: 'Anatomy, rehab protocols, patient assessment, exercise science' },
  'nursing':          { name: 'Nursing',           icon: '🏥', desc: 'Patient care, clinical skills, pharmacology, NCLEX prep' },
  // ── Semiconductor / Hardware Engineering Tracks ──────────────────────────
  'rtl-design':       { name: 'RTL Design',        icon: '⚡', desc: 'Verilog/SystemVerilog, FSMs, pipelines, verification, UVM' },
  'physical-design':  { name: 'Physical Design',   icon: '🔬', desc: 'RTL-to-GDS flow, floorplan, placement, timing closure, signoff' },
  'lab-debug':        { name: 'Lab Tools & Debug',  icon: '🛠️', desc: 'Oscilloscope, logic analyzer, board bring-up, signal integrity' },
};

// ─── Skills topics ──────────────────────────────────────────────────────────

export const SKILLS_TOPICS = [
  { id: 'python',         name: 'Python',        icon: '🐍', desc: 'Scripting, data science, automation' },
  { id: 'javascript',    name: 'JavaScript',    icon: '⚡', desc: 'Web dev, Node.js, React' },
  { id: 'cpp',           name: 'C++',           icon: '⚙️', desc: 'Systems, performance, embedded' },
  { id: 'java',          name: 'Java',          icon: '☕', desc: 'Enterprise, Android, Spring' },
  { id: 'verilog',       name: 'Verilog',       icon: '🔌', desc: 'RTL design, FPGA, digital logic' },
  { id: 'systemverilog', name: 'SystemVerilog', icon: '🔬', desc: 'Verification, UVM, advanced RTL' },
  { id: 'sql',           name: 'SQL',           icon: '🗄️', desc: 'Databases, queries, analysis' },
];

// ─── Subject card gradients ─────────────────────────────────────────────────

export const SUBJECT_CARD_GRADIENTS = {
  reading:    ['#1D4ED8', '#5B21B6'],
  writing:    ['#065F46', '#0369A1'],
  math:       ['#5B21B6', '#A21CAF'],
  spelling:   ['#92400E', '#B45309'],
  social:     ['#9D174D', '#6B21A8'],
  logic:      ['#312E81', '#4F46E5'],
  languages:  ['#075985', '#0E7490'],
  'test-prep':  ['#991B1B', '#C2410C'],
  career:       ['#7C2D12', '#92400E'],
  chemistry:    ['#0E7490', '#1D4ED8'],
  physics:      ['#5B21B6', '#7C3AED'],
  programming:  ['#1E293B', '#334155'],
  economics:    ['#065F46', '#059669'],
  engineering:  ['#92400E', '#B45309'],
  'study-skills':['#9F1239', '#BE123C'],
  'ai-data-science': ['#4C1D95', '#3730A3'],
  science:      ['#065F46', '#0891B2'],
  'social-studies':['#7E22CE', '#9333EA'],
  // ── Professional & Academic Tracks ──────────────────────────────────────
  'college':       ['#4338CA', '#6366F1'],
  'law':           ['#7C2D12', '#9A3412'],
  'accounting':    ['#065F46', '#047857'],
  'cpa':           ['#1E3A5F', '#2563EB'],
  'pro-coaching':  ['#6B21A8', '#9333EA'],
  // ── Health Education Tracks ──────────────────────────────────────────────
  'family-medicine':  ['#991B1B', '#DC2626'],
  'pharmacy':         ['#5B21B6', '#7C3AED'],
  'physical-therapy': ['#065F46', '#059669'],
  'nursing':          ['#1E40AF', '#3B82F6'],
  // ── Semiconductor / Hardware Engineering Tracks ──────────────────────────
  'rtl-design':       ['#1E3A5F', '#2563EB'],
  'physical-design':  ['#064E3B', '#047857'],
  'lab-debug':        ['#78350F', '#B45309'],
};

// ─── Main subjects definition (icon names as strings) ───────────────────────

export const SUBJECTS = {
  'reading': {
    name: 'Reading',
    icon: 'BookOpen',
    color: 'from-blue-400 to-blue-600',
    levels: {
      '4-6': ['ABC Letters', 'Letter Sounds', 'Simple Words', 'Short Sentences', 'Chapter Books'],
      '7-9': ['Reading Fluency', 'Story Elements', 'Main Idea', 'Making Inferences', 'Advanced Reading'],
      '10-13': ['Complex Texts', 'Literary Devices', 'Critical Analysis', 'Research Skills'],
      '14-18': ['Advanced Literature', 'Rhetorical Analysis', 'Academic Writing', 'College Prep']
    }
  },
  'writing': {
    name: 'Writing',
    icon: 'Pencil',
    color: 'from-green-400 to-green-600',
    levels: {
      '4-6': ['Drawing Letters', 'First Words', 'Simple Sentences', 'Short Stories', 'Creative Stories'],
      '7-9': ['Paragraphs', 'Story Writing', 'Descriptive Writing', 'Essay Basics', 'Creative Essays'],
      '10-13': ['Essay Structure', 'Argumentative Writing', 'Research Papers', 'Creative Writing', 'Advanced Writing'],
      '14-18': ['Advanced Essays', 'Literary Analysis', 'College Essays', 'Professional Writing', 'Publication Ready']
    }
  },
  'math': {
    name: 'Math',
    icon: 'Calculator',
    color: 'from-purple-400 to-purple-600',
    levels: {
      '4-6': ['Counting 1-10', 'Simple Addition', 'Basic Subtraction', 'Number Recognition', 'Math Mastery'],
      '7-9': ['Multiplication', 'Division', 'Fractions', 'Word Problems', 'Advanced Problems'],
      '10-13': ['Pre-Algebra', 'Algebra Basics', 'Geometry', 'Statistics', 'Advanced Math'],
      '14-18': ['Algebra 1', 'Geometry', 'Algebra 2', 'Pre-Calculus', 'Calculus', 'SAT Math Prep']
    }
  },
  'spelling': {
    name: 'Spelling',
    icon: 'Book',
    color: 'from-yellow-400 to-orange-500',
    levels: {
      '4-6': ['3-Letter Words', '4-Letter Words', 'Simple Phonics', 'Sight Words', 'Advanced Words'],
      '7-9': ['Common Words', 'Vowel Patterns', 'Prefixes/Suffixes', 'Spelling Rules', 'Complex Words'],
      '10-13': ['Advanced Words', 'Root Words', 'Greek/Latin Roots', 'Vocabulary', 'Etymology'],
      '14-18': ['SAT Vocabulary', 'Academic Terms', 'Technical Terms', 'Etymology', 'Advanced Vocabulary']
    }
  },
  'social': {
    name: 'Social Skills',
    icon: 'Users',
    color: 'from-pink-400 to-pink-600',
    levels: {
      '4-6': ['Sharing', 'Taking Turns', 'Being Kind', 'Making Friends', 'Social Mastery'],
      '7-9': ['Teamwork', 'Empathy', 'Conflict Resolution', 'Communication', 'Advanced Social'],
      '10-13': ['Leadership', 'Peer Relationships', 'Self-Awareness', 'Respect', 'Social Intelligence'],
      '14-18': ['Networking', 'Professional Skills', 'Emotional Intelligence', 'Cultural Awareness', 'Advanced Social']
    }
  },
  'logic': {
    name: 'Logic & Reasoning',
    icon: 'Puzzle',
    color: 'from-indigo-400 to-indigo-600',
    levels: {
      '4-6': ['Patterns', 'Matching', 'Sorting', 'Simple Puzzles', 'Logic Master'],
      '7-9': ['Logical Sequences', 'Problem Solving', 'Critical Thinking', 'Deduction', 'Advanced Logic'],
      '10-13': ['Abstract Reasoning', 'Strategy Games', 'Logic Puzzles', 'Hypothesis Testing', 'Expert Logic'],
      '14-18': ['Formal Logic', 'Scientific Method', 'Philosophical Reasoning', 'Debate Skills', 'Master Reasoning']
    }
  },
  'languages': {
    name: 'Languages',
    icon: 'Globe',
    color: 'from-cyan-400 to-blue-500',
    levels: {
      '4-6': ['Basic Words', 'Colors & Numbers', 'Simple Phrases', 'Songs & Games'],
      '7-9': ['Greetings', 'Family & Friends', 'Food & Hobbies', 'Simple Conversations'],
      '10-13': ['Grammar Basics', 'Reading & Writing', 'Intermediate Vocab', 'Culture'],
      '14-18': ['Advanced Grammar', 'Fluency Practice', 'Literature', 'Professional Language']
    }
  },
  'science': {
    name: 'Science',
    icon: 'FlaskConical',
    color: 'from-teal-400 to-emerald-500',
    levels: {
      '4-6': ['Living Things', 'Animals & Habitats', 'Plants & Growth', 'Weather & Seasons', 'Earth & Space'],
      '7-9': ['Life Science', 'Earth Science', 'Matter & Energy', 'Forces & Motion', 'Ecosystems'],
      '10-13': ['Biology', 'Chemistry Basics', 'Physics Basics', 'Earth Science', 'Scientific Method'],
      '14-18': ['Advanced Biology', 'Chemistry', 'Physics', 'Environmental Science', 'AP Science Prep']
    }
  },
  'social-studies': {
    name: 'Social Studies',
    icon: 'Globe',
    color: 'from-orange-400 to-amber-500',
    levels: {
      '4-6': ['My Community', 'Maps & Places', 'Families & Cultures', 'Holidays & Traditions', 'Our World'],
      '7-9': ['US Geography', 'World Cultures', 'American History', 'Government Basics', 'Economics'],
      '10-13': ['World History', 'US History', 'Civics', 'World Geography', 'Economics'],
      '14-18': ['AP History', 'Political Science', 'Global Issues', 'College Prep Social Studies', 'Advanced Topics']
    }
  },
  'test-prep': {
    name: 'Test Prep',
    icon: 'Target',
    color: 'from-red-400 to-orange-500',
    levels: {
      '4-6': ['Not applicable'],
      '7-9': ['Not applicable'],
      '10-13': ['Pre-SAT', 'PSAT Practice', 'Study Skills', 'Test Strategies'],
      '14-18': ['SAT/ACT Prep', 'AP Exams', 'IELTS/TOEFL', 'College Entrance']
    }
  },
  'career': {
    name: 'Career Planning',
    icon: 'Briefcase',
    color: 'from-purple-400 to-pink-500',
    levels: {
      '4-6': ['Dream Jobs', 'What I Like', 'Being Helpful', 'Growing Up'],
      '7-9': ['Interests', 'Strengths', 'Future Careers', 'Goal Setting'],
      '10-13': ['Career Exploration', 'Skills Assessment', 'Education Planning', 'Career Paths'],
      '14-18': ['Career Strategy', 'Market Analysis', 'Action Plans', 'Success Roadmap']
    }
  },
  'chemistry': {
    name: 'Chemistry',
    icon: 'FlaskConical',
    color: 'from-cyan-500 to-blue-600',
    levels: {
      '4-6': [],
      '7-9': [],
      '10-13': ['Matter & Atoms', 'Periodic Table', 'Chemical Bonds', 'Reactions', 'States of Matter'],
      '14-18': ['Atomic Structure', 'Bonding & Geometry', 'Stoichiometry', 'Reactions & Kinetics', 'Thermochemistry', 'Acids & Bases', 'Equilibrium', 'Electrochemistry', 'Organic Chemistry']
    }
  },
  'physics': {
    name: 'Physics',
    icon: 'Atom',
    color: 'from-violet-500 to-purple-600',
    levels: {
      '4-6': [],
      '7-9': ['Forces & Motion', 'Energy', 'Electricity Basics', 'Light & Sound'],
      '10-13': ['Kinematics', "Newton's Laws", 'Work & Energy', 'Waves & Sound'],
      '14-18': ['Advanced Kinematics', 'Dynamics', 'Momentum & Collisions', 'Circular Motion', 'Waves & Optics', 'Electricity & Magnetism', 'Thermodynamics', 'Modern Physics']
    }
  },
  'programming': {
    name: 'Programming',
    icon: 'Code2',
    color: 'from-slate-600 to-slate-800',
    levels: {
      '4-6': [],
      '7-9': ['Scratch & Sequences', 'Loops & Logic'],
      '10-13': ['Python Basics', 'Variables & Loops', 'Functions', 'Simple Projects'],
      '14-18': ['Python Advanced', 'JavaScript', 'Data Structures', 'Algorithms', 'OOP', 'Databases', 'Web Dev']
    }
  },
  'economics': {
    name: 'Economics',
    icon: 'TrendingUp',
    color: 'from-emerald-500 to-green-700',
    levels: {
      '4-6': [],
      '7-9': [],
      '10-13': ['Money & Trade', 'Supply & Demand', 'Jobs & Careers'],
      '14-18': ['Microeconomics', 'Macroeconomics', 'Market Structures', 'GDP & Indicators', 'Monetary Policy', 'Fiscal Policy', 'International Trade']
    }
  },
  'engineering': {
    name: 'Engineering',
    icon: 'Wrench',
    color: 'from-amber-500 to-orange-600',
    levels: {
      '4-6': [],
      '7-9': ['Simple Machines', 'Bridges & Structures'],
      '10-13': ['Engineering Design', 'Mechanics Basics', 'Circuits Basics'],
      '14-18': ['Mechanics', 'Electrical Circuits', 'Materials Science', 'Systems Design', 'Thermodynamics']
    }
  },
  'study-skills': {
    name: 'Study Skills',
    icon: 'Brain',
    color: 'from-rose-400 to-pink-600',
    levels: {
      '4-6': ['Memory Games', 'Listening Skills'],
      '7-9': ['Note Taking', 'Study Habits', 'Memory Tricks'],
      '10-13': ['Note Taking Strategies', 'Memory Techniques', 'Test Prep', 'Organized Study'],
      '14-18': ['Cornell Notes', 'Spaced Repetition', 'Exam Strategies', 'Time Management', 'Research Methods']
    }
  },
  'ai-data-science': {
    name: 'AI & Data Science',
    icon: 'Cpu',
    color: 'from-purple-600 to-indigo-700',
    levels: {
      '4-6': [],
      '7-9': [],
      '10-13': [],
      '14-18': ['Data Foundations', 'Statistics & Probability', 'Python for Data', 'Machine Learning Basics', 'Neural Networks', 'AI Ethics & Applications', 'Data Science Capstone']
    }
  }
};

// ─── Advanced topics ────────────────────────────────────────────────────────

export const ADVANCED_TOPICS = {
  'math': [
    { id: 'algebra', name: 'Algebra', icon: '📐', description: 'Equations, functions, factoring' },
    { id: 'geometry', name: 'Geometry', icon: '📏', description: 'Shapes, proofs, theorems' },
    { id: 'trigonometry', name: 'Trigonometry', icon: '📊', description: 'Sin, cos, tan, identities' },
    { id: 'precalculus', name: 'Pre-Calculus', icon: '📈', description: 'Limits, functions, graphing' },
    { id: 'calculus', name: 'Calculus', icon: '∫', description: 'Derivatives, integrals, chain rule' },
    { id: 'statistics', name: 'Statistics', icon: '📉', description: 'Probability, distributions, data analysis' },
    { id: 'sat-math', name: 'SAT Math Prep', icon: '🎯', description: 'Test strategies, practice' },
    { id: 'calculus-2', name: 'Calculus II', icon: '∫∫', description: 'Integration techniques, series, multivariable intro' },
    { id: 'linear-algebra', name: 'Linear Algebra', icon: '⬛', description: 'Matrices, vectors, eigenvalues, transformations' },
    { id: 'discrete-math', name: 'Discrete Math', icon: '🔢', description: 'Logic, sets, graph theory, combinatorics, proofs' },
    { id: 'probability', name: 'Probability', icon: '🎲', description: 'Distributions, expected value, conditional probability, Bayes' },
    { id: 'differential-eq', name: 'Differential Equations', icon: '∂', description: 'ODEs, separation of variables, linear equations' }
  ],
  'writing': [
    { id: 'creative', name: 'Creative Writing', icon: '✍️', description: 'Stories, poetry, fiction' },
    { id: 'essays', name: 'Essay Writing', icon: '📝', description: 'Argumentative, persuasive' },
    { id: 'grammar', name: 'Grammar & Style', icon: '📖', description: 'Rules, punctuation, clarity' },
    { id: 'research', name: 'Research Papers', icon: '🔍', description: 'Citations, thesis, structure' },
    { id: 'college-essays', name: 'College Essays', icon: '🎓', description: 'Personal statements, supplements' },
    { id: 'apa-mla', name: 'APA & MLA Citation', icon: '📑', description: 'In-text citations, reference lists, formatting' },
    { id: 'argumentation', name: 'Argument Development', icon: '⚖️', description: 'Thesis, evidence, counterarguments, logical structure' },
    { id: 'editing', name: 'Editing & Proofreading', icon: '✏️', description: 'Clarity, concision, grammar, peer review strategies' }
  ],
  'languages': [
    { id: 'english', name: 'English', icon: '🇺🇸', description: 'Learn English vocabulary, grammar, conversation' },
    { id: 'spanish', name: 'Spanish', icon: '🇪🇸', description: 'Learn Spanish vocabulary, grammar, conversation' },
    { id: 'french', name: 'French', icon: '🇫🇷', description: 'Learn French vocabulary, grammar, conversation' },
    { id: 'japanese', name: 'Japanese', icon: '🇯🇵', description: 'Learn Japanese (Hiragana, Katakana, Kanji)' },
    { id: 'mandarin', name: 'Mandarin Chinese', icon: '🇨🇳', description: 'Learn Mandarin (Pinyin, characters, tones)' },
    { id: 'german', name: 'German', icon: '🇩🇪', description: 'Learn German vocabulary, grammar, conversation' },
    { id: 'italian', name: 'Italian', icon: '🇮🇹', description: 'Learn Italian vocabulary, grammar, conversation' },
    { id: 'korean', name: 'Korean', icon: '🇰🇷', description: 'Learn Korean (Hangul, vocabulary, grammar)' }
  ],
  'test-prep': [
    { id: 'ielts', name: 'IELTS', icon: '🎓', description: 'Reading, Writing, Listening, Speaking preparation' },
    { id: 'toefl', name: 'TOEFL', icon: '📚', description: 'Reading, Listening, Speaking, Writing sections' },
    { id: 'sat', name: 'SAT', icon: '📝', description: 'Math, Reading, Writing & Language sections' },
    { id: 'act', name: 'ACT', icon: '✍️', description: 'English, Math, Reading, Science, Writing' },
    { id: 'ap', name: 'AP Exams', icon: '🏆', description: 'Advanced Placement exam preparation' },
    { id: 'gre', name: 'GRE', icon: '🎯', description: 'Graduate Record Examination prep' }
  ],
  'science': [
    { id: 'cell-biology', name: 'Cell Biology', icon: '🦠', description: 'Organelles, cell cycle, mitosis, meiosis, cell membranes' },
    { id: 'genetics', name: 'Genetics', icon: '🧬', description: 'DNA, RNA, protein synthesis, Punnett squares, inheritance' },
    { id: 'evolution', name: 'Evolution', icon: '🦕', description: 'Natural selection, speciation, phylogenetics, adaptation' },
    { id: 'ecology', name: 'Ecology', icon: '🌳', description: 'Ecosystems, food webs, biomes, population dynamics' },
    { id: 'human-biology', name: 'Human Biology', icon: '🫁', description: 'Body systems: circulatory, respiratory, nervous, immune' },
    { id: 'microbiology', name: 'Microbiology', icon: '🔬', description: 'Bacteria, viruses, fungi, immune response, antibiotics' }
  ],
  'chemistry': [
    { id: 'atomic-structure', name: 'Atomic Structure', icon: '⚛️', description: 'Protons, neutrons, electrons, orbitals, quantum numbers' },
    { id: 'periodic-table', name: 'Periodic Table', icon: '📋', description: 'Periods, groups, element trends, electron configuration' },
    { id: 'bonding', name: 'Chemical Bonding', icon: '🔗', description: 'Ionic, covalent, metallic bonds, VSEPR geometry' },
    { id: 'stoichiometry', name: 'Stoichiometry', icon: '⚖️', description: 'Mole calculations, limiting reagents, percent yield' },
    { id: 'reactions', name: 'Chemical Reactions', icon: '💥', description: 'Types, balancing equations, predicting products' },
    { id: 'acids-bases', name: 'Acids & Bases', icon: '🧪', description: 'pH scale, buffers, titration, Bronsted-Lowry theory' },
    { id: 'thermochemistry', name: 'Thermochemistry', icon: '🌡️', description: 'Enthalpy, entropy, Gibbs free energy, Hess\'s law' },
    { id: 'equilibrium', name: 'Equilibrium', icon: '↔️', description: 'Le Chatelier\'s principle, Keq, ICE tables' },
    { id: 'electrochemistry', name: 'Electrochemistry', icon: '⚡', description: 'Galvanic cells, electrolysis, standard reduction potential' },
    { id: 'organic', name: 'Organic Chemistry', icon: '🧬', description: 'Functional groups, nomenclature, basic reactions' }
  ],
  'physics': [
    { id: 'kinematics', name: 'Kinematics', icon: '🏃', description: 'Displacement, velocity, acceleration, projectile motion' },
    { id: 'newtons-laws', name: "Newton's Laws", icon: '🍎', description: 'Forces, friction, free body diagrams, Newton\'s 3 laws' },
    { id: 'energy', name: 'Work & Energy', icon: '⚡', description: 'KE, PE, conservation of energy, power, efficiency' },
    { id: 'momentum', name: 'Momentum & Collisions', icon: '💥', description: 'Impulse, elastic/inelastic collisions, conservation' },
    { id: 'circular', name: 'Circular Motion & Gravity', icon: '🌍', description: 'Centripetal force, gravitational fields, Kepler\'s laws' },
    { id: 'waves', name: 'Waves & Sound', icon: '🌊', description: 'Frequency, wavelength, interference, Doppler effect' },
    { id: 'electricity', name: 'Electricity', icon: '🔌', description: "Charge, current, voltage, resistance, Ohm's law, circuits" },
    { id: 'magnetism', name: 'Magnetism & EMF', icon: '🧲', description: 'Magnetic fields, Faraday\'s law, electromagnetic induction' },
    { id: 'optics', name: 'Optics', icon: '🔭', description: 'Reflection, refraction, lenses, mirrors, diffraction' },
    { id: 'modern', name: 'Modern Physics', icon: '💫', description: 'Quantum mechanics, special relativity, atomic models, nuclear' }
  ],
  'programming': [
    { id: 'python', name: 'Python', icon: '🐍', description: 'Variables, loops, functions, lists, dictionaries, OOP' },
    { id: 'javascript', name: 'JavaScript', icon: '⚡', description: 'DOM, events, async/await, ES6+, Node.js basics' },
    { id: 'java', name: 'Java', icon: '☕', description: 'OOP, classes, inheritance, generics, collections' },
    { id: 'cpp', name: 'C++', icon: '⚙️', description: 'Pointers, memory management, STL, systems programming' },
    { id: 'algorithms', name: 'Algorithms', icon: '🔍', description: 'Sorting, searching, time complexity, Big-O notation' },
    { id: 'data-structures', name: 'Data Structures', icon: '🏗️', description: 'Arrays, linked lists, stacks, queues, trees, graphs' },
    { id: 'sql', name: 'SQL & Databases', icon: '🗄️', description: 'Queries, joins, aggregation, normalization, design' },
    { id: 'web-dev', name: 'Web Development', icon: '🌐', description: 'HTML, CSS, JavaScript, React basics, REST APIs' },
    { id: 'oop', name: 'OOP Principles', icon: '🧩', description: 'Encapsulation, inheritance, polymorphism, design patterns' },
    { id: 'debugging', name: 'Debugging & Testing', icon: '🐛', description: 'Debugging strategies, unit testing, code review, optimization' }
  ],
  'economics': [
    { id: 'supply-demand', name: 'Supply & Demand', icon: '📈', description: 'Price elasticity, market equilibrium, curve shifts' },
    { id: 'market-structures', name: 'Market Structures', icon: '🏭', description: 'Perfect competition, monopoly, oligopoly, monopolistic competition' },
    { id: 'consumer-theory', name: 'Consumer Theory', icon: '🛍️', description: 'Utility maximization, budget constraints, rational choice' },
    { id: 'macroeconomics', name: 'Macroeconomics', icon: '🌍', description: 'GDP, unemployment, inflation, business cycles, AS-AD model' },
    { id: 'monetary-policy', name: 'Monetary Policy', icon: '💵', description: 'Federal Reserve, interest rates, money supply, quantitative easing' },
    { id: 'fiscal-policy', name: 'Fiscal Policy', icon: '🏛️', description: 'Government spending, taxation, deficit, national debt, multiplier' },
    { id: 'international-econ', name: 'International Economics', icon: '✈️', description: 'Comparative advantage, trade, exchange rates, globalization' }
  ],
  'engineering': [
    { id: 'mechanics', name: 'Mechanics', icon: '⚙️', description: 'Statics, dynamics, stress & strain, beams and trusses' },
    { id: 'circuits', name: 'Electrical Circuits', icon: '🔌', description: "Ohm's law, Kirchhoff's laws, AC/DC, capacitors, op-amps" },
    { id: 'materials', name: 'Materials Science', icon: '🔩', description: 'Stress-strain curves, polymers, metals, semiconductors' },
    { id: 'systems', name: 'Systems Engineering', icon: '🔄', description: 'Control theory, feedback loops, system modeling, transfer functions' },
    { id: 'design-thinking', name: 'Design Thinking', icon: '💡', description: 'Problem framing, ideation, prototyping, user testing, iteration' },
    { id: 'thermodynamics-eng', name: 'Engineering Thermodynamics', icon: '🌡️', description: 'Heat engines, Rankine/Carnot cycles, efficiency, entropy' }
  ],
  'study-skills': [
    { id: 'note-taking', name: 'Note Taking', icon: '📝', description: 'Cornell notes, mind maps, structured outlines, annotation strategies' },
    { id: 'memory', name: 'Memory Techniques', icon: '🧠', description: 'Mnemonics, spaced repetition, active recall, chunking, memory palace' },
    { id: 'exam-prep', name: 'Exam Preparation', icon: '📚', description: 'Study plans, practice tests, test-taking strategies, managing anxiety' },
    { id: 'time-management', name: 'Time Management', icon: '⏰', description: 'Pomodoro technique, priority matrices, planning, beating procrastination' },
    { id: 'reading-strategies', name: 'Academic Reading', icon: '📖', description: 'SQ3R, annotation, skimming vs close reading, source evaluation' },
    { id: 'critical-thinking', name: 'Critical Thinking', icon: '🤔', description: 'Logic, cognitive fallacies, argument analysis, evidence evaluation' }
  ],
  'ai-data-science': [
    { id: 'data-analysis', name: 'Data Analysis', icon: '📊', description: 'Exploring datasets, finding patterns, descriptive statistics, data cleaning' },
    { id: 'statistics', name: 'Statistics', icon: '📈', description: 'Probability, distributions, hypothesis testing, correlation, regression' },
    { id: 'python-data', name: 'Python for Data', icon: '🐍', description: 'pandas, numpy, matplotlib — practical data manipulation and visualization' },
    { id: 'ml-supervised', name: 'Supervised Learning', icon: '🤖', description: 'Linear/logistic regression, decision trees, random forests, SVMs' },
    { id: 'ml-unsupervised', name: 'Unsupervised Learning', icon: '🔍', description: 'K-means clustering, PCA, dimensionality reduction, anomaly detection' },
    { id: 'neural-networks', name: 'Neural Networks', icon: '🧠', description: 'Perceptrons, layers, activation functions, backpropagation, CNNs' },
    { id: 'deep-learning', name: 'Deep Learning', icon: '⚡', description: 'Architectures (CNN, RNN, Transformer), training tricks, transfer learning' },
    { id: 'nlp', name: 'NLP', icon: '💬', description: 'Tokenization, embeddings, sentiment analysis, language models, ChatGPT' },
    { id: 'model-evaluation', name: 'Model Evaluation', icon: '📏', description: 'Accuracy, precision, recall, F1, cross-validation, overfitting/underfitting' },
    { id: 'ai-ethics', name: 'AI Ethics', icon: '⚖️', description: 'Bias, fairness, transparency, privacy, societal impact, responsible AI' }
  ],
  // ── Professional & Academic Tracks ──────────────────────────────────────
  'college': [
    { id: 'intro-accounting',    name: 'Intro Accounting',        icon: '📊', description: 'Accounting equation, debits/credits, T-accounts, financial statements' },
    { id: 'business-writing',    name: 'Business Writing',        icon: '✍️', description: 'Memos, reports, proposals, professional tone, clarity' },
    { id: 'economics-101',       name: 'Economics',               icon: '📈', description: 'Micro/macro fundamentals, supply and demand, market structures, GDP' },
    { id: 'statistics',          name: 'Statistics',              icon: '📉', description: 'Probability, distributions, hypothesis testing, regression, data analysis' },
    { id: 'algebra-calculus',    name: 'Algebra & Calculus',      icon: '∫',  description: 'College algebra, functions, derivatives, integrals, applied math' },
    { id: 'essay-writing',       name: 'Essay Writing',           icon: '📝', description: 'Thesis development, argumentative essays, research papers, citations' },
    { id: 'study-skills-college',name: 'Reading & Study Skills',  icon: '📖', description: 'Active reading, note-taking, exam prep, time management for college' },
    { id: 'intro-finance',       name: 'Intro Finance',           icon: '💵', description: 'Time value of money, financial markets, risk and return, valuation basics' },
    { id: 'psychology',          name: 'Psychology',              icon: '🧠', description: 'Research methods, cognition, development, social psychology, abnormal psych' },
    { id: 'bio-chem',            name: 'Biology & Chemistry',     icon: '🧬', description: 'Cell biology, genetics, general chemistry, organic chemistry basics' },
  ],
  'law': [
    { id: 'legal-reading',        name: 'Legal Reading',              icon: '📖', description: 'Comprehending statutes, case opinions, and legal reasoning' },
    { id: 'case-briefing',        name: 'Case Briefing',              icon: '📋', description: 'IRAC method — extracting facts, issues, holdings, and reasoning' },
    { id: 'issue-spotting',       name: 'Issue Spotting',             icon: '🔍', description: 'Identifying legal issues in fact patterns, exam technique' },
    { id: 'legal-writing',        name: 'Legal Writing',              icon: '✍️', description: 'Memos, briefs, persuasive writing, citation format' },
    { id: 'contract-vocab',       name: 'Contract Vocabulary',        icon: '📜', description: 'Consideration, breach, indemnity, force majeure, and key contract terms' },
    { id: 'legal-reasoning',      name: 'Structured Reasoning',       icon: '⚖️', description: 'Rule application, analogical reasoning, policy arguments' },
    { id: 'legal-interview',      name: 'Legal Interview Prep',       icon: '🎯', description: 'OCI prep, behavioral questions, firm knowledge, fit interviews' },
    { id: 'legal-communication',  name: 'Professional Communication', icon: '💼', description: 'Client communication, workplace writing, law firm email etiquette' },
  ],
  'accounting': [
    { id: 'acct-concepts',       name: 'Accounting Concepts',     icon: '📚', description: 'Accounting equation, GAAP, accrual vs cash, double-entry bookkeeping' },
    { id: 'journal-entries',     name: 'Journal Entries',          icon: '📝', description: 'Debits, credits, adjusting entries, closing entries' },
    { id: 'financial-stmts',     name: 'Financial Statements',    icon: '📊', description: 'Balance sheet, income statement, cash flow, statement of equity' },
    { id: 'auditing',            name: 'Auditing Basics',          icon: '🔍', description: 'Audit process, internal controls, sampling, audit opinions' },
    { id: 'tax-fundamentals',    name: 'Tax Fundamentals',         icon: '🏛️', description: 'Individual and corporate taxation, deductions, tax planning basics' },
    { id: 'excel-workflow',      name: 'Excel & Workflow',         icon: '💻', description: 'VLOOKUP, pivot tables, IF/SUMIF, accounting software workflows' },
    { id: 'acct-interview',      name: 'Interview Prep',           icon: '🎯', description: 'Big 4 and public accounting interviews, technical and behavioral prep' },
    { id: 'client-explanation',  name: 'Client Explanation',       icon: '🗣️', description: 'Explaining financial concepts clearly to non-accountant clients' },
  ],
  'cpa': [
    { id: 'far',             name: 'FAR',                  icon: '📊', description: 'Financial Accounting and Reporting — GAAP, government, not-for-profit' },
    { id: 'aud',             name: 'AUD',                  icon: '🔍', description: 'Auditing and Attestation — audit procedures, ethics, reports' },
    { id: 'reg',             name: 'REG',                  icon: '🏛️', description: 'Regulation — federal taxation, business law, ethics' },
    { id: 'isc',             name: 'ISC',                  icon: '💻', description: 'Information Systems and Controls — IT governance, security, SOC reports' },
    { id: 'tcp',             name: 'TCP',                  icon: '📋', description: 'Tax Compliance and Planning — individual, corporate, partnership taxation' },
    { id: 'bar',             name: 'BAR',                  icon: '📈', description: 'Business Analysis and Reporting — cost accounting, analysis, planning' },
    { id: 'cpa-strategy',    name: 'Test Strategy',        icon: '🎯', description: 'Study plans, time management, test-taking technique, weak-area review' },
    { id: 'cpa-simulations', name: 'Task-Based Simulations', icon: '🖥️', description: 'Practice task-based simulations with guided walkthroughs' },
  ],
  'pro-coaching': [
    { id: 'communication',       name: 'Communication Coaching',  icon: '🗣️', description: 'Active listening, clarity, difficult conversations, feedback delivery' },
    { id: 'workplace-writing',   name: 'Workplace Writing',       icon: '✍️', description: 'Emails, reports, proposals, executive summaries' },
    { id: 'presentations',       name: 'Presentation Coaching',   icon: '📊', description: 'Slide structure, delivery, storytelling, handling Q&A' },
    { id: 'structured-thinking', name: 'Structured Thinking',     icon: '🧩', description: 'MECE, 2x2 frameworks, problem decomposition, decision-making' },
    { id: 'confidence',          name: 'Confidence Building',     icon: '💪', description: 'Self-advocacy, executive presence, overcoming imposter syndrome' },
    { id: 'roleplay',            name: 'Scenario Roleplay',       icon: '🎭', description: 'Salary negotiations, performance reviews, client meetings' },
    { id: 'industry-flows',      name: 'Industry Coaching',       icon: '🏢', description: 'Consulting, finance, tech, healthcare — domain-specific coaching' },
    { id: 'leadership',          name: 'Leadership Skills',       icon: '👥', description: 'Team management, delegation, 1-on-1s, mentoring junior staff' },
  ],
  // ── Health Education Tracks ──────────────────────────────────────────────
  'family-medicine': [
    { id: 'clinical-reasoning',   name: 'Clinical Reasoning',       icon: '🧠', description: 'Diagnostic thinking, hypothesis generation, Bayesian approach to diagnosis' },
    { id: 'patient-history',      name: 'Patient History',          icon: '📋', description: 'HPI, ROS, PMH, SH, FH — structured history taking and documentation' },
    { id: 'differential-dx',      name: 'Differential Diagnosis',   icon: '🔍', description: 'Generating and narrowing differentials systematically by organ system' },
    { id: 'chronic-disease',      name: 'Chronic Disease',          icon: '🩺', description: 'Diabetes, hypertension, COPD, CHF — management principles and guidelines' },
    { id: 'preventive-care',      name: 'Preventive Care',          icon: '🛡️', description: 'Screening guidelines, immunizations, counseling, USPSTF recommendations' },
    { id: 'lab-interpretation',   name: 'Lab Interpretation',       icon: '🔬', description: 'CBC, CMP, lipid panel, LFTs — reference ranges and clinical significance' },
    { id: 'patient-communication',name: 'Patient Communication',    icon: '🗣️', description: 'Motivational interviewing, breaking bad news, shared decision-making' },
    { id: 'evidence-based',       name: 'Evidence-Based Medicine',  icon: '📊', description: 'Study design, NNT, sensitivity/specificity, applying guidelines to patients' },
  ],
  'pharmacy': [
    { id: 'pharmacokinetics',     name: 'Pharmacokinetics',         icon: '📈', description: 'ADME — absorption, distribution, metabolism, excretion, half-life, Vd' },
    { id: 'drug-interactions',    name: 'Drug Interactions',        icon: '⚠️', description: 'CYP450 pathways, major interactions, clinical significance and management' },
    { id: 'dosage-calc',          name: 'Dosage Calculations',      icon: '🧮', description: 'Weight-based dosing, IV flow rates, unit conversions, dimensional analysis' },
    { id: 'top-200-drugs',        name: 'Top 200 Drugs',            icon: '💊', description: 'Most prescribed medications — brand/generic, drug class, mechanism, use' },
    { id: 'counseling',           name: 'Patient Counseling',       icon: '🗣️', description: 'Medication counseling, adherence, side effect management, show-and-tell' },
    { id: 'compounding',          name: 'Compounding',              icon: '⚗️', description: 'Sterile and non-sterile compounding, USP <795>/<797> standards, calculations' },
    { id: 'pharmacy-law',         name: 'Pharmacy Law',             icon: '⚖️', description: 'DEA schedules, HIPAA, OBRA-90, state board regulations, controlled substances' },
    { id: 'otc-recommendations',  name: 'OTC Recommendations',      icon: '🏥', description: 'Self-care counseling, when to refer, OTC drug selection, triage approach' },
  ],
  'physical-therapy': [
    { id: 'musculoskeletal',      name: 'Musculoskeletal',          icon: '🦴', description: 'Anatomy, joint mechanics, orthopedic conditions, special tests' },
    { id: 'neurological-rehab',   name: 'Neurological Rehab',       icon: '🧠', description: 'Stroke, TBI, Parkinson\'s, MS — neuroplasticity and recovery principles' },
    { id: 'exercise-prescription',name: 'Exercise Prescription',    icon: '💪', description: 'FITT principle, periodization, progression, therapeutic exercise design' },
    { id: 'gait-analysis',        name: 'Gait Analysis',            icon: '🚶', description: 'Normal gait cycle, deviations, compensations, observational and quantitative' },
    { id: 'manual-therapy',       name: 'Manual Therapy',           icon: '🤲', description: 'Joint mobilization, soft tissue techniques, grades of mobilization, evidence base' },
    { id: 'patient-assessment',   name: 'Patient Assessment',       icon: '📋', description: 'Subjective and objective exam, outcome measures, functional assessments' },
    { id: 'documentation',        name: 'Clinical Documentation',   icon: '📝', description: 'SOAP notes, progress notes, discharge summaries, functional goals (SMART)' },
    { id: 'geriatric-pt',         name: 'Geriatric PT',             icon: '👴', description: 'Falls prevention, balance assessment, Berg Balance Scale, frailty management' },
  ],
  'nursing': [
    { id: 'patient-assessment',   name: 'Patient Assessment',       icon: '🔍', description: 'Head-to-toe assessment, vital signs interpretation, focused assessments' },
    { id: 'medication-admin',     name: 'Medication Administration',icon: '💊', description: 'Rights of medication administration, routes, safe injection, high-alert drugs' },
    { id: 'care-planning',        name: 'Care Planning',            icon: '📋', description: 'Nursing diagnoses (NANDA), care plans, goal-setting, ADPIE process' },
    { id: 'clinical-skills',      name: 'Clinical Skills',          icon: '🩺', description: 'IV insertion, catheterization, wound care, nasogastric tubes, trach care' },
    { id: 'nclex-prep',           name: 'NCLEX Prep',               icon: '📝', description: 'NGN format, select-all-that-apply, priority/delegation, pharmacology questions' },
    { id: 'critical-thinking',    name: 'Critical Thinking',        icon: '🧠', description: 'Clinical judgment, SBAR communication, recognizing deterioration, QSEN' },
    { id: 'patient-education',    name: 'Patient Education',        icon: '🗣️', description: 'Teach-back method, health literacy, discharge teaching, cultural competence' },
    { id: 'documentation',        name: 'Nursing Documentation',    icon: '💻', description: 'EHR charting, legal considerations, incident reports, accurate documentation' },
  ],
  // ── RTL Design ────────────────────────────────────────────────────────────
  'rtl-design': [
    { id: 'combinational-logic',  name: 'Combinational Logic',      icon: '🔗', description: 'Gates, mux/demux, encoders/decoders, adders, arithmetic circuits, synthesis implications' },
    { id: 'sequential-fsm',       name: 'Sequential Logic & FSMs',  icon: '🔄', description: 'Flip-flops, registers, Mealy vs Moore FSMs, state encoding, safe state machines' },
    { id: 'pipelines-datapath',   name: 'Pipelines & Datapath',     icon: '🚀', description: 'Pipeline stages, hazard detection, forwarding, stalls, throughput vs latency tradeoffs' },
    { id: 'fifo-protocols',       name: 'FIFOs & Bus Protocols',    icon: '📦', description: 'Sync/async FIFOs, full/empty flags, AXI, APB, AHB handshaking, ready/valid' },
    { id: 'clock-reset-cdc',      name: 'Clocking, Reset & CDC',    icon: '⏱️', description: 'Clock domains, synchronizers, FIFO-based CDC, metastability, reset strategy' },
    { id: 'rtl-coding-style',     name: 'RTL Coding Style',         icon: '💻', description: 'Synthesizable RTL, always_ff/always_comb, blocking vs nonblocking, lint rules, readability' },
    { id: 'testbench-sim',        name: 'Testbench & Simulation',   icon: '🧪', description: 'Writing testbenches, directed tests, self-checking, waveform review, VCS/Xcelium workflow' },
    { id: 'waveform-debug',       name: 'Waveform Debug',           icon: '📊', description: 'Reading waveforms, signal tracing, identifying bugs from simulation output, TCL scripting' },
    { id: 'assertions-coverage',  name: 'Assertions & Coverage',    icon: '✅', description: 'SVA immediate/concurrent assertions, functional coverage, covergroups, code coverage closure' },
    { id: 'uvm-foundations',      name: 'UVM Foundations',          icon: '🏗️', description: 'UVM architecture, agents/scoreboard/env, sequence/sequencer, factory, TLM ports' },
  ],
  // ── Physical Design ───────────────────────────────────────────────────────
  'physical-design': [
    { id: 'synthesis-handoff',    name: 'Synthesis & Handoff',      icon: '⚙️', description: 'Synthesis flow (Design Compiler/Genus), netlist QA, SDC constraints, area/timing tradeoffs' },
    { id: 'floorplan-power',      name: 'Floorplan & Power Planning',icon: '📐', description: 'Die/core area, macro placement, power domains, UPF/CPF, IR drop, power mesh strategy' },
    { id: 'placement',            name: 'Placement',                icon: '📍', description: 'Standard cell placement, congestion hot-spots, timing-driven placement, legalization' },
    { id: 'cts',                  name: 'Clock Tree Synthesis',     icon: '🌳', description: 'CTS goals, skew/latency targets, clock buffers/inverters, useful skew, gated clocks in CTS' },
    { id: 'routing-congestion',   name: 'Routing & Congestion',     icon: '🕸️', description: 'Global vs detailed routing, DRC violations, congestion maps, layer assignment, shielding' },
    { id: 'timing-closure',       name: 'Timing Closure',           icon: '⏰', description: 'Setup/hold analysis, critical path debug, ECO fixes, multi-corner/multi-mode, OCV/POCV' },
    { id: 'signoff-drc-lvs',      name: 'Signoff: DRC/LVS/STA',    icon: '✔️', description: 'Physical verification (Calibre), LVS debug, signoff STA (PrimeTime), timing reports' },
    { id: 'eco-debug',            name: 'ECO & Debug',              icon: '🔧', description: 'Functional/timing ECOs, metal fix, spare cell methodology, post-tapeout debug' },
  ],
  // ── Lab Tools & Debug ─────────────────────────────────────────────────────
  'lab-debug': [
    { id: 'oscilloscope',         name: 'Oscilloscope',             icon: '📡', description: 'Triggering, time/div, probe compensation, AC coupling, FFT, bandwidth limits, common probing mistakes' },
    { id: 'logic-analyzer',       name: 'Logic Analyzer',           icon: '🔍', description: 'Digital capture, protocol decode (SPI/I2C/UART), state vs timing mode, threshold settings' },
    { id: 'multimeter-power',     name: 'Multimeter & Power Supply', icon: '🔋', description: 'Voltage/current/resistance measurement, power sequencing, current measurement shunts, safety' },
    { id: 'waveform-reading',     name: 'Waveform Reading',         icon: '📈', description: 'Signal integrity concepts: ringing, overshoot, ground bounce, cross-talk, eye diagrams' },
    { id: 'serial-debug',         name: 'Serial & Debug Interfaces',icon: '🔌', description: 'UART/SPI/I2C debugging, JTAG/SWD, OpenOCD, GDB, register reads over debug interface' },
    { id: 'board-bringup',        name: 'Board Bring-Up',           icon: '🖥️', description: 'Power-on sequence, voltage rail checks, boot debug, schematic review vs reality' },
    { id: 'debug-workflow',       name: 'Structured Debug Workflow', icon: '🗺️', description: 'Hypothesis-driven debugging, divide-and-conquer, fault isolation, reproduce-then-fix methodology' },
    { id: 'signal-integrity',     name: 'Signal Integrity',         icon: '〰️', description: 'Transmission lines, termination, impedance matching, PCB stackup, differential signaling' },
  ],
};

// ─── Subject constraints ────────────────────────────────────────────────────

export const SUBJECT_CONSTRAINTS = {
  'math': 'ONLY ask math questions: counting, addition, subtraction, numbers. DO NOT ask about letters, spelling, or reading.',
  'reading': `ONLY ask reading questions: letters, sounds, words, sentences. DO NOT ask about math, counting, or numbers.
LISTENING EXERCISES (missing word / fill-in-the-blank):
- Put the COMPLETE sentence (with the answer filled in, no blank) in the "audioPrompt" field — the app will SPEAK it aloud so the child can hear it.
- Put the sentence WITH the blank (e.g. "The ___ is on the mat.") in study_board visual so the child can see it.
- coach_say should be a short instruction like "Listen carefully! What word is missing?"
- correctAnswer should be just the missing word.
Example: sentence "The cat is on the mat." → audioPrompt: "The cat is on the mat.", visual: "The ___ is on the mat.", correctAnswer: "cat"`,
  'spelling': `SPELLING RULES — READ CAREFULLY:
THE WORD TO SPELL MUST NEVER APPEAR AS VISIBLE TEXT ANYWHERE.
- coach_say: NEVER include the word. Use ONLY generic prompts like "Listen carefully and spell the word!" or "Great try! Listen again." or "Almost — try once more!"
- study_board visual: ALWAYS use visualType "audio-prompt" and visual "🔊 Listen!" — never put the word here.
- correctAnswer: put the word here (e.g. "cat") — this field is HIDDEN and spoken aloud by the app automatically.
- audioPrompt: put the word here too — this field is also HIDDEN and spoken aloud.
The app will read correctAnswer/audioPrompt and speak it for the student. You do NOT need to say the word — just set those hidden fields.
When student is wrong: set coach_say to "Almost! Listen again." and keep the same word in correctAnswer/audioPrompt — the app will re-speak it.`,
  'writing': 'ONLY ask writing questions: sentences, stories. DO NOT ask about math or reading.',
  'social': 'ONLY ask social skills questions: sharing, kindness, friends. DO NOT ask about math or reading.',
  'logic': 'ONLY ask logic questions: patterns, puzzles. DO NOT ask about math or reading.',
  'languages': 'ONLY teach the selected foreign language. This is BILINGUAL MODE: Instructions in user\'s profile language, teaching content in target language.',
  'science': `ONLY teach science. Use curiosity-driven Socratic teaching: ask "What do you think?" before explaining.
For young learners (4-9): use animals, plants, weather, and hands-on observations.
For older learners: connect concepts to real phenomena. Always ask ONE question, wait for student's attempt, THEN explain.
Use "steps" visualType for processes (water cycle, photosynthesis), "emoji" for counting organisms, "word" for science vocab.
Generate SHORT stories about science phenomena when teaching (e.g., "Maya the butterfly..."). Use visualType "story" for reading passages.`,
  'social-studies': `ONLY teach social studies: geography, history, cultures, government, economics.
Use storytelling to make history come alive — speak as if you're there. Start with a hook: "Imagine you lived in ancient Egypt..."
Use maps described in text, timelines as "steps" visualType, culture comparisons as "table" visualType.
Ask open-ended questions ("Why do you think people built walls?") before giving answers.
Generate age-appropriate historical stories using visualType "story". Always connect history to students' lives.`,
  'test-prep': 'ONLY ask test preparation questions.',
  'career': 'Act as a career counselor and personal advisor. Conduct comprehensive assessment, provide career analysis, create personalized plans.',
  'chemistry': `ONLY teach chemistry. Start every concept with a curiosity hook ("What do you think happens when iron rusts?").
Use visualType "chemistry-equation" for balanced equations and reactions. Use "steps" for calculation procedures (stoichiometry, pH, Keq).
Use "flashcard" for element symbols, ion names, and vocabulary (word = symbol/formula, translation = name/meaning, subtext = pronunciation).
Use "formula" for key equations (PV=nRT, ΔG=ΔH-TΔS): show formula, variable legend, and worked example.
Follow GIVEN → FIND → EQUATION → SOLVE format for all calculation problems.
NEVER give the answer directly — guide the student through each step with Socratic questions.
NEVER reveal the coefficient in a balancing problem — ask "how many of X do you need on each side?"`,
  'physics': `ONLY teach physics. Always describe a physical scenario before any math.
Use "formula" visualType to introduce equations — always show variable meanings and units.
Use "steps" for all problem solving: (1) Sketch & label, (2) List GIVEN values, (3) Identify FIND, (4) Choose equation, (5) Substitute, (6) Solve, (7) Check units.
Use "text" for ASCII free body diagrams: draw arrows with labels like "→ Applied Force   ← Friction   ↓ Weight".
Real-world first: "Why doesn't the Moon fall to Earth?" before universal gravitation equations.
ALWAYS verify units in every calculation. Never skip dimensional analysis.`,
  'programming': `ONLY teach programming. ALWAYS show code using "code-block" visualType — never describe code without showing it.
Teaching loop: show working code → explain each line → run through an example → ask "what if we change X?"
For debugging: use "code-block" with buggy code, ask "can you spot the bug?" before explaining.
Use "steps" for algorithm walkthroughs (trace code execution line by line with actual values).
Accept and encourage pseudocode from beginners. Celebrate creative solutions.
Connect code to output: "This prints each item — let's trace it with [1, 2, 3]: what happens at step 1?"
NEVER describe code without a "code-block" visual. Every lesson must show actual runnable code.`,
  'economics': `ONLY teach economics. Connect every concept to a real-world example the student knows.
Use "steps" to build supply/demand graphs: (1) Label axes Price vs Quantity, (2) Draw demand curve, (3) Draw supply curve, (4) Mark equilibrium, (5) Show a shift event.
Use "table" visualType to compare market structures, policy tools, or economic indicators side-by-side.
Use "flashcard" for key vocabulary (elastic, inelastic, deadweight loss, comparative advantage, multiplier).
Present tradeoffs honestly — never politically biased. Show BOTH sides of every policy debate.
Start with a hook: "Why did the price of eggs spike in 2023? Let's use economics to find out."`,
  'engineering': `ONLY teach engineering. Lead with a design challenge before any theory.
Use "steps" for free body diagrams (label all forces, apply ΣF=ma or ΣM=0), circuit analysis (KVL/KCL), and design processes.
Use "formula" for core equations (F=ma, V=IR, σ=F/A, Q=mcΔT). Always show units.
Use "code-block" for any programming or simulation-related engineering concepts.
Teach from failure: reference real engineering failures/successes (Tacoma Narrows, Apollo 13, Golden Gate).
Systems thinking: always ask "what are the inputs, the process, the outputs, and the feedback loop?"`,
  'study-skills': `ONLY teach study strategies and learning techniques. This is META-learning.
Demonstrate the technique WITHIN the lesson itself (use it while teaching it).
Give one specific, actionable item the student can try TODAY. Never be vague.
Ask what subject they are currently studying and personalize advice to that context.
Use "steps" to show techniques: Cornell notes layout, Pomodoro intervals, memory palace construction.
Use "text" to show before/after examples: "passive reading" vs "active recall" side by side.
End every turn with a concrete challenge: "Set a 25-minute timer and try this on your chemistry notes right now."`,
  'ai-data-science': `ONLY teach AI and data science. ALWAYS use "code-block" for Python code.
Use "formula" for math concepts (loss functions, Bayes' theorem, gradient descent) with a variable legend.
Use "steps" for algorithms: (1) Define the problem, (2) Prepare data, (3) Choose model, (4) Train, (5) Evaluate, (6) Iterate.
Teach via real datasets and real-world applications (Netflix recommendations, spam filters, medical diagnosis, ChatGPT).
Require students to interpret results, not just compute them — ask "What does this accuracy score MEAN?"
Weave in ethics naturally: when teaching any ML model, ask "Could this be biased? Who might it harm?"`
};

// ─── Assessment questions ───────────────────────────────────────────────────

export const ASSESSMENT_QUESTIONS = {
  'reading': {
    '4-6': [
      { question: "What letter is this?", questionKey: 'aq.letterWhat', visual: "A", visualType: "letter", level: 0, speak: "What letter is this?" },
      { question: "What sound does this make?", questionKey: 'aq.letterSound', visual: "M", visualType: "letter", level: 1, speak: "What sound does this letter make?" },
      { question: "What word starts with this letter?", questionKey: 'aq.letterStartWord', visual: "B", visualType: "letter", level: 2, speak: "Tell me a word that starts with B" }
    ],
    '7-9': [
      { question: "What happens in the middle of a story?", questionKey: 'aq.storyMiddle', level: 1 },
      { question: "Can you summarize a book you read?", questionKey: 'aq.storySummarize', level: 3 }
    ]
  },
  'math': {
    '4-6': [
      { question: "Count the frogs!", questionKey: 'aq.countFrogs', visual: { count: 3, emoji: '🐸' }, visualType: "emoji", level: 0, speak: "Count the frogs" },
      { question: "How many apples total?", questionKey: 'aq.applesTotal', visual: { count1: 3, count2: 2, emoji: '🍎' }, visualType: "addition-emoji", level: 2, speak: "How many apples total?" },
      { question: "Count the stars!", questionKey: 'aq.countStars', visual: { count: 10, emoji: '⭐' }, visualType: "emoji", level: 3, speak: "Count all the stars" }
    ],
    '7-9': [
      { question: "What is 7 × 8?", questionKey: 'aq.mult7x8', level: 1 },
      { question: "What is 1/2 + 1/4?", questionKey: 'aq.fraction', level: 3 }
    ]
  },
  'writing': {
    '4-6': [
      { question: "Tell me your name!", questionKey: 'aq.yourName', visualType: "none", level: 0, speak: "What's your name?" },
      { question: "Tell me a story!", questionKey: 'aq.tellStory', visualType: "none", level: 2, speak: "Tell me about your favorite toy" }
    ]
  },
  'spelling': {
    '4-6': [
      { question: "Listen and spell!", questionKey: 'aq.spellCat', visualType: "none", level: 1, speak: "Listen carefully. The word is: cat. Cat. Can you spell cat?" },
      { question: "Listen and spell!", questionKey: 'aq.spellDog', visualType: "none", level: 3, speak: "Listen carefully. The word is: dog. Dog. Can you spell dog?" }
    ]
  }
};

// ─── Visual processing ──────────────────────────────────────────────────────

export function normalizeStudyBoard(board) {
  if (!board) return board;

  // If `visual` is missing but the board itself looks like visual content
  // (e.g. {title, steps, highlight} or {word, translation, language}),
  // wrap it so the existing rendering logic works.
  if (!board.visual && !board.visualType) {
    const { audioPrompt, correctAnswer, visualColor, ...rest } = board;
    if (Object.keys(rest).length > 0) {
      board = { visual: rest, visualColor, audioPrompt, correctAnswer };
    }
  }

  const v = board.visual;
  // If already typed as 'choice', ensure visual is an array
  if (board.visualType === 'choice') {
    if (Array.isArray(v)) {
      return { ...board, visual: [...v].sort(() => Math.random() - 0.5) };
    }
    if (typeof v === 'string') {
      // AI returned a formatted string instead of an array — parse it
      const lines = v.split(/\n+/)
        .map(l => l.replace(/^[A-D][).]\s*|^\d+[).]\s*|^[•\-]\s*/u, '').trim())
        .filter(Boolean);
      if (lines.length >= 2) return { ...board, visual: lines };
      // Single-item or unparseable — fall back to text
      return { ...board, visualType: 'text' };
    }
  }
  if (!v || board.visualType) return board; // already has type, nothing to do

  // Infer visualType from the shape of `visual`
  if (Array.isArray(v)) {
    // Shuffle choices so the correct answer isn't always first (AI tends to put it first)
    const shuffled = [...v].sort(() => Math.random() - 0.5);
    board = { ...board, visual: shuffled, visualType: 'choice' };
  } else if (typeof v === 'object') {
    if (Array.isArray(v.steps))                     board = { ...board, visualType: 'steps' };
    else if (Array.isArray(v.rows))                 board = { ...board, visualType: 'table' };
    else if (v.word && v.translation)               board = { ...board, visualType: 'flashcard' };
    else if (Array.isArray(v.parts))                board = { ...board, visualType: 'word-parts' };
    else if (v.numerator !== undefined && v.denominator) board = { ...board, visualType: 'fraction' };
    else if (v.groups && v.itemsPerGroup)           board = { ...board, visualType: 'groups' };
    else if (Array.isArray(v.pattern))              board = { ...board, visualType: 'pattern' };
    else if (v.count !== undefined && v.emoji)      board = { ...board, visualType: 'emoji' };
    else if (v.count1 !== undefined && v.count2 !== undefined && v.emoji)
                                                    board = { ...board, visualType: 'addition-emoji' };
    else                                            board = { ...board, visualType: 'text' };
  } else {
    board = { ...board, visualType: 'text' };
  }

  return board;
}

export function createSmartVisual(questionText, subject) {
  const text = questionText.toLowerCase();

  // Foreign Language - Flashcard
  if (subject === 'languages') {
    // Detect if it's a translation question
    if (text.includes('spanish') || text.includes('french') || text.includes('japanese')) {
      // Extract the word/phrase to translate
      const wordMatch = text.match(/how.*say ["'](.+?)["']/i) ||
                       text.match(/what.*["'](.+?)["']/i);
      if (wordMatch) {
        return {
          visual: { word: wordMatch[1], language: 'en' },
          visualType: 'flashcard',
          visualColor: 'cyan'
        };
      }
    }

    // Default language visual
    return {
      visual: { word: 'Hello', translation: '¡Hola!', language: 'Spanish' },
      visualType: 'flashcard',
      visualColor: 'cyan'
    };
  }

  // Test Prep - Question format
  if (subject === 'test-prep') {
    return {
      visual: text.substring(0, 200),
      visualType: 'test-question',
      visualColor: 'red'
    };
  }

  // Math - Multiplication
  if (text.includes('×') || text.includes('*') || text.includes('multiply') || text.includes('times')) {
    const multMatch = text.match(/(\d+)\s*[×*]\s*(\d+)/) || text.match(/(\d+)\s+times\s+(\d+)/);
    if (multMatch) {
      const num1 = parseInt(multMatch[1]);
      const num2 = parseInt(multMatch[2]);

      // For young kids, use emoji grid
      if (subject === 'math' && num1 <= 5 && num2 <= 5) {
        return {
          visual: { rows: num1, cols: num2, emoji: '⭐' },
          visualType: 'multiplication-grid',
          visualColor: 'purple'
        };
      }

      // For older students, use text
      return {
        visual: `${num1} × ${num2}`,
        visualType: 'multiplication-text',
        visualColor: 'purple'
      };
    }

    // If no numbers found but asks for multiplication
    return {
      visual: '3 × 4',
      visualType: 'multiplication-text',
      visualColor: 'purple'
    };
  }

  // Reading/Letters
  if (subject === 'reading' || text.includes('letter')) {
    const letterMatch = text.match(/letter ([a-z])/i);
    if (letterMatch) {
      return {
        visual: letterMatch[1].toUpperCase(),
        visualType: 'letter',
        visualColor: 'blue'
      };
    }
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return {
      visual: letters[Math.floor(Math.random() * letters.length)],
      visualType: 'letter',
      visualColor: 'blue'
    };
  }

  // Spelling - AUDIO ONLY, don't show the word!
  if (subject === 'spelling' || text.includes('spell')) {
    const wordMatch = text.match(/spell ([a-z]+)/i);
    if (wordMatch) {
      return {
        visual: '🔊 Listen!',
        visualType: 'audio-prompt',
        visualColor: 'purple',
        audioWord: wordMatch[1] // Store word for TTS, but don't display it
      };
    }
    return {
      visual: '🔊 Listen carefully!',
      visualType: 'audio-prompt',
      visualColor: 'purple'
    };
  }

  // Math - Counting
  if (subject === 'math') {
    if (text.includes('count') || text.includes('how many')) {
      let emoji = '🔵';
      let count = 5;

      if (text.includes('frog')) emoji = '🐸';
      else if (text.includes('apple')) emoji = '🍎';
      else if (text.includes('star')) emoji = '⭐';
      else if (text.includes('dog')) emoji = '🐶';
      else if (text.includes('cat')) emoji = '🐱';
      else if (text.includes('ball')) emoji = '⚽';
      else if (text.includes('heart')) emoji = '❤️';

      const countMatch = text.match(/(\d+)/);
      if (countMatch) {
        count = parseInt(countMatch[1]);
      }

      return {
        visual: { count: Math.min(count, 10), emoji: emoji },
        visualType: 'emoji',
        visualColor: 'blue'
      };
    }

    if (text.includes('+') || text.includes('add') || text.includes('plus')) {
      const addMatch = text.match(/(\d+)\s*[+]\s*(\d+)/);
      if (addMatch) {
        return {
          visual: { count1: parseInt(addMatch[1]), count2: parseInt(addMatch[2]), emoji: '🍎' },
          visualType: 'addition-emoji',
          visualColor: 'red'
        };
      }
    }

    // Subtraction detection
    if (text.includes('-') || text.includes('subtract') || text.includes('minus') || text.includes('take away')) {
      const subMatch = text.match(/(\d+)\s*[-−]\s*(\d+)/);
      if (subMatch) {
        return {
          visual: { count1: parseInt(subMatch[1]), count2: parseInt(subMatch[2]), emoji: '🍎' },
          visualType: 'subtraction-emoji',
          visualColor: 'blue'
        };
      }
      // If no numbers found but asks for subtraction
      return {
        visual: { count1: 5, count2: 2, emoji: '🍎' },
        visualType: 'subtraction-emoji',
        visualColor: 'blue'
      };
    }

    return {
      visual: { count: 3, emoji: '🔢' },
      visualType: 'emoji',
      visualColor: 'blue'
    };
  }

  return {
    visual: questionText.substring(0, 100),
    visualType: 'text',
    visualColor: 'gray'
  };
}

// ─── Response processing pipeline ───────────────────────────────────────────

export function processTeachingResponse(aiResponseText, currentSubject, currentStudyBoard) {
  try {
    const sunnyResponse = extractJSON(aiResponseText);
    validateSunnyResponse(sunnyResponse);

    sunnyResponse.study_board = normalizeStudyBoard(sunnyResponse.study_board);
    if (!sunnyResponse.study_board || !sunnyResponse.study_board.visual || sunnyResponse.study_board.visualType === 'none') {
      sunnyResponse.study_board = createSmartVisual(sunnyResponse.coach_say, currentSubject);
    }

    const wasCorrect = sunnyResponse.graded === 'correct' || sunnyResponse.state === 'advance';
    const isWrong = sunnyResponse.graded === 'incorrect';

    return {
      success: true,
      coachSay: sunnyResponse.coach_say,
      studyBoard: {
        ...sunnyResponse.study_board,
        audioPrompt: sunnyResponse.audioPrompt,
        correctAnswer: sunnyResponse.correctAnswer,
      },
      wasCorrect,
      isWrong,
      graded: sunnyResponse.graded,
      state: sunnyResponse.state,
      conceptCompleted: sunnyResponse.conceptCompleted,
      raw: sunnyResponse,
    };
  } catch (error) {
    // Fallback: try to extract coach_say from broken JSON
    const coachSayMatch = aiResponseText.match(/"coach_say"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const fallbackCoachSay = coachSayMatch ? coachSayMatch[1] : "Let's keep going! What do you think?";
    const fallbackBoard = currentSubject === 'accent' ? null : createSmartVisual(aiResponseText, currentSubject);
    const wasCorrect = /"graded"\s*:\s*"correct"/.test(aiResponseText);

    return {
      success: false,
      coachSay: fallbackCoachSay,
      studyBoard: fallbackBoard ? { ...fallbackBoard, audioPrompt: null, correctAnswer: null } : null,
      wasCorrect,
      isWrong: false,
      graded: null,
      state: null,
      raw: null,
    };
  }
}
