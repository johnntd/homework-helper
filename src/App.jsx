import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Send, Sparkles, BookOpen, Trash2, Home, Mic, MicOff, Users, Book, Pencil, Hash, Lightbulb, Volume2, VolumeX } from 'lucide-react';
import CoachSay from './components/CoachSay';
import StudyBoard from './components/StudyBoard';
import AuthScreen from './components/AuthScreen';
import { getSunnySystemPrompt, extractJSON, validateSunnyResponse, getLanguageSpecificInstructions } from './utils/sunnyPrompts';
import { t } from './utils/translations';
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

// Age boundaries - centralized constants
const AGE_BOUNDARIES = {
  AUTO_SUBMIT_MAX: 6,      // Kids 6 and under get auto-submit
  TTS_MAX: 13,             // Ages 4-13 get voice guidance (TTS) by default
  VERY_YOUNG_MAX: 7,       // Ages 4-7 language learning stage
  YOUNG_MAX: 9,            // Age group 7-9
  MIDDLE_MAX: 12,          // Ages 8-12 language learning stage
  TEEN_MIN: 13,            // Age group 10-13
  TEEN_MAX: 18             // Ages 13+ language learning stage
};

// Grade levels - K through college
const GRADES = {
  'K':       { name: 'Kindergarten', ageGroup: '4-6',   next: '1'       },
  '1':       { name: '1st Grade',    ageGroup: '4-6',   next: '2'       },
  '2':       { name: '2nd Grade',    ageGroup: '7-9',   next: '3'       },
  '3':       { name: '3rd Grade',    ageGroup: '7-9',   next: '4'       },
  '4':       { name: '4th Grade',    ageGroup: '7-9',   next: '5'       },
  '5':       { name: '5th Grade',    ageGroup: '10-13', next: '6'       },
  '6':       { name: '6th Grade',    ageGroup: '10-13', next: '7'       },
  '7':       { name: '7th Grade',    ageGroup: '10-13', next: '8'       },
  '8':       { name: '8th Grade',    ageGroup: '10-13', next: '9'       },
  '9':       { name: '9th Grade',    ageGroup: '14-18', next: '10'      },
  '10':      { name: '10th Grade',   ageGroup: '14-18', next: '11'      },
  '11':      { name: '11th Grade',   ageGroup: '14-18', next: '12'      },
  '12':      { name: '12th Grade',   ageGroup: '14-18', next: 'college' },
  'college': { name: 'College',      ageGroup: '14-18', next: null      }
};

// Grade helper functions (module-level so they can be used anywhere)
const getGradeFromAge = (age) => {
  const ageNum = parseInt(age);
  if (ageNum <= 5) return 'K';
  if (ageNum === 6)  return '1';
  if (ageNum === 7)  return '2';
  if (ageNum === 8)  return '3';
  if (ageNum === 9)  return '4';
  if (ageNum === 10) return '5';
  if (ageNum === 11) return '6';
  if (ageNum === 12) return '7';
  if (ageNum === 13) return '8';
  if (ageNum === 14) return '9';
  if (ageNum === 15) return '10';
  if (ageNum === 16) return '11';
  if (ageNum === 17) return '12';
  return 'college';
};

const getNextGrade = (currentGrade) => {
  return GRADES[currentGrade]?.next || null;
};

const getAgeGroupForGrade = (grade) => {
  return GRADES[grade]?.ageGroup || '10-13';
};

// Convert grade key to a number for comparison (K=0, 1=1 … 12=12, college=13)
const gradeToNum = (grade) => {
  if (grade === 'K') return 0;
  if (grade === 'college') return 13;
  return parseInt(grade) || 0;
};

// Language locale mappings - centralized
const LANGUAGE_LOCALE_MAP = {
  'en': 'en-US',
  'es': 'es-ES',
  'vi': 'vi-VN',
  'zh': 'zh-CN',
  'fr': 'fr-FR',
  'ar': 'ar-SA',
  'hi': 'hi-IN',
  'pt': 'pt-BR',
  'ja': 'ja-JP',
  'ko': 'ko-KR',
  'de': 'de-DE',
  'it': 'it-IT',
  'ru': 'ru-RU'
};

// Language name to code mapping
const LANGUAGE_NAME_TO_CODE = {
  'spanish': 'es',
  'french': 'fr',
  'japanese': 'ja',
  'korean': 'ko',
  'chinese': 'zh',
  'german': 'de',
  'italian': 'it',
  'portuguese': 'pt',
  'russian': 'ru',
  'arabic': 'ar',
  'hindi': 'hi',
  'vietnamese': 'vi'
};

export default function AdaptiveLearningApp() {
  const [screen, setScreen] = useState('welcome');
  const [userName, setUserName] = useState('');
  const [userAge, setUserAge] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [userProgress, setUserProgress] = useState(null);
  const [currentSubject, setCurrentSubject] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [userAnswer, setUserAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [assessmentResults, setAssessmentResults] = useState({});
  const [currentAssessment, setCurrentAssessment] = useState(null);
  const [assessmentSubjectIndex, setAssessmentSubjectIndex] = useState(0);
  const [isHomeworkMode, setIsHomeworkMode] = useState(false);
  const [recentUsers, setRecentUsers] = useState([]);
  // Sunny dual-surface state (ALWAYS ON)
  const [currentCoachSay, setCurrentCoachSay] = useState('');
  const [currentStudyBoard, setCurrentStudyBoard] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null); // For autofocus on user input
  const [showTopicSelection, setShowTopicSelection] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const synthRef = useRef(null);
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    try { return localStorage.getItem('tutor:lastLanguage') || 'en'; } catch { return 'en'; }
  });
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  // Grade advancement modal: { subjectKey, currentGrade, nextGrade } or null
  const [gradeAdvancementPending, setGradeAdvancementPending] = useState(null);
  // Toast after advancing: string or null
  const [gradeToast, setGradeToast] = useState(null);
  const [isVoiceInput, setIsVoiceInput] = useState(false); // Track if answer came from voice
  const autoSubmitTimerRef = useRef(null); // Track auto-submit timer
  const isListeningRef = useRef(false); // Ref to avoid stale closure in speech recognition callbacks
  const authInitialized = useRef(false); // Only process onAuthStateChanged on initial page load
  const fetchAbortRef = useRef(null); // AbortController for in-flight API requests

  // Firebase auth state
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

// Subject card gradient pairs — textbook chapter color coding
const SUBJECT_CARD_GRADIENTS = {
  reading:    ['#1D4ED8', '#5B21B6'],
  writing:    ['#065F46', '#0369A1'],
  math:       ['#5B21B6', '#A21CAF'],
  spelling:   ['#92400E', '#B45309'],
  social:     ['#9D174D', '#6B21A8'],
  logic:      ['#312E81', '#4F46E5'],
  languages:  ['#075985', '#0E7490'],
  'test-prep':['#991B1B', '#C2410C'],
  career:     ['#7C2D12', '#92400E'],
};

  // Assessment questions by subject and age group
const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸', nativeName: 'English' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳', nativeName: 'Tiếng Việt' },
  { code: 'zh', name: 'Mandarin', flag: '🇨🇳', nativeName: '中文' },
  { code: 'fr', name: 'French', flag: '🇫🇷', nativeName: 'Français' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', nativeName: 'हिन्दी' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷', nativeName: 'Português' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', nativeName: '한국어' },
  { code: 'de', name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' }
];

// === LANGUAGE LEARNING STAGES ===
const LANGUAGE_LEARNING_STAGES = {
  YOUNG: { 
    focus: 'listening_speaking',
    methods: ['verbal', 'songs', 'games', 'repetition'],
    assessment: 'verbal_only',
    readingRequired: false,
    writingRequired: false
  },
  MIDDLE: {
    focus: 'speaking_reading',
    methods: ['conversation', 'reading', 'simple_writing'],
    assessment: 'verbal_and_written',
    readingRequired: true,
    writingRequired: 'simple'
  },
  OLDER: {
    focus: 'comprehensive',
    methods: ['conversation', 'reading', 'writing', 'grammar'],
    assessment: 'comprehensive',
    readingRequired: true,
    writingRequired: true
  }
};

const getLanguageLearningStage = (age) => {
  const ageNum = parseInt(age);
  if (ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX) return LANGUAGE_LEARNING_STAGES.YOUNG;
  if (ageNum <= AGE_BOUNDARIES.MIDDLE_MAX) return LANGUAGE_LEARNING_STAGES.MIDDLE;
  return LANGUAGE_LEARNING_STAGES.OLDER;
};

  const languageAssessmentQuestions = {
  'spanish': [
    { 
      question: "¿Hablas español? (Do you speak Spanish?)", 
      options: ["No, I'm a complete beginner", "I know a few words", "I can have basic conversations", "I'm fluent"],
      level: [0, 1, 2, 3],
      speak: "Do you speak any Spanish?"
    },
    { 
      question: "What does 'hola' mean?", 
      correctAnswer: "hello",
      level: 0,
      speak: "What does hola mean?"
    },
    { 
      question: "How do you say 'thank you' in Spanish?", 
      correctAnswer: "gracias",
      level: 1,
      speak: "How do you say thank you in Spanish?"
    },
    { 
      question: "Translate: 'I am learning Spanish'", 
      correctAnswer: "estoy aprendiendo español",
      level: 2,
      speak: "Translate: I am learning Spanish"
    }
  ],
  'french': [
    { 
      question: "Parlez-vous français? (Do you speak French?)", 
      options: ["No, I'm a complete beginner", "I know a few words", "I can have basic conversations", "I'm fluent"],
      level: [0, 1, 2, 3],
      speak: "Do you speak any French?"
    },
    { 
      question: "What does 'bonjour' mean?", 
      correctAnswer: "hello",
      level: 0,
      speak: "What does bonjour mean?"
    },
    { 
      question: "How do you say 'thank you' in French?", 
      correctAnswer: "merci",
      level: 1,
      speak: "How do you say thank you in French?"
    }
  ],
  'japanese': [
    { 
      question: "日本語を話しますか？ (Do you speak Japanese?)", 
      options: ["No, I'm a complete beginner", "I know Hiragana", "I can read Katakana too", "I know Kanji"],
      level: [0, 1, 2, 3],
      speak: "Do you speak any Japanese?"
    },
    { 
      question: "What does 'こんにちは' (konnichiwa) mean?", 
      correctAnswer: "hello",
      level: 0,
      speak: "What does konnichiwa mean?"
    }
  ],
  'mandarin': [
    { 
      question: "你会说中文吗？ (Do you speak Chinese?)", 
      options: ["No, I'm a complete beginner", "I know Pinyin", "I can read some characters", "I'm fluent"],
      level: [0, 1, 2, 3],
      speak: "Do you speak any Mandarin?"
    },
    { 
      question: "What does '你好' (nǐ hǎo) mean?", 
      correctAnswer: "hello",
      level: 0,
      speak: "What does ni hao mean?"
    }
  ],
  'german': [
    { 
      question: "Sprechen Sie Deutsch? (Do you speak German?)", 
      options: ["No, I'm a complete beginner", "I know a few words", "I can have basic conversations", "I'm fluent"],
      level: [0, 1, 2, 3],
      speak: "Do you speak any German?"
    },
    { 
      question: "What does 'danke' mean?", 
      correctAnswer: "thank you",
      level: 0,
      speak: "What does danke mean?"
    }
  ],
  'italian': [
    { 
      question: "Parli italiano? (Do you speak Italian?)", 
      options: ["No, I'm a complete beginner", "I know a few words", "I can have basic conversations", "I'm fluent"],
      level: [0, 1, 2, 3],
      speak: "Do you speak any Italian?"
    },
    { 
      question: "What does 'ciao' mean?", 
      correctAnswer: "hello",
      level: 0,
      speak: "What does ciao mean?"
    }
  ],
  'korean': [
    {
      question: "한국어를 할 수 있어요? (Can you speak Korean?)",
      options: ["No, I'm a complete beginner", "I know Hangul", "I can have basic conversations", "I'm fluent"],
      level: [0, 1, 2, 3],
      speak: "Do you speak any Korean?"
    },
    {
      question: "What does '안녕하세요' (annyeonghaseyo) mean?",
      correctAnswer: "hello",
      level: 0,
      speak: "What does annyeonghaseyo mean?"
    }
  ],
  'arabic': [
    {
      question: "هل تتكلم العربية؟ (Do you speak Arabic?)",
      options: ["No, I'm a complete beginner", "I know a few words", "I can have basic conversations", "I'm fluent"],
      level: [0, 1, 2, 3],
      speak: "Do you speak any Arabic?"
    },
    {
      question: "What does 'مرحبا' (marhaba) mean?",
      correctAnswer: "hello",
      level: 0,
      speak: "What does marhaba mean?"
    },
    {
      question: "How do you say 'thank you' in Arabic?",
      correctAnswer: "shukran",
      level: 1,
      speak: "How do you say thank you in Arabic?"
    }
  ],
  'hindi': [
    {
      question: "क्या आप हिंदी बोलते हैं? (Do you speak Hindi?)",
      options: ["No, I'm a complete beginner", "I know a few words", "I can have basic conversations", "I'm fluent"],
      level: [0, 1, 2, 3],
      speak: "Do you speak any Hindi?"
    },
    {
      question: "What does 'नमस्ते' (namaste) mean?",
      correctAnswer: "hello",
      level: 0,
      speak: "What does namaste mean?"
    },
    {
      question: "How do you say 'thank you' in Hindi?",
      correctAnswer: "dhanyavaad",
      level: 1,
      speak: "How do you say thank you in Hindi?"
    }
  ],
  'portuguese': [
    {
      question: "Você fala português? (Do you speak Portuguese?)",
      options: ["No, I'm a complete beginner", "I know a few words", "I can have basic conversations", "I'm fluent"],
      level: [0, 1, 2, 3],
      speak: "Do you speak any Portuguese?"
    },
    {
      question: "What does 'olá' mean?",
      correctAnswer: "hello",
      level: 0,
      speak: "What does ola mean?"
    },
    {
      question: "How do you say 'thank you' in Portuguese?",
      correctAnswer: "obrigado",
      level: 1,
      speak: "How do you say thank you in Portuguese?"
    }
  ],
  'russian': [
    {
      question: "Вы говорите по-русски? (Do you speak Russian?)",
      options: ["No, I'm a complete beginner", "I know the Cyrillic alphabet", "I can have basic conversations", "I'm fluent"],
      level: [0, 1, 2, 3],
      speak: "Do you speak any Russian?"
    },
    {
      question: "What does 'привет' (privet) mean?",
      correctAnswer: "hello",
      level: 0,
      speak: "What does privet mean?"
    },
    {
      question: "How do you say 'thank you' in Russian?",
      correctAnswer: "spasibo",
      level: 1,
      speak: "How do you say thank you in Russian?"
    }
  ],
  'vietnamese': [
    {
      question: "Bạn có nói tiếng Việt không? (Do you speak Vietnamese?)",
      options: ["No, I'm a complete beginner", "I know a few words", "I can have basic conversations", "I'm fluent"],
      level: [0, 1, 2, 3],
      speak: "Do you speak any Vietnamese?"
    },
    {
      question: "What does 'xin chào' mean?",
      correctAnswer: "hello",
      level: 0,
      speak: "What does xin chao mean?"
    },
    {
      question: "How do you say 'thank you' in Vietnamese?",
      correctAnswer: "cam on",
      level: 1,
      speak: "How do you say thank you in Vietnamese?"
    }
  ]
};
  // Topic selections for advanced students (13+)
const advancedTopics = {
  'math': [
    { id: 'algebra', name: 'Algebra', icon: '📐', description: 'Equations, functions, factoring' },
    { id: 'geometry', name: 'Geometry', icon: '📏', description: 'Shapes, proofs, theorems' },
    { id: 'trigonometry', name: 'Trigonometry', icon: '📊', description: 'Sin, cos, tan, identities' },
    { id: 'precalculus', name: 'Pre-Calculus', icon: '📈', description: 'Limits, functions, graphing' },
    { id: 'calculus', name: 'Calculus', icon: '∫', description: 'Derivatives, integrals' },
    { id: 'statistics', name: 'Statistics', icon: '📉', description: 'Probability, data analysis' },
    { id: 'sat-math', name: 'SAT Math Prep', icon: '🎯', description: 'Test strategies, practice' }
  ],
  'writing': [
    { id: 'creative', name: 'Creative Writing', icon: '✍️', description: 'Stories, poetry, fiction' },
    { id: 'essays', name: 'Essay Writing', icon: '📝', description: 'Argumentative, persuasive' },
    { id: 'grammar', name: 'Grammar & Style', icon: '📖', description: 'Rules, punctuation, clarity' },
    { id: 'research', name: 'Research Papers', icon: '🔍', description: 'Citations, thesis, structure' },
    { id: 'college-essays', name: 'College Essays', icon: '🎓', description: 'Personal statements, supplements' }
  ],
  // NEW: Language topics
  'languages': [
    { id: 'spanish', name: 'Spanish', icon: '🇪🇸', description: 'Learn Spanish vocabulary, grammar, conversation' },
    { id: 'french', name: 'French', icon: '🇫🇷', description: 'Learn French vocabulary, grammar, conversation' },
    { id: 'japanese', name: 'Japanese', icon: '🇯🇵', description: 'Learn Japanese (Hiragana, Katakana, Kanji)' },
    { id: 'mandarin', name: 'Mandarin Chinese', icon: '🇨🇳', description: 'Learn Mandarin (Pinyin, characters, tones)' },
    { id: 'german', name: 'German', icon: '🇩🇪', description: 'Learn German vocabulary, grammar, conversation' },
    { id: 'italian', name: 'Italian', icon: '🇮🇹', description: 'Learn Italian vocabulary, grammar, conversation' },
    { id: 'korean', name: 'Korean', icon: '🇰🇷', description: 'Learn Korean (Hangul, vocabulary, grammar)' }
  ],
  
  // NEW: Test Prep topics
  'test-prep': [
    { id: 'ielts', name: 'IELTS', icon: '🎓', description: 'Reading, Writing, Listening, Speaking preparation' },
    { id: 'toefl', name: 'TOEFL', icon: '📚', description: 'Reading, Listening, Speaking, Writing sections' },
    { id: 'sat', name: 'SAT', icon: '📝', description: 'Math, Reading, Writing & Language sections' },
    { id: 'act', name: 'ACT', icon: '✍️', description: 'English, Math, Reading, Science, Writing' },
    { id: 'ap', name: 'AP Exams', icon: '🏆', description: 'Advanced Placement exam preparation' },
    { id: 'gre', name: 'GRE', icon: '🎯', description: 'Graduate Record Examination prep' }
  ]
};
  const assessmentQuestions = {
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
        { question: "Spell CAT!", questionKey: 'aq.spellCat', visual: "CAT", visualType: "word", level: 1, speak: "Spell CAT" },
        { question: "Spell DOG!", questionKey: 'aq.spellDog', visual: "DOG", visualType: "word", level: 3, speak: "Spell DOG" }
      ]
    }
  };

  const subjects = {
    'reading': {
      name: 'Reading',
      icon: BookOpen,
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
      icon: Pencil,
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
      icon: Hash,
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
      icon: Book,
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
      icon: Users,
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
      icon: Lightbulb,
      color: 'from-indigo-400 to-indigo-600',
      levels: {
        '4-6': ['Patterns', 'Matching', 'Sorting', 'Simple Puzzles', 'Logic Master'],
        '7-9': ['Logical Sequences', 'Problem Solving', 'Critical Thinking', 'Deduction', 'Advanced Logic'],
        '10-13': ['Abstract Reasoning', 'Strategy Games', 'Logic Puzzles', 'Hypothesis Testing', 'Expert Logic'],
        '14-18': ['Formal Logic', 'Scientific Method', 'Philosophical Reasoning', 'Debate Skills', 'Master Reasoning']
      }
    },
    // NEW: Foreign Languages
  'languages': {
    name: 'Languages',
    icon: '🌍', // You'll need to import Globe from lucide-react
    color: 'from-cyan-400 to-blue-500',
    levels: {
      '4-6': ['Basic Words', 'Colors & Numbers', 'Simple Phrases', 'Songs & Games'],
      '7-9': ['Greetings', 'Family & Friends', 'Food & Hobbies', 'Simple Conversations'],
      '10-13': ['Grammar Basics', 'Reading & Writing', 'Intermediate Vocab', 'Culture'],
      '14-18': ['Advanced Grammar', 'Fluency Practice', 'Literature', 'Professional Language']
    }
  },
  
  // NEW: Test Prep
  'test-prep': {
    name: 'Test Prep',
    icon: '🎯', // Target icon
    color: 'from-red-400 to-orange-500',
    levels: {
      '4-6': ['Not applicable'], // Test prep not for young kids
      '7-9': ['Not applicable'],
      '10-13': ['Pre-SAT', 'PSAT Practice', 'Study Skills', 'Test Strategies'],
      '14-18': ['SAT/ACT Prep', 'AP Exams', 'IELTS/TOEFL', 'College Entrance']
    }
  },
  
  // NEW: Career Planning & Personal Advisor
  'career': {
    name: 'Career Planning',
    icon: '🎯',
    color: 'from-purple-400 to-pink-500',
    levels: {
      '4-6': ['Dream Jobs', 'What I Like', 'Being Helpful', 'Growing Up'],
      '7-9': ['Interests', 'Strengths', 'Future Careers', 'Goal Setting'],
      '10-13': ['Career Exploration', 'Skills Assessment', 'Education Planning', 'Career Paths'],
      '14-18': ['Career Strategy', 'Market Analysis', 'Action Plans', 'Success Roadmap']
    }
  }
  };

  // Subject constraints for AI responses - MUST BE AT TOP LEVEL
  const subjectConstraints = {
    'math': 'ONLY ask math questions: counting, addition, subtraction, numbers. DO NOT ask about letters, spelling, or reading.',
    'reading': 'ONLY ask reading questions: letters, sounds, words. DO NOT ask about math, counting, or numbers.',
    'spelling': 'ONLY ask spelling questions. CRITICAL: Never show the word to spell in the visual! Use visualType "audio-prompt" or "none". The student must spell from hearing only.',
    'writing': 'ONLY ask writing questions: sentences, stories. DO NOT ask about math or reading.',
    'social': 'ONLY ask social skills questions: sharing, kindness, friends. DO NOT ask about math or reading.',
    'logic': 'ONLY ask logic questions: patterns, puzzles. DO NOT ask about math or reading.',
    'languages': 'ONLY teach the selected foreign language. This is BILINGUAL MODE: Instructions in user\'s profile language, teaching content in target language.',
    'test-prep': 'ONLY ask test preparation questions.',
    'career': 'Act as a career counselor and personal advisor. Conduct comprehensive assessment, provide career analysis, create personalized plans.'
  };

  const getAgeGroup = (age) => {
    const ageNum = parseInt(age);
    if (ageNum >= 4 && ageNum <= 6) return '4-6';
    if (ageNum >= 7 && ageNum <= 9) return '7-9';
    if (ageNum >= 10 && ageNum <= 13) return '10-13';
    if (ageNum >= 14 && ageNum <= 18) return '14-18';
    return '10-13';
  };

  // Get appropriate starting level based on age (maps to typical grade level)
  const getStartingLevel = (age, subjectKey) => {
    const ageNum = parseInt(age);
    
    // For math, map age to typical grade-level content
    if (subjectKey === 'math') {
      if (ageNum <= 13) return 0; // Start at beginning of their age group
      if (ageNum === 14) return 0; // 9th grade: Algebra 1
      if (ageNum === 15) return 1; // 10th grade: Geometry
      if (ageNum === 16) return 2; // 11th grade: Algebra 2
      if (ageNum >= 17) return 3; // 12th grade: Pre-Calculus
    }
    
    // For other subjects, start at beginning of age group
    return 0;
  };

  useEffect(() => {
    // Setup speech recognition
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      // Optimal settings for reliability
      recognitionRef.current.continuous = false;  // Single utterance mode for better finalization
      recognitionRef.current.interimResults = true; // Show what's being heard
      recognitionRef.current.maxAlternatives = 5; // Get more alternatives for better accuracy
      
      // Language will be set dynamically when user starts speaking
      // Default to English for now
      recognitionRef.current.lang = 'en-US';
      
      // Track last recognized text (interim or final)
      let lastInterimResult = '';
      let hasReceivedResult = false;
      
      recognitionRef.current.onresult = (event) => {
        hasReceivedResult = true;
        
        // Get the most recent result
        const lastResultIndex = event.results.length - 1;
        const lastResult = event.results[lastResultIndex];
        const transcript = lastResult[0].transcript;
        const confidence = lastResult[0].confidence;
        const isFinal = lastResult.isFinal;
        
        console.log('🎤 Speech recognized:', transcript, 'Confidence:', confidence, 'Final:', isFinal);
        
        if (isFinal) {
          // Final result - use this
          console.log('✅ Final result received:', transcript);
          setUserAnswer(transcript.trim());
          setIsVoiceInput(true);
          console.log('🎯 isVoiceInput set to TRUE');
          lastInterimResult = ''; // Clear interim since we have final
        } else {
          // Interim result - save it and show with visual feedback
          console.log('⏳ Interim result (not final)');
          lastInterimResult = transcript.trim();
          setUserAnswer(lastInterimResult + '...');
        }
      };

      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        
        // If we have an interim result (shown with ...), finalize it
        if (lastInterimResult) {
          console.log('💡 Finalizing interim result:', lastInterimResult);
          setUserAnswer(lastInterimResult); // Remove the "..."
          setIsVoiceInput(true);
          console.log('🎯 isVoiceInput set to TRUE');
        }
        
        setIsListening(false);
        lastInterimResult = ''; // Reset for next time
        hasReceivedResult = false;
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        
        // Handle different error types
        switch (event.error) {
          case 'no-speech':
            console.log('No speech detected - try speaking louder or closer to microphone');
            // Auto-retry for no-speech (use ref to avoid stale closure)
            setTimeout(() => {
              if (isListeningRef.current) {
                console.log('Auto-retrying speech recognition...');
                try {
                  recognitionRef.current.start();
                } catch (e) {
                  console.log('Could not restart recognition');
                  setIsListening(false);
                }
              }
            }, 500);
            break;
          
          case 'audio-capture':
            console.error('No microphone detected');
            alert('No microphone detected. Please check your microphone connection.');
            setIsListening(false);
            break;
          
          case 'not-allowed':
            console.error('Microphone permission denied');
            alert('Please allow microphone access to use voice input.');
            setIsListening(false);
            break;
          
          case 'aborted':
            console.log('Speech recognition aborted');
            setIsListening(false);
            break;
          
          default:
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        }
      };
      
      // Add speech start event
      recognitionRef.current.onspeechstart = () => {
        console.log('Speech detected - listening...');
      };
      
      // Add speech end event
      recognitionRef.current.onspeechend = () => {
        console.log('Speech ended - processing...');
      };

      setSpeechSupported(true);
    }

    // Setup speech synthesis
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
      
      // Load voices
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        console.log('Voices loaded:', voices.length);
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
      
      // iOS FIX: Unlock speech synthesis on first user interaction.
      // iOS requires a non-empty utterance spoken synchronously inside a gesture handler.
      // An empty string '' is silently ignored by iOS — use a space character instead.
      const initIOSAudio = () => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS && window.speechSynthesis) {
          console.log('iOS: unlocking speech synthesis...');
          // Cancel any leftover state first
          window.speechSynthesis.cancel();
          // Speak a real (but silent) utterance — iOS ignores empty strings
          const unlock = new SpeechSynthesisUtterance(' ');
          unlock.volume = 0;
          unlock.rate = 1;
          unlock.onend = () => {
            // Cancel after it ends so the queue is clean for real speech
            window.speechSynthesis.cancel();
          };
          window.speechSynthesis.speak(unlock);
          console.log('iOS: speech synthesis unlocked');
        }
      };

      // Re-unlock on every new session (PWA re-launch resets the audio lock)
      document.addEventListener('touchstart', initIOSAudio, { once: true });
      document.addEventListener('click', initIOSAudio, { once: true });
    }

    // Firebase auth listener — only handles initial page load check.
    // Sign-in and sign-out triggered by the app are handled by onAuthSuccess/logout directly.
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (authInitialized.current) return;
      authInitialized.current = true;
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const docSnap = await getDoc(doc(db, 'users', fbUser.uid));
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.name) {
              const user = { name: data.name, age: data.age, language: data.language };
              if (data.language) setSelectedLanguage(data.language);
              setCurrentUser(user);
              if (data.subjects) {
                await loadUserProgress(user, { uid: fbUser.uid });
                setScreen('dashboard');
              } else {
                // Profile exists but assessment not yet completed
                startAssessment(user);
                setScreen('assessment');
              }
            } else {
              setScreen('auth');
            }
          } else {
            setScreen('auth');
          }
        } catch (e) {
          console.error('Failed to load user:', e);
          setScreen('auth');
        }
      } else {
        setScreen('auth');
      }
      setAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // Keep isListeningRef in sync so speech recognition callbacks avoid stale closures
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Auto-submit voice answers for young kids
  useEffect(() => {
    // Clear any existing timer first
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    
    // Check if we should auto-submit
    if (!isVoiceInput || !userAnswer || !userProgress) {
      return;
    }
    
    const ageNum = parseInt(userProgress.age);
    
    // Auto-submit for: young kids OR language learning (pronunciation practice)
    const shouldAutoSubmit = ageNum <= AGE_BOUNDARIES.AUTO_SUBMIT_MAX || currentSubject === 'languages';
    
    if (shouldAutoSubmit) {
      console.log('🎯 Scheduling auto-submit for', ageNum <= AGE_BOUNDARIES.AUTO_SUBMIT_MAX ? `age ${ageNum}` : 'language learning', ':', userAnswer);
      
      // Wait 1.5 seconds so user can see what was heard
      autoSubmitTimerRef.current = setTimeout(() => {
        console.log('🚀 Auto-submitting now:', userAnswer);
        
        // Capture the answer in a variable to avoid closure issues
        const answerToSubmit = userAnswer;
        
        // Call sendMessage directly
        sendMessage(answerToSubmit);
        
        // Reset flag
        setIsVoiceInput(false);
        autoSubmitTimerRef.current = null;
      }, 1500);
      
      console.log('⏱️ Timer scheduled, will submit in 1.5 seconds');
    } else {
      // For older kids in non-language subjects, manual submit required
      console.log('👤 Age', ageNum, '- manual submit required');
      setIsVoiceInput(false);
    }
    
    // Cleanup function
    return () => {
      if (autoSubmitTimerRef.current) {
        console.log('🧹 Cleaning up auto-submit timer');
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
    };
  }, [userAnswer, isVoiceInput, userProgress]); // Removed isLoading from dependencies

  const loadRecentUsers = () => {
    const users = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('tutor:')) {
          const data = localStorage.getItem(key);
          if (data) {
            const progress = JSON.parse(data);
            users.push({
              name: progress.name,
              age: progress.age,
              totalPoints: progress.totalPoints || 0
            });
          }
        }
      }
    } catch (e) {
      console.log('Could not load from localStorage');
    }

    setRecentUsers(users.slice(0, 3));
  };

  useEffect(() => {
    if (currentUser) {
      loadUserProgress(currentUser);
    }
  }, [currentUser]);

  // Persist the selected language so the picker initialises correctly on next page load.
  useEffect(() => {
    try { localStorage.setItem('tutor:lastLanguage', selectedLanguage); } catch {}
  }, [selectedLanguage]);

  // Cancel any in-flight API request when leaving the activity screen
  useEffect(() => {
    if (screen !== 'activity') {
      fetchAbortRef.current?.abort();
      fetchAbortRef.current = null;
      setIsLoading(false);
    }
  }, [screen]);

  // Autofocus textarea after each response
  useEffect(() => {
    if (textareaRef.current && screen === 'activity' && !isLoading) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [conversation, screen, isLoading]); // Refocus when conversation updates (new response) or screen changes


  const loadUserProgress = async (user, firebaseOpts = null) => {
  let progress = null;
  const fbUid = firebaseOpts?.uid ?? firebaseUser?.uid;

  // 1. Try Firestore (primary source when authenticated)
  if (fbUid) {
    try {
      const docSnap = await getDoc(doc(db, 'users', fbUid));
      if (docSnap.exists()) {
        progress = docSnap.data();
        console.log('Loaded from Firestore');
      }
    } catch (error) {
      console.log('Firestore load failed, trying cache');
    }
  }

  // 2. localStorage cache (offline fallback)
  if (!progress) {
    const cacheKey = fbUid ? `tutor:uid:${fbUid}` : `tutor:${user.name}:${user.age}`;
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) { progress = JSON.parse(stored); console.log('Loaded from localStorage cache'); }
    } catch {}
  }

  // 3. Legacy key fallback
  if (!progress) {
    try {
      const stored = localStorage.getItem(`tutor:${user.name}:${user.age}`);
      if (stored) { progress = JSON.parse(stored); console.log('Loaded from legacy localStorage'); }
    } catch {}
  }

  if (!progress) {
    try {
      const stored = sessionStorage.getItem(`tutor:${user.name}:${user.age}`);
      if (stored) { progress = JSON.parse(stored); console.log('Loaded from sessionStorage'); }
    } catch {}
  }

  // MIGRATION: Add new subjects if they don't exist in saved progress
  if (progress) {
    // If the doc has no subjects, it's a brand-new registration (profile-only doc, pre-assessment).
    // Don't treat it as progress — start assessment to create initial progress.
    if (!progress.subjects) {
      if (parseInt(user.age) <= AGE_BOUNDARIES.TTS_MAX) setTtsEnabled(true);
      startAssessment(user);
      setScreen('assessment');
      return;
    }

    const ageGroup = getAgeGroup(user.age);
    let needsSave = false;

    // Always sync the profile's language from the welcome-screen picker.
    // The picker is now persisted to localStorage so it initialises to the last-used
    // language rather than defaulting to 'en', which prevents accidental resets.
    if (user.language && user.language !== progress.language) {
      console.log(`🌐 Language update: ${progress.language || 'none'} → ${user.language}`);
      progress.language = user.language;
      needsSave = true;
    }

    // Migrate: ensure ageGroup is stored on progress
    if (!progress.ageGroup) {
      progress.ageGroup = ageGroup;
      needsSave = true;
    }

    Object.keys(subjects).forEach(subjectKey => {
      if (!progress.subjects[subjectKey]) {
        console.log('🆕 Adding new subject:', subjectKey);
        // Add the missing subject dynamically with appropriate starting level
        progress.subjects[subjectKey] = {
          level: getStartingLevel(user.age, subjectKey),
          maxLevel: subjects[subjectKey].levels[ageGroup].length - 1,
          points: 0,
          activitiesCompleted: 0,
          correctAnswers: 0,
          totalAttempts: 0,
          currentStreak: 0,
          gradeLevel: getGradeFromAge(user.age),
          readyForAdvancement: false,
          advancementStreak: 0
        };

        // Special case: languages subject needs languageLevels property
        if (subjectKey === 'languages') {
          progress.subjects[subjectKey].languageLevels = {};
        }
        
        needsSave = true;
      } else {
        // CRITICAL: Fix existing subjects with level/maxLevel mismatches
        const currentMaxLevel = subjects[subjectKey].levels[ageGroup].length - 1;
        const subjectProgress = progress.subjects[subjectKey];
        
        // Update maxLevel if it's wrong
        if (subjectProgress.maxLevel !== currentMaxLevel) {
          console.log(`🔧 Fixing ${subjectKey} maxLevel: ${subjectProgress.maxLevel} → ${currentMaxLevel}`);
          subjectProgress.maxLevel = currentMaxLevel;
          needsSave = true;
        }
        
        // Cap level to maxLevel to prevent array index errors
        if (subjectProgress.level > currentMaxLevel) {
          console.log(`🔧 Capping ${subjectKey} level: ${subjectProgress.level} → ${currentMaxLevel}`);
          subjectProgress.level = currentMaxLevel;
          needsSave = true;
        }
        
        // Add languageLevels to existing languages subjects
        if (subjectKey === 'languages' && !subjectProgress.languageLevels) {
          console.log('🔧 Adding languageLevels to existing languages subject');
          subjectProgress.languageLevels = {};
          needsSave = true;
        }

        // Migrate: add grade tracking fields if missing
        if (!subjectProgress.gradeLevel) {
          subjectProgress.gradeLevel = getGradeFromAge(user.age);
          needsSave = true;
        }
        if (subjectProgress.readyForAdvancement === undefined) {
          subjectProgress.readyForAdvancement = false;
          needsSave = true;
        }
        if (subjectProgress.advancementStreak === undefined) {
          subjectProgress.advancementStreak = 0;
          needsSave = true;
        }
      }
    });
    
    // Save migrated progress
    if (needsSave) {
      console.log('💾 Saving migrated progress with new subjects');
      await saveUserProgress(progress);
    }

    // Log grade summary after migration is complete
    console.log('📥 Loaded progress with grades:');
    Object.keys(progress.subjects).forEach(subjectKey => {
      const sub = progress.subjects[subjectKey];
      const grade = sub.gradeLevel;
      const gradeName = grade ? (GRADES[grade]?.name || grade) : 'not set';
      console.log(`  ${subjectKey}: level=${sub.level}, grade='${grade || 'N/A'}' (${gradeName})`);
    });

    setUserProgress(progress);
    // Keep the language picker in sync with the loaded profile's language
    if (progress.language) {
      setSelectedLanguage(progress.language);
    }

    if (parseInt(user.age) <= AGE_BOUNDARIES.TTS_MAX) {
      setTtsEnabled(true);
    }

    setScreen('dashboard');
    return;
  }

  // No saved progress - start assessment
  if (parseInt(user.age) <= AGE_BOUNDARIES.TTS_MAX) {
    setTtsEnabled(true);
  }
  
  console.log('No saved progress, starting assessment');
  setScreen('assessment');
  startAssessment(user);
};

const startLanguageAssessment = (languageId) => {
  const questions = languageAssessmentQuestions[languageId];
  
  setCurrentAssessment({
    type: 'language',
    language: languageId,
    questions: questions,
    currentQuestionIndex: 0,
    answers: []
  });
  
  setScreen('assessment');
  
  const firstQuestion = questions[0];
  if (parseInt(userProgress.age) <= 6 && (firstQuestion.speak || firstQuestion.questionKey)) {
    const ttsLang = userProgress.language || 'en';
    setTimeout(() => speak(firstQuestion.questionKey ? t(firstQuestion.questionKey, ttsLang) : firstQuestion.speak), 500);
  }
};

  const createInitialProgress = (user, levels = {}) => {
    const ageGroup = getAgeGroup(user.age);
    const progress = {
      name: user.name,
      age: user.age,
      ageGroup: ageGroup,
      language: user.language || 'en',  // NEW: Store interface language
      totalPoints: 0,
      totalActivities: 0,
      streak: 0,
      lastActivity: new Date().toISOString(),
      assessmentCompleted: Object.keys(levels).length > 0,
      subjects: {}
    };

    Object.keys(subjects).forEach(subjectKey => {
      progress.subjects[subjectKey] = {
        level: levels[subjectKey] !== undefined ? levels[subjectKey] : getStartingLevel(user.age, subjectKey),
        maxLevel: subjects[subjectKey].levels[ageGroup].length - 1,
        points: 0,
        activitiesCompleted: 0,
        correctAnswers: 0,
        totalAttempts: 0,
        currentStreak: 0,
        gradeLevel: getGradeFromAge(user.age),
        readyForAdvancement: false,
        advancementStreak: 0
      };

      // Only languages subject needs languageLevels property
      if (subjectKey === 'languages') {
        progress.subjects[subjectKey].languageLevels = {};
      }
    });

    return progress;
  };

  const determineLanguageLevel = (languageId, answers) => {
  const questions = languageAssessmentQuestions[languageId];
  
  // First question is self-assessment
  if (questions[0].options) {
    const selfAssessment = answers[0];
    const optionIndex = questions[0].options.indexOf(selfAssessment);
    if (optionIndex !== -1 && questions[0].level) {
      const baseLevel = questions[0].level[optionIndex];
      
      // If they say "complete beginner" (Level 0), trust them - no verification needed
      if (baseLevel === 0) {
        console.log('User is complete beginner - skipping verification questions');
        return 0;
      }
      
      // For higher levels, verify with remaining questions
      let correctCount = 0;
      for (let i = 1; i < answers.length; i++) {
        if (questions[i].correctAnswer) {
          const userAnswer = answers[i].toLowerCase().trim();
          const correctAnswer = questions[i].correctAnswer.toLowerCase().trim();
          if (userAnswer === correctAnswer || userAnswer.includes(correctAnswer)) {
            correctCount++;
          }
        }
      }
      
      // Adjust level based on verification
      const verificationQuestions = answers.length - 1;
      const accuracy = verificationQuestions > 0 ? correctCount / verificationQuestions : 0;
      
      if (accuracy < 0.3) return Math.max(0, baseLevel - 1);
      if (accuracy > 0.7) return Math.min(3, baseLevel);
      return baseLevel;
    }
  }
  
  // Fallback: count correct answers
  let correctCount = 0;
  for (let i = 0; i < answers.length; i++) {
    if (questions[i].correctAnswer) {
      const userAnswer = answers[i].toLowerCase().trim();
      const correctAnswer = questions[i].correctAnswer.toLowerCase().trim();
      if (userAnswer === correctAnswer || userAnswer.includes(correctAnswer)) {
        correctCount++;
      }
    }
  }
  
  // Map to level 0-3
  const percentage = answers.length > 0 ? correctCount / answers.length : 0;
  if (percentage < 0.25) return 0; // Beginner
  if (percentage < 0.5) return 1;  // Elementary
  if (percentage < 0.75) return 2; // Intermediate
  return 3; // Advanced
};

  const startAssessment = (user) => {
    const ageGroup = getAgeGroup(user.age);
    const subjectKeys = Object.keys(subjects);
    const firstSubject = subjectKeys[0];
    
    const questions = assessmentQuestions[firstSubject]?.[ageGroup] || [];
    
    if (questions.length > 0) {
      setCurrentAssessment({
        subject: firstSubject,
        questions: questions,
        currentQuestionIndex: 0,
        answers: []
      });
      setAssessmentSubjectIndex(0);
      setAssessmentResults({});
      
      const userAge = parseInt(user.age);
      if (userAge <= 6 && questions[0]) {
        setTimeout(() => {
          const q0 = questions[0];
          const ttsLang = user.language || 'en';
          const toSpeak = q0.questionKey ? t(q0.questionKey, ttsLang) : (q0.speak || q0.question);
          speak(toSpeak);
        }, 1000);
      }
    } else {
      finishAssessment(user, {});
    }
  };

const submitAssessmentAnswer = async (answer) => {
  if (!currentAssessment) return;
  
  const newAnswers = [...currentAssessment.answers, {
    questionIndex: currentAssessment.currentQuestionIndex,
    answer: answer,
    level: currentAssessment.questions[currentAssessment.currentQuestionIndex].level
  }];
  
  // LANGUAGE ASSESSMENT FLOW
  if (currentAssessment.type === 'language') {
    // Check if this was the first question (self-assessment) and they indicated beginner level
    const isFirstQuestion = currentAssessment.currentQuestionIndex === 0;
    const firstQuestion = currentAssessment.questions[0];
    
    let shouldEndEarly = false;
    if (isFirstQuestion && firstQuestion.options) {
      // Check if they selected "complete beginner" option OR typed variations of "no"
      const answerLower = answer.toLowerCase().trim();
      const optionIndex = firstQuestion.options.findIndex(opt => 
        opt.toLowerCase() === answerLower
      );
      
      // Also check for common "no" variations
      const isBeginnerResponse = 
        optionIndex === 0 || // First option (complete beginner)
        answerLower === 'no' ||
        answerLower === 'nope' ||
        answerLower === 'none' ||
        answerLower === "i don't know" ||
        answerLower === "i dont know" ||
        answerLower === "don't know" ||
        answerLower === "dont know" ||
        answerLower.includes('beginner') ||
        answerLower.includes("don't speak") ||
        answerLower.includes("dont speak");
      
      if (isBeginnerResponse) {
        // They're a complete beginner - end assessment now
        shouldEndEarly = true;
        console.log('User identified as complete beginner - ending assessment early');
      }
    }
    
    const nextQuestionIndex = currentAssessment.currentQuestionIndex + 1;
    
    if (!shouldEndEarly && nextQuestionIndex < currentAssessment.questions.length) {
      // More questions in language assessment
      setCurrentAssessment({
        ...currentAssessment,
        currentQuestionIndex: nextQuestionIndex,
        answers: newAnswers
      });
      setUserAnswer('');
      
      const userAge = parseInt(currentUser.age);
      if (userAge <= 6) {
        setTimeout(() => {
          const nextQ = currentAssessment.questions[nextQuestionIndex];
          const ttsLang = currentUser.language || 'en';
          const toSpeak = nextQ.questionKey ? t(nextQ.questionKey, ttsLang) : (nextQ.speak || nextQ.question);
          speak(toSpeak);
        }, 800);
      }
    } else {
      // Language assessment complete - determine level
      let languageLevel;
      
      // If we ended early (beginner response), force level 0
      if (shouldEndEarly) {
        languageLevel = 0;
        console.log(`Language assessment ended early - forcing Level 0 for complete beginner`);
      } else {
        languageLevel = determineLanguageLevel(currentAssessment.language, newAnswers.map(a => a.answer));
      }
      
      console.log(`Language assessment complete: ${currentAssessment.language} - Level ${languageLevel}`);
      
      // Update user progress with language level
      const updatedProgress = { ...userProgress };
      if (!updatedProgress.subjects.languages.languageLevels) {
        updatedProgress.subjects.languages.languageLevels = {};
      }
      updatedProgress.subjects.languages.languageLevels[currentAssessment.language] = languageLevel;
      
      setUserProgress(updatedProgress);
      await saveUserProgress(updatedProgress);
      
      // Clear assessment
      setCurrentAssessment(null);
      setUserAnswer('');
      
      // Start learning activity directly (no need to call startActivityWithTopic)
      // We already know the language was just assessed, no need to check again
      const languageToStart = currentAssessment.language;
      
      setShowTopicSelection(false);
      setIsHomeworkMode(false);
      setCurrentSubject('languages');
      setSelectedTopic(languageToStart);
      setConversation([]);
      setUploadedImage(null);
      setCurrentCoachSay('');
      setCurrentStudyBoard(null);
      setScreen('activity');
      
      // Initialize conversation will happen via useEffect when screen changes
    }
    return;
  }
  
  // REGULAR SUBJECT ASSESSMENT FLOW
  const nextQuestionIndex = currentAssessment.currentQuestionIndex + 1;
  
  if (nextQuestionIndex < currentAssessment.questions.length) {
    setCurrentAssessment({
      ...currentAssessment,
      currentQuestionIndex: nextQuestionIndex,
      answers: newAnswers
    });
    setUserAnswer('');
    
    const userAge = parseInt(currentUser.age);
    if (userAge <= 6) {
      setTimeout(() => {
        const nextQ = currentAssessment.questions[nextQuestionIndex];
        const ttsLang = currentUser.language || 'en';
        const toSpeak = nextQ.questionKey ? t(nextQ.questionKey, ttsLang) : (nextQ.speak || nextQ.question);
        speak(toSpeak);
      }, 800);
    }
  } else {
    const determinedLevel = determineLevel(newAnswers);
    const newResults = {
      ...assessmentResults,
      [currentAssessment.subject]: determinedLevel
    };
    setAssessmentResults(newResults);
    
    const subjectKeys = Object.keys(subjects);
    const nextSubjectIndex = assessmentSubjectIndex + 1;
    
    if (nextSubjectIndex < subjectKeys.length) {
      const nextSubject = subjectKeys[nextSubjectIndex];
      const ageGroup = getAgeGroup(currentUser.age);
      const questions = assessmentQuestions[nextSubject]?.[ageGroup] || [];
      
      if (questions.length > 0) {
        setCurrentAssessment({
          subject: nextSubject,
          questions: questions,
          currentQuestionIndex: 0,
          answers: []
        });
        setAssessmentSubjectIndex(nextSubjectIndex);
        setUserAnswer('');
        
        const userAge = parseInt(currentUser.age);
        if (userAge <= 6) {
          setTimeout(() => {
            const q0 = questions[0];
            const ttsLang = currentUser.language || 'en';
            const toSpeak = q0.questionKey ? t(q0.questionKey, ttsLang) : (q0.speak || q0.question);
            speak(toSpeak);
          }, 800);
        }
      } else {
        finishAssessment(currentUser, newResults);
      }
    } else {
      finishAssessment(currentUser, newResults);
    }
  }
};

  const determineLevel = (answers) => {
    if (answers.length === 0) return 0;
    
    const correctCount = answers.filter(a => {
      return a.answer && a.answer.length > 0;
    }).length;
    
    const percentage = correctCount / answers.length;
    
    if (percentage >= 0.8) {
      return Math.max(...answers.map(a => a.level));
    } else if (percentage >= 0.5) {
      return Math.floor(answers.reduce((sum, a) => sum + a.level, 0) / answers.length);
    } else {
      return 0;
    }
  };

  const finishAssessment = async (user, levels) => {
    const progress = createInitialProgress(user, levels);
    setUserProgress(progress);
    await saveUserProgress(progress);
    setCurrentAssessment(null);
    setScreen('dashboard');
  };

  const saveUserProgress = async (progress) => {
    const uid = firebaseUser?.uid;
    // Save to Firestore (primary) when authenticated
    if (uid) {
      try {
        await setDoc(doc(db, 'users', uid), progress, { merge: true });
        console.log('Saved to Firestore');
      } catch (error) {
        console.error('Firestore save failed:', error);
      }
    }

    // Also write to localStorage as offline cache
    const cacheKey = uid ? `tutor:uid:${uid}` : `tutor:${progress.name}:${progress.age}`;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(progress));
    } catch {}

    // Legacy key for offline-only path
    if (!uid) {
      try {
        const key = `tutor:${progress.name}:${progress.age}`;
        localStorage.setItem(key, JSON.stringify(progress));
        sessionStorage.setItem(key, JSON.stringify(progress));
      } catch {}
    }
  };

  // === PERFORMANCE TRACKING ===
const trackAttempt = (wasSuccessful) => {
  if (!currentSubject || !userProgress) return;
  
  const subjectProgress = userProgress.subjects[currentSubject];
  
  if (!subjectProgress.recentAttempts) {
    subjectProgress.recentAttempts = [];
  }
  
  subjectProgress.recentAttempts.push({
    timestamp: Date.now(),
    success: wasSuccessful,
    topic: selectedTopic || 'general',
    level: subjectProgress.level
  });
  
  // Keep only last 20 attempts to avoid bloat
  if (subjectProgress.recentAttempts.length > 20) {
    subjectProgress.recentAttempts = subjectProgress.recentAttempts.slice(-20);
  }
  
  // Calculate recent performance
  const last5 = subjectProgress.recentAttempts.slice(-5);
  const failures = last5.filter(a => !a.success).length;
  const isStruggling = failures >= 3;
  
  console.log(`📊 Performance: ${failures}/5 failures, Struggling: ${isStruggling}`);
  
  saveUserProgress(userProgress);
};

  // ─── GRADE ADVANCEMENT ────────────────────────────────────────────────────
  // Public function: advance a subject's grade standalone (for Phase 3 UI buttons)
  const advanceGrade = async (subjectKey) => {
    const newProgress = { ...userProgress };
    const subject = newProgress.subjects[subjectKey];
    const currentGrade = subject.gradeLevel;
    const nextGrade = getNextGrade(currentGrade);

    if (!nextGrade) {
      console.log(`🎓 ${subjectKey}: Already at College — no further advancement`);
      return;
    }

    const oldGradeName = GRADES[currentGrade]?.name || currentGrade;
    const newGradeName = GRADES[nextGrade]?.name || nextGrade;
    const newAgeGroup  = getAgeGroupForGrade(nextGrade);
    const newMaxLevel  = (subjects[subjectKey]?.levels?.[newAgeGroup]?.length ?? 1) - 1;
    const newLevelName = subjects[subjectKey]?.levels?.[newAgeGroup]?.[0] || 'Beginner';

    subject.gradeLevel          = nextGrade;
    subject.level               = 0;
    subject.maxLevel            = newMaxLevel;
    subject.advancementStreak   = 0;
    subject.readyForAdvancement = false;
    subject.difficultyBoost     = 0;
    subject.currentStreak       = 0;

    console.log(`🎓 ADVANCED! ${subjects[subjectKey]?.name || subjectKey}: ${currentGrade} (${oldGradeName}) → ${nextGrade} (${newGradeName})`);
    console.log(`📊 Starting ${subjectKey}: level=0, gradeLevel='${nextGrade}', levelName="${newLevelName}"`);
    console.log(`📐 New maxLevel=${newMaxLevel}, ageGroup='${newAgeGroup}'`);

    setUserProgress(newProgress);
    await saveUserProgress(newProgress);
  };

  // Called when user clicks "Advance" in the modal
  const handleGradeAdvance = async () => {
    if (!gradeAdvancementPending) return;
    const { subjectKey, nextGrade } = gradeAdvancementPending;
    const subjectName = subjects[subjectKey]?.name || subjectKey;
    const newGradeName = GRADES[nextGrade]?.name || nextGrade;
    setGradeAdvancementPending(null);
    await advanceGrade(subjectKey);
    const toast = `🎓 Now learning ${newGradeName} ${subjectName}!`;
    setGradeToast(toast);
    setTimeout(() => setGradeToast(null), 4000);
  };

  // Called when user clicks "Stay" in the modal
  const handleGradeStay = async () => {
    if (!gradeAdvancementPending) return;
    const { subjectKey } = gradeAdvancementPending;
    setGradeAdvancementPending(null);
    const newProgress = { ...userProgress };
    const subject = newProgress.subjects[subjectKey];
    subject.advancementStreak   = 0;
    subject.readyForAdvancement = false;
    console.log(`🎓 ${subjectKey}: User chose to stay — advancementStreak reset`);
    setUserProgress(newProgress);
    await saveUserProgress(newProgress);
  };

  const updateProgress = async (subjectKey, wasCorrect) => {
    const newProgress = { ...userProgress };
    const subject = newProgress.subjects[subjectKey];

    subject.totalAttempts += 1;
    if (wasCorrect) {
      subject.correctAnswers += 1;
      subject.points += 10;
      subject.currentStreak += 1;
      newProgress.totalPoints += 10;

      if (subject.currentStreak >= 3) {
        if (subject.level < subject.maxLevel) {
          subject.level += 1;
          subject.currentStreak = 0;
        } else {
          // AT MAX LEVEL — track advancement streak
          subject.difficultyBoost   = (subject.difficultyBoost   || 0) + 1;
          subject.advancementStreak = (subject.advancementStreak || 0) + 1;
          subject.currentStreak     = 0;
          console.log(`🎯 Max level reached! Difficulty boost: ${subject.difficultyBoost}`);

          if (subject.advancementStreak >= 5) {
            const currentGrade = subject.gradeLevel;
            const nextGrade    = getNextGrade(currentGrade);
            if (nextGrade) {
              subject.readyForAdvancement = true;
              console.log(`🎓 Ready to advance! ${subjects[subjectKey]?.name}: ${currentGrade} → ${nextGrade} — showing modal`);
              // Trigger modal (set after saving below)
              setTimeout(() => setGradeAdvancementPending({ subjectKey, currentGrade, nextGrade }), 50);
            } else {
              subject.readyForAdvancement = true;
              console.log(`🎓 ${subjectKey}: Already at College — maintaining max difficulty`);
            }
          } else {
            subject.readyForAdvancement = subject.advancementStreak >= 3;
            console.log(`🎓 Ready to advance! advancementStreak: ${subject.advancementStreak}/5`);
          }
        }
      }
    } else {
      subject.currentStreak = 0;
    }

    subject.activitiesCompleted += 1;
    newProgress.totalActivities += 1;
    newProgress.lastActivity = new Date().toISOString();

    setUserProgress(newProgress);
    await saveUserProgress(newProgress);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      console.error('Speech recognition not initialized');
      return;
    }
    
    if (isListening) {
      // Stop listening
      try {
        recognitionRef.current.stop();
        console.log('Stopped listening');
      } catch (error) {
        console.error('Error stopping recognition:', error);
        setIsListening(false);
      }
    } else {
      // Start listening
      try {
        // Make sure it's not already running
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore - it wasn't running
      }
      
      // Set language dynamically — userProgress is null for new users in assessment,
      // so fall back to currentUser.language then selectedLanguage.
      const _recogLangSource = userProgress?.language || currentUser?.language || selectedLanguage;
      if (_recogLangSource) {
        let recognitionLang = _recogLangSource;

        if (currentSubject === 'languages' && selectedTopic) {
          // Learning a language — recognise the TARGET language, not profile language
          recognitionLang = LANGUAGE_NAME_TO_CODE[selectedTopic] || selectedTopic;
          console.log('🎯 Language learning mode: recognizing', selectedTopic, '->', recognitionLang);
        } else {
          console.log('✅ Regular mode: using language', recognitionLang);
        }

        recognitionRef.current.lang = LANGUAGE_LOCALE_MAP[recognitionLang] || 'en-US';
        console.log('✅ Speech recognition set to:', recognitionRef.current.lang);
      }
      
      // Small delay to ensure clean state
      setTimeout(() => {
        try {
          recognitionRef.current.start();
          setIsListening(true);
          console.log('Started listening - speak now!');
          
        } catch (error) {
          console.error('Could not start recognition:', error);
          setIsListening(false);
          
          // Show helpful error message to user
          if (error.message && error.message.includes('already started')) {
            console.log('Recognition already started, trying to reset...');
            setTimeout(() => toggleListening(), 500);
          }
        }
      }, 100);
    }
  };

  const startListeningNow = () => {
    if (!recognitionRef.current) return;

    // Force stop first
    try {
      recognitionRef.current.abort();
      setIsListening(false);
    } catch (e) {
      // Ignore
    }

    // Set language — same fallback chain as toggleListening
    const _recogLangSource = userProgress?.language || currentUser?.language || selectedLanguage;
    if (_recogLangSource) {
      let recognitionLang = _recogLangSource;
      if (currentSubject === 'languages' && selectedTopic) {
        recognitionLang = LANGUAGE_NAME_TO_CODE[selectedTopic] || selectedTopic;
      }
      recognitionRef.current.lang = LANGUAGE_LOCALE_MAP[recognitionLang] || 'en-US';
      console.log('✅ startListeningNow: speech recognition set to:', recognitionRef.current.lang);
    }

    setTimeout(() => {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        console.log('Started listening');
      } catch (error) {
        console.error('Could not start recognition:', error);
        setIsListening(false);
      }
    }, 200);
  };

const speak = (text, onComplete) => {
  if (!synthRef.current) {
    console.log('Speech synthesis not available');
    if (onComplete) onComplete();
    return;
  }
  
  if (!ttsEnabled) {
    console.log('TTS is disabled');
    if (onComplete) onComplete();
    return;
  }

  // Strip all emoji and pictographic symbols before speaking
  text = text.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim();
  if (!text) { if (onComplete) onComplete(); return; }

  console.log('Speaking:', text.substring(0, 50) + '...');

  // iOS FIX: Resume speech synthesis (iOS often suspends it)
  if (synthRef.current.speaking || synthRef.current.pending) {
    console.log('iOS Fix: Canceling previous speech');
    synthRef.current.cancel();
  }
  
  // iOS FIX: Resume if paused (common iOS issue)
  if (synthRef.current.paused) {
    console.log('iOS Fix: Resuming paused speech synthesis');
    synthRef.current.resume();
  }

  const cleanText = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

  if (!cleanText.trim()) {
    console.log('No text to speak after cleaning');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 0.9;
  utterance.pitch = 1.1;
  utterance.volume = 1.0;

  const voices = synthRef.current.getVoices();
  console.log('Available voices:', voices.length);

  // iOS FIX: If no voices loaded yet, retry with increasing delays.
  // iOS loads voices asynchronously and 100ms is often too short.
  if (voices.length === 0) {
    console.log('iOS Fix: No voices loaded yet, will retry...');
    window.speechSynthesis.getVoices(); // trigger loading

    const retryDelays = [200, 500, 1000];
    const tryRetry = (delays) => {
      if (delays.length === 0) {
        console.log('iOS Fix: Voices never loaded, speaking without preferred voice');
        synthRef.current.speak(utterance); // last resort: speak with default voice
        return;
      }
      setTimeout(() => {
        const retryVoices = synthRef.current.getVoices();
        console.log('iOS Fix: Voices after retry:', retryVoices.length);
        if (retryVoices.length > 0) {
          speak(text, onComplete); // retry with voice selection
        } else {
          tryRetry(delays.slice(1));
        }
      }, delays[0]);
    };
    tryRetry(retryDelays);
    return;
  }

  // Get user's language — userProgress is null for new users still in assessment,
  // so fall back to currentUser.language (set on welcome screen) then selectedLanguage.
  const userLang = userProgress?.language || currentUser?.language || selectedLanguage || 'en';

  // Detect if text contains Japanese characters
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  const hasKorean = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text);
  const hasChinese = /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text);

  // If learning a language, use target language voice for target language words
  let voiceLang = userLang;
  if (currentSubject === 'languages') {
    if (hasJapanese) voiceLang = 'ja';
    else if (hasKorean) voiceLang = 'ko';
    else if (hasChinese) voiceLang = 'zh';
  }

  // Tell the browser which language the text is in — critical for correct pronunciation
  utterance.lang = LANGUAGE_LOCALE_MAP[voiceLang] || 'en-US';
  
  // Language-specific voice preferences - PRIORITIZED BY QUALITY
  const languageVoiceMap = {
    'en': [
      // iOS voices (prioritize for iOS)
      'Samantha',
      'Karen',
      'Ava',
      'Allison',
      'Susan',
      // Google voices (fallback)
      'Google US English',
      'Google UK English Female',
      // Microsoft voices
      'Microsoft Zira',
      'Microsoft David',
      'Samantha (Enhanced)',
      'Ava (Enhanced)',
      'Vicki',
      'Victoria'
    ],
    'es': ['Monica', 'Paulina', 'Google español', 'Juan', 'Diego'],
    'vi': ['Vietnamese', 'Google tiếng Việt'],
    'zh': ['Ting-Ting', 'Sin-ji', 'Google 普通话', 'Google 中文'],
    'fr': ['Thomas', 'Amélie', 'Google français'],
    'ar': ['Maged', 'Google العربية'],
    'hi': ['Lekha', 'Google हिन्दी'],
    'pt': ['Luciana', 'Felipe', 'Google português'],
    'ja': ['Kyoko', 'Otoya', 'Google 日本語'],
    'ko': ['Yuna', 'Google 한국어'],
    'de': ['Anna', 'Helena', 'Google Deutsch'],
    'ru': ['Milena', 'Yuri', 'Google русский']
  };
  
  const preferredVoiceNames = languageVoiceMap[voiceLang] || languageVoiceMap['en'];
  
  if (voices.length > 0) {
    // Try to find preferred voice by name
    let selectedVoice = null;
    
    // First pass: Look for exact matches (case-insensitive)
    for (const voiceName of preferredVoiceNames) {
      selectedVoice = voices.find(v => 
        v.name.toLowerCase().includes(voiceName.toLowerCase())
      );
      if (selectedVoice) {
        console.log('Found preferred voice:', selectedVoice.name);
        break;
      }
    }
    
    // Second pass: Try to find premium/enhanced voices
    if (!selectedVoice && userLang === 'en') {
      selectedVoice = voices.find(v => 
        v.name.includes('Enhanced') || 
        v.name.includes('Premium') ||
        v.name.includes('Google')
      );
    }
    
    // Third pass: Find any voice for this language
    if (!selectedVoice) {
      const langPrefix = voiceLang === 'zh' ? 'zh-' : voiceLang;
      selectedVoice = voices.find(v => v.lang.startsWith(langPrefix));
    }
    
    // Fallback to first available voice
    if (!selectedVoice) {
      selectedVoice = voices[0];
    }
    
    utterance.voice = selectedVoice;
    console.log('Using voice:', selectedVoice.name, 'for language:', voiceLang);
  }

  utterance.onstart = () => {
    setIsSpeaking(true);
    console.log('Speech started');
  };
  
  utterance.onend = () => {
    setIsSpeaking(false);
    console.log('Speech ended');
    if (onComplete) onComplete();
  };
  
  utterance.onerror = (event) => {
    setIsSpeaking(false);
    console.error('Speech error:', event.error, event);
    
    // iOS FIX: If error is 'interrupted' or 'canceled', it might be iOS issue
    if (event.error === 'interrupted' || event.error === 'canceled') {
      console.log('iOS Fix: Speech was interrupted, this is normal on iOS');
    }
    
    if (onComplete) onComplete();
  };

  try {
    // iOS FIX: Small delay before speaking helps iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      console.log('iOS detected: Using iOS-optimized speech');
      setTimeout(() => {
        synthRef.current.speak(utterance);
        console.log('Speech queued successfully (iOS)');
      }, 50); // 50ms delay for iOS
    } else {
      synthRef.current.speak(utterance);
      console.log('Speech queued successfully');
    }
  } catch (error) {
    console.error('Error speaking:', error);
    setIsSpeaking(false);
  }
};

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setUploadedImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const startHomeworkHelp = () => {
    setIsHomeworkMode(true);
    setCurrentSubject('homework');
    setConversation([]);
    setUserAnswer('');
    setUploadedImage(null);
    setScreen('activity');
    
    const welcomeMessage = {
      role: 'assistant',
      content: parseInt(userProgress.age) <= 6 
        ? "Hi! 👋 Show me your homework! Take a picture or tell me what you need help with! 📸"
        : "Hello! I'm here to help with your homework. You can upload a photo of your work or describe what you need help with."
    };
    setConversation([welcomeMessage]);
    
    if (parseInt(userProgress.age) <= 6) {
      setTimeout(() => speak(welcomeMessage.content), 300);
    }
  };

  // Smart visual creator
  const createSmartVisual = (questionText, subject) => {
    const text = questionText.toLowerCase();
    
    console.log('Creating smart visual for:', questionText, 'subject:', subject);
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
    
    // Spelling/Words
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
  };

  // Infer visualType from the visual object's shape when the AI omits it,
  // and rescue boards where the AI placed visual fields directly on study_board
  // instead of nesting them inside a `visual` field.
  const normalizeStudyBoard = (board) => {
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
    if (!v || board.visualType) return board; // already has type, nothing to do

    // Infer visualType from the shape of `visual`
    if (Array.isArray(v)) {
      board = { ...board, visualType: 'choice' };
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
  };

async function startActivity(subjectKey) {
  const ageNum = parseInt(userProgress.age);
  
  // Show topic selection for:
  // - Math/Writing for ages 13+
  // - Languages for ALL ages (kids learn languages early!)
  // - Test Prep for ages 10+ (if they need it)
  const shouldShowTopicSelection = 
    (ageNum >= 13 && (subjectKey === 'math' || subjectKey === 'writing')) ||
    (subjectKey === 'languages') || // Everyone gets to choose language!
    (ageNum >= 10 && subjectKey === 'test-prep');
  
  if (shouldShowTopicSelection && advancedTopics[subjectKey]) {
    setCurrentSubject(subjectKey);
    setShowTopicSelection(true);
    return;
  }
  
  // Otherwise proceed normally
  startActivityWithTopic(subjectKey, null);
}

// === LANGUAGE TEACHING HELPERS ===

const getLanguageSpecificTips = (langCode, age) => {
  const ageNum = parseInt(age);
  const tips = {
    'es': `Spanish Tips:
- It's phonetic - sounds match letters!
- Focus on pronunciation: rr, ñ, j sounds
- Gender matters: el (masculine) vs la (feminine)
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Start with: colors, numbers, greetings, animals' : ''}
${ageNum > 7 ? '- Use cognates: "animal" = animal, "chocolate" = chocolate' : ''}
- Verbs change based on who does the action`,

    'fr': `French Tips:
- Many silent letters (letters you don't say)
- Words connect together (liaisons)
- Gender: le (masculine) vs la (feminine)
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Start with songs: "Frère Jacques", "Alouette"' : ''}
- Nasal sounds are special: an, on, in, un
- Accent marks change pronunciation: é è ê`,

    'zh': `Chinese (Mandarin) Tips:
- It's TONAL - pitch changes the meaning!
- 4 tones plus neutral: → ˊ ˇ ˋ (flat, rising, dip, falling)
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Only speaking/listening for young learners' : ''}
- Start with Pinyin (romanization)
- Characters come much later
- Simple words first: māma (mom), bàba (dad), māo (cat)`,

    'vi': `Vietnamese Tips:
- It's TONAL - 6 different tones!
- Use tone markers: à á ả ã ạ
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Focus purely on speaking and listening' : ''}
- Pronunciation is key to being understood
- Grammar is actually simple (no conjugations!)
- Many Chinese loanwords`,

    'ja': `Japanese Tips:
- 3 writing systems (hiragana, katakana, kanji)
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Writing comes much later, focus on speaking' : ''}
${ageNum > 7 ? '- Start with hiragana (phonetic alphabet)' : ''}
- Particles are important: は、が、を、に
- Levels of politeness (casual vs formal)
- Subject is often dropped`,

    'de': `German Tips:
- 3 genders: der (masculine), die (feminine), das (neuter)
- Nouns are always capitalized
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Start simple: greetings, animals, colors' : ''}
- Compound words are common (Donaudampfschifffahrt!)
- Word order changes in different sentences
- Cases change "the": der → den → dem → des`,

    'ko': `Korean Tips:
- Hangul alphabet is actually easy to learn!
- Letters combine into syllable blocks
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Speaking and listening first' : ''}
- Levels of formality (casual vs polite vs formal)
- Subject-Object-Verb word order
- Particles attach to words: 은/는, 이/가, 을/를`,

    'pt': `Portuguese Tips:
- Similar to Spanish but different pronunciation
- Nasal sounds are key: ão, ã, õe
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Start with: animals, colors, family words' : ''}
- Gender: o (masculine) vs a (feminine)
- Brazilian vs European Portuguese differ
- Many verb tenses`,

    'ar': `Arabic Tips:
- Written right to left!
- Letters change shape (beginning/middle/end/alone)
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Pure speaking/listening approach' : ''}
- Emphasis sounds: ع ح ق
- Short vowels are marks above/below
- Root system (3 letter roots)
- No "is/are" in present tense`,

    'ru': `Russian Tips:
- Cyrillic alphabet (different letters)
- 6 cases change word endings
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Start with speaking familiar words' : ''}
- No "a/an/the" words
- Gender: masculine, feminine, neuter
- Aspect system (perfective vs imperfective)
- Palatalization (soft vs hard sounds)`,

    'hi': `Hindi Tips:
- Devanagari script (different alphabet)
- Gender affects everything (masculine/feminine)
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Speaking and listening first' : ''}
- Postpositions instead of prepositions
- Verb comes at the end
- Formal vs informal "you"
- Many English loanwords`
  };
  
  return tips[langCode] || 'Focus on building confidence through regular practice and real communication!';
};

// NEW FUNCTION - Add this right after startActivity
async function startActivityWithTopic(subjectKey, topicId) {

  // If this is a language and user hasn't been assessed yet, start language assessment
  if (subjectKey === 'languages' && topicId && languageAssessmentQuestions[topicId]) {
    // Ensure languageLevels property exists
    if (!userProgress.subjects.languages.languageLevels) {
      console.log('⚠️ languageLevels missing, creating it now');
      userProgress.subjects.languages.languageLevels = {};
      await saveUserProgress(userProgress);
    }
    
    const languageProgress = userProgress.subjects.languages;
    
    // Debug logging
    console.log('=== LANGUAGE ASSESSMENT CHECK ===');
    console.log('topicId:', topicId);
    console.log('languageProgress.languageLevels:', languageProgress.languageLevels);
    console.log('languageProgress.languageLevels[topicId]:', languageProgress.languageLevels[topicId]);
    
    // Check if this specific language has been assessed
    if (languageProgress.languageLevels[topicId] === undefined) {
      console.log('Starting language assessment for:', topicId);
      startLanguageAssessment(topicId);
      return;
    } else {
      console.log(`✓ Language already assessed: ${topicId} at level ${languageProgress.languageLevels[topicId]}`);
    }
  }

  setShowTopicSelection(false);
  setIsHomeworkMode(false);
  setCurrentSubject(subjectKey);
  setSelectedTopic(topicId);
  setConversation([]);
  setUserAnswer('');
  setUploadedImage(null);
  setCurrentCoachSay('');
  setCurrentStudyBoard(null);
  setScreen('activity');
  
  const subject = subjects[subjectKey];
  
  // Ensure ageGroup is set
  if (!userProgress.ageGroup) {
    userProgress.ageGroup = getAgeGroup(userProgress.age);
    await saveUserProgress(userProgress);
  }
  
  // Ensure subject progress exists
  if (!userProgress.subjects[subjectKey]) {
    console.error(`Missing subject progress for: ${subjectKey}`);
    const ageGroup = userProgress.ageGroup || getAgeGroup(userProgress.age);
    userProgress.subjects[subjectKey] = {
      level: getStartingLevel(userProgress.age, subjectKey),
      maxLevel: subject.levels[ageGroup].length - 1,
      points: 0,
      activitiesCompleted: 0,
      correctAnswers: 0,
      totalAttempts: 0,
      currentStreak: 0
    };
    if (subjectKey === 'languages') {
      userProgress.subjects[subjectKey].languageLevels = {};
    }
    await saveUserProgress(userProgress);
  } else if (subjectKey === 'languages' && !userProgress.subjects[subjectKey].languageLevels) {
    // Ensure languageLevels exists even if languages subject exists
    console.log('🔧 Adding languageLevels to languages subject');
    userProgress.subjects[subjectKey].languageLevels = {};
    await saveUserProgress(userProgress);
  }
  
  const level = userProgress.subjects[subjectKey]?.level || 0;
  const ageGroup = userProgress.ageGroup || getAgeGroup(userProgress.age);
  const levelName = subject.levels[ageGroup]?.[level] || subject.levels[ageGroup]?.[0] || 'Beginner';
  const difficultyBoost = userProgress.subjects[subjectKey]?.difficultyBoost || 0;
  
  console.log(`📊 Starting ${subjectKey}: level=${level}, levelName="${levelName}", ageGroup="${ageGroup}", difficultyBoost=${difficultyBoost}`);
  
  setIsLoading(true);

  try {
    const ageNum = parseInt(userProgress.age);
    
    // TTS should be enabled for young kids OR anyone learning a language (need to hear pronunciation)
    const shouldUseTTS = (ageNum <= AGE_BOUNDARIES.TTS_MAX || subjectKey === 'languages') && ttsEnabled && synthRef.current;
    
    // Get subject constraint - handle topics dynamically for ALL subjects
    let constraint;
    if (topicId) {
      const topic = advancedTopics[subjectKey]?.find(t => t.id === topicId);
      if (topic) {
        // Topic-specific constraint for ANY subject with topics
        constraint = `CRITICAL: ONLY teach ${topic.name.toUpperCase()}. Focus exclusively on: ${topic.description}. DO NOT switch to other topics like ${advancedTopics[subjectKey]?.filter(t => t.id !== topicId).map(t => t.name).join(', ')}. Every question must be about ${topic.name}.`;
      } else {
        constraint = subjectConstraints[subjectKey];
      }
    } else {
      constraint = subjectConstraints[subjectKey];
    }
    
let systemPrompt = getSunnySystemPrompt({
  name: userProgress.name,
  age: ageNum,
  profileLang: userProgress.language || 'en',  // User's interface language
  learningLang: subjectKey === 'languages' ? topicId : null, // Only for language learning
  hasHistory: userProgress.assessmentCompleted
}) + `\n\n=== TEACHING APPROACH ===
${subjectKey === 'languages' && topicId ? `
You're teaching ${topicId.toUpperCase()} to a ${level === 0 ? 'complete beginner' : 'beginner-level'} student.

TEACHING PHILOSOPHY:
- Be warm, encouraging, and creative
- Make learning fun and engaging
- Adapt to the student's responses and pace
- Use natural conversation, not rigid templates
- Celebrate progress and build confidence

${level === 0 ? `
FOR COMPLETE BEGINNERS:
- They don't know any ${topicId} yet, so INTRODUCE words before asking about them
- Show the word → explain what it means → help them practice
- Think: "I'm showing them something new" not "testing what they know"
- If they're confused, teach or reteach warmly - don't keep asking the same question
- Mix teaching with gentle practice in a natural flow
- Use creativity: stories, connections, mnemonics, context
- Make pronunciation practice feel like a game, not a drill

ENGAGEMENT IDEAS:
- Use relatable examples ("This word is like..." or "You say this when...")
- Make connections to things they know
- Add little cultural notes when relevant
- Vary your approach - don't sound robotic
- Show genuine enthusiasm for the language
- Build on what they're learning progressively

` : `
FOR INTERMEDIATE LEARNERS:
- Build on their existing vocabulary
- Introduce simple grammar naturally through examples
- Practice short conversations
- Gently correct mistakes while encouraging
`}

PRONUNCIATION:
- Accept close attempts warmly ("Great try!" or "Almost there!")
- Romanization variations are fine (konnichiwa = konichiwa)
- Only correct if significantly wrong, and do it kindly
- Celebrate effort and progress

BE CREATIVE AND ADAPTIVE - You're a skilled teacher, not a script reader.
` : `Respond in ${LANGUAGES.find(l => l.code === userProgress.language)?.name || 'English'} only.`}
SUBJECT: ${subject.name}
LEVEL: ${levelName}${difficultyBoost > 0 ? ` (+${difficultyBoost} difficulty boost - MASTERED this level, make it HARDER!)` : ''}
${constraint}`;

// Build user message with topic if selected
let userMessage;
// === ADAPTIVE TEACHING GUIDANCE ===
const adaptiveTeachingGuidance = `
ADAPTIVE TEACHING: Read the student's responses and adapt naturally.
- Confused or wrong repeatedly? Switch approach or explain differently
- Doing well? Add a bit more challenge
- Struggling? Break it down smaller or try a different angle
- Bored? Add variety and interest

${subjectKey === 'languages' ? 'For language learning: Keep it conversational and natural, not like flashcards.' : 'MATH: Visual examples. READING: Phonics with colors. SPELLING: Break into syllables.'}
`;

// === FOREIGN LANGUAGE TEACHING ===
// Only add language-specific teaching guidance when actually teaching a language subject.
// For core subjects (reading, math, etc.) this block would add contradictory instructions
// like "VERBAL ONLY / NO reading/writing" to a Reading session.
const userAge = ageNum;

if (subjectKey === 'languages' && topicId) {
  const stage = getLanguageLearningStage(userAge);
  const langName = topicId.charAt(0).toUpperCase() + topicId.slice(1);

  const languageTeachingPrompt = `
LANGUAGE: ${langName} | Age ${userAge} | ${stage.focus}
${userAge <= 7 ? 'Ages 4-7: VERBAL ONLY. Listen/repeat 3-5x, songs, visual+verbal, games. NO reading/writing.' : userAge <= 12 ? 'Ages 8-12: Speaking+reading+simple writing. Conversations, simple texts, basic writing.' : 'Ages 13+: All skills. Speaking, listening, reading, writing, grammar, culture.'}
Make it fun, use interests, celebrate wins, little/often.
`;

  systemPrompt += languageTeachingPrompt;

  // Append language-specific curriculum (hiragana order for Japanese, tones for Mandarin, etc.)
  const langSpecific = getLanguageSpecificInstructions(topicId);
  if (langSpecific) systemPrompt += langSpecific;
}
// Add this to your system prompt
systemPrompt += adaptiveTeachingGuidance;

// === QUESTION VARIETY ===
systemPrompt += `
VARIETY: MATH-vary numbers(1-20)/objects(🍎🍪🐸⭐). SPELLING-rotate words. READING-different stories. LANGUAGES-rotate themes. Think 50+ questions, shuffle each session. Never repeat. Session: ${new Date().toISOString()}
`;

// === CAREER COUNSELOR MODE ===
if (subjectKey === 'career') {
  systemPrompt += `
CAREER COUNSELOR for ${userProgress.name} (${userProgress.age}): 20min assessment (1Q at a time): interests, strengths, values, goals. Then: 3-5 AI-proof careers with why/outlook/education. ACTION PLANS with exact resources: DAILY ("Mon 7am: Read 'Deep Work' Ch1"), WEEKLY (skills/goals), MONTHLY (12mo roadmap). RESOURCES: exact titles ("Atomic Habits"/James Clear, "CS50"/Harvard). TRACKING: daily/weekly/monthly. Be specific, actionable, encouraging.
`;
}

if (topicId) {
  const topic = advancedTopics[subjectKey]?.find(t => t.id === topicId);
  if (topic) {
    // Special handling for languages - teach first, then practice
    if (subjectKey === 'languages') {
      userMessage = level === 0
        ? `Start the ${topicId} lesson. This student is a COMPLETE BEGINNER — they know zero ${topicId} words.

YOUR FIRST RESPONSE MUST BE A TEACH TURN:
- state: "teach"
- expect: "none"
- correctAnswer: null
- Introduce ONE useful word or phrase (e.g. a greeting)
- Show it on the study board as a flashcard (visualType: "flashcard") with the word and its English meaning
- Explain it warmly in coach_say (e.g. "Here's your first ${topicId} word: 'Hola' — it means Hello!")
- Do NOT ask any question — just present and explain the word
- Tell them to type it or say "ready" when they want to practice

After they respond, THEN test them with a practice question (state: "ask") about the word you just taught.`
        : `Continue the ${topicId} lesson. The student knows some basics already. Introduce one new word or phrase, then practice it.`;
    } else {
      // CRITICAL: Include the student's level when teaching topics
      userMessage = `Start teaching ${subject.name} - ${topic.name} at ${levelName} level. The student is at ${levelName} level, so teach ${topic.name} concepts appropriate for that level. Focus on: ${topic.description}. Present a NEW, VARIED question.`;
    }
  } else {
    if (subjectKey === 'languages' && topicId) {
      userMessage = level === 0
        ? `Start the ${topicId} lesson. This student is a COMPLETE BEGINNER — they know zero ${topicId} words.

YOUR FIRST RESPONSE MUST BE A TEACH TURN:
- state: "teach"
- expect: "none"
- correctAnswer: null
- Introduce ONE useful word or phrase (e.g. a greeting)
- Show it as a flashcard (visualType: "flashcard") with the word and its English meaning
- Explain it warmly — do NOT ask a question yet
- Tell them to type it or say "ready" when they want to practice

After they respond, THEN test them with a practice question about what you just taught.`
        : `Continue ${topicId} lesson. Student knows some basics. Introduce new vocabulary and practice it.`;
    } else {
      userMessage = `Start teaching ${subject.name} at level: ${levelName}. Present a NEW, VARIED question (use random numbers and different objects/scenarios each time).`;
    }
  }
} else {
  if (subjectKey === 'career') {
    userMessage = `Begin career counseling session with ${userProgress.name} (age ${userProgress.age}). Start with a warm introduction, then begin the comprehensive assessment. Remember: be conversational, ask one question at a time, and make this a dialogue, not an interrogation.`;
  } else if (ageNum <= AGE_BOUNDARIES.AUTO_SUBMIT_MAX) {
    // For very young kids (≤6): skip warmup/confirmation, go straight to a question
    userMessage = `Start teaching ${subject.name} at level: ${levelName}. The student is ${ageNum} years old.

CRITICAL RULES FOR YOUNG LEARNERS:
- Use state "ask" IMMEDIATELY — do NOT use state "teach" as your first response
- Do NOT say "Are you ready?" or ask for confirmation — just begin!
- Present a simple, fun scenario or question RIGHT AWAY
- Use visualType "choice" with 2-3 picture/emoji options whenever possible (e.g. ["Share 🤝", "Keep it 😤"])
- Keep coach_say to ONE short sentence with a big emoji
- Make it feel like a game, not a lesson`;
  } else {
    userMessage = `Start teaching ${subject.name} at level: ${levelName}${difficultyBoost > 0 ? ` (student has MASTERED this level ${difficultyBoost} times - challenge them with HARDER questions!)` : ''}. Present a NEW, VARIED question (use random numbers and different objects/scenarios each time).`;
  }
}

    console.log(`📤 Sending to API: level=${level}, levelName="${levelName}", difficultyBoost=${difficultyBoost}, userMessage="${userMessage.substring(0, 100)}..."`);

    fetchAbortRef.current?.abort();
    fetchAbortRef.current = new AbortController();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: fetchAbortRef.current.signal,
      body: JSON.stringify({
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userMessage
        }]
      })
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const errMsg = errBody?.error?.message || errBody?.error || JSON.stringify(errBody);
      console.error('API Error:', response.status, errMsg, errBody);
      throw new Error(`API ${response.status}: ${errMsg}`);
    }

    const data = await response.json();

    if (!data || !data.content || !data.content[0] || !data.content[0].text) {
      console.error('Invalid API response:', data);
      throw new Error('Invalid response from API');
    }

    const aiResponseText = data.content[0].text;

    console.log('AI Response:', aiResponseText);

    try {
      const sunnyResponse = extractJSON(aiResponseText);
      validateSunnyResponse(sunnyResponse);
      
      sunnyResponse.study_board = normalizeStudyBoard(sunnyResponse.study_board);
      if (!sunnyResponse.study_board || !sunnyResponse.study_board.visual || sunnyResponse.study_board.visualType === 'none') {
        console.log('No visual in response, creating fallback');
        sunnyResponse.study_board = createSmartVisual(sunnyResponse.coach_say, subjectKey);
      }

      console.log('Final Sunny Response:', sunnyResponse);
      
      setCurrentCoachSay(sunnyResponse.coach_say);
      
      // Only set study board if it actually has content
      if (sunnyResponse.study_board && sunnyResponse.study_board.visual) {
        console.log('✅ Setting study board with visual:', sunnyResponse.study_board.visual);
        setCurrentStudyBoard({
          ...sunnyResponse.study_board,
          audioPrompt: sunnyResponse.audioPrompt,
          correctAnswer: sunnyResponse.correctAnswer
        });
      } else {
        console.log('⚠️ No visual in study_board, clearing it');
        setCurrentStudyBoard(null);
      }
      
      const aiMessage = {
        role: 'assistant',
        content: sunnyResponse.coach_say
      };
      setConversation([aiMessage]);
      
if (shouldUseTTS) {
  setTimeout(() => {
    // For spelling, speak the word to spell, not the instructions
    if (subjectKey === 'spelling' && (sunnyResponse.audioPrompt || sunnyResponse.correctAnswer)) {
      const word = sunnyResponse.audioPrompt || sunnyResponse.correctAnswer;
      // Speak the word clearly, spell it out, then repeat
      speak(`The word is: ${word}. ${word}. Can you spell ${word}?`);
    } else if (subjectKey === 'languages' && sunnyResponse.correctAnswer) {
      // For language learning, ALWAYS speak the target word (correctAnswer), not the visual
      // Visual might be an emoji (👁️) which can't be spoken
      // correctAnswer is the actual word (e.g., "ojo" for eye)
      const targetWord = sunnyResponse.correctAnswer;
      
      // Speak instruction first, THEN speak the target word when it finishes
      speak(sunnyResponse.coach_say, () => {
        // After instruction finishes, speak the target word 3 times
        speak(`${targetWord}. ${targetWord}. ${targetWord}.`);
      });
    } else {
      speak(sunnyResponse.coach_say);
    }
  }, 500);
}
    } catch (error) {
      console.error('Failed to parse JSON, using fallback:', error);
      console.log('Raw response:', aiResponseText);
      
      const coachSayMatch2 = aiResponseText.match(/"coach_say"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const fallbackCoachSay = coachSayMatch2 ? coachSayMatch2[1] : "Let's keep going! What do you think?";
      const fallbackBoard = createSmartVisual(aiResponseText, subjectKey);

      console.log('Fallback board:', fallbackBoard);
      console.log('Fallback text:', fallbackCoachSay);

setCurrentCoachSay(fallbackCoachSay);
setCurrentStudyBoard({
  ...fallbackBoard,
  audioPrompt: null,
  correctAnswer: null
});
      
      const aiMessage = {
        role: 'assistant',
        content: fallbackCoachSay
      };
      setConversation([aiMessage]);
      
if (shouldUseTTS) {
  setTimeout(() => {
    speak(fallbackCoachSay);
  }, 500);
}
    }
  } catch (error) {
    if (error.name === 'AbortError') { setIsLoading(false); return; }
    console.error('Error:', error);

    const is529Error = error.message && (error.message.includes('529') || error.message.includes('overload'));
    const is400Error = error.message && error.message.includes('400');

    let errorMessage;
    if (is529Error) {
      errorMessage = {
        role: 'assistant',
        content: 'Sunny is thinking really hard right now! 🤔 The server is a bit busy. Please try again in a moment! ⏱️'
      };
    } else if (is400Error) {
      const detail = error.message.replace('API 400: ', '');
      errorMessage = {
        role: 'assistant',
        content: `❌ API Error (400): ${detail}\n\nCheck the server terminal for details.`
      };
    } else {
      errorMessage = {
        role: 'assistant',
        content: `Oops! Something went wrong. Let's try again! 🌟\n(${error.message})`
      };
    }

    setConversation([errorMessage]);
    setCurrentCoachSay(errorMessage.content);
  }

  setIsLoading(false);
};

const sendMessage = async (providedAnswer = null) => {
  // Clear auto-submit timer if it exists (prevent double submission)
  if (autoSubmitTimerRef.current) {
    console.log('🛑 Clearing auto-submit timer (manual submission)');
    clearTimeout(autoSubmitTimerRef.current);
    autoSubmitTimerRef.current = null;
  }
  
  // Get the answer to send - ensure it's a string
  let answerToSend = providedAnswer !== null ? providedAnswer : userAnswer;
  
  // Make sure it's a string
  if (typeof answerToSend !== 'string') {
    answerToSend = String(answerToSend);
  }
  
  // Trim it
  answerToSend = answerToSend.trim();
  
  if (!answerToSend && !uploadedImage) {
    console.log('No answer to send');
    return;
  }

  setIsLoading(true);
  
  // Safety check - ensure userProgress exists
  if (!userProgress) {
    console.error('❌ sendMessage called but userProgress is null');
    setIsLoading(false);
    return;
  }
  
  // TTS should be enabled for young kids OR anyone learning a language (need to hear pronunciation)
  const ageNum = parseInt(userProgress.age);
  const shouldUseTTS = (ageNum <= AGE_BOUNDARIES.TTS_MAX || currentSubject === 'languages') && ttsEnabled && synthRef.current;

  try {
    // Build API messages array
    const apiMessages = [];

    // Add conversation history - skip leading assistant messages
    let foundFirstUser = false;
    
    for (const msg of conversation) {
      // Skip if no content
      if (!msg.content) continue;
      
      // Skip assistant messages before first user message
      if (!foundFirstUser && msg.role === 'assistant') {
        continue;
      }
      
      if (msg.role === 'user') {
        foundFirstUser = true;
      }
      
      // CRITICAL: Properly extract string content from any format
      let contentString = '';
      
      if (typeof msg.content === 'string') {
        // Perfect - already a string
        contentString = msg.content;
      } else if (msg.content && typeof msg.content === 'object') {
        // It's an object - try to extract the actual text
        if (typeof msg.content.content === 'string') {
          // Nested: {content: {content: 'text'}}
          contentString = msg.content.content;
        } else if (msg.content.text && typeof msg.content.text === 'string') {
          // Has .text property
          contentString = msg.content.text;
        } else if (msg.content.answer && typeof msg.content.answer === 'string') {
          // Has .answer property
          contentString = msg.content.answer;
        } else {
          // Last resort - try to find any string value in the object
          const values = Object.values(msg.content);
          const stringValue = values.find(v => typeof v === 'string' && v.length > 0);
          contentString = stringValue || 'User response';
        }
      } else {
        // Fallback
        contentString = String(msg.content);
      }
      
      apiMessages.push({
        role: msg.role,
        content: contentString
      });
    }

    // Add current user answer to API messages
    if (uploadedImage) {
      const base64Data = uploadedImage.split(',')[1];
      const mediaType = uploadedImage.split(';')[0].split(':')[1];
      
      apiMessages.push({
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data
            }
          },
          {
            type: 'text',
            text: answerToSend || 'Here is my work!'
          }
        ]
      });
    } else {
      // Standard message
      apiMessages.push({
        role: 'user',
        content: answerToSend
      });
    }

    // Debug log
    console.log('=== MESSAGES TO API ===');
    apiMessages.forEach((msg, i) => {
      console.log(`Message ${i}:`, msg.role, typeof msg.content, msg.content);
    });

    const ageNum = parseInt(userProgress.age);
    
    let systemPrompt;
    
    if (isHomeworkMode) {
      systemPrompt = ageNum <= AGE_BOUNDARIES.AUTO_SUBMIT_MAX
        ? `You are helping a ${ageNum}-year-old with homework.
- Use 1-2 VERY short sentences
- Simple words
- Guide with questions, don't give answers
- Super encouraging!
- Use lots of emojis`
        : ageNum <= AGE_BOUNDARIES.YOUNG_MAX
        ? `You are helping a ${ageNum}-year-old with homework.
- Keep responses short (2-3 sentences)
- Guide them to figure it out
- Ask leading questions
- Be encouraging`
        : `You are helping a ${ageNum}-year-old with homework.
- Be concise and clear
- Guide with questions and hints
- Don't just give answers
- Help them learn the concept`;
    } else {
      const subject = subjects[currentSubject];
      const level = userProgress.subjects[currentSubject]?.level || 0;
      const ageGroup = userProgress.ageGroup || getAgeGroup(userProgress.age);
      const levelName = subject.levels[ageGroup]?.[level] || subject.levels[ageGroup]?.[0] || 'Beginner';
      
      // Get subject constraint - handle topics dynamically for ALL subjects
      let constraint;
      if (selectedTopic) {
        const topic = advancedTopics[currentSubject]?.find(t => t.id === selectedTopic);
        if (topic) {
          // Topic-specific constraint for ANY subject with topics
          constraint = `CRITICAL: ONLY teach ${topic.name.toUpperCase()}. Focus exclusively on: ${topic.description}. DO NOT switch to other topics. Every question must be about ${topic.name}.`;
        } else {
          constraint = subjectConstraints[currentSubject];
        }
      } else {
        constraint = subjectConstraints[currentSubject];
      }

      // Build continuation instruction outside the template literal to avoid nested backtick errors
      const topicDisplayName = selectedTopic
        ? (advancedTopics[currentSubject]?.find(t => t.id === selectedTopic)?.name || selectedTopic)
        : null;
      const continuationInstruction = currentSubject === 'languages'
        ? 'LANGUAGE TEACHING CYCLE — follow this strictly:\n' +
          '- If the PREVIOUS turn was a TEACH turn (state was "teach"): the student is now attempting the word you just taught. Do a PRACTICE turn (state: "ask") testing exactly that word.\n' +
          '- If the PREVIOUS turn was a PRACTICE turn (state was "ask"):\n' +
          '  - Correct: celebrate, then TEACH a NEW word/phrase (state: "teach", expect: "none")\n' +
          '  - Incorrect: gently correct, reteach the same word, then ask again (state: "ask")\n' +
          '- NEVER ask about a word the student has not been taught yet.\n' +
          '- Always follow: TEACH one word → PRACTICE that word → TEACH next → PRACTICE → ...'
        : ageNum <= AGE_BOUNDARIES.AUTO_SUBMIT_MAX
          ? 'YOUNG LEARNER RULES (age ' + ageNum + '):\n' +
            '- NEVER ask "Are you ready?" or any confirmation question — always give a NEW question immediately\n' +
            '- Use state "ask" every turn. NEVER use state "teach" for non-language subjects.\n' +
            '- If the answer was correct: celebrate briefly (1 sentence) then ask a NEW question\n' +
            '- If the answer was wrong: gently explain (1 sentence) then ask a SIMPLER version\n' +
            '- Use visualType "choice" with 2-3 fun options whenever possible\n' +
            '- Keep coach_say to ONE short fun sentence'
          : topicDisplayName
            ? 'If correct: Give next ' + topicDisplayName + ' question at ' + levelName + ' level.\nIf incorrect: Teach ' + topicDisplayName + ' concept at ' + levelName + ' level and retry.'
            : 'If correct: Give next ' + subject.name + ' question.\nIf incorrect: Teach ' + subject.name + ' concept and retry.';

      systemPrompt = getSunnySystemPrompt({
        name: userProgress.name,
        age: ageNum,
        profileLang: userProgress.language || 'en',
        learningLang: null,
        hasHistory: userProgress.assessmentCompleted
      }) + `\n\n=== CRITICAL LANGUAGE INSTRUCTION ===
RESPOND ENTIRELY IN ${LANGUAGES.find(l => l.code === (userProgress.language || 'en'))?.name || 'English'}.
ALL your responses, questions, feedback, and encouragement MUST be in ${LANGUAGES.find(l => l.code === (userProgress.language || 'en'))?.name || 'English'}.
The student only speaks ${LANGUAGES.find(l => l.code === (userProgress.language || 'en'))?.name || 'English'}.

${ageNum <= AGE_BOUNDARIES.AUTO_SUBMIT_MAX ? `\n=== VOICE INPUT LENIENCY (Age ${ageNum}) ===
This student uses VOICE INPUT which may have speech-to-text errors. Be VERY lenient:
- Accept phonetic variations (e.g., "ate" vs "eight", "too" vs "two" vs "2")
- Accept spelled-out vs numeric (e.g., "five" = "5")
- Accept capitalization differences
- For spelling questions: Accept if letters are correct even if spacing is off (e.g., "C A T" = "cat" = "CAT")
- Ignore minor transcription errors
- If the answer is close or shows understanding, count it as correct
- Focus on the MEANING, not exact text match
\n` : ''}
=== CRITICAL SUBJECT CONSTRAINT ===
SUBJECT: ${subject.name}${selectedTopic ? ` - TOPIC: ${advancedTopics[currentSubject]?.find(t => t.id === selectedTopic)?.name || selectedTopic}` : ''}
LEVEL: ${levelName}
${constraint}

${selectedTopic ? `CRITICAL: Student selected ${advancedTopics[currentSubject]?.find(t => t.id === selectedTopic)?.name || selectedTopic} specifically. DO NOT switch to other topics within ${subject.name}. Stick to ${advancedTopics[currentSubject]?.find(t => t.id === selectedTopic)?.name || selectedTopic} ONLY. Teach at ${levelName} level.` : `Stay on ${subject.name} ONLY.`}

User just answered: "${answerToSend}".
${continuationInstruction}`;


    }

    fetchAbortRef.current?.abort();
    fetchAbortRef.current = new AbortController();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: fetchAbortRef.current.signal,
      body: JSON.stringify({
        system: systemPrompt,
        messages: apiMessages
      })
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const errMsg = errBody?.error?.message || errBody?.error || JSON.stringify(errBody);
      console.error('API Error:', response.status, errMsg, errBody);
      throw new Error(`API ${response.status}: ${errMsg}`);
    }

    const data = await response.json();

    if (!data || !data.content || !data.content[0] || !data.content[0].text) {
      console.error('Invalid API response:', data);
      throw new Error('Invalid response from API');
    }

    const aiResponseText = data.content[0].text;
      
    if (!isHomeworkMode) {
      try {
        const sunnyResponse = extractJSON(aiResponseText);
        validateSunnyResponse(sunnyResponse);
        
        sunnyResponse.study_board = normalizeStudyBoard(sunnyResponse.study_board);
        if (!sunnyResponse.study_board || !sunnyResponse.study_board.visual || sunnyResponse.study_board.visualType === 'none') {
          sunnyResponse.study_board = createSmartVisual(sunnyResponse.coach_say, currentSubject);
        }

        setCurrentCoachSay(sunnyResponse.coach_say);
        setCurrentStudyBoard({
          ...sunnyResponse.study_board,
          audioPrompt: sunnyResponse.audioPrompt,
          correctAnswer: sunnyResponse.correctAnswer
        });
        
        const wasCorrect = sunnyResponse.state === 'advance' || 
                         aiResponseText.toLowerCase().includes('correct') || 
                         aiResponseText.toLowerCase().includes('great job');
        await updateProgress(currentSubject, wasCorrect);
        
        // Add both messages to conversation - strings only!
        const userMessage = {
          role: 'user',
          content: answerToSend
        };
        
        const aiMessage = {
          role: 'assistant',
          content: sunnyResponse.coach_say
        };
        
        setConversation(prev => [...prev, userMessage, aiMessage]);
        
if (shouldUseTTS) {
  setTimeout(() => {
    // For spelling, speak the word to spell, not the instructions
    if (currentSubject === 'spelling' && (sunnyResponse.audioPrompt || sunnyResponse.correctAnswer)) {
      const word = sunnyResponse.audioPrompt || sunnyResponse.correctAnswer;
      speak(`The word is: ${word}. ${word}. Can you spell ${word}?`);
    } else {
      speak(sunnyResponse.coach_say);
    }
  }, 500);
}
      } catch (error) {
        console.error('Failed to parse response, using fallback');
        
        // Try to extract coach_say from broken JSON before using raw text
        const coachSayMatch = aiResponseText.match(/"coach_say"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const fallbackCoachSay = coachSayMatch ? coachSayMatch[1] : "Let's keep going! What do you think?";
        const fallbackBoard = createSmartVisual(aiResponseText, currentSubject);
        
setCurrentCoachSay(fallbackCoachSay);
setCurrentStudyBoard({
  ...fallbackBoard,
  audioPrompt: null,
  correctAnswer: null
});
        
        const wasCorrect = aiResponseText.toLowerCase().includes('correct') || 
                         aiResponseText.toLowerCase().includes('great job');
        await updateProgress(currentSubject, wasCorrect);
        
        const userMessage = {
          role: 'user',
          content: answerToSend
        };
        
        const aiMessage = {
          role: 'assistant',
          content: fallbackCoachSay
        };
        
        setConversation(prev => [...prev, userMessage, aiMessage]);
        
if (shouldUseTTS) {
  setTimeout(() => {
    speak(fallbackCoachSay);
  }, 500);
}
      }
    } else {
      const wasCorrect = aiResponseText.toLowerCase().includes('correct') || 
                        aiResponseText.toLowerCase().includes('great job') ||
                        aiResponseText.toLowerCase().includes('excellent');
      
      if (!isHomeworkMode) {
        await updateProgress(currentSubject, wasCorrect);
      }

      const userMessage = {
        role: 'user',
        content: answerToSend
      };

      const aiMessage = {
        role: 'assistant',
        content: aiResponseText
      };

      setConversation(prev => [...prev, userMessage, aiMessage]);
      
if (shouldUseTTS) {
  setTimeout(() => {
    speak(aiResponseText.substring(0, 140));
  }, 500);
}
    }

    setUserAnswer('');
    setUploadedImage(null);
      
  } catch (error) {
    if (error.name === 'AbortError') { setIsLoading(false); return; }
    console.error('Error:', error);
    const errorMessage = {
      role: 'assistant',
      content: 'Oops! Let me try again. Please repeat your answer! 🌟'
    };
    setConversation(prev => [...prev, errorMessage]);
  }

  setIsLoading(false);
};

const handleLogin = () => {
  if (userName.trim() && userAge && parseInt(userAge) >= 4 && parseInt(userAge) <= 18) {
    setCurrentUser({ name: userName, age: userAge, language: selectedLanguage }); // ADD language
    setScreen('dashboard');
  }
};

// Simple handlers for StudyBoard - React.memo will prevent unnecessary re-renders
const handleStudyBoardInteraction = (choice) => {
  sendMessage(choice);
};

const handleStudyBoardSubmit = (answer) => {
  sendMessage(answer);
};

const continueAsUser = (user) => {
    setCurrentUser({ name: user.name, age: user.age, language: selectedLanguage });
    setUserName(user.name);
    setUserAge(user.age.toString());
    loadUserProgress({ name: user.name, age: user.age, language: selectedLanguage });
  };

  const goHome = () => {
    setScreen('dashboard');
    setCurrentSubject(null);
    setConversation([]);
    setUserAnswer('');
    setUploadedImage(null);
    setCurrentCoachSay('');
    setCurrentStudyBoard(null);
  };

  const logout = async () => {
    try { await firebaseSignOut(auth); } catch {}
    setCurrentUser(null);
    setUserProgress(null);
    setFirebaseUser(null);
    setUserName('');
    setUserAge('');
    setScreen('auth');
  };

  // Loading while Firebase checks auth state
  if (authLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2F2F7' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>☀️</div>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #E5E5EA', borderTopColor: '#7C3AED', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // 1. AUTH SCREEN — login or register
  if (screen === 'auth') {
    return (
      <AuthScreen
        onAuthSuccess={async (fbUser, profileData) => {
          setFirebaseUser(fbUser);
          if (profileData) {
            // New registration — save profile to Firestore and start assessment
            try {
              await setDoc(doc(db, 'users', fbUser.uid), {
                email: fbUser.email,
                name: profileData.name,
                age: profileData.age,
                language: profileData.language,
                learningLanguage: profileData.learningLanguage || '',
                createdAt: serverTimestamp(),
              });
            } catch (e) {
              console.error('Failed to save profile:', e);
            }
            const user = { name: profileData.name, age: profileData.age, language: profileData.language };
            if (profileData.language) setSelectedLanguage(profileData.language);
            setCurrentUser(user);
            startAssessment(user);
            setScreen('assessment');
          } else {
            // Returning user sign-in — load profile from Firestore
            try {
              const docSnap = await getDoc(doc(db, 'users', fbUser.uid));
              if (docSnap.exists()) {
                const data = docSnap.data();
                const user = { name: data.name, age: data.age, language: data.language };
                if (data.language) setSelectedLanguage(data.language);
                setCurrentUser(user);
                if (data.subjects) {
                  await loadUserProgress(user, { uid: fbUser.uid });
                  setScreen('dashboard');
                } else {
                  startAssessment(user);
                  setScreen('assessment');
                }
              }
            } catch (e) {
              console.error('Failed to load user on sign-in:', e);
            }
          }
        }}
      />
    );
  }

// Legacy welcome screen disabled (replaced by auth flow above)
if (false) {
  const sysFont = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif';
  const GRID_LANGS = LANGUAGES.slice(0, 5);
  const filteredLangs = LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
    l.nativeName.toLowerCase().includes(langSearch.toLowerCase())
  );
  const canStart = userName.trim() && userAge && parseInt(userAge) >= 4 && parseInt(userAge) <= 18;

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', overflow: 'hidden',
      fontFamily: sysFont, background: '#F2F2F7',
    }}>

      {/* ── LEFT PANEL ── */}
      <div style={{
        width: '42%', minWidth: 320,
        background: 'linear-gradient(160deg, #EDE9FE 0%, #DDD6FE 55%, #C4B5FD 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 36px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 260, height: 260, borderRadius: '50%', background: 'rgba(167,139,250,0.25)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(196,181,253,0.3)' }} />
        <div style={{ position: 'absolute', top: '35%', left: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(221,214,254,0.4)' }} />

        <div style={{ position: 'relative', maxWidth: 300, width: '100%', textAlign: 'center' }}>
          {/* Logo */}
          <div style={{
            width: 80, height: 80, borderRadius: 24, margin: '0 auto 24px',
            background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(109,40,217,0.3)',
          }}>
            <span style={{ fontSize: 40 }}>☀️</span>
          </div>

          <h1 style={{ fontSize: 36, fontWeight: 700, color: '#3B1F8C', margin: '0 0 10px', letterSpacing: '-0.5px' }}>
            Welcome!
          </h1>
          <p style={{ fontSize: 17, color: '#6D28D9', fontWeight: 400, margin: '0 0 32px', lineHeight: 1.5 }}>
            {t('welcome.subtitle', selectedLanguage)}
          </p>

          {/* Feature list */}
          <div style={{ textAlign: 'left', marginBottom: 36 }}>
            {[
              'Get ready to learn new subjects and have fun!',
              'Practice with interactive lessons',
              'Track your progress',
            ].map((text, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: i === 0 ? 16 : 10 }}>
                {i === 0 ? (
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#4C1D95', lineHeight: 1.4 }}>{text}</span>
                ) : (
                  <>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                      background: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span style={{ fontSize: 14, color: '#5B21B6', lineHeight: 1.5 }}>{text}</span>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Subject chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {['📖 Reading', '➕ Math', '✏️ Writing', '🧠 Logic', '💬 Languages', '🎯 Social'].map(s => (
              <span key={s} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                background: 'rgba(139,92,246,0.12)', color: '#5B21B6',
                border: '1px solid rgba(139,92,246,0.2)',
              }}>{s}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{
        flex: 1, background: '#fff', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '32px 40px',
      }}>
        <div style={{ width: '100%', maxWidth: 460 }}>

          {/* Language section */}
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1C1C1E', margin: '0 0 16px', textAlign: 'center' }}>
            Choose Your Language
          </h2>

          {/* Language grid — 3 columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 6 }}>
            {GRID_LANGS.map(lang => {
              const isSelected = selectedLanguage === lang.code;
              return (
                <button key={lang.code} onClick={() => setSelectedLanguage(lang.code)}
                  style={{
                    padding: '14px 8px', borderRadius: 14, border: `2px solid ${isSelected ? '#7C3AED' : '#E5E5EA'}`,
                    background: isSelected ? '#F5F0FF' : '#FAFAFA',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    boxShadow: isSelected ? '0 0 0 3px rgba(124,58,237,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
                    transition: 'all 0.15s',
                  }}>
                  <span style={{ fontSize: 28 }}>{lang.flag}</span>
                  <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: isSelected ? '#7C3AED' : '#1C1C1E' }}>
                    {lang.nativeName}
                  </span>
                </button>
              );
            })}
            {/* More Languages tile */}
            <button onClick={() => { setShowLanguageModal(true); setLangSearch(''); }}
              style={{
                padding: '14px 8px', borderRadius: 14, border: '2px solid #E5E5EA',
                background: '#FAFAFA', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F5F0FF'}
              onMouseLeave={e => e.currentTarget.style.background = '#FAFAFA'}>
              <span style={{ fontSize: 20, color: '#7C3AED' }}>›››</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#7C3AED' }}>More Languages</span>
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#F2F2F7', margin: '20px 0' }} />

          {/* Recent profiles */}
          {recentUsers.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E8E93', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                {t('welcome.continue', selectedLanguage)}
              </p>
              <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #E5E5EA', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                {recentUsers.map((user, idx) => (
                  <button key={idx} onClick={() => continueAsUser(user)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 14px', background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left',
                      borderBottom: idx < recentUsers.length - 1 ? '1px solid #F2F2F7' : 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F9F9FB'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: '#EEF0FF', color: '#7C3AED',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, fontWeight: 600,
                      }}>
                        {user.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>{user.name}</p>
                        <p style={{ fontSize: 12, color: '#8E8E93', margin: '1px 0 0' }}>Age {user.age} · {user.totalPoints} pts</p>
                      </div>
                    </div>
                    <svg width="7" height="12" viewBox="0 0 7 12" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M1 1l5 5-5 5" stroke="#C7C7CC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#E5E5EA' }} />
                <span style={{ fontSize: 12, color: '#8E8E93' }}>{t('welcome.orStartNew', selectedLanguage)}</span>
                <div style={{ flex: 1, height: 1, background: '#E5E5EA' }} />
              </div>
            </div>
          )}

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#3C3C43', marginBottom: 6 }}>
                {t('welcome.nameLabel', selectedLanguage)}
              </label>
              <input type="text" value={userName}
                onChange={e => setUserName(e.target.value)}
                placeholder={t('welcome.namePlaceholder', selectedLanguage)}
                style={{
                  width: '100%', padding: '12px 14px', fontSize: 16, color: '#1C1C1E',
                  background: '#F9F9FB', border: '1.5px solid #E5E5EA', borderRadius: 12,
                  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = '#7C3AED'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.12)'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#E5E5EA'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F9F9FB'; }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#3C3C43', marginBottom: 6 }}>
                {t('welcome.ageLabel', selectedLanguage)}
              </label>
              <input type="number" value={userAge}
                onChange={e => setUserAge(e.target.value)}
                min="4" max="18"
                placeholder={t('welcome.agePlaceholder', selectedLanguage)}
                style={{
                  width: '100%', padding: '12px 14px', fontSize: 16, color: '#1C1C1E',
                  background: '#F9F9FB', border: '1.5px solid #E5E5EA', borderRadius: 12,
                  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = '#7C3AED'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.12)'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#E5E5EA'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F9F9FB'; }}
              />
            </div>

            <button onClick={handleLogin} disabled={!canStart}
              style={{
                width: '100%', padding: '14px 20px', fontSize: 16, fontWeight: 600,
                color: '#fff', borderRadius: 14, border: 'none', cursor: canStart ? 'pointer' : 'not-allowed',
                background: canStart ? 'linear-gradient(135deg, #7C3AED, #4F46E5)' : '#C7C7CC',
                boxShadow: canStart ? '0 4px 16px rgba(124,58,237,0.35)' : 'none',
                transition: 'all 0.2s',
              }}>
              {t('welcome.startButton', selectedLanguage)}
            </button>
          </div>
        </div>
      </div>

      {/* ── Language modal ── */}
      {showLanguageModal && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)', zIndex: 50,
        }}
          onClick={e => { if (e.target === e.currentTarget) { setShowLanguageModal(false); setLangSearch(''); } }}>
          <div style={{
            width: '100%', maxWidth: 480, background: '#fff', fontFamily: sysFont,
            borderRadius: '24px 24px 0 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
            maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          }}>
            {/* Handle bar */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E5EA' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 10px' }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: '#1C1C1E' }}>All Languages</span>
              <button onClick={() => { setShowLanguageModal(false); setLangSearch(''); }}
                style={{ width: 30, height: 30, borderRadius: '50%', background: '#F2F2F7', border: 'none', cursor: 'pointer', color: '#8E8E93', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ padding: '0 16px 12px' }}>
              <input type="text" value={langSearch}
                onChange={e => setLangSearch(e.target.value)}
                placeholder="Search…" autoFocus
                style={{
                  width: '100%', padding: '9px 12px', fontSize: 15, boxSizing: 'border-box',
                  background: '#F2F2F7', border: 'none', borderRadius: 10, outline: 'none', color: '#1C1C1E',
                }} />
            </div>
            <div style={{ overflowY: 'auto', padding: '0 8px 16px' }}>
              {filteredLangs.map(lang => {
                const isSel = selectedLanguage === lang.code;
                return (
                  <button key={lang.code}
                    onClick={() => { setSelectedLanguage(lang.code); setShowLanguageModal(false); setLangSearch(''); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                      background: isSel ? 'rgba(124,58,237,0.08)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F2F2F7'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSel ? 'rgba(124,58,237,0.08)' : 'transparent'; }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{lang.flag}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 15, fontWeight: 500, color: isSel ? '#7C3AED' : '#1C1C1E', margin: 0 }}>{lang.name}</p>
                      <p style={{ fontSize: 12, color: '#8E8E93', margin: '1px 0 0' }}>{lang.nativeName}</p>
                    </div>
                    {isSel && (
                      <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                        <path d="M1 5l4 4L13 1" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
              {filteredLangs.length === 0 && (
                <p style={{ textAlign: 'center', padding: '24px 0', fontSize: 14, color: '#8E8E93' }}>No languages found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

  // 2. ASSESSMENT SCREEN
  if (screen === 'assessment' && currentAssessment && currentUser) {
    const ageNum = parseInt(currentUser.age);
    const isYoung = ageNum <= AGE_BOUNDARIES.YOUNG_MAX;
    const isVeryYoung = ageNum <= AGE_BOUNDARIES.AUTO_SUBMIT_MAX;
    const lang = currentUser.language || 'en';
    // Handle both regular assessments and language assessments
  let subject;
  if (currentAssessment.type === 'language') {
    // For language assessments, create a temporary subject object
    subject = {
      name: currentAssessment.language.charAt(0).toUpperCase() + currentAssessment.language.slice(1),
      color: 'from-cyan-400 to-blue-500',
      icon: '🌍'
    };
  } else {
    // Regular subject assessment
    const subjectKey = Object.keys(assessmentQuestions)[assessmentSubjectIndex];
    subject = subjects[subjectKey];
  }
    const currentQuestion = currentAssessment.questions[currentAssessment.currentQuestionIndex];
    const progress = (currentAssessment.currentQuestionIndex / currentAssessment.questions.length) * 100;
    const subjectInfo = subjects[currentAssessment.subject];

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-100 to-pink-100 flex items-center justify-center p-6">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap');
          .pulse-mic {
            animation: pulseMic 1.5s infinite;
          }
          @keyframes pulseMic {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
            }
            50% {
              transform: scale(1.05);
              box-shadow: 0 0 0 20px rgba(59, 130, 246, 0);
            }
          }
        `}</style>
        
        <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-8">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full bg-gradient-to-r ${subject.color} transition-all duration-300`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* VISUAL DISPLAY */}
          {isVeryYoung && currentQuestion.visualType !== 'none' && (
            <div className="text-center mb-12">
              {/* Emojis for counting */}
              {currentQuestion.visualType === 'emoji' && (
                <div className="flex flex-wrap justify-center gap-6">
                  {Array.from({ length: currentQuestion.visual.count || currentQuestion.visual }).map((_, i) => (
                    <div
                      key={i}
                      className="text-8xl animate-bounce"
                      style={{ animationDelay: `${i * 0.1}s`, animationDuration: '1s' }}
                    >
                      {currentQuestion.visual.emoji || '🔵'}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Addition with emojis */}
              {currentQuestion.visualType === 'addition-emoji' && (
                <div className="flex flex-wrap items-center justify-center gap-8">
                  {/* First group */}
                  <div className="flex flex-wrap gap-4">
                    {Array.from({ length: currentQuestion.visual.count1 }).map((_, i) => (
                      <div key={i} className="text-7xl animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}>
                        {currentQuestion.visual.emoji}
                      </div>
                    ))}
                  </div>
                  
                  {/* Plus sign */}
                  <div className="text-9xl font-bold text-gray-700">+</div>
                  
                  {/* Second group */}
                  <div className="flex flex-wrap gap-4">
                    {Array.from({ length: currentQuestion.visual.count2 }).map((_, i) => (
                      <div key={i + currentQuestion.visual.count1} className="text-7xl animate-bounce" style={{ animationDelay: `${(i + currentQuestion.visual.count1) * 0.1}s` }}>
                        {currentQuestion.visual.emoji}
                      </div>
                    ))}
                  </div>
                  
                  {/* Equals sign */}
                  <div className="text-9xl font-bold text-gray-700">=</div>
                  
                  {/* Question mark */}
                  <div className="text-9xl font-bold text-gray-400">?</div>
                </div>
              )}
              
              {/* Circles for counting */}
              {currentQuestion.visualType === 'circles' && (
                <div className="flex flex-wrap justify-center gap-6">
                  {Array.from({ length: currentQuestion.visual }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-24 h-24 rounded-full shadow-xl ${
                        currentQuestion.visualColor === 'green' ? 'bg-green-500' :
                        currentQuestion.visualColor === 'red' ? 'bg-red-500' :
                        currentQuestion.visualColor === 'yellow' ? 'bg-yellow-400' :
                        'bg-blue-500'
                      }`}
                      style={{
                        border: '4px solid white',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                      }}
                    />
                  ))}
                </div>
              )}
              
              {/* Addition with visual groups */}
              {currentQuestion.visualType === 'addition' && (
                <div className="flex items-center justify-center gap-8">
                  {currentQuestion.visual.split('+').map((num, groupIdx) => (
                    <div key={groupIdx} className="flex items-center gap-4">
                      {groupIdx > 0 && (
                        <div className="text-8xl font-bold text-gray-700">+</div>
                      )}
                      <div className="flex flex-wrap justify-center gap-4 max-w-xs">
                        {Array.from({ length: parseInt(num.trim()) }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-20 h-20 rounded-full ${
                              currentQuestion.visualColor === 'red' ? 'bg-red-500' :
                              currentQuestion.visualColor === 'blue' ? 'bg-blue-500' :
                              'bg-green-500'
                            }`}
                            style={{
                              border: '3px solid white',
                              boxShadow: '0 3px 15px rgba(0,0,0,0.2)'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Large letters */}
              {currentQuestion.visualType === 'letter' && (
                <div className="text-[18rem] font-bold text-blue-600 leading-none" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                  {currentQuestion.visual}
                </div>
              )}
              
              {/* Words to spell */}
              {currentQuestion.visualType === 'word' && (
                <div className="text-9xl font-bold text-purple-600" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                  {currentQuestion.visual}
                </div>
              )}
            </div>
          )}

          {/* Question */}
          <div className="text-center mb-10">
            <h1 className="text-6xl font-bold text-gray-800 leading-tight" style={{ fontFamily: 'Fredoka, sans-serif' }}>
              {currentQuestion.questionKey ? t(currentQuestion.questionKey, lang) : currentQuestion.question}
            </h1>
          </div>

          {/* Voice-First Input for Very Young Kids */}
          {isVeryYoung && speechSupported ? (
            <div className="flex flex-col items-center gap-6">
              {/* Giant Microphone Button */}
              <button
                onClick={startListeningNow}
                className={`w-48 h-48 rounded-full transition-all ${
                  isListening 
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse scale-110' 
                    : 'bg-blue-500 hover:bg-blue-600 pulse-mic'
                } text-white shadow-2xl`}
              >
                <Mic className="w-24 h-24 mx-auto" />
              </button>
              
              {/* Simple Status */}
              <p className="text-4xl font-bold text-gray-800" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                {isListening ? t('assessment.listening', lang) : t('assessment.tapToAnswer', lang)}
              </p>

              {/* Show what they said */}
              {userAnswer && !isListening && (
                <div className="w-full">
                  <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-blue-300">
                    <p className="text-5xl font-bold text-blue-900 text-center" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                      {userAnswer}
                    </p>
                  </div>
                  
                  {/* Next Button */}
                  <button
                    onClick={() => {
                      submitAssessmentAnswer(userAnswer);
                      setUserAnswer('');
                    }}
                    className="w-full mt-6 bg-green-500 text-white rounded-3xl p-8 font-bold text-4xl shadow-xl hover:bg-green-600 transition-all"
                    style={{ fontFamily: 'Fredoka, sans-serif' }}
                  >
                    {currentAssessment.currentQuestionIndex === currentAssessment.questions.length - 1
                      ? t('assessment.done', lang)
                      : t('assessment.next', lang)
                    }
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Regular Input for Older Kids */
            <div>
              <div className="relative mb-4">
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder={t('assessment.yourAnswer', lang)}
                  className="w-full p-4 pr-16 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none text-lg"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                  rows="3"
                  autoFocus
                />
                {speechSupported && (
                  <button
                    onClick={toggleListening}
                    className={`absolute right-3 bottom-3 p-3 rounded-full transition-all ${
                      isListening 
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                        : 'bg-blue-500 hover:bg-blue-600'
                    } text-white`}
                  >
                    {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </button>
                )}
              </div>

              {/* Submit Button */}
              <button
                onClick={() => submitAssessmentAnswer(userAnswer)}
                disabled={!userAnswer.trim()}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-4 font-bold text-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
                style={{ fontFamily: 'Fredoka, sans-serif' }}
              >
                {currentAssessment.currentQuestionIndex === currentAssessment.questions.length - 1
                  ? t('assessment.finishButton', lang)
                  : t('assessment.nextQuestion', lang)
                }
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Continue with dashboard and activity screens...
  const isYoung = userProgress ? parseInt(userProgress.age) <= 9 : false;
  const subject = currentSubject ? subjects[currentSubject] : null;

  // 3. TOPIC SELECTION SCREEN
if (showTopicSelection && currentSubject && userProgress) {
  const subject = subjects[currentSubject];
  const topics = advancedTopics[currentSubject] || [];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 p-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap');
      `}</style>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => {
              setShowTopicSelection(false);
              setCurrentSubject(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all mb-6"
          >
            <Home className="w-5 h-5" />
            <span style={{ fontFamily: 'Poppins, sans-serif' }}>Back to Dashboard</span>
          </button>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className={`p-4 bg-gradient-to-r ${subject.color} rounded-xl`}>
                {typeof subject.icon === 'string' ? (
                  <span className="text-5xl">{subject.icon}</span>
                ) : (
                  <subject.icon className="w-8 h-8 text-white" />
                )}
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                  Choose Your {subject.name} Topic
                </h1>
                <p className="text-gray-600 text-lg" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Select what you want to learn today
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Topics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {topics.map((topic) => (
            <button
              key={topic.id}
              onClick={() => startActivityWithTopic(currentSubject, topic.id)}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all text-left group hover:scale-105"
            >
              <div className="text-6xl mb-4">{topic.icon}</div>
              <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                {topic.name}
              </h3>
              <p className="text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {topic.description}
              </p>
            </button>
          ))}
        </div>

        {/* Skip Topic Selection */}
        <div className="mt-8 text-center">
          <button
            onClick={() => startActivityWithTopic(currentSubject, null)}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Skip - Start General Practice
          </button>
        </div>
      </div>
    </div>
  );
}

  // 4. DASHBOARD SCREEN
  // Safety: if screen is dashboard but progress hasn't loaded yet, show spinner
  if (screen === 'dashboard' && !userProgress) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2F2F7' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>☀️</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #E5E5EA', borderTopColor: '#7C3AED', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (screen === 'dashboard' && userProgress) {
    const sysFont = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif';
    return (
      <div className="app-bg" style={{ height: '100vh', fontFamily: sysFont, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{
          background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(15,23,42,0.08)', padding: '12px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 17, flexShrink: 0,
              boxShadow: '0 0 0 3px rgba(124,58,237,0.18)',
            }}>
              {userProgress.name[0].toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {isYoung ? `Hi ${userProgress.name}!` : `Hi, ${userProgress.name}`}
              </p>
              <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
                {isYoung ? 'Ready to learn today?' : 'Continue your learning journey'}
              </p>
            </div>
          </div>
          <button onClick={logout} style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px' }}>
            Sign Out
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10, padding: '14px 16px 6px', flexShrink: 0 }}>
          {[
            { label: 'Points', value: userProgress.totalPoints, color: '#7C3AED' },
            { label: 'Sessions', value: userProgress.totalActivities, color: '#2563EB' },
            { label: 'Streak', value: `${userProgress.streak}d`, color: '#EA580C' },
          ].map(s => (
            <div key={s.label} className="stat-tile">
              <p style={{ fontSize: 20, fontWeight: 800, color: s.color, margin: 0, letterSpacing: '-0.5px' }}>{s.value}</p>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0', fontWeight: 500 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Subjects + Homework — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 32px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '8px 0 12px' }}>
            Subjects
          </p>

          <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {Object.keys(subjects).map((subjectKey) => {
              const subject = subjects[subjectKey];
              const subjectProgress = userProgress.subjects[subjectKey];
              if (!subjectProgress) return null;

              const subjectGrade  = subjectProgress.gradeLevel || getGradeFromAge(userProgress.age);
              const gradeAgeGroup = getAgeGroupForGrade(subjectGrade);
              const levelName     = subject.levels[gradeAgeGroup]?.[subjectProgress.level]
                                  || subject.levels[userProgress.ageGroup]?.[subjectProgress.level]
                                  || 'Beginner';
              const gradeName     = GRADES[subjectGrade]?.name || subjectGrade;
              const expectedGrade = getGradeFromAge(userProgress.age);
              const isAdvanced    = gradeToNum(subjectGrade) > gradeToNum(expectedGrade);
              const pct           = Math.round(((subjectProgress.level + 1) / (subjectProgress.maxLevel + 1)) * 100);

              const [g1, g2] = SUBJECT_CARD_GRADIENTS[subjectKey] || ['#4F46E5', '#7C3AED'];

              return (
                <button key={subjectKey} onClick={() => startActivity(subjectKey)} className="subject-card">
                  {/* Gradient header — textbook chapter style */}
                  <div style={{
                    background: `linear-gradient(135deg, ${g1} 0%, ${g2} 100%)`,
                    padding: '18px 16px 14px', position: 'relative', overflow: 'hidden',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  }}>
                    <div style={{ position: 'absolute', right: -14, top: -14, width: 66, height: 66, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                    <div>
                      <div style={{ fontSize: 34, lineHeight: 1, marginBottom: 6 }}>
                        {typeof subject.icon === 'string' ? subject.icon : '📚'}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px' }}>
                        {subject.name}
                      </div>
                    </div>
                    {isAdvanced && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.22)', borderRadius: 20, padding: '3px 8px', flexShrink: 0 }}>
                        Advanced
                      </span>
                    )}
                  </div>
                  {/* Card body */}
                  <div style={{ padding: '12px 16px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>{gradeName} · {levelName}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: g1 }}>Lv.{subjectProgress.level + 1}</span>
                    </div>
                    <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${g1}, ${g2})`, borderRadius: 3, transition: 'width 0.4s ease' }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 5, textAlign: 'right' }}>{pct}%</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Homework Help */}
          <button onClick={startHomeworkHelp} className="card-3d"
            style={{ width: '100%', marginTop: 14, padding: '18px 20px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', borderRadius: 18, fontFamily: sysFont }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              background: 'linear-gradient(135deg, #F97316, #EAB308)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(249,115,22,0.28)',
            }}>
              <Lightbulb style={{ width: 24, height: 24, color: '#fff' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {isYoung ? 'Need Help?' : 'Homework Help'}
              </p>
              <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>
                {isYoung ? 'Show me your homework!' : 'Get guided help with any question'}
              </p>
            </div>
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none" style={{ flexShrink: 0 }}>
              <path d="M1 1l5 5-5 5" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    );
  }

// 5.ACTIVITY SCREEN
  if (screen === 'activity' && userProgress && currentSubject) {
    const sysFont = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif';
    const accentColors = { reading: '#3B82F6', writing: '#10B981', math: '#8B5CF6', spelling: '#F59E0B', social: '#EC4899', logic: '#6366F1', languages: '#06B6D4', 'test-prep': '#EF4444', career: '#F97316' };
    const accent = accentColors[currentSubject] || '#7C3AED';

    // Compute subtitle
    const activitySubtitle = (() => {
      if (isHomeworkMode) return 'Get guided assistance';
      if (isYoung) return 'Let\'s learn together!';
      if (selectedTopic) {
        if (currentSubject === 'languages' && userProgress.subjects[currentSubject]?.languageLevels?.[selectedTopic] !== undefined) {
          const ll = userProgress.subjects[currentSubject].languageLevels[selectedTopic];
          return `${selectedTopic.charAt(0).toUpperCase() + selectedTopic.slice(1)} · ${['Beginner','Elementary','Intermediate','Advanced'][ll] || 'Beginner'}`;
        }
        const tp = advancedTopics[currentSubject]?.find(t => t.id === selectedTopic);
        return tp ? tp.name : selectedTopic.charAt(0).toUpperCase() + selectedTopic.slice(1);
      }
      const _sp = userProgress.subjects[currentSubject];
      const _sg = _sp?.gradeLevel || getGradeFromAge(userProgress.age);
      const _ag = getAgeGroupForGrade(_sg);
      const _ln = subject?.levels[_ag]?.[_sp?.level] || subject?.levels[userProgress.ageGroup]?.[_sp?.level] || 'Beginner';
      const _gn = GRADES[_sg]?.name || _sg;
      return `${_gn} · ${_ln} (${(_sp?.level ?? 0) + 1}/${(_sp?.maxLevel ?? 0) + 1})`;
    })();

    return (
      <div className="app-bg" style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: sysFont }}>

        {/* Header */}
        <div style={{
          background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(15,23,42,0.08)', padding: '10px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={goHome} style={{ width: 34, height: 34, borderRadius: '50%', background: '#F2F2F7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Home style={{ width: 16, height: 16, color: '#3C3C43' }} />
            </button>
            {!isHomeworkMode && subject && (
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {typeof subject.icon === 'string'
                  ? <span style={{ fontSize: 18 }}>{subject.icon}</span>
                  : <subject.icon style={{ width: 18, height: 18, color: accent }} />}
              </div>
            )}
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>
                {isHomeworkMode ? 'Homework Help' : subject?.name}
              </p>
              <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>{activitySubtitle}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {userProgress && parseInt(userProgress.age) <= AGE_BOUNDARIES.TTS_MAX && synthRef.current && (
              <button onClick={() => setTtsEnabled(!ttsEnabled)}
                style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: ttsEnabled ? accent : '#F2F2F7' }}>
                {ttsEnabled
                  ? <Volume2 style={{ width: 16, height: 16, color: '#fff' }} />
                  : <VolumeX style={{ width: 16, height: 16, color: '#8E8E93' }} />}
              </button>
            )}
          </div>
        </div>

        {/* Main Content — two columns on iPad, stacked on iPhone */}
        <div className="activity-content">

          {/* Board panel: CoachSay + StudyBoard */}
          <div className="activity-board-panel">
            {!isHomeworkMode && (currentCoachSay || currentStudyBoard) && (
              <>
                {currentCoachSay && <CoachSay message={currentCoachSay} isYoung={isYoung} />}
                {currentStudyBoard && (
                  <StudyBoard
                    visual={currentStudyBoard.visual}
                    visualType={currentStudyBoard.visualType}
                    visualColor={currentStudyBoard.visualColor}
                    isYoung={isYoung}
                    onInteraction={handleStudyBoardInteraction}
                    onSubmit={handleStudyBoardSubmit}
                  />
                )}
              </>
            )}
          </div>

          {/* Chat panel: messages + input */}
          <div className="activity-chat-panel">

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 4 }}>
            {conversation.slice(-5).map((msg, idx) => (
              <div key={idx} className="msg-in" style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '82%',
                  background: msg.role === 'user' ? accent : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#1C1C1E',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  padding: '10px 14px',
                  boxShadow: msg.role === 'user' ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
                  fontSize: isYoung ? 15 : 14,
                  lineHeight: 1.5,
                  fontFamily: sysFont,
                }}>
                  {msg.image && (
                    <img src={msg.image} alt="Work" style={{ width: '100%', maxWidth: 320, borderRadius: 10, marginBottom: 8, display: 'block' }} />
                  )}
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                  {msg.role === 'assistant' && isYoung && synthRef.current && (
                    <button
                      onClick={() => speak(msg.content)}
                      style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: accent, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: sysFont }}
                    >
                      <Volume2 style={{ width: 12, height: 12 }} /> Listen
                    </button>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: '#fff', borderRadius: '18px 18px 18px 4px', padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0, 0.2, 0.4].map((d, i) => (
                    <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: accent, animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${d}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          {!isLoading && (
            <div style={{ flexShrink: 0, paddingTop: 10 }} className="safe-bottom">
              {/* Upload + listening row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  style={{ width: 38, height: 38, borderRadius: 10, background: '#F2F2F7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Take Photo"
                >
                  <Camera style={{ width: 18, height: 18, color: '#8E8E93' }} />
                </button>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: 'none' }} />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ width: 38, height: 38, borderRadius: 10, background: '#F2F2F7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Upload Image"
                >
                  <Upload style={{ width: 18, height: 18, color: '#8E8E93' }} />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ display: 'none' }} />

                <div style={{ flex: 1 }} />

                {isListening && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FEE2E2', borderRadius: 8, padding: '4px 10px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
                    <span style={{ fontSize: 12, color: '#B91C1C', fontFamily: sysFont }}>Listening...</span>
                  </div>
                )}
              </div>

              {/* Image Preview */}
              {uploadedImage && (
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <img src={uploadedImage} alt="Upload" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 12, border: '1px solid #E5E5EA' }} />
                  <button
                    onClick={() => setUploadedImage(null)}
                    style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 style={{ width: 14, height: 14, color: '#fff' }} />
                  </button>
                </div>
              )}

              {/* Voice Input Detected */}
              {!isListening && isVoiceInput && userAnswer && (
                <div style={{ marginBottom: 8, padding: '8px 12px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, color: '#166534', fontFamily: sysFont }}>
                    I heard: <strong>"{userAnswer}"</strong>
                  </span>
                  {userProgress && parseInt(userProgress.age) > 6 && (
                    <button
                      onClick={() => { sendMessage(userAnswer); setIsVoiceInput(false); }}
                      style={{ padding: '4px 12px', background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: sysFont }}
                    >
                      Send
                    </button>
                  )}
                  {userProgress && parseInt(userProgress.age) <= 6 && (
                    <span style={{ fontSize: 12, color: '#166534', fontFamily: sysFont }}>Sending in 1.5s...</span>
                  )}
                </div>
              )}

              {/* Text + Mic + Send */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  ref={textareaRef}
                  autoFocus
                  value={userAnswer}
                  onChange={(e) => { setUserAnswer(e.target.value); setIsVoiceInput(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(userAnswer); } }}
                  onFocus={(e) => { setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100); }}
                  placeholder={isYoung ? (speechSupported ? "Tap mic or type..." : "Type your answer...") : "Type your answer..."}
                  rows={2}
                  style={{ flex: 1, padding: '10px 14px', fontSize: 16, background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, resize: 'none', outline: 'none', fontFamily: sysFont, color: '#1C1C1E', lineHeight: 1.5 }}
                />
                {speechSupported && (
                  <button
                    onClick={toggleListening}
                    title={isListening ? "Stop listening" : "Speak your answer"}
                    style={{ width: 42, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0, background: isListening ? '#EF4444' : '#F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {isListening ? <MicOff style={{ width: 18, height: 18, color: '#fff' }} /> : <Mic style={{ width: 18, height: 18, color: '#8E8E93' }} />}
                  </button>
                )}
                <button
                  onClick={() => sendMessage(userAnswer)}
                  disabled={!userAnswer.trim() && !uploadedImage}
                  style={{ width: 42, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0, background: (!userAnswer.trim() && !uploadedImage) ? '#F2F2F7' : accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Send style={{ width: 18, height: 18, color: (!userAnswer.trim() && !uploadedImage) ? '#C7C7CC' : '#fff' }} />
                </button>
              </div>
            </div>
          )}
          </div> {/* activity-chat-panel */}
        </div> {/* activity-content */}

        {/* ── Grade Advancement Modal ── */}
        {gradeAdvancementPending && (() => {
          const { subjectKey, currentGrade, nextGrade } = gradeAdvancementPending;
          const subjectName    = subjects[subjectKey]?.name || subjectKey;
          const currentName    = GRADES[currentGrade]?.name || currentGrade;
          const nextName       = GRADES[nextGrade]?.name    || nextGrade;
          const subjectProgress = userProgress.subjects[subjectKey];
          return (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            }}>
              {/* Confetti dots */}
              <style>{`
                @keyframes confettiFall {
                  0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
                  100% { transform: translateY(80px)  rotate(360deg); opacity: 0; }
                }
                .confetti-dot { position: absolute; width: 8px; height: 8px; border-radius: 2px; animation: confettiFall 1.8s ease-in infinite; }
              `}</style>
              {['#F59E0B','#EF4444','#10B981','#3B82F6','#8B5CF6','#EC4899'].map((c, i) => (
                <div key={i} className="confetti-dot" style={{
                  background: c, top: `${10 + (i * 13) % 40}%`,
                  left: `${8 + (i * 17) % 85}%`,
                  animationDelay: `${i * 0.3}s`,
                }} />
              ))}

              <div style={{
                background: '#fff', borderRadius: 28, padding: '36px 32px',
                maxWidth: 420, width: '100%', textAlign: 'center', position: 'relative',
                boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              }}>
                {/* Trophy */}
                <div style={{ fontSize: 56, marginBottom: 8 }}>🎓</div>
                <div style={{ fontSize: 28, marginBottom: 4 }}>🎉</div>

                <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1C1C1E', margin: '8px 0 4px' }}>
                  Congratulations!
                </h2>
                <p style={{ fontSize: 16, color: '#3C3C43', margin: '0 0 20px' }}>
                  You've mastered <strong>{currentName} {subjectName}!</strong>
                </p>

                {/* Grade arrow */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
                  background: 'linear-gradient(135deg, #EDE9FE, #FEF3C7)',
                  borderRadius: 16, padding: '16px 24px', marginBottom: 20,
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 2 }}>Current</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#7C3AED' }}>{currentGrade === 'K' ? 'K' : currentGrade}</div>
                    <div style={{ fontSize: 12, color: '#5B21B6' }}>{currentName}</div>
                  </div>
                  <div style={{ fontSize: 28, color: '#F59E0B' }}>→</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 2 }}>Next</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#059669' }}>{nextGrade}</div>
                    <div style={{ fontSize: 12, color: '#047857' }}>{nextName}</div>
                  </div>
                </div>

                <p style={{ fontSize: 14, color: '#8E8E93', marginBottom: 24 }}>
                  {subjectProgress?.correctAnswers || 0} correct answers · {subjectProgress?.activitiesCompleted || 0} activities completed
                </p>

                {/* Buttons */}
                <button onClick={handleGradeAdvance} style={{
                  width: '100%', padding: '14px 20px', fontSize: 16, fontWeight: 600,
                  color: '#fff', borderRadius: 14, border: 'none', cursor: 'pointer', marginBottom: 10,
                  background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                  boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
                }}>
                  Start {nextName}! →
                </button>
                <button onClick={handleGradeStay} style={{
                  width: '100%', padding: '12px 20px', fontSize: 15, fontWeight: 500,
                  color: '#8E8E93', borderRadius: 14, border: '1.5px solid #E5E5EA',
                  background: '#fff', cursor: 'pointer',
                }}>
                  Stay at {currentName}
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Grade Toast ── */}
        {gradeToast && (
          <div style={{
            position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            zIndex: 200, background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
            color: '#fff', padding: '12px 24px', borderRadius: 100,
            fontSize: 15, fontWeight: 600, boxShadow: '0 8px 32px rgba(124,58,237,0.4)',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            whiteSpace: 'nowrap',
          }}>
            {gradeToast}
          </div>
        )}
      </div>
    );
  }

  return null;
}
