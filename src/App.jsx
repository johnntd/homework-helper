import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Send, Sparkles, BookOpen, Trash2, Home, Mic, MicOff, Users, Book, Pencil, Hash, Lightbulb, Volume2, VolumeX, FlaskConical, Globe, Atom, Code2, TrendingUp, Wrench, Brain, Target, Briefcase, Cpu, GraduationCap, Puzzle, Calculator } from 'lucide-react';
import CoachSay from './components/CoachSay';
import InterpreterOverlay from './components/InterpreterOverlay';
import StudyBoard from './components/StudyBoard';
import ThinkingShimmer from './components/ThinkingShimmer';
import WaveformBars from './components/WaveformBars';
import ConfettiCanvas from './components/ConfettiCanvas';
import AuthScreen from './components/AuthScreen';
import { getSunnySystemPrompt, extractJSON, validateSunnyResponse, getLanguageSpecificInstructions } from './utils/sunnyPrompts';
import { buildMemoryGradeHint } from './utils/gradeMemory';
import { t } from './utils/translations';
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

// === V2 ENGINE IMPORTS ===
import {
  AGE_BOUNDARIES as ENGINE_AGE_BOUNDARIES, GRADES as ENGINE_GRADES,
  getGradeFromAge as engineGetGradeFromAge, getNextGrade as engineGetNextGrade,
  getAgeGroupForGrade as engineGetAgeGroupForGrade, gradeToNum as engineGradeToNum,
  buildLearnerContext, buildEnhancedLearnerProfile,
  computeProgressUpdate, trackAttempt as engineTrackAttempt,
  computeGradeAdvancement,
  saveSession, loadSession, clearSession, isErrorSession, findRecentSession,
  saveProgress, extractAndTrackTopicTags,
} from './engines/learnerMemory.js';
import {
  SESSION_STATES, INTERPRETER_STATES, TRANSLATION_STATES,
  trimGoodbye as engineTrimGoodbye, isGoodbye, generateGoodbye,
  createSession, transitionState, buildApiMessages, canResume,
  getSessionPhaseInstruction,
} from './engines/sessionEngine.js';
import {
  LANGUAGES as ENGINE_LANGUAGES, LANGUAGE_LOCALE_MAP as ENGINE_LOCALE_MAP,
  LANGUAGE_NAME_TO_CODE as ENGINE_NAME_TO_CODE,
  CEFR_LEVELS, getCEFRCode, getCEFRName, getCEFRFromProgress,
  getRecognitionLocale, shouldUseTTS as engineShouldUseTTS,
  getTTSLangOverride,
  getLanguageSpecificTips,
  getVietnameseVoice, getLanguageLearningStage,
} from './engines/languageEngine.js';
import {
  getAgeGroup as engineGetAgeGroup, getStartingLevel as engineGetStartingLevel,
  ADULT_SUBJECTS, SKILLS_TOPICS, SUBJECT_CARD_GRADIENTS,
  SUBJECTS as ENGINE_SUBJECTS, ADVANCED_TOPICS, SUBJECT_CONSTRAINTS,
  ASSESSMENT_QUESTIONS,
  normalizeStudyBoard as engineNormalizeStudyBoard,
  createSmartVisual as engineCreateSmartVisual,
  processTeachingResponse, NON_SCORING_SUBJECTS, isAdultSubject as engineIsAdultSubject,
} from './engines/teachingEngine.js';
import {
  MODES, chooseStartActivity, buildFirstMessage,
  detectIntent, computeClientGradeHint, buildLangPracticeHint,
  buildUserMessage, buildInterpreterInjection, buildEarlyTurnContextInjection,
  buildHomeworkPrompt, selectSystemPrompt,
} from './engines/smartOrchestrator.js';

// === V2: Constants now imported from engines, aliased for backward compatibility ===
const AGE_BOUNDARIES = ENGINE_AGE_BOUNDARIES;
const GRADES = ENGINE_GRADES;
const getGradeFromAge = engineGetGradeFromAge;
const getNextGrade = engineGetNextGrade;
const getAgeGroupForGrade = engineGetAgeGroupForGrade;
const gradeToNum = engineGradeToNum;
const LANGUAGE_LOCALE_MAP = ENGINE_LOCALE_MAP;
const LANGUAGE_NAME_TO_CODE = ENGINE_NAME_TO_CODE;

// V2: trimGoodbye now imported from sessionEngine as engineTrimGoodbye
const trimGoodbye = engineTrimGoodbye;

// V2: ADULT_SUBJECTS and SKILLS_TOPICS now imported from teachingEngine

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
  const [interpreterOpen, setInterpreterOpen] = useState(false);
  const isMountedRef = useRef(true); // Track component mount state for async safety
  const [viAccent, setViAccent] = useState(() => {
    try {
      const saved = localStorage.getItem('tutor:viAccent');
      // Migration: if no explicit choice was saved, default to Southern.
      // Old default was 'northern' — users who never changed it won't have it saved,
      // but users who opened the old app might have 'northern' persisted.
      // Only keep saved value if user explicitly chose it (we track this with a flag).
      if (saved && localStorage.getItem('tutor:viAccent:userChosen') === 'true') {
        return saved;
      }
      // No explicit user choice — apply Southern default
      return 'southern';
    } catch { return 'southern'; }
  });
  const [assessmentResults, setAssessmentResults] = useState({});
  const [currentAssessment, setCurrentAssessment] = useState(null);
  const [assessmentSubjectIndex, setAssessmentSubjectIndex] = useState(0);
  const [isHomeworkMode, setIsHomeworkMode] = useState(false);
  const [recentUsers, setRecentUsers] = useState([]);
  const [lessonContext, setLessonContext] = useState(null);
  const [showLessonExtractor, setShowLessonExtractor] = useState(false);
  const [lessonInputText, setLessonInputText] = useState('');
  const [lessonExtracting, setLessonExtracting] = useState(false);
  const [lessonPreview, setLessonPreview] = useState(null);
  const [lessonError, setLessonError] = useState('');
  // Sunny dual-surface state (ALWAYS ON)
  const [currentCoachSay, setCurrentCoachSay] = useState('');
  const [currentStudyBoard, setCurrentStudyBoard] = useState(null);
  const boardPanelRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const interviewFileRef = useRef(null);
  const interviewCameraRef = useRef(null);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null); // For autofocus on user input
  const lastAiStateRef = useRef(null); // Tracks last AI response state for language teach/ask cycle
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
  const [celebrationKey, setCelebrationKey] = useState(0); // Increments to trigger star burst
  const [wrongAnim, setWrongAnim] = useState(false);       // Triggers shake on wrong answer
  const [boardKey, setBoardKey] = useState(0);             // Increments to re-animate study board
  const autoSubmitTimerRef = useRef(null); // Track auto-submit timer
  const isListeningRef = useRef(false); // Ref to avoid stale closure in speech recognition callbacks
  const isLoadingRef = useRef(false);   // Ref so TTS/STT callbacks can check loading state
  const authInitialized = useRef(false); // Only process onAuthStateChanged on initial page load
  const fetchAbortRef = useRef(null); // AbortController for in-flight API requests
  const smartModeIntentRef = useRef(null);     // Pre-seeded intent for Smart Mode capability quick-launch
  const audioCtxRef = useRef(null);          // Web Audio API context for TTS playback
  const currentAudioSourceRef = useRef(null); // Active TTS audio source (for cancellation)
  // TTS proxied through /api/tts-openai (nova) and /api/tts (Gemini) — no direct browser→API calls

  // Firebase auth state
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Adult/professional mode state
  const [showSkillsPicker, setShowSkillsPicker] = useState(false);
  const [showInterviewSetup, setShowInterviewSetup] = useState(false);
  const [showPersonaOnboarding, setShowPersonaOnboarding] = useState(false);
  const [personaStep, setPersonaStep] = useState(0);
  const [personaAnswers, setPersonaAnswers] = useState({});
  const [interviewJobDesc, setInterviewJobDesc] = useState('');
  const [interviewCompany, setInterviewCompany] = useState('');
  const [interviewSearchResults, setInterviewSearchResults] = useState([]);
  const [interviewJdImage, setInterviewJdImage] = useState(null);
  const [interviewNativeLang, setInterviewNativeLang] = useState('');
  const [translatedMessages, setTranslatedMessages] = useState({});
  const [translatingIdx, setTranslatingIdx] = useState(null);
  const [langCoachTranslation, setLangCoachTranslation] = useState('');
  const [langCoachTranslating, setLangCoachTranslating] = useState(false);
  // Resume Review state
  const [showResumeSetup, setShowResumeSetup] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [resumeImage, setResumeImage] = useState(null);
  const [resumeJobDesc, setResumeJobDesc] = useState('');
  const resumeFileRef = useRef(null);
  const resumeCameraRef = useRef(null);
  const chatBottomRef = useRef(null); // Auto-scroll anchor
  const justResumedRef = useRef(false); // Signals that a session was just resumed
  // Interview Follow-up state
  const [showFollowupSetup, setShowFollowupSetup] = useState(false);
  const [followupMode, setFollowupMode] = useState('thankyou');
  const [followupEmailText, setFollowupEmailText] = useState('');
  const [followupCompany, setFollowupCompany] = useState('');
  const [followupNativeLang, setFollowupNativeLang] = useState('');
  // Trading
  const [showTradingSetup, setShowTradingSetup] = useState(false);
  const [tradingAssetClass, setTradingAssetClass] = useState('stocks');
  const [tradingSymbolInput, setTradingSymbolInput] = useState('');
  const [tradingSearchResults, setTradingSearchResults] = useState([]);
  const [tradingOptionsStrategy, setTradingOptionsStrategy] = useState('tastytrade-0dte');
  // Agent Pipeline
  const [agentPipelineState, setAgentPipelineState] = useState(null);
  const PAPER_PORTFOLIO_KEY = 'polymarket:paper-portfolio';
  const loadPaperPortfolio = () => {
    try {
      const saved = localStorage.getItem(PAPER_PORTFOLIO_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { startingBalance: 10000, balance: 10000, trades: [] };
  };
  const [paperPortfolio, setPaperPortfolio] = useState(loadPaperPortfolio);
  // Copy feedback
  const [copiedKey, setCopiedKey] = useState(null);
  // Session resume
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeSubject, setResumeSubject] = useState(null);
  const [resumeSessionData, setResumeSessionData] = useState(null);

// Subject card gradient pairs — textbook chapter color coding
const SUBJECT_CARD_GRADIENTS = {
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
  'english': [
    {
      question: "How well do you speak English?",
      options: ["I'm a complete beginner", "I know a few words and phrases", "I can have basic conversations", "I'm quite fluent"],
      level: [0, 1, 2, 3],
      speak: "How well do you speak English?"
    },
    {
      question: "What does 'apple' mean?",
      correctAnswer: "a fruit",
      level: 0,
      speak: "What does the word apple mean?"
    },
    {
      question: "Use 'beautiful' in a sentence.",
      correctAnswer: "any sentence using beautiful",
      level: 1,
      speak: "Can you use the word beautiful in a sentence?"
    },
    {
      question: "What is the past tense of 'go'?",
      correctAnswer: "went",
      level: 2,
      speak: "What is the past tense of the word go?"
    }
  ],
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
  // NEW: Language topics
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
  
  // NEW: Test Prep topics
  'test-prep': [
    { id: 'ielts', name: 'IELTS', icon: '🎓', description: 'Reading, Writing, Listening, Speaking preparation' },
    { id: 'toefl', name: 'TOEFL', icon: '📚', description: 'Reading, Listening, Speaking, Writing sections' },
    { id: 'sat', name: 'SAT', icon: '📝', description: 'Math, Reading, Writing & Language sections' },
    { id: 'act', name: 'ACT', icon: '✍️', description: 'English, Math, Reading, Science, Writing' },
    { id: 'ap', name: 'AP Exams', icon: '🏆', description: 'Advanced Placement exam preparation' },
    { id: 'gre', name: 'GRE', icon: '🎯', description: 'Graduate Record Examination prep' }
  ],

  // Biology topics under science
  'science': [
    { id: 'cell-biology', name: 'Cell Biology', icon: '🦠', description: 'Organelles, cell cycle, mitosis, meiosis, cell membranes' },
    { id: 'genetics', name: 'Genetics', icon: '🧬', description: 'DNA, RNA, protein synthesis, Punnett squares, inheritance' },
    { id: 'evolution', name: 'Evolution', icon: '🦕', description: 'Natural selection, speciation, phylogenetics, adaptation' },
    { id: 'ecology', name: 'Ecology', icon: '🌳', description: 'Ecosystems, food webs, biomes, population dynamics' },
    { id: 'human-biology', name: 'Human Biology', icon: '🫁', description: 'Body systems: circulatory, respiratory, nervous, immune' },
    { id: 'microbiology', name: 'Microbiology', icon: '🔬', description: 'Bacteria, viruses, fungi, immune response, antibiotics' }
  ],

  // Chemistry topics
  'chemistry': [
    { id: 'atomic-structure', name: 'Atomic Structure', icon: '⚛️', description: 'Protons, neutrons, electrons, orbitals, quantum numbers' },
    { id: 'periodic-table', name: 'Periodic Table', icon: '📋', description: 'Periods, groups, element trends, electron configuration' },
    { id: 'bonding', name: 'Chemical Bonding', icon: '🔗', description: 'Ionic, covalent, metallic bonds, VSEPR geometry' },
    { id: 'stoichiometry', name: 'Stoichiometry', icon: '⚖️', description: 'Mole calculations, limiting reagents, percent yield' },
    { id: 'reactions', name: 'Chemical Reactions', icon: '💥', description: 'Types, balancing equations, predicting products' },
    { id: 'acids-bases', name: 'Acids & Bases', icon: '🧪', description: 'pH scale, buffers, titration, Brønsted-Lowry theory' },
    { id: 'thermochemistry', name: 'Thermochemistry', icon: '🌡️', description: 'Enthalpy, entropy, Gibbs free energy, Hess\'s law' },
    { id: 'equilibrium', name: 'Equilibrium', icon: '↔️', description: 'Le Chatelier\'s principle, Keq, ICE tables' },
    { id: 'electrochemistry', name: 'Electrochemistry', icon: '⚡', description: 'Galvanic cells, electrolysis, standard reduction potential' },
    { id: 'organic', name: 'Organic Chemistry', icon: '🧬', description: 'Functional groups, nomenclature, basic reactions' }
  ],

  // Physics topics
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

  // Programming topics
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

  // Economics topics
  'economics': [
    { id: 'supply-demand', name: 'Supply & Demand', icon: '📈', description: 'Price elasticity, market equilibrium, curve shifts' },
    { id: 'market-structures', name: 'Market Structures', icon: '🏭', description: 'Perfect competition, monopoly, oligopoly, monopolistic competition' },
    { id: 'consumer-theory', name: 'Consumer Theory', icon: '🛍️', description: 'Utility maximization, budget constraints, rational choice' },
    { id: 'macroeconomics', name: 'Macroeconomics', icon: '🌍', description: 'GDP, unemployment, inflation, business cycles, AS-AD model' },
    { id: 'monetary-policy', name: 'Monetary Policy', icon: '💵', description: 'Federal Reserve, interest rates, money supply, quantitative easing' },
    { id: 'fiscal-policy', name: 'Fiscal Policy', icon: '🏛️', description: 'Government spending, taxation, deficit, national debt, multiplier' },
    { id: 'international-econ', name: 'International Economics', icon: '✈️', description: 'Comparative advantage, trade, exchange rates, globalization' }
  ],

  // Engineering topics
  'engineering': [
    { id: 'mechanics', name: 'Mechanics', icon: '⚙️', description: 'Statics, dynamics, stress & strain, beams and trusses' },
    { id: 'circuits', name: 'Electrical Circuits', icon: '🔌', description: "Ohm's law, Kirchhoff's laws, AC/DC, capacitors, op-amps" },
    { id: 'materials', name: 'Materials Science', icon: '🔩', description: 'Stress-strain curves, polymers, metals, semiconductors' },
    { id: 'systems', name: 'Systems Engineering', icon: '🔄', description: 'Control theory, feedback loops, system modeling, transfer functions' },
    { id: 'design-thinking', name: 'Design Thinking', icon: '💡', description: 'Problem framing, ideation, prototyping, user testing, iteration' },
    { id: 'thermodynamics-eng', name: 'Engineering Thermodynamics', icon: '🌡️', description: 'Heat engines, Rankine/Carnot cycles, efficiency, entropy' }
  ],

  // Study Skills topics
  'study-skills': [
    { id: 'note-taking', name: 'Note Taking', icon: '📝', description: 'Cornell notes, mind maps, structured outlines, annotation strategies' },
    { id: 'memory', name: 'Memory Techniques', icon: '🧠', description: 'Mnemonics, spaced repetition, active recall, chunking, memory palace' },
    { id: 'exam-prep', name: 'Exam Preparation', icon: '📚', description: 'Study plans, practice tests, test-taking strategies, managing anxiety' },
    { id: 'time-management', name: 'Time Management', icon: '⏰', description: 'Pomodoro technique, priority matrices, planning, beating procrastination' },
    { id: 'reading-strategies', name: 'Academic Reading', icon: '📖', description: 'SQ3R, annotation, skimming vs close reading, source evaluation' },
    { id: 'critical-thinking', name: 'Critical Thinking', icon: '🤔', description: 'Logic, cognitive fallacies, argument analysis, evidence evaluation' }
  ],

  // AI & Data Science topics
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
        { question: "Listen and spell!", questionKey: 'aq.spellCat', visualType: "none", level: 1, speak: "Listen carefully. The word is: cat. Cat. Can you spell cat?" },
        { question: "Listen and spell!", questionKey: 'aq.spellDog', visualType: "none", level: 3, speak: "Listen carefully. The word is: dog. Dog. Can you spell dog?" }
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
      icon: Calculator,
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
      icon: Puzzle,
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
    icon: Globe,
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
    icon: FlaskConical,
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
    icon: Globe,
    color: 'from-orange-400 to-amber-500',
    levels: {
      '4-6': ['My Community', 'Maps & Places', 'Families & Cultures', 'Holidays & Traditions', 'Our World'],
      '7-9': ['US Geography', 'World Cultures', 'American History', 'Government Basics', 'Economics'],
      '10-13': ['World History', 'US History', 'Civics', 'World Geography', 'Economics'],
      '14-18': ['AP History', 'Political Science', 'Global Issues', 'College Prep Social Studies', 'Advanced Topics']
    }
  },

  // NEW: Test Prep
  'test-prep': {
    name: 'Test Prep',
    icon: Target,
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
    icon: Briefcase,
    color: 'from-purple-400 to-pink-500',
    levels: {
      '4-6': ['Dream Jobs', 'What I Like', 'Being Helpful', 'Growing Up'],
      '7-9': ['Interests', 'Strengths', 'Future Careers', 'Goal Setting'],
      '10-13': ['Career Exploration', 'Skills Assessment', 'Education Planning', 'Career Paths'],
      '14-18': ['Career Strategy', 'Market Analysis', 'Action Plans', 'Success Roadmap']
    }
  },

  // ── HIGH SCHOOL & COLLEGE SUBJECTS ───────────────────────────────────
  'chemistry': {
    name: 'Chemistry',
    icon: FlaskConical,
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
    icon: Atom,
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
    icon: Code2,
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
    icon: TrendingUp,
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
    icon: Wrench,
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
    icon: Brain,
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
    icon: Cpu,
    color: 'from-purple-600 to-indigo-700',
    levels: {
      '4-6': [],
      '7-9': [],
      '10-13': [],
      '14-18': ['Data Foundations', 'Statistics & Probability', 'Python for Data', 'Machine Learning Basics', 'Neural Networks', 'AI Ethics & Applications', 'Data Science Capstone']
    }
  }
  };

  // Subject constraints for AI responses - MUST BE AT TOP LEVEL
  const subjectConstraints = {
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
      recognitionRef.current.continuous = true;    // Keep listening through natural pauses
      recognitionRef.current.interimResults = true; // Show what's being heard
      recognitionRef.current.maxAlternatives = 5; // Get more alternatives for better accuracy

      // Language will be set dynamically when user starts speaking
      // Default to English for now
      recognitionRef.current.lang = 'en-US';

      // Track last recognized text (interim or final)
      let finalTranscript = '';    // Accumulated final results
      let lastInterimResult = '';
      let hasReceivedResult = false;
      let noSpeechRetrying = false; // True while a no-speech auto-retry is pending
      let stopTimer = null;        // Stops recognition after user finishes speaking

      recognitionRef.current.onresult = (event) => {
        if (!isMountedRef.current) return;
        hasReceivedResult = true;

        let newFinal = '';
        let newInterim = '';
        for (let i = 0; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            newFinal += t;
          } else {
            newInterim = t;
          }
        }

        const isFinal = event.results[event.results.length - 1].isFinal;

        if (isFinal) {
          finalTranscript = newFinal.trim();
          setUserAnswer(finalTranscript);
          lastInterimResult = '';
          const _silenceMs = 1000;
          if (stopTimer) clearTimeout(stopTimer);
          stopTimer = setTimeout(() => {
            stopTimer = null;
            if (!isMountedRef.current) return; // CRASH FIX: skip if unmounted
            const combined = (finalTranscript + ' ' + lastInterimResult).trim();
            if (combined) {
              setUserAnswer(combined);
              setIsVoiceInput(true);
            }
            try { recognitionRef.current?.stop(); } catch (e) {}
          }, _silenceMs);
        } else {
          lastInterimResult = newInterim.trim();
          const display = (finalTranscript + ' ' + lastInterimResult).trim();
          setUserAnswer(display + '...');
          if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
        }
      };

      recognitionRef.current.onend = () => {
        if (!isMountedRef.current) return; // CRASH FIX: skip if unmounted
        if (stopTimer) {
          clearTimeout(stopTimer);
          stopTimer = null;
          const combined = (finalTranscript + ' ' + lastInterimResult).trim();
          if (combined) {
            setUserAnswer(combined);
            setIsVoiceInput(true);
          }
        }

        if (noSpeechRetrying) {
          lastInterimResult = '';
          hasReceivedResult = false;
          return;
        }

        setIsListening(false);
        finalTranscript = '';
        lastInterimResult = '';
        hasReceivedResult = false;
      };

      recognitionRef.current.onerror = (event) => {
        if (!isMountedRef.current) return; // CRASH FIX: skip if unmounted
        switch (event.error) {
          case 'no-speech':
            noSpeechRetrying = true;
            setTimeout(() => {
              noSpeechRetrying = false;
              if (!isMountedRef.current) return; // CRASH FIX
              if (isListeningRef.current && recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                } catch (e) {
                  setIsListening(false);
                }
              }
            }, 200);
            break;
          case 'audio-capture':
            setIsListening(false);
            break;
          case 'not-allowed':
            setIsListening(false);
            break;
          case 'aborted':
            setIsListening(false);
            break;
          default:
            setIsListening(false);
        }
      };

      recognitionRef.current.onspeechstart = () => {};
      recognitionRef.current.onspeechend = () => {};

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
        // Prime Web Audio API context from this gesture handler — required on iOS Safari
        // for AudioContext to remain active during subsequent async Gemini TTS playback.
        try {
          if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
          }
          if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume().catch(() => {});
          }
        } catch (_) {}

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
    return () => {
      // CRASH FIX: Mark unmounted so all async callbacks bail out
      isMountedRef.current = false;
      unsubscribeAuth();
      // Cancel all speech activity
      try { recognitionRef.current?.abort(); } catch {}
      try { synthRef.current?.cancel(); } catch {}
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
    };
  }, []);

  // Keep isListeningRef in sync so speech recognition callbacks avoid stale closures
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Keep isLoadingRef in sync so TTS/STT callbacks can check loading state
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // REMOVED: The old useEffect that watched isSpeaking and auto-started the mic.
  // It caused race conditions with the primary restartMic callback, leading to
  // self-listening. Mic restart is now ONLY handled by explicit callbacks.

  // Auto-submit voice answers for young kids
  useEffect(() => {
    // Clear any existing timer first
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    
    // Check if we should auto-submit
    if (!isVoiceInput || !userAnswer || !userProgress || isLoading) {
      return;
    }

    const ageNum = parseInt(userProgress.age);
    
    // Auto-submit for all grades and all subjects whenever voice input is used.
    // Interpreter mode: 300ms delay to let transcript stabilize (0ms caused
    // submission of incomplete text). Normal modes: 1.5s to show what was heard.
    const _autoSubmitDelay = 1500;
    console.log('🎯 Scheduling auto-submit for age', ageNum, currentSubject, ':', userAnswer);

    autoSubmitTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return; // CRASH FIX: skip if unmounted
      const answerToSubmit = userAnswer;
      sendMessage(answerToSubmit);
      setIsVoiceInput(false);
      autoSubmitTimerRef.current = null;
    }, _autoSubmitDelay);
    
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
    // Skip when Firebase auth is present — the onAuthStateChanged callback already called loadUserProgress
    if (currentUser && !firebaseUser) {
      loadUserProgress(currentUser);
    }
  }, [currentUser]);

  // Persist the selected language so the picker initialises correctly on next page load.
  useEffect(() => {
    try { localStorage.setItem('tutor:lastLanguage', selectedLanguage); } catch {}
  }, [selectedLanguage]);

  // Sync paperPortfolio into the agent pipeline visual so StudyBoard can pass it to AgentPipeline
  useEffect(() => {
    if (paperPortfolio) {
      setCurrentStudyBoard(prev => {
        if (!prev || prev.visualType !== 'agent-pipeline') return prev;
        return { ...prev, visual: { ...prev.visual, paperPortfolio } };
      });
    }
  }, [paperPortfolio]);

  // Auto-scroll to bottom when conversation updates (only when on activity screen)
  useEffect(() => {
    if (screen !== 'activity') return;
    try {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch (e) {
      // Fallback for older iOS that doesn't support smooth scrollIntoView
      if (chatBottomRef.current) {
        chatBottomRef.current.scrollTop = chatBottomRef.current.scrollHeight;
      }
    }
  }, [conversation.length, screen]);

  // Reset board panel to top when a new study board arrives so Remotion frame is always visible.
  useEffect(() => {
    if (boardPanelRef.current) boardPanelRef.current.scrollTop = 0;
  }, [currentStudyBoard]);

  // After resuming a session: speak the last AI message so the user knows where they are.
  // The last AI message already contains the pending question, so just speak it and wait for the user.
  useEffect(() => {
    if (!justResumedRef.current || screen !== 'activity' || !userProgress) return;
    justResumedRef.current = false;

    const ageNum = parseInt(userProgress.age);
    const ttsOn = (ageNum <= AGE_BOUNDARIES.TTS_MAX || currentSubject === 'languages') && ttsEnabled && synthRef.current;

    const lastAiMsg = [...conversation].reverse().find(m => m.role === 'assistant');

    if (lastAiMsg && ttsOn) {
      // Speak the last question/feedback so the child knows what to do
      const text = typeof lastAiMsg.content === 'string' ? lastAiMsg.content : '';
      if (text) {
        if (currentSubject === 'languages') {
          const targetLangCode = LANGUAGE_NAME_TO_CODE[selectedTopic] || 'en';
          setTimeout(() => speak(text, null, targetLangCode), 600);
        } else {
          setTimeout(() => speak(text), 600);
        }
      }
    }
    // NOTE: Do NOT auto-send "Continue" here — the last AI message already has the pending question.
    // Sending "Continue" would skip that question and confuse the user.
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save session to localStorage so user can resume later (all subjects)
  useEffect(() => {
    if (screen !== 'activity' || !userProgress || !currentSubject) return;
    if (conversation.length === 0) return;
    // Don't save error states — next click should start fresh, not restore the error
    const lastMsg = conversation[conversation.length - 1];
    if (lastMsg?.role === 'assistant' && typeof lastMsg.content === 'string' &&
        (lastMsg.content.includes('Something went wrong') || lastMsg.content.includes('API Error') || lastMsg.content.includes('server is a bit busy'))) {
      try { localStorage.removeItem(`tutor:session:${userProgress.name}:${currentSubject}`); } catch {}
      return;
    }
    const key = `tutor:session:${userProgress.name}:${currentSubject}`;
    try {
      localStorage.setItem(key, JSON.stringify({
        conversation,
        selectedTopic,
        interviewJobDesc,
        interviewCompany,
        interviewNativeLang,
        followupMode,
        followupCompany,
        followupNativeLang,
        tradingSymbolInput,
        tradingSearchResults,
        currentCoachSay,
        currentStudyBoard,
        savedAt: Date.now(),
      }));
    } catch {}
  }, [conversation.length, screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset CoachSay translation when the coach message changes (new turn)
  useEffect(() => {
    setLangCoachTranslation('');
    setLangCoachTranslating(false);
  }, [currentCoachSay]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-translate new assistant messages in interview/followup mode when native lang is set
  useEffect(() => {
    const nativeLang = currentSubject === 'interview' ? interviewNativeLang : currentSubject === 'followup' ? followupNativeLang : '';
    if (!nativeLang) return;
    const key = conversation.length - 1;
    const lastMsg = conversation[key];
    if (!lastMsg || lastMsg.role !== 'assistant') return;
    if (translatedMessages[key]) return; // already translated
    const langEntry = LANGUAGES.find(l => l.code === nativeLang);
    const langName = langEntry?.name || nativeLang;
    setTranslatingIdx(key);
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: `Translate the following text to ${langName}. Return ONLY the translation, nothing else.`,
        messages: [{ role: 'user', content: lastMsg.content }]
      })
    })
      .then(r => r.json())
      .then(data => {
        const translation = data?.content?.[0]?.text || '';
        if (translation) setTranslatedMessages(prev => ({ ...prev, [key]: translation }));
        setTranslatingIdx(null);
      })
      .catch(() => setTranslatingIdx(null));
  }, [conversation.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const ageLvls = subjects[subjectKey].levels[ageGroup];
      if (!progress.subjects[subjectKey]) {
        if (!ageLvls || ageLvls.length === 0) return; // Skip age-inappropriate subjects
        console.log('🆕 Adding new subject:', subjectKey);
        // Add the missing subject dynamically with appropriate starting level
        progress.subjects[subjectKey] = {
          level: getStartingLevel(user.age, subjectKey),
          maxLevel: ageLvls.length - 1,
          points: 0,
          activitiesCompleted: 0,
          correctAnswers: 0,
          totalAttempts: 0,
          currentStreak: 0,
          gradeLevel: getGradeFromAge(user.age),
          readyForAdvancement: false,
          advancementStreak: 0,
          topicStats: {}
        };

        // Special case: languages subject needs languageLevels property
        if (subjectKey === 'languages') {
          progress.subjects[subjectKey].languageLevels = {};
        }
        
        needsSave = true;
      } else {
        // CRITICAL: Fix existing subjects with level/maxLevel mismatches
        if (!ageLvls || ageLvls.length === 0) return; // Should not have been stored, skip
        const currentMaxLevel = ageLvls.length - 1;
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
        if (!subjectProgress.topicStats) {
          subjectProgress.topicStats = {};
          needsSave = true;
        }
      }
    });
    
    // Migrate: add trading subject for adult users
    if (!progress.subjects.trading && (parseInt(user.age) >= 22 || progress.ageGroup === 'adult')) {
      progress.subjects.trading = { level: 0, completedTopics: [], totalSessions: 0 };
      needsSave = true;
    }
    // Migrate: add accent subject (no level-up scoring, just session tracking)
    if (!progress.subjects.accent) {
      progress.subjects.accent = { totalAttempts: 0, correctAnswers: 0, totalSessions: 0 };
      needsSave = true;
    }
    // Migrate: add professional, academic, and health tracks for adult/college-age users
    const _profTracks = ['college', 'law', 'accounting', 'cpa', 'pro-coaching',
                         'family-medicine', 'pharmacy', 'physical-therapy', 'nursing',
                         'rtl-design', 'physical-design', 'lab-debug'];
    if (parseInt(user.age) >= 18 || progress.ageGroup === 'adult') {
      _profTracks.forEach(track => {
        if (!progress.subjects[track]) {
          progress.subjects[track] = { totalAttempts: 0, correctAnswers: 0, totalSessions: 0, topicStats: {} };
          needsSave = true;
        }
      });
    }

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

  // Always enable TTS for language assessments so the student hears the questions
  if (synthRef.current) setTtsEnabled(true);

  const firstQuestion = questions[0];
  if (firstQuestion.speak || firstQuestion.questionKey) {
    const ttsLang = userProgress.language || 'en';
    setTimeout(() => speak(firstQuestion.questionKey ? t(firstQuestion.questionKey, ttsLang) : firstQuestion.speak), 600);
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
      const lvls = subjects[subjectKey].levels[ageGroup];
      if (!lvls || lvls.length === 0) return; // Skip age-inappropriate subjects
      progress.subjects[subjectKey] = {
        level: levels[subjectKey] !== undefined ? levels[subjectKey] : getStartingLevel(user.age, subjectKey),
        maxLevel: lvls.length - 1,
        points: 0,
        activitiesCompleted: 0,
        correctAnswers: 0,
        totalAttempts: 0,
        currentStreak: 0,
        gradeLevel: getGradeFromAge(user.age),
        readyForAdvancement: false,
        advancementStreak: 0,
        topicStats: {}
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

      // Always speak next question for language assessments
      setTimeout(() => {
        const nextQ = currentAssessment.questions[nextQuestionIndex];
        const ttsLang = currentUser.language || 'en';
        const toSpeak = nextQ.questionKey ? t(nextQ.questionKey, ttsLang) : (nextQ.speak || nextQ.question);
        speak(toSpeak);
      }, 800);
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
      
      // Clear assessment state
      setCurrentAssessment(null);
      setUserAnswer('');

      // Start the language activity — startActivityWithTopic will skip the assessment
      // because languageLevels[language] is now defined (set above via shared reference)
      const languageToStart = currentAssessment.language;
      startActivityWithTopic('languages', languageToStart);
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
    // Adult/accent subjects don't use the standard point-scoring schema — skip
    const NON_SCORING = ['accent', 'trading', 'research', '0dte', 'options-desk', 'interview', 'life-coach', 'skills', 'followup', 'resume', 'agents',
                         'college', 'law', 'accounting', 'cpa', 'pro-coaching'];
    if (NON_SCORING.includes(subjectKey)) return;

    const newProgress = { ...userProgress };
    const subject = newProgress.subjects[subjectKey];
    if (!subject || subject.totalAttempts === undefined) return; // guard against missing schema

    subject.totalAttempts += 1;

    // Per-topic mastery tracking
    if (selectedTopic) {
      if (!subject.topicStats) subject.topicStats = {};
      if (!subject.topicStats[selectedTopic])
        subject.topicStats[selectedTopic] = { attempts: 0, correct: 0, lastSeen: null };
      subject.topicStats[selectedTopic].attempts += 1;
      if (wasCorrect) subject.topicStats[selectedTopic].correct += 1;
      subject.topicStats[selectedTopic].lastSeen = Date.now();
    }

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
      const _adultEnglishSubjects = ['interview', 'followup', 'skills', 'resume', 'life-coach', 'accent'];
      if (_adultEnglishSubjects.includes(currentSubject)) {
        // Adult professional subjects + accent coach: always English STT regardless of native language
        recognitionRef.current.lang = 'en-US';
        console.log('✅ Adult subject — forcing English speech recognition');
      } else {
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

    // Set language — same logic as toggleListening
    const _adultEnglishSubjects2 = ['interview', 'followup', 'skills', 'resume', 'life-coach', 'accent'];
    if (_adultEnglishSubjects2.includes(currentSubject)) {
      recognitionRef.current.lang = 'en-US';
    } else {
      const _recogLangSource = userProgress?.language || currentUser?.language || selectedLanguage;
      if (_recogLangSource) {
        let recognitionLang = _recogLangSource;
        if (currentSubject === 'languages' && selectedTopic) {
          recognitionLang = LANGUAGE_NAME_TO_CODE[selectedTopic] || selectedTopic;
        }
        recognitionRef.current.lang = LANGUAGE_LOCALE_MAP[recognitionLang] || 'en-US';
      }
    }
    console.log('✅ startListeningNow: speech recognition set to:', recognitionRef.current.lang);

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


// ── OpenAI TTS — proxied through /api/tts-openai (nova voice) ────────────────
// Routes through the server proxy to avoid CSP/CORS issues with direct API calls.
// onDone(true) = played  |  onDone(false) = failure → caller falls to Gemini TTS
const speakViaOpenAI = (text, onDone) => {
  let ctx = audioCtxRef.current;
  if (!ctx || ctx.state === 'closed') {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); audioCtxRef.current = ctx; }
    catch (_) { onDone(false); return; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  fetch('/api/tts-openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
    .then(resp => resp.ok ? resp.arrayBuffer() : Promise.reject(new Error('HTTP ' + resp.status)))
    .then(buf => new Promise((resolve, reject) => ctx.decodeAudioData(buf, resolve, reject)))
    .then(decoded => {
      if (currentAudioSourceRef.current) {
        try { currentAudioSourceRef.current.stop(); } catch (_) {}
        currentAudioSourceRef.current = null;
      }
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(ctx.destination);
      currentAudioSourceRef.current = src;
      if (isMountedRef.current) setIsSpeaking(true);
      console.log(`[OpenAI TTS] ▶ nova proxy len=${text.length}`);
      src.onended = () => {
        currentAudioSourceRef.current = null;
        if (isMountedRef.current) setIsSpeaking(false);
        onDone(true);
      };
      src.start();
    })
    .catch(err => {
      console.log('[OpenAI TTS] ✗ proxy failed, falling back to Gemini:', err.message);
      currentAudioSourceRef.current = null;
      onDone(false);
    });
};

// ── Gemini TTS — proxied through /api/tts (Sulafat EN / Aoede VI/ES) ─────────
// Routes through the server proxy to avoid CSP/CORS issues with direct API calls.
// 24 kHz PCM via Web Audio API — same voice quality as Salon AI Agent.
// onDone(true) = played  |  onDone(false) = failure → caller falls to browser TTS
const speakViaGemini = (text, langCode, onDone) => {
  let ctx = audioCtxRef.current;
  if (!ctx || ctx.state === 'closed') {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); audioCtxRef.current = ctx; }
    catch (_) { onDone(false); return; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, lang: langCode }),
  })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    .then(data => {
      if (!data.audio) throw new Error('no audio data');

      const raw = atob(data.audio);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
      const audioBuf = ctx.createBuffer(1, float32.length, 24000);
      audioBuf.copyToChannel(float32, 0);

      if (currentAudioSourceRef.current) {
        try { currentAudioSourceRef.current.stop(); } catch (_) {}
        currentAudioSourceRef.current = null;
      }
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.connect(ctx.destination);
      currentAudioSourceRef.current = src;
      if (isMountedRef.current) setIsSpeaking(true);
      console.log(`[Gemini TTS] ▶ ${data.voice} proxy lang=${langCode} len=${text.length}`);
      src.onended = () => {
        currentAudioSourceRef.current = null;
        if (isMountedRef.current) setIsSpeaking(false);
        onDone(true);
      };
      src.start();
    })
    .catch(err => {
      console.log('[Gemini TTS] ✗ proxy failed, falling back to browser TTS:', err.message);
      currentAudioSourceRef.current = null;
      onDone(false);
    });
};

// ── High-quality TTS: OpenAI (nova) → Gemini (Sulafat/Aoede) → browser fallback ──
// Matches Salon AI Agent voice chain. Use this for all AI-spoken responses.
// lang auto-resolved: langOverride → user profile language → 'en'.
const speakWithGemini = (text, onComplete, langOverride, rateOverride) => {
  const gLang = langOverride || userProgress?.language || currentUser?.language || selectedLanguage || 'en';
  speakViaOpenAI(text, (ok1) => {
    if (!ok1) {
      speakViaGemini(text, gLang, (ok2) => {
        if (!ok2) speak(text, onComplete, langOverride, rateOverride);
        else if (onComplete) onComplete();
      });
    } else if (onComplete) onComplete();
  });
};

const speak = (text, onComplete, langOverride, rateOverride) => {
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

  // Convert short ALL-CAPS words to lowercase so TTS reads them as words, not acronyms.
  // Reading activities display words like BAT, MAT, CAT in ALL-CAPS for visual emphasis.
  // Without this, the browser's TTS engine spells them: "B, A, T" instead of "bat".
  // Exclude known abbreviations that should stay uppercase.
  const _SPEECH_ABBR = new Set(['US', 'UK', 'EU', 'UN', 'FBI', 'CIA', 'NASA', 'PDF', 'FAQ', 'OK', 'TV', 'DNA', 'RNA', 'HIV', 'CPU', 'GPU', 'URL', 'API', 'NYC', 'LA', 'DC', 'AM', 'PM', 'ASAP', 'ETA', 'BRB', 'LOL']);
  text = text.replace(/\b([A-Z]{2,6})\b/g, (m) => _SPEECH_ABBR.has(m) ? m : m.toLowerCase());

  // Normalize math symbols so TTS reads them naturally
  text = text
    // Multiplication: 5×8 or 5x8 (only x between digits, not part of words)
    .replace(/(\d+)\s*[×]\s*(\d+)/g, '$1 times $2')
    .replace(/(\d+)\s*x\s*(\d+)/gi, '$1 times $2')
    // Division: 5÷8 or 5/8
    .replace(/(\d+)\s*÷\s*(\d+)/g, '$1 divided by $2')
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$1 divided by $2')
    // Squared / cubed superscripts and caret notation
    .replace(/(\d+)\s*²/g, '$1 squared')
    .replace(/(\d+)\s*³/g, '$1 cubed')
    .replace(/(\d+)\s*\^\s*2\b/g, '$1 squared')
    .replace(/(\d+)\s*\^\s*3\b/g, '$1 cubed')
    .replace(/(\d+)\s*\^\s*(\d+)/g, '$1 to the power of $2')
    // Square root
    .replace(/√\s*(\d+)/g, 'square root of $1')
    // Percent sign (avoid double if "percent" already follows)
    .replace(/(\d+)\s*%(?!\s*percent)/g, '$1 percent')
    // Comparison operators
    .replace(/≠/g, 'not equal to')
    .replace(/≤/g, 'less than or equal to')
    .replace(/≥/g, 'greater than or equal to')
    // Greek / math constants
    .replace(/π/g, 'pi')
    .replace(/±/g, 'plus or minus')
    .replace(/∞/g, 'infinity')
    .replace(/\s+/g, ' ').trim();

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
  utterance.rate = rateOverride ?? 0.92;  // Salon AI Agent browser-fallback rate
  utterance.pitch = 1.0;                  // Salon AI Agent browser-fallback pitch
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
          speak(text, onComplete, langOverride); // retry with voice selection
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

  // Detect if text contains Japanese characters (Hiragana/Katakana only — not CJK which is shared with Chinese)
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
  const hasKorean = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text);
  const hasChinese = /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text);
  const hasVietnamese = /[\u00C0-\u024F\u1EA0-\u1EFF]/.test(text) && /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(text);

  // Determine voice language: explicit override > script detection > user native language
  // CRITICAL: langOverride takes absolute priority — this is how interpreter mode
  // ensures the correct output language regardless of user profile.
  let voiceLang = langOverride || userLang;
  if (!langOverride) {
    if (hasJapanese) voiceLang = 'ja';
    else if (hasKorean) voiceLang = 'ko';
    else if (hasChinese) voiceLang = 'zh';
    else if (hasVietnamese && userLang !== 'vi') voiceLang = 'vi';
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
      'Samantha (Enhanced)',
      'Ava (Enhanced)',
      // Google voices
      'Google US English',
      'Google UK English Female',
      // Microsoft voices
      'Microsoft Zira',
      'Microsoft David',
      'Vicki',
      'Victoria'
    ],
    'es': ['Monica', 'Paulina', 'Google español', 'Juan', 'Diego'],
    'vi': ['Lân', 'Linh', 'Vietnamese', 'Google tiếng Việt'],  // Lân (male) first for clarity
    'zh': ['Ting-Ting', 'Sin-ji', 'Google 普通话', 'Google 中文'],
    'fr': ['Thomas', 'Amélie', 'Google français'],
    'ar': ['Maged', 'Google العربية'],
    'hi': ['Lekha', 'Google हिन्दी'],
    'pt': ['Luciana', 'Felipe', 'Google português'],
    'ja': ['Kyoko', 'Otoya', 'Google 日本語'],
    'ko': ['Yuna', 'Google 한국어'],
    'de': ['Anna', 'Helena', 'Google Deutsch'],
    'it': ['Alice', 'Federica', 'Luca', 'Google italiano'],
    'ru': ['Milena', 'Yuri', 'Google русский']
  };

  // Don't fall back to English names — that would select an English voice for other languages
  const preferredVoiceNames = languageVoiceMap[voiceLang] || [];

  if (voices.length > 0) {
    let selectedVoice = null;

    // === VOICE SELECTION PIPELINE ===
    // Each pass is scoped to voiceLang to prevent cross-language voice selection.
    // The user's profile language (userLang) is NEVER used for voice matching —
    // only voiceLang (which comes from langOverride in interpreter mode).

    const targetLocale = LANGUAGE_LOCALE_MAP[voiceLang] || 'en-US';
    const targetLangPrefix = voiceLang === 'zh' ? 'zh-' : voiceLang;

    // Vietnamese: ALWAYS use accent-aware path first.
    if (voiceLang === 'vi') {
      selectedVoice = getVietnameseVoice(voices, viAccent);
      // REALITY CHECK: Most platforms (iOS, Chrome, Android) have only 1-2
      // Vietnamese voices with NO accent distinction. We cannot change the
      // actual voice — only its prosody (pitch, rate). We make the prosody
      // differences dramatic enough to be clearly perceptible.
      if (viAccent === 'southern') {
        utterance.rate = rateOverride ?? 0.72;   // Southern: distinctly slower, relaxed
        utterance.pitch = 0.78;                  // Southern: clearly lower pitch
      } else if (viAccent === 'central') {
        utterance.rate = rateOverride ?? 0.68;   // Central (Hue): slowest
        utterance.pitch = 0.88;                  // Central: mid-low
      } else {
        utterance.rate = rateOverride ?? 0.85;   // Northern (Hanoi): faster, crisper
        utterance.pitch = 1.2;                   // Northern: clearly higher pitch
      }
      console.log(`[TTS] 🇻🇳 VIETNAMESE VOICE RESOLVED: accent=${viAccent}, voice="${selectedVoice?.name || 'OS-default'}", rate=${utterance.rate}, pitch=${utterance.pitch}, lang=${utterance.lang}`);
      console.log(`[TTS] 🇻🇳 NOTE: ${voices.filter(v => v.lang?.startsWith('vi')).length} Vietnamese voice(s) available. Accent is via prosody, not distinct voices.`);
    }

    // Pass 1: Named voice preferences for the target language (non-Vietnamese)
    if (!selectedVoice) {
      for (const voiceName of preferredVoiceNames) {
        selectedVoice = voices.find(v =>
          v.name.toLowerCase().includes(voiceName.toLowerCase()) &&
          v.lang.startsWith(targetLangPrefix)
        );
        if (selectedVoice) {
          console.log(`[TTS] Pass 1 — named match: "${selectedVoice.name}" (${selectedVoice.lang})`);
          break;
        }
      }
    }

    // Pass 2: Enhanced/Premium voice for the target language
    if (!selectedVoice) {
      selectedVoice = voices.find(v =>
        v.lang.startsWith(targetLangPrefix) &&
        (v.name.includes('Enhanced') || v.name.includes('Premium'))
      );
      if (selectedVoice) {
        console.log(`[TTS] Pass 2 — enhanced: "${selectedVoice.name}" (${selectedVoice.lang})`);
      }
    }

    // Pass 4: Any voice matching the target language locale
    if (!selectedVoice) {
      // Strict locale match first (e.g., en-US), then prefix match (e.g., en-)
      selectedVoice = voices.find(v => v.lang === targetLocale)
        || voices.find(v => v.lang.startsWith(targetLangPrefix));
      if (selectedVoice) {
        console.log(`[TTS] Pass 4 — locale match: "${selectedVoice.name}" (${selectedVoice.lang})`);
      }
    }

    // Pass 5: Fallback — ONLY use voices[0] when voiceLang is English AND
    // voices[0] is actually an English voice. On Vietnamese devices, voices[0]
    // is often the Vietnamese voice — using it for English would be the exact bug.
    if (!selectedVoice && voiceLang === 'en') {
      if (voices[0]?.lang?.startsWith('en')) {
        selectedVoice = voices[0];
        console.log(`[TTS] Pass 5 — default English: "${selectedVoice.name}" (${selectedVoice.lang})`);
      } else {
        // voices[0] is NOT English (Vietnamese device). Leave voice unset —
        // the browser will use utterance.lang ('en-US') to pick the right voice.
        console.log(`[TTS] Pass 5 — voices[0] is ${voices[0]?.lang}, NOT English. Leaving unset for OS selection via utterance.lang=${utterance.lang}`);
      }
    }

    // Adult language learning mode: slightly slower rate for pronunciation clarity
    if (selectedVoice && currentSubject === 'languages' && langOverride && langOverride !== userLang) {
      utterance.rate = rateOverride ?? 0.82;
    }

    if (selectedVoice) utterance.voice = selectedVoice;
    // DEFINITIVE RUNTIME LOG — shows exactly what the TTS engine will use
    console.log(`[TTS] ▶ EFFECTIVE RUNTIME: voice="${utterance.voice?.name || 'OS-default'}", voiceLang=${utterance.voice?.lang || 'unset'}, utterance.lang=${utterance.lang}, rate=${utterance.rate}, pitch=${utterance.pitch}, langOverride=${langOverride || 'none'}, userLang=${userLang}`);
  }

  // iOS keepalive: Safari stops speechSynthesis after ~14s — pause/resume every 10s keeps it alive
  let _keepalive = null;

  utterance.onstart = () => {
    if (isMountedRef.current) setIsSpeaking(true);
    _keepalive = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } else {
        clearInterval(_keepalive);
        _keepalive = null;
      }
    }, 10000);
  };

  utterance.onend = () => {
    clearInterval(_keepalive);
    _keepalive = null;
    if (isMountedRef.current) setIsSpeaking(false);
    if (onComplete) onComplete();
  };

  utterance.onerror = (event) => {
    clearInterval(_keepalive);
    _keepalive = null;
    if (isMountedRef.current) setIsSpeaking(false);
    // If speech was intentionally cancelled (new turn started), do NOT continue
    // the old chain — that would replay old segments without their langOverride.
    if (event.error === 'interrupted' || event.error === 'canceled') {
      return;
    }
    console.error('Speech error:', event.error, event);
    // TTS failed before playing — still call onComplete so the chain continues.
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

// Speaks text that mixes native and target language with the correct voice for each part.
// Primary method: parses [L: phrase] markers — those spans are spoken in the target-language voice.
// Fallback: splits by sentence and uses script-detection heuristic for non-Latin native scripts.
// e.g. "Bây giờ thử nói [L: Nice to meet you] nhé!" →
//   "Bây giờ thử nói" in Vietnamese voice, "Nice to meet you" in English voice, "nhé!" in Vietnamese.
const speakMixed = (text, nativeLang, targetLang, onComplete) => {
  if (!text) { onComplete?.(); return; }
  if (nativeLang === targetLang) { speak(text, onComplete); return; }

  // Heuristic: does a chunk look like native language? Used only when no [L: ...] markers present.
  const isNative = (chunk) => {
    if (nativeLang === 'vi') return /[àáảãạăắằặẳẵâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(chunk);
    if (nativeLang === 'zh') return /[\u4E00-\u9FFF]/.test(chunk);
    if (nativeLang === 'ja') return /[\u3040-\u30FF]/.test(chunk);
    if (nativeLang === 'ko') return /[\uAC00-\uD7AF]/.test(chunk);
    if (nativeLang === 'ar') return /[\u0600-\u06FF]/.test(chunk);
    if (nativeLang === 'hi') return /[\u0900-\u097F]/.test(chunk);
    if (nativeLang === 'ru') return /[\u0400-\u04FF]/.test(chunk);
    // For Latin-script native languages (en, es, fr, de…) we cannot distinguish from target by script.
    // Treat everything as native and rely entirely on [L: ...] markers supplied by the AI.
    return true;
  };

  const raw = text.replace(/\p{Extended_Pictographic}/gu, ' ').replace(/\s+/g, ' ').trim();
  const segments = [];

  // ── Primary: explicit [L: ...] markers enable sub-sentence voice switching ──
  const markerRx = /\[L:\s*(.*?)\]/g;
  let lastIdx = 0;
  let m;
  let hasMarkers = false;
  while ((m = markerRx.exec(raw)) !== null) {
    hasMarkers = true;
    if (m.index > lastIdx) {
      const chunk = raw.slice(lastIdx, m.index).trim();
      if (chunk) segments.push({ text: chunk, lang: nativeLang });
    }
    if (m[1].trim()) segments.push({ text: m[1].trim(), lang: targetLang });
    lastIdx = m.index + m[0].length;
  }
  if (hasMarkers && lastIdx < raw.length) {
    const chunk = raw.slice(lastIdx).trim();
    if (chunk) segments.push({ text: chunk, lang: nativeLang });
  }

  // ── Fallback: when AI sends no [L: ...] markers ────────────────────────────
  if (!hasMarkers) {
    // For non-Latin native scripts (Vietnamese, Chinese, Japanese, Korean, Arabic, Hindi, Russian):
    // ASCII-only word runs embedded in native text are almost certainly the target language.
    // Split at that granularity so "Thử nói 'Nice to meet you' nhé!" correctly switches voices
    // mid-sentence rather than speaking all of it in Vietnamese.
    const nonLatinScripts = ['vi', 'zh', 'ja', 'ko', 'ar', 'hi', 'ru'];
    if (nonLatinScripts.includes(nativeLang)) {
      // Split on runs of 2+ pure-ASCII words (letters, apostrophes, hyphens only)
      const parts = raw.split(/([A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z][A-Za-z'\-]+)+)/);
      for (const part of parts) {
        const t = part.trim();
        if (!t) continue;
        const isAsciiPhrase = /^[A-Za-z][A-Za-z' \-]*$/.test(t) && t.split(/\s+/).length >= 2;
        const lang = isAsciiPhrase ? targetLang : nativeLang;
        if (segments.length > 0 && segments[segments.length - 1].lang === lang) {
          segments[segments.length - 1].text += ' ' + t;
        } else {
          segments.push({ text: t, lang });
        }
      }
    } else {
      // Latin-script native languages (en, es, fr, de, …): rely on markers; no heuristic possible
      segments.push({ text: raw, lang: nativeLang });
    }
  }

  const speakNext = (i) => {
    if (i >= segments.length) { onComplete?.(); return; }
    const { text, lang } = segments[i];
    // iOS needs a small gap between utterances when switching voices — without it,
    // the next utterance may inherit the previous voice and speak in the wrong language.
    const delay = i === 0 ? 0 : 60;
    setTimeout(() => {
      speak(text, () => speakNext(i + 1), lang !== nativeLang ? lang : undefined);
    }, delay);
  };

  speakNext(0);
};

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setUploadedImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleInterviewJdImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setInterviewJdImage(reader.result);
      reader.readAsDataURL(file);
    }
    event.target.value = '';
  };

  const handleResumeFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) { event.target.value = ''; return; }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'txt' || ext === 'md') {
      // Plain text: read into the textarea
      const reader = new FileReader();
      reader.onloadend = () => setResumeText(reader.result);
      reader.readAsText(file);
    } else if (file.type === 'application/pdf' || ext === 'pdf') {
      // PDF: read as data URL (Claude supports PDF natively)
      const reader = new FileReader();
      reader.onloadend = () => setResumeImage(reader.result);
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setResumeImage(reader.result);
      reader.readAsDataURL(file);
    } else if (ext === 'docx' || ext === 'doc') {
      // Word document: extract text via mammoth
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const mammoth = (await import('mammoth')).default;
          const { value } = await mammoth.extractRawText({ arrayBuffer: reader.result });
          setResumeText(value);
        } catch (e) {
          alert('Could not read Word document. Please save as PDF and try again.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('Please upload a PDF, Word document (.docx), plain text (.txt), or image file.');
    }
    event.target.value = '';
  };

  const handleResumeImageUpload = handleResumeFileUpload;

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const downloadAsWord = (content, filename = 'resume') => {
    const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${filename}</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;margin:1in}pre{white-space:pre-wrap;font-family:inherit}</style></head><body><pre>${escaped}</pre></body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printAsPDF = (content, title = 'Resume') => {
    const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`<html><head><title>${title}</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;margin:1in}@media print{body{margin:.75in}}pre{white-space:pre-wrap;font-family:inherit}</style></head><body><pre>${escaped}</pre><script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  };

  const translateMessage = async (key, text) => {
    // Toggle off if already translated
    if (translatedMessages[key]) {
      setTranslatedMessages(prev => { const n = { ...prev }; delete n[key]; return n; });
      return;
    }
    // Determine which native lang to use based on active subject
    const activeLangCode = currentSubject === 'followup' ? followupNativeLang
      : currentSubject === 'languages' ? (userProgress?.language || 'en')
      : interviewNativeLang;
    if (!activeLangCode) return;
    setTranslatingIdx(key);
    try {
      const langEntry = LANGUAGES.find(l => l.code === activeLangCode);
      const langName = langEntry?.name || activeLangCode;
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: `Translate the following text to ${langName}. Return ONLY the translation, nothing else.`,
          messages: [{ role: 'user', content: text }]
        })
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const translation = data?.content?.[0]?.text || '';
      if (translation) setTranslatedMessages(prev => ({ ...prev, [key]: translation }));
    } catch (e) {
      console.error('Translation failed:', e);
    }
    setTranslatingIdx(null);
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
        ? "Hi! I'm Sunny! Ask me anything — animals, space, why the sky is blue — or show me your homework! What are you curious about today?"
        : parseInt(userProgress.age) <= 12
        ? "Hey! I'm Sunny. Ask me anything you're curious about — science, history, animals, math, homework. You can also snap a photo of something you need help with. What's on your mind?"
        : "Hi! I'm Sunny. Ask me anything — homework, science concepts, history, current events, anything you're curious about. I'll give you an accurate, clear answer. What would you like to know?"
    };
    setConversation([welcomeMessage]);
    
    if (parseInt(userProgress.age) <= 6) {
      setTimeout(() => speak(welcomeMessage.content), 300);
    }
  };

  // ── GEMINI HELPER ────────────────────────────────────────────────────

  const callGemini = async (task, context) => {
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, context }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.result || null;
    } catch {
      return null;
    }
  };

  // ── ADULT ACTIVITY STARTERS ─────────────────────────────────────────

  const startSkillsActivity = async (topicId) => {
    setShowSkillsPicker(false);
    setIsHomeworkMode(false);
    setCurrentSubject('skills');
    setSelectedTopic(topicId);
    setConversation([]);
    setUserAnswer('');
    setUploadedImage(null);
    setCurrentCoachSay('');
    setCurrentStudyBoard(null);
    lastAiStateRef.current = null;
    setScreen('activity');
    setIsLoading(true);
    const skill = SKILLS_TOPICS.find(s => s.id === topicId);
    const skillName = skill?.name || topicId;
    try {
      const { getSkillsSystemPrompt } = await import('./utils/sunnyPrompts');
      const systemPrompt = getSkillsSystemPrompt(skillName, userProgress.name, userProgress.language || 'en');
      const firstMsg = `I want to learn ${skillName}. Let's get started.`;
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system: systemPrompt, messages: [{ role: 'user', content: firstMsg }] }) });
      const data = await response.json();
      const text = data?.content?.[0]?.text || `Hi ${userProgress.name}! Ready to dive into ${skillName}? Paste some code, describe what you're working on, or upload a screenshot and I'll help you out.`;
      setConversation([{ role: 'user', content: firstMsg }, { role: 'assistant', content: text }]);
      setCurrentCoachSay('');
      setCurrentStudyBoard(null);
    } catch (e) {
      setConversation([{ role: 'assistant', content: `Hi ${userProgress.name}! Ready to work on ${skillName}? Paste your code or describe what you need help with, and I'll dive right in.` }]);
    }
    setIsLoading(false);
  };

  const startInterviewPrep = async (jobDesc, company, jdImage) => {
    setShowInterviewSetup(false);
    setInterviewJdImage(null);
    setTranslatedMessages({});
    setTtsEnabled(true);
    setIsHomeworkMode(false);
    setCurrentSubject('interview');
    setSelectedTopic(company || 'general');
    setConversation([]);
    setUserAnswer('');
    setUploadedImage(null);
    setCurrentCoachSay('');
    setCurrentStudyBoard(null);
    lastAiStateRef.current = null;
    setScreen('activity');
    setIsLoading(true);
    // Web search for company-specific interview intel
    let searchResults = [];
    if (company) {
      try {
        const resp = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `${company} interview questions site:glassdoor.com OR site:reddit.com OR site:levels.fyi` }) });
        const d = await resp.json();
        searchResults = d.results || [];
      } catch (e) { /* graceful degradation */ }
    }
    setInterviewSearchResults(searchResults);
    try {
      const { getInterviewSystemPrompt } = await import('./utils/sunnyPrompts');
      const systemPrompt = getInterviewSystemPrompt(jobDesc, company, searchResults, userProgress.name);
      const textPart = `I want to prepare for this role${company ? ` at ${company}` : ''}. ${jobDesc ? `Here is the job description: ${jobDesc}` : 'Please review the job description in the image and coach me for this role.'}`;
      // Build message content — include image if provided
      let firstMsgContent;
      if (jdImage) {
        const [prefix, b64] = jdImage.split(',');
        const mediaType = prefix.match(/:(.*?);/)?.[1] || 'image/jpeg';
        firstMsgContent = [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
          { type: 'text', text: textPart }
        ];
      } else {
        firstMsgContent = textPart;
      }
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system: systemPrompt, messages: [{ role: 'user', content: firstMsgContent }] }) });
      const data = await response.json();
      const text = data?.content?.[0]?.text || `Hi ${userProgress.name}! I've reviewed the role. Let's practice — I'll ask you interview questions one at a time, just like a real interviewer. Ready to begin?`;
      setConversation([{ role: 'user', content: textPart }, { role: 'assistant', content: text }]);
    } catch (e) {
      setConversation([{ role: 'assistant', content: `Hi ${userProgress.name}! I've reviewed the role${company ? ` at ${company}` : ''}. Let's practice — I'll ask you one question at a time, just like a real interviewer. Ready to begin?` }]);
    }
    setIsLoading(false);
  };

  const startLifeCoach = () => {
    setIsHomeworkMode(false);
    setCurrentSubject('life-coach');
    setConversation([{ role: 'assistant', content: `Hi ${userProgress.name}! I'm here to help with anything — legal questions, medical info, document translation, financial decisions, or whatever's on your mind. What can I help you with?` }]);
    setUserAnswer('');
    setUploadedImage(null);
    setCurrentCoachSay('');
    setCurrentStudyBoard(null);
    setScreen('activity');
  };

  const startTradingLesson = async (assetClass, symbolOverride) => {
    setShowTradingSetup(false);
    const defaultSymbols = { stocks: 'AAPL', crypto: 'BTC-USD', forex: 'EURUSD=X', options: 'SPY' };
    const symbol = (symbolOverride || '').trim().toUpperCase() || defaultSymbols[assetClass] || 'AAPL';
    const level = userProgress?.subjects?.trading?.level || 0;
    const levelLabel = ['beginner', 'intermediate', 'advanced'][Math.min(level, 2)] || 'beginner';

    setIsHomeworkMode(false);
    setCurrentSubject('trading');
    setSelectedTopic(assetClass);
    setTradingSymbolInput(symbol);
    setConversation([]);
    setUserAnswer('');
    setUploadedImage(null);
    setCurrentCoachSay('');
    setCurrentStudyBoard(null);
    lastAiStateRef.current = null;
    setScreen('activity');
    setIsLoading(true);

    // Web search for current trading strategies
    let searchResults = [];
    try {
      const resp = await fetch('/api/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `best ${levelLabel} ${assetClass} trading chart patterns strategy 2025 site:reddit.com OR site:investopedia.com OR site:babypips.com OR site:tradingview.com` })
      });
      searchResults = (await resp.json()).results || [];
    } catch {}
    setTradingSearchResults(searchResults);

    try {
      const { getTradingSystemPrompt, getStockResearchPrompt, get0DTEPrompt, getOptionsDeskPrompt, OPTIONS_DESK_STRATEGIES } = await import('./utils/sunnyPrompts');
      let systemPrompt, firstMsg;
      if (assetClass === 'options-desk') {
        const stratMeta = OPTIONS_DESK_STRATEGIES.find(s => s.id === tradingOptionsStrategy) || OPTIONS_DESK_STRATEGIES[0];
        systemPrompt = getOptionsDeskPrompt(tradingOptionsStrategy, userProgress.name);
        firstMsg = `Run the ${stratMeta.firm} ${stratMeta.name} analysis for today's market session.`;
      } else if (assetClass === 'research') {
        systemPrompt = getStockResearchPrompt(symbol, userProgress.name);
        firstMsg = `Run a full Goldman Sachs-style equity research analysis on ${symbol}.`;
      } else if (assetClass === '0dte') {
        systemPrompt = get0DTEPrompt(userProgress.name);
        firstMsg = `Give me today's 0DTE SPX credit spread trade setup using the Tastytrade framework.`;
      } else {
        systemPrompt = getTradingSystemPrompt(assetClass, symbol, searchResults, userProgress.name, level);
        firstMsg = `I want to learn ${assetClass} chart reading. I'm at the ${levelLabel} level. Show me a real chart and start my first lesson.`;
      }
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system: systemPrompt, messages: [{ role: 'user', content: firstMsg }] })
      });
      const data = await response.json();
      const aiText = data?.content?.[0]?.text || '';
      try {
        const parsed = extractJSON(aiText);
        const displayCoachSay = (parsed.coach_say || '').replace(/\[L:\s*(.*?)\]/g, '$1');
        setCurrentCoachSay(displayCoachSay);
        if (parsed.study_board?.visual) setCurrentStudyBoard(parsed.study_board);
        setConversation([{ role: 'user', content: firstMsg }, { role: 'assistant', content: displayCoachSay }]);
      } catch {
        setConversation([{ role: 'assistant', content: aiText || `Ready to start? Let's dive in.` }]);
      }
    } catch {
      setConversation([{ role: 'assistant', content: `Welcome ${userProgress.name}! Ready to start? Let's dive in.` }]);
    }
    setIsLoading(false);
  };

  const startAgentPipeline = async () => {
    const AGENT_DEFS = [
      { id: 'scanner',    name: 'Market Scanner' },
      { id: 'sentiment',  name: 'Sentiment Agent' },
      { id: 'prediction', name: 'Prediction Agent' },
      { id: 'risk',       name: 'Risk Agent' },
      { id: 'executor',   name: 'Execution Agent' },
      { id: 'postmortem', name: 'Post-Mortem Agent' },
    ];
    const makeAgent = (def) => ({ ...def, status: 'waiting', output: '', outputFull: null, startedAt: null, completedAt: null });

    const initialPipelineState = {
      agents: AGENT_DEFS.map(makeAgent),
      recommendation: null,
      isRunning: true,
      dataSource: 'mock',
    };

    setIsHomeworkMode(false);
    setCurrentSubject('trading');
    setSelectedTopic('agents');
    setConversation([]);
    setCurrentCoachSay('Running the 6-agent pipeline on live Polymarket markets...');
    setCurrentStudyBoard({ visualType: 'agent-pipeline', visual: initialPipelineState });
    setAgentPipelineState(initialPipelineState);
    setScreen('activity');

    // Helper: update one agent + sync StudyBoard
    const updateAgent = (id, patch) => {
      setAgentPipelineState(prev => {
        if (!prev) return prev;
        const agents = prev.agents.map(a => a.id === id ? { ...a, ...patch } : a);
        const next = { ...prev, agents };
        setCurrentStudyBoard({ visualType: 'agent-pipeline', visual: next });
        return next;
      });
    };

    // Helper: run one Claude agent (retries once on network error)
    const runAgent = async (agentType, ctx, attempt = 0) => {
      const { getAgentPrompt } = await import('./utils/sunnyPrompts.js');
      updateAgent(agentType, { status: 'running', startedAt: Date.now() });
      try {
        const resp = await fetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system: getAgentPrompt(agentType, ctx, userProgress?.name || 'Trader'),
            messages: [{ role: 'user', content: 'Run your analysis now and return the JSON result.' }],
            maxTokens: 2000,
          }),
        });
        const data = await resp.json();
        const rawText = data?.content?.[0]?.text || '{}';
        let parsed = {};
        try {
          const s = rawText.indexOf('{'), e = rawText.lastIndexOf('}');
          if (s !== -1 && e !== -1) parsed = JSON.parse(rawText.slice(s, e + 1));
        } catch { parsed = { status: 'error', summary: 'Could not parse response.' }; }

        const isError = parsed.status === 'error' || !parsed.agent;
        const isBlocked = agentType === 'risk' && (parsed.riskAssessments || []).every(r => !r.approved);
        updateAgent(agentType, {
          status: isError ? 'error' : isBlocked ? 'blocked' : 'done',
          output: parsed.summary || '',
          outputFull: parsed,
          completedAt: Date.now(),
        });
        return parsed;
      } catch (err) {
        // Retry once on network errors (ERR_NETWORK_CHANGED, etc.)
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 2000));
          return runAgent(agentType, ctx, 1);
        }
        updateAgent(agentType, { status: 'error', output: 'Network error — check connection', completedAt: Date.now() });
        return { status: 'error' };
      }
    };

    try {
      // Fetch Polymarket data
      let markets = [], dataSource = 'mock';
      try {
        const pmResp = await fetch('/api/polymarket');
        const pmData = await pmResp.json();
        markets = pmData.markets || [];
        dataSource = pmData.source || 'mock';
      } catch {}
      // Build a marketId → URL lookup so we can link to Polymarket later
      const marketUrlMap = Object.fromEntries(markets.map(m => [m.id, m.marketUrl || '']));
      setAgentPipelineState(prev => {
        if (!prev) return prev;
        const next = { ...prev, dataSource };
        setCurrentStudyBoard({ visualType: 'agent-pipeline', visual: next });
        return next;
      });

      // Agent 1: Scanner
      const scanResult = await runAgent('scanner', { markets });
      let topMarkets = scanResult.topMarkets || [];
      // If scanner failed or returned nothing, synthesize top markets from raw data so pipeline continues
      if (!topMarkets.length && markets.length) {
        const fallbackMarkets = [...markets]
          .sort((a, b) => (b.volume || 0) - (a.volume || 0))
          .slice(0, 3)
          .map(m => ({
            id: m.id, question: m.question,
            yes_bid: m.yes_bid, volume: m.volume, liquidity: m.liquidity,
            endDate: m.endDate,
            flagReason: 'High volume market (auto-selected)',
            edgeEstimate: Math.abs((m.yes_bid || 0.5) - 0.5),
          }));
        topMarkets = fallbackMarkets;
        // Mark scanner as done with fallback note
        updateAgent('scanner', { status: 'done', output: 'Auto-selected top markets by volume (AI scan skipped)', completedAt: Date.now() });
      }
      if (!topMarkets.length) {
        setCurrentCoachSay('No markets available. Try again later.');
        setAgentPipelineState(prev => { const next = { ...prev, isRunning: false }; setCurrentStudyBoard({ visualType: 'agent-pipeline', visual: next }); return next; });
        return;
      }

      // Agent 2: Sentiment (with Brave search)
      let searchResults = [];
      try {
        const sResp = await fetch('/api/search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `${topMarkets[0]?.question || ''} prediction odds site:reddit.com OR site:reuters.com OR site:polymarket.com` }),
        });
        searchResults = (await sResp.json()).results || [];
      } catch {}
      const sentResult = await runAgent('sentiment', { topMarkets, searchResults });
      let sentimentScores = sentResult.sentimentScores || [];
      // Fallback: if sentiment failed, synthesize neutral scores from top markets so pipeline continues
      if (!sentimentScores.length) {
        sentimentScores = topMarkets.map(m => ({
          marketId: m.id, question: m.question, yes_bid: m.yes_bid,
          sentimentDirection: (m.yes_bid || 0.5) > 0.55 ? 'bullish' : (m.yes_bid || 0.5) < 0.45 ? 'bearish' : 'neutral',
          sentimentConfidence: 0.5,
          sentimentVsMarket: `Market prices Yes at ${Math.round((m.yes_bid || 0.5) * 100)}%. No external sentiment available.`,
          keySignals: ['Based on market price only'],
        }));
        if (sentResult.status === 'error') {
          updateAgent('sentiment', { status: 'done', output: 'Using market-price-only sentiment (AI scan skipped)', completedAt: Date.now() });
        }
      }

      // Agent 3: Prediction
      const predResult = await runAgent('prediction', { sentimentScores });
      let predictions = predResult.predictions || [];
      // Fallback: if prediction failed, synthesize predictions from sentiment scores
      if (!predictions.length) {
        predictions = sentimentScores.map(s => {
          const base = s.yes_bid || 0.5;
          const adj = s.sentimentDirection === 'bullish' ? Math.min(base + 0.07, 0.95)
                    : s.sentimentDirection === 'bearish' ? Math.max(base - 0.07, 0.05) : base;
          return {
            marketId: s.marketId, question: s.question, marketPrice: base,
            adjustedProbability: parseFloat(adj.toFixed(3)),
            confidenceLow: parseFloat((adj - 0.1).toFixed(3)),
            confidenceHigh: parseFloat((adj + 0.1).toFixed(3)),
            edge: parseFloat(Math.abs(adj - base).toFixed(3)),
            edgeDirection: adj >= base ? 'YES' : 'NO',
            modelRationale: 'Estimated from market price + sentiment direction (AI prediction skipped)',
          };
        });
        if (predResult.status === 'error') {
          updateAgent('prediction', { status: 'done', output: 'Using heuristic predictions (AI scan skipped)', completedAt: Date.now() });
        }
      }

      // Agent 4: Risk
      const riskResult = await runAgent('risk', { predictions });
      let riskAssessments = riskResult.riskAssessments || [];
      // Fallback: synthesize risk assessments if risk agent failed
      if (!riskAssessments.length) {
        riskAssessments = predictions
          .filter(p => p.edge >= 0.03)
          .map(p => {
            // Correct prediction market Kelly: accounts for asymmetric payoffs at non-50¢ prices
            const mktPrice = p.marketPrice || 0.5;
            const prob = p.adjustedProbability;
            let kelly;
            if (p.edgeDirection === 'NO') {
              kelly = Math.max(0, ((1 - prob) - (1 - mktPrice)) / mktPrice);
            } else {
              kelly = Math.max(0, (prob - mktPrice) / (1 - mktPrice));
            }
            const qKelly = kelly * 0.25;
            return {
              marketId: p.marketId, question: p.question,
              approved: kelly > 0, blockReason: kelly <= 0 ? 'Negative Kelly (unfavorable odds)' : null,
              kellyFraction: parseFloat(kelly.toFixed(4)),
              quarterKelly: parseFloat(qKelly.toFixed(4)),
              recommendedBetSize: parseFloat((qKelly * 10000).toFixed(0)),
              edge: p.edge, adjustedProbability: p.adjustedProbability,
              edgeDirection: p.edgeDirection, marketPrice: mktPrice,
            };
          });
        if (riskResult.status === 'error') {
          updateAgent('risk', { status: 'done', output: 'Using quarter-Kelly sizing (AI scan skipped)', completedAt: Date.now() });
        }
      }
      let approvedTrades = riskAssessments.filter(r => r.approved);
      // If nothing approved, pick the best available trade as a "below threshold" recommendation
      if (!approvedTrades.length && riskAssessments.length) {
        const best = [...riskAssessments].sort((a, b) => (b.edge || 0) - (a.edge || 0))[0];
        approvedTrades = [{ ...best, approved: true, blockReason: null, belowThreshold: true }];
        const bestEdgePct = Math.round((best.edge || 0) * 100);
        const bestKelly = parseFloat((best.kellyFraction || 0).toFixed(3));
        updateAgent('risk', { output: `All trades risk-blocked. Best available: edge ${bestEdgePct}%, Kelly ${bestKelly.toFixed(2)} — shown as educational example only.` });
      }
      if (!approvedTrades.length) {
        updateAgent('executor', { status: 'done', output: 'No markets available for execution.', completedAt: Date.now() });
        updateAgent('postmortem', { status: 'done', output: 'Pipeline complete — no trade executed this session.', completedAt: Date.now() });
        setCurrentCoachSay('No actionable markets found this session. Try again later or run again for fresh data.');
        setAgentPipelineState(prev => { const next = { ...prev, isRunning: false }; setCurrentStudyBoard({ visualType: 'agent-pipeline', visual: next }); return next; });
        return;
      }

      // Agent 5: Executor
      const execResult = await runAgent('executor', { riskAssessments: approvedTrades });
      const tradePlan = execResult.tradePlan || null;

      // Agent 6: Post-mortem preview (brief analysis before trade simulation)
      updateAgent('postmortem', { status: 'done', output: 'Awaiting trade simulation — click "Simulate Trade" to run outcome analysis.', completedAt: Date.now() });

      // Build recommendation
      const bestRisk = approvedTrades[0];
      const matchPred = predictions.find(p => p.marketId === bestRisk?.marketId);
      if (tradePlan || bestRisk) {
        const isBelow = bestRisk?.belowThreshold;
        const recommendation = {
          question:   tradePlan?.question || bestRisk?.question || predictions[0]?.question || 'Top market',
          action:     tradePlan?.action || (bestRisk?.edgeDirection === 'NO' ? 'BUY NO' : 'BUY YES'),
          entryPrice: tradePlan?.entryPrice || (matchPred?.marketPrice || 0.5),
          betSize:    tradePlan?.totalCost || bestRisk?.recommendedBetSize || 0,
          edge:       bestRisk?.edge || 0,
          confidence: matchPred?.adjustedProbability || 0.5,
          rationale:  tradePlan?.rationale || (isBelow
            ? `Best available market — edge is below the 3% threshold. Treat as educational only. ${matchPred?.modelRationale || ''}`
            : matchPred?.modelRationale || 'Based on market pricing and directional analysis.'),
          marketUrl: marketUrlMap[bestRisk?.marketId] || '',
          marketId:  bestRisk?.marketId || '',
        };
        setAgentPipelineState(prev => {
          if (!prev) return prev;
          const next = { ...prev, recommendation, isRunning: false };
          setCurrentStudyBoard({ visualType: 'agent-pipeline', visual: next });
          return next;
        });
        setCurrentCoachSay(isBelow
          ? `Pipeline complete. Best available market shown — edge below threshold, proceed with caution.`
          : `Pipeline complete. ${recommendation.action} opportunity found. Review the recommendation below.`);
      }

    } catch (err) {
      console.error('Agent pipeline error:', err);
      setCurrentCoachSay('Pipeline encountered an error. Please try again.');
      setAgentPipelineState(prev => { if (!prev) return prev; const next = { ...prev, isRunning: false }; setCurrentStudyBoard({ visualType: 'agent-pipeline', visual: next }); return next; });
    }
  };

  // Pipeline interaction handler (called via StudyBoard's onInteraction prop)
  const handlePipelineInteraction = async (event) => {
    if (!event) return;

    if (event.type === 'simulate-trade') {
      const pState = agentPipelineState;
      if (!pState?.recommendation) return;

      // Simulate outcome after 30s based on model confidence
      setTimeout(async () => {
        const confidence = pState.recommendation?.confidence || 0.5;
        const didWin = Math.random() < confidence;
        const execAgent = pState.agents?.find(a => a.id === 'executor');
        const tradePlan = execAgent?.outputFull?.tradePlan || {};
        const simOutcome = {
          resolved: didWin ? 'YES' : 'NO',
          finalPrice: didWin ? 1.0 : 0.0,
          pnl: didWin ? parseFloat(tradePlan.expectedProfit || 0) : -parseFloat(tradePlan.totalCost || 0),
        };
        try {
          const { getAgentPrompt } = await import('./utils/sunnyPrompts.js');
          const pmResp = await fetch('/api/chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system: getAgentPrompt('postmortem', { tradePlan, simulatedOutcome: simOutcome }, userProgress?.name || 'Trader'),
              messages: [{ role: 'user', content: 'Analyze the trade outcome and return the JSON post-mortem.' }],
            }),
          });
          const pmData = await pmResp.json();
          const rawText = pmData?.content?.[0]?.text || '{}';
          let pmResult = {};
          try {
            const s = rawText.indexOf('{'), e = rawText.lastIndexOf('}');
            if (s !== -1 && e !== -1) pmResult = JSON.parse(rawText.slice(s, e + 1));
          } catch {}
          setAgentPipelineState(prev => {
            if (!prev) return prev;
            const agents = prev.agents.map(a => a.id === 'postmortem'
              ? { ...a, status: 'done', output: pmResult.summary || `Outcome: ${simOutcome.resolved} | P&L: $${simOutcome.pnl.toFixed(2)}`, outputFull: pmResult, completedAt: Date.now() }
              : a);
            const next = { ...prev, agents };
            setCurrentStudyBoard({ visualType: 'agent-pipeline', visual: next });
            return next;
          });
          const pnlStr = simOutcome.pnl >= 0 ? `+$${simOutcome.pnl.toFixed(2)}` : `-$${Math.abs(simOutcome.pnl).toFixed(2)}`;
          setCurrentCoachSay(`Post-mortem complete. Simulated outcome: ${simOutcome.resolved} (${pnlStr})`);

          // Record trade in paper portfolio
          const rec = pState.recommendation;
          setPaperPortfolio(prev => {
            const pnl = parseFloat(simOutcome.pnl.toFixed(2));
            const trade = {
              date: new Date().toLocaleDateString(),
              question: rec?.question || 'Unknown market',
              action: rec?.action || 'BUY YES',
              entryPrice: rec?.entryPrice || 0,
              betSize: rec?.betSize || 0,
              edge: rec?.edge || 0,
              outcome: simOutcome.resolved,
              pnl,
              won: didWin,
              marketUrl: rec?.marketUrl || '',
            };
            const next = {
              ...prev,
              balance: parseFloat((prev.balance + pnl).toFixed(2)),
              trades: [trade, ...(prev.trades || [])],
            };
            try { localStorage.setItem(PAPER_PORTFOLIO_KEY, JSON.stringify(next)); } catch {}
            return next;
          });
        } catch (err) {
          console.error('Post-mortem error:', err);
        }
      }, 30000);
    }

    if (event.type === 'pipeline-reset') {
      setAgentPipelineState(null);
      setCurrentStudyBoard(null);
      setCurrentCoachSay('');
      setConversation([]);
      setScreen('dashboard');
    }

    if (event.type === 'clear-portfolio') {
      const fresh = { startingBalance: 10000, balance: 10000, trades: [] };
      setPaperPortfolio(fresh);
      try { localStorage.setItem(PAPER_PORTFOLIO_KEY, JSON.stringify(fresh)); } catch {}
    }
  };

  const startAccentCoach = () => {
    setIsHomeworkMode(false);
    setCurrentSubject('accent');
    setSelectedTopic(null);
    setUserAnswer('');
    setUploadedImage(null);
    lastAiStateRef.current = null;
    setTtsEnabled(true);

    const name = userProgress.name;
    const openingPhrase = "I'd like a cup of coffee, please.";
    const coachText = `Hi ${name}! I want to hear you speak first — no pressure. Say this sentence for me, just naturally:`;
    const studyBoard = {
      visual: {
        word: openingPhrase,
        translation: "Just say it out loud — I'll listen to your accent and coach you from there.",
      },
      visualType: 'flashcard',
    };

    setConversation([{ role: 'assistant', content: coachText }]);
    setCurrentCoachSay(coachText);
    setCurrentStudyBoard(studyBoard);
    setScreen('activity');

    // Speak the instruction, then the example phrase, then auto-start listening
    const autoStartListening = () => {
      if (!recognitionRef.current) return;
      try {
        recognitionRef.current.abort();
      } catch (e) { /* ignore */ }
      recognitionRef.current.lang = 'en-US'; // always English for accent coach
      // 1.2s delay after TTS finishes — lets speaker audio dissipate before mic opens
      setTimeout(() => {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (e) {
          console.error('accent auto-listen error:', e);
        }
      }, 1200);
    };

    if (synthRef.current) {
      setTimeout(() => {
        speak(coachText, () => {
          setTimeout(() => speak(openingPhrase, autoStartListening, 'en'), 500);
        }, 'en');
      }, 400);
    } else {
      // No TTS — just start listening directly
      setTimeout(autoStartListening, 800);
    }
  };

  const startResumeReview = async (resumeTextInput, resumeImg, jobDesc) => {
    setShowResumeSetup(false);
    setResumeImage(null);
    setIsHomeworkMode(false);
    setCurrentSubject('resume');
    setSelectedTopic(jobDesc ? 'tailored' : 'general');
    setConversation([]);
    setUserAnswer('');
    setUploadedImage(null);
    setCurrentCoachSay('');
    setCurrentStudyBoard(null);
    lastAiStateRef.current = null;
    setScreen('activity');
    setIsLoading(true);
    try {
      const { getResumeSystemPrompt } = await import('./utils/sunnyPrompts');
      const systemPrompt = getResumeSystemPrompt(userProgress.name, jobDesc, interviewNativeLang);
      let firstMsgContent;
      if (resumeImg) {
        const [prefix, b64] = resumeImg.split(',');
        const mediaType = prefix.match(/:(.*?);/)?.[1] || 'image/jpeg';
        const isPdf = mediaType === 'application/pdf';
        const fileBlock = isPdf
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
          : { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } };
        const textBlock = {
          type: 'text',
          text: resumeTextInput
            ? `Here is my resume (also ${isPdf ? 'as PDF' : 'as image'} above):\n\n${resumeTextInput}${jobDesc ? `\n\nTarget job description:\n${jobDesc}` : ''}`
            : `Here is my resume as a ${isPdf ? 'PDF document' : 'image'}.${jobDesc ? `\n\nTarget job description:\n${jobDesc}` : ''}`
        };
        firstMsgContent = [fileBlock, textBlock];
      } else {
        firstMsgContent = `Here is my resume:\n\n${resumeTextInput}${jobDesc ? `\n\nTarget job description:\n${jobDesc}` : ''}`;
      }
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system: systemPrompt, messages: [{ role: 'user', content: firstMsgContent }] }) });
      const data = await response.json();
      const text = data?.content?.[0]?.text || `Hi ${userProgress.name}! I've reviewed your resume. Here are my suggestions.`;
      const displayMsg = resumeImg && !resumeTextInput ? '(Resume image uploaded)' : `Resume submitted${jobDesc ? ' with job description' : ''}`;
      setConversation([{ role: 'user', content: displayMsg }, { role: 'assistant', content: text }]);
    } catch (e) {
      setConversation([{ role: 'assistant', content: `Hi ${userProgress.name}! I'm ready to review and polish your resume. Please share it with me and let me know what role you're targeting.` }]);
    }
    setIsLoading(false);
  };

  const startInterviewFollowup = async (mode, emailText, company) => {
    setShowFollowupSetup(false);
    setIsHomeworkMode(false);
    setCurrentSubject('followup');
    setSelectedTopic(company || mode);
    setConversation([]);
    setUserAnswer('');
    setUploadedImage(null);
    setCurrentCoachSay('');
    setCurrentStudyBoard(null);
    lastAiStateRef.current = null;
    setTranslatedMessages({});
    setScreen('activity');
    setIsLoading(true);
    try {
      const { getFollowupSystemPrompt } = await import('./utils/sunnyPrompts');
      const systemPrompt = getFollowupSystemPrompt(userProgress.name, mode, company, followupNativeLang);
      const firstMsgContent = mode === 'thankyou'
        ? `I just had an interview${company ? ` at ${company}` : ''} and I need to write a professional thank you email. Please help me write one.`
        : emailText
          ? `I received this follow-up email from the interviewer${company ? ` at ${company}` : ''}:\n\n${emailText}\n\nPlease help me understand it and draft a reply.`
          : `I need help replying to an email from${company ? ` ${company}` : ' an interviewer'}.`;
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system: systemPrompt, messages: [{ role: 'user', content: firstMsgContent }] }) });
      const data = await response.json();
      const text = data?.content?.[0]?.text || `Hi ${userProgress.name}! I'm here to help with your follow-up email.`;
      setConversation([{ role: 'user', content: firstMsgContent }, { role: 'assistant', content: text }]);
    } catch (e) {
      const fallback = mode === 'thankyou'
        ? `Hi ${userProgress.name}! Let's write a professional thank you email. Tell me the interviewer's name and one key topic you discussed.`
        : `Hi ${userProgress.name}! I can help you reply to that email. Share it here and we'll work through it together.`;
      setConversation([{ role: 'assistant', content: fallback }]);
    }
    setIsLoading(false);
  };

  // V2: Delegate to engines
  const createSmartVisual = engineCreateSmartVisual;
  const normalizeStudyBoard = engineNormalizeStudyBoard;

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

// V2: Smart Mode functions now imported from engines
// buildSmartLearnerContext → buildLearnerContext (from learnerMemory)
// chooseSmartStartActivity → chooseStartActivity (from smartOrchestrator)
// buildSmartFirstMessage → buildFirstMessage (from smartOrchestrator)
const buildSmartLearnerContext = buildLearnerContext;

function startSmartMode() {
  startActivityWithTopic('smart', null);
}

// Quick-launch Smart Mode with a pre-seeded capability intent
function startSmartModeWithIntent(intent) {
  smartModeIntentRef.current = intent;
  startActivityWithTopic('smart', null);
}

// V2: getLanguageSpecificTips imported from languageEngine

// NEW FUNCTION - Add this right after startActivity
async function startActivityWithTopic(subjectKey, topicId) {

  // Auto-enable TTS for language learning — the user needs to hear pronunciation
  if (subjectKey === 'languages' && synthRef.current) {
    setTtsEnabled(true);
  }

  // === SMART MODE — adaptive cross-subject coaching (no fixed subject/level) ===
  if (subjectKey === 'smart') {
    setShowTopicSelection(false);
    setIsHomeworkMode(false);
    setCurrentSubject('smart');
    setSelectedTopic(null);
    setConversation([]);
    setUserAnswer('');
    setUploadedImage(null);
    setCurrentCoachSay('');
    setCurrentStudyBoard(null);
    lastAiStateRef.current = null;
    setScreen('activity');
    setIsLoading(true);
    try {
      const { getSmartModeSystemPrompt } = await import('./utils/sunnyPrompts');
      const _smartCtx = buildSmartLearnerContext(userProgress);
      const smartPrompt = getSmartModeSystemPrompt({
        name: userProgress.name,
        age: parseInt(userProgress.age),
        profileLang: userProgress.language || 'en',
      }, _smartCtx);
      const _intentHint = smartModeIntentRef.current;
      smartModeIntentRef.current = null; // clear after use
      const _profileLang = userProgress.language || 'en';
      const firstMsg = buildFirstMessage(userProgress.name, _smartCtx, parseInt(userProgress.age), _intentHint, _profileLang);
      fetchAbortRef.current?.abort();
      fetchAbortRef.current = new AbortController();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: fetchAbortRef.current.signal,
        body: JSON.stringify({ system: smartPrompt, messages: [{ role: 'user', content: firstMsg }] }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(`API ${response.status}: ${errBody?.error?.message || JSON.stringify(errBody)}`);
      }
      const data = await response.json();
      const aiText = data.content?.[0]?.text || '';
      const parsed = extractJSON(aiText);
      if (parsed) {
        const displayCoachSay = (parsed.coach_say || '').replace(/\[L:\s*(.*?)\]/g, '$1');
        setCurrentCoachSay(displayCoachSay);
        const nb = normalizeStudyBoard(parsed.study_board);
        if (nb?.visual) {
          setCurrentStudyBoard({ ...nb, audioPrompt: parsed.audioPrompt, correctAnswer: parsed.correctAnswer });
        }
        setConversation([{ role: 'assistant', content: displayCoachSay }]);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setConversation([{ role: 'assistant', content: "Let's get started! What would you like to learn today?" }]);
        setCurrentCoachSay("Let's get started! What would you like to learn today?");
      }
    }
    setIsLoading(false);
    return;
  }

  // If this is a language and user hasn't been assessed yet, start language assessment
  if (subjectKey === 'languages' && topicId && languageAssessmentQuestions[topicId]) {
    // Ensure languages subject and languageLevels exist
    if (!userProgress.subjects.languages) {
      userProgress.subjects.languages = { level: 0, maxLevel: 3, points: 0, activitiesCompleted: 0, correctAnswers: 0, totalAttempts: 0, currentStreak: 0, advancementStreak: 0, recentAttempts: [], languageLevels: {} };
      await saveUserProgress(userProgress);
    }
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
      // Save preferred language before assessment
      userProgress.subjects.languages.preferredLanguage = topicId;
      saveUserProgress(userProgress);
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
  // Track preferred language for dashboard card
  if (subjectKey === 'languages' && topicId) {
    userProgress.subjects.languages.preferredLanguage = topicId;
    saveUserProgress(userProgress);
  }
  setConversation([]);
  setUserAnswer('');
  setUploadedImage(null);
  setCurrentCoachSay('');
  setCurrentStudyBoard(null);
  lastAiStateRef.current = null; // Reset language state tracking for new session
  setScreen('activity');
  
  let subject = subjects[subjectKey];
  if (!subject) {
    const s = ADULT_SUBJECTS[subjectKey];
    if (!s) { console.error(`Unknown subject: ${subjectKey}`); setIsLoading(false); return; }
    subject = { name: s.name, icon: s.icon, color: 'from-indigo-500 to-purple-600', levels: {} };
  }

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
      maxLevel: (subject.levels[ageGroup]?.length ?? 1) - 1,
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
  const levelName = subject.levels?.[ageGroup]?.[level] || subject.levels?.[ageGroup]?.[0] || 'Professional';
  const difficultyBoost = userProgress.subjects[subjectKey]?.difficultyBoost || 0;
  
  console.log(`📊 Starting ${subjectKey}: level=${level}, levelName="${levelName}", ageGroup="${ageGroup}", difficultyBoost=${difficultyBoost}`);
  
  setIsLoading(true);

  try {
    const ageNum = parseInt(userProgress.age);
    
    // TTS should be enabled for young kids OR anyone learning a language (need to hear pronunciation)
    const forceVoice = ageNum <= AGE_BOUNDARIES.VOICE_ALWAYS_MAX;
    const shouldUseTTS = (forceVoice || ((ageNum <= AGE_BOUNDARIES.TTS_MAX || subjectKey === 'languages') && ttsEnabled)) && synthRef.current;
    
    // Get subject constraint - handle topics dynamically for ALL subjects
    const _topicList = advancedTopics[subjectKey] || ADVANCED_TOPICS[subjectKey];
    let constraint;
    if (topicId) {
      const topic = _topicList?.find(t => t.id === topicId);
      if (topic) {
        // Topic-specific constraint for ANY subject with topics
        constraint = `CRITICAL: ONLY teach ${topic.name.toUpperCase()}. Focus exclusively on: ${topic.description}. DO NOT switch to other topics like ${_topicList?.filter(t => t.id !== topicId).map(t => t.name).join(', ')}. Every question must be about ${topic.name}.`;
      } else {
        constraint = subjectConstraints[subjectKey];
      }
    } else {
      constraint = subjectConstraints[subjectKey];
    }
    
const _subjProgress = userProgress.subjects?.[subjectKey];
    const _recentMistakes = (_subjProgress?.recentAttempts || [])
      .filter(a => !a.success).slice(-5).map(a => a.topic).filter(Boolean);
    const _wordBank = (subjectKey === 'languages')
      ? Object.keys(userProgress.subjects?.languages?.wordBank || {}).slice(0, 30)
      : [];

    // Adaptive intelligence fields
    const _last5 = (_subjProgress?.recentAttempts || []).slice(-5);
    const _isStruggling = _last5.filter(a => !a.success).length >= 3;
    const _totalAtt = _subjProgress?.totalAttempts || 0;
    const _confScore = Math.round(((_subjProgress?.correctAnswers || 0) / Math.max(_totalAtt, 1)) * 100);
    const _confLabel = _totalAtt >= 5 ? (_confScore >= 75 ? 'High' : _confScore >= 50 ? 'Medium' : 'Low') : null;
    const _masteryPct = Math.round(((_subjProgress?.level || 0) / Math.max(_subjProgress?.maxLevel || 1, 1)) * 100);
    const _topicStats = _subjProgress?.topicStats || {};
    const _twoDaysAgo = Date.now() - 172800000;
    const _weakTopics = Object.entries(_topicStats)
      .filter(([, s]) => s.attempts >= 3 && s.correct / s.attempts < 0.5).map(([t]) => t);
    const _nextReview = Object.entries(_topicStats)
      .filter(([, s]) => s.lastSeen && s.lastSeen < _twoDaysAgo)
      .sort(([, a], [, b]) => a.lastSeen - b.lastSeen).map(([t]) => t);

let systemPrompt = getSunnySystemPrompt({
  name: userProgress.name,
  age: ageNum,
  profileLang: userProgress.language || 'en',  // User's interface language
  learningLang: subjectKey === 'languages' ? topicId : null, // Only for language learning
  hasHistory: userProgress.assessmentCompleted,
  recentMistakes: _recentMistakes,
  wordBank: _wordBank,
  isStruggling: _isStruggling,
  confidenceLabel: _confLabel,
  masteryPct: _masteryPct,
  weakTopics: _weakTopics,
  nextReviewTopics: _nextReview,
}) + (() => {
  // Compute adaptive immersion level for language teaching
  const _langLevel = subjectKey === 'languages' && topicId
    ? (userProgress.subjects?.languages?.languageLevels?.[topicId] ?? 0)
    : 0;
  const _immersionPct = Math.min(Math.round(_langLevel * 18), 90); // 0→0%, 5→90%
  const _isBeginner = _langLevel <= 1;
  const _isEarlyIntermediate = _langLevel >= 2 && _langLevel <= 3;
  return `\n\n=== TEACHING APPROACH ===
${subjectKey === 'languages' && topicId ? `
You're teaching ${topicId.toUpperCase()} to a learner at level ${_langLevel}/5.

══ IMMERSION RULE (MANDATORY) ══
Target language usage in your responses: ${_immersionPct}%${_isBeginner ? ' or less' : ''}.
${_langLevel === 0 ? `COMPLETE BEGINNER — Level 0:
- Speak 100% English. Show ONE ${topicId} word or phrase per turn as a flashcard. NEVER speak full sentences in ${topicId}.
- Pattern: English explanation → show flashcard → ask learner to repeat/identify.
- ❌ WRONG: Entire response in ${topicId}. Opening with ${topicId} greeting and staying there.
- ✅ CORRECT: "Your first word in ${topicId} is..." then show flashcard with English translation.` : ''}
${_langLevel === 1 ? `EARLY BEGINNER — Level 1:
- 80% English, up to 20% target language.
- Introduce 1-2 new words or a short phrase per turn, always with translation.
- Short greetings OK but always translate immediately after.` : ''}
${_isEarlyIntermediate ? `EARLY INTERMEDIATE — Level ${_langLevel}:
- ${100 - _immersionPct}% English guidance, ${_immersionPct}% target language.
- Short sentences in target language OK if always followed by translation.
- Introduce simple grammar through examples, not lectures.` : ''}
${_langLevel >= 4 ? `INTERMEDIATE/ADVANCED — Level ${_langLevel}:
- ${_immersionPct}% target language. Use it naturally in coaching.
- Short conversations in target language with gentle corrections.
- Reduce English scaffolding as learner shows confidence.` : ''}

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
})()

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

// === ADULT LANGUAGE LEARNING — override system prompt entirely ===
const _isAdultLang = isAdultUser && subjectKey === 'languages' && topicId;
if (_isAdultLang) {
  const { getAdultLanguageSystemPrompt } = await import('./utils/sunnyPrompts');
  const _CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const _langLvlAdult = userProgress.subjects.languages?.languageLevels?.[topicId] ?? 0;
  const _cefrAdult = _CEFR[Math.min(Math.floor(_langLvlAdult), 5)] || 'A1';
  const _targetLangName = topicId.charAt(0).toUpperCase() + topicId.slice(1);
  systemPrompt = getAdultLanguageSystemPrompt(_targetLangName, userProgress.name, _cefrAdult, userProgress.language || 'en');
}

// === ACCENT COACH ===
if (subjectKey === 'accent') {
  const { getAccentCoachSystemPrompt } = await import('./utils/sunnyPrompts');
  systemPrompt = getAccentCoachSystemPrompt(userProgress.name, userProgress.language || 'en');
}

// === PRO / HEALTH / ENGINEERING TRACKS — use specialized system prompts on first turn ===
{
  const _nativeLang = userProgress.language || 'en';
  const _uname = userProgress.name;
  const _tid = topicId;
  if (subjectKey === 'college') {
    const { getCollegeCourseSystemPrompt } = await import('./utils/sunnyPrompts');
    const _map = { 'intro-accounting': 'Intro Accounting', 'business-writing': 'Business Writing', 'economics-101': 'Economics', 'statistics': 'Statistics', 'algebra-calculus': 'Algebra & Calculus', 'essay-writing': 'Essay Writing', 'study-skills-college': 'Reading & Study Skills', 'intro-finance': 'Intro Finance', 'psychology': 'Psychology', 'bio-chem': 'Biology & Chemistry' };
    systemPrompt = getCollegeCourseSystemPrompt(_map[_tid] || (_topicList?.find(t => t.id === _tid)?.name) || _tid || 'General', _uname, _nativeLang);
  } else if (subjectKey === 'law') {
    const { getLawSystemPrompt } = await import('./utils/sunnyPrompts');
    const _map = { 'legal-reading': 'Legal Reading', 'case-briefing': 'Case Briefing', 'issue-spotting': 'Issue Spotting', 'legal-writing': 'Legal Writing', 'contract-vocab': 'Contract Vocabulary', 'legal-reasoning': 'Structured Reasoning', 'legal-interview': 'Legal Interview Prep', 'legal-communication': 'Professional Communication' };
    systemPrompt = getLawSystemPrompt(_map[_tid] || (_topicList?.find(t => t.id === _tid)?.name) || _tid || 'Legal Reading', _uname, _nativeLang);
  } else if (subjectKey === 'accounting') {
    const { getAccountingSystemPrompt } = await import('./utils/sunnyPrompts');
    const _map = { 'acct-concepts': 'Accounting Concepts', 'journal-entries': 'Journal Entries', 'financial-stmts': 'Financial Statements', 'auditing': 'Auditing Basics', 'tax-fundamentals': 'Tax Fundamentals', 'excel-workflow': 'Excel & Workflow', 'acct-interview': 'Interview Prep', 'client-explanation': 'Client Explanation' };
    systemPrompt = getAccountingSystemPrompt(_map[_tid] || (_topicList?.find(t => t.id === _tid)?.name) || _tid || 'Accounting Concepts', _uname, _nativeLang);
  } else if (subjectKey === 'cpa') {
    const { getCpaExamSystemPrompt } = await import('./utils/sunnyPrompts');
    systemPrompt = getCpaExamSystemPrompt(_tid || 'far', _uname, _nativeLang);
  } else if (subjectKey === 'pro-coaching') {
    const { getProCoachingSystemPrompt } = await import('./utils/sunnyPrompts');
    const _map = { 'communication': 'Communication Coaching', 'workplace-writing': 'Workplace Writing', 'presentations': 'Presentation Coaching', 'structured-thinking': 'Structured Thinking', 'confidence': 'Confidence Building', 'roleplay': 'Scenario Roleplay', 'industry-flows': 'Industry Coaching', 'leadership': 'Leadership Skills' };
    systemPrompt = getProCoachingSystemPrompt(_map[_tid] || (_topicList?.find(t => t.id === _tid)?.name) || _tid || 'Communication Coaching', _uname, _nativeLang);
  } else if (subjectKey === 'family-medicine') {
    const { getFamilyMedicineSystemPrompt } = await import('./utils/sunnyPrompts');
    const _map = { 'clinical-reasoning': 'Clinical Reasoning', 'patient-history': 'Patient History', 'differential-dx': 'Differential Diagnosis', 'chronic-disease': 'Chronic Disease', 'preventive-care': 'Preventive Care', 'lab-interpretation': 'Lab Interpretation', 'patient-communication': 'Patient Communication', 'evidence-based': 'Evidence-Based Medicine' };
    systemPrompt = getFamilyMedicineSystemPrompt(_map[_tid] || (_topicList?.find(t => t.id === _tid)?.name) || _tid || 'Clinical Reasoning', _uname, _nativeLang);
  } else if (subjectKey === 'pharmacy') {
    const { getPharmacySystemPrompt } = await import('./utils/sunnyPrompts');
    const _map = { 'pharmacokinetics': 'Pharmacokinetics', 'drug-interactions': 'Drug Interactions', 'dosage-calc': 'Dosage Calculations', 'top-200-drugs': 'Top 200 Drugs', 'counseling': 'Patient Counseling', 'compounding': 'Compounding', 'pharmacy-law': 'Pharmacy Law', 'otc-recommendations': 'OTC Recommendations' };
    systemPrompt = getPharmacySystemPrompt(_map[_tid] || (_topicList?.find(t => t.id === _tid)?.name) || _tid || 'Pharmacokinetics', _uname, _nativeLang);
  } else if (subjectKey === 'physical-therapy') {
    const { getPhysicalTherapySystemPrompt } = await import('./utils/sunnyPrompts');
    const _map = { 'musculoskeletal': 'Musculoskeletal', 'neurological-rehab': 'Neurological Rehab', 'exercise-prescription': 'Exercise Prescription', 'gait-analysis': 'Gait Analysis', 'manual-therapy': 'Manual Therapy', 'patient-assessment': 'Patient Assessment', 'documentation': 'Clinical Documentation', 'geriatric-pt': 'Geriatric PT' };
    systemPrompt = getPhysicalTherapySystemPrompt(_map[_tid] || (_topicList?.find(t => t.id === _tid)?.name) || _tid || 'Musculoskeletal', _uname, _nativeLang);
  } else if (subjectKey === 'nursing') {
    const { getNursingSystemPrompt } = await import('./utils/sunnyPrompts');
    const _map = { 'patient-assessment': 'Patient Assessment', 'medication-admin': 'Medication Administration', 'care-planning': 'Care Planning', 'clinical-skills': 'Clinical Skills', 'nclex-prep': 'NCLEX Prep', 'critical-thinking': 'Critical Thinking', 'patient-education': 'Patient Education', 'documentation': 'Nursing Documentation' };
    systemPrompt = getNursingSystemPrompt(_map[_tid] || (_topicList?.find(t => t.id === _tid)?.name) || _tid || 'Patient Assessment', _uname, _nativeLang);
  } else if (subjectKey === 'rtl-design') {
    const { getRTLDesignSystemPrompt } = await import('./utils/sunnyPrompts');
    const _map = { 'combinational-logic': 'Combinational Logic', 'sequential-fsm': 'Sequential Logic & FSMs', 'pipelines-datapath': 'Pipelines & Datapath', 'fifo-protocols': 'FIFOs & Bus Protocols', 'clock-reset-cdc': 'Clocking, Reset & CDC', 'rtl-coding-style': 'RTL Coding Style', 'testbench-sim': 'Testbench & Simulation', 'waveform-debug': 'Waveform Debug', 'assertions-coverage': 'Assertions & Coverage', 'uvm-foundations': 'UVM Foundations' };
    systemPrompt = getRTLDesignSystemPrompt(_map[_tid] || (_topicList?.find(t => t.id === _tid)?.name) || _tid || 'Combinational Logic', _uname, _nativeLang);
  } else if (subjectKey === 'physical-design') {
    const { getPhysicalDesignSystemPrompt } = await import('./utils/sunnyPrompts');
    const _map = { 'synthesis-handoff': 'Synthesis & Handoff', 'floorplan-power': 'Floorplan & Power Planning', 'placement': 'Placement', 'cts': 'Clock Tree Synthesis', 'routing-congestion': 'Routing & Congestion', 'timing-closure': 'Timing Closure', 'signoff-drc-lvs': 'Signoff: DRC/LVS/STA', 'eco-debug': 'ECO & Debug' };
    systemPrompt = getPhysicalDesignSystemPrompt(_map[_tid] || (_topicList?.find(t => t.id === _tid)?.name) || _tid || 'Synthesis & Handoff', _uname, _nativeLang);
  } else if (subjectKey === 'lab-debug') {
    const { getLabDebugSystemPrompt } = await import('./utils/sunnyPrompts');
    const _map = { 'oscilloscope': 'Oscilloscope', 'logic-analyzer': 'Logic Analyzer', 'multimeter-power': 'Multimeter & Power Supply', 'waveform-reading': 'Waveform Reading', 'serial-debug': 'Serial & Debug Interfaces', 'board-bringup': 'Board Bring-Up', 'debug-workflow': 'Structured Debug Workflow', 'signal-integrity': 'Signal Integrity' };
    systemPrompt = getLabDebugSystemPrompt(_map[_tid] || (_topicList?.find(t => t.id === _tid)?.name) || _tid || 'Oscilloscope', _uname, _nativeLang);
  }
}

// === FOREIGN LANGUAGE TEACHING (kids/college) ===
// Only add language-specific teaching guidance when actually teaching a language subject.
// For core subjects (reading, math, etc.) this block would add contradictory instructions
// like "VERBAL ONLY / NO reading/writing" to a Reading session.
const userAge = ageNum;

if (!_isAdultLang && subjectKey === 'languages' && topicId) {
  const langLevelNum = userProgress.subjects.languages?.languageLevels?.[topicId] ?? 0;
  const CEFR_CODES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const cefrCode = CEFR_CODES[Math.min(Math.floor(langLevelNum), 5)] || 'A1';
  const primaryLangName = LANGUAGES.find(l => l.code === (userProgress.language || 'en'))?.name || 'English';
  const langName = topicId.charAt(0).toUpperCase() + topicId.slice(1);

  const cefrGuides = {
    A1: `A1 BEGINNER — Teach one word, then ask them to SAY it:
- TEACH turn: Introduce ONE word (state: "teach", expect: "none", correctAnswer: null)
  - Show flashcard with word + ${primaryLangName} translation
  - Say e.g. "Here's your first word: 'Hello' — it means Xin chào! Try saying it!"
- PRACTICE turn (state: "ask"): Ask them to REPEAT or TYPE the word — NEVER ask for the meaning!
  - e.g. "Can you type 'Hello'?" or "Say this word!"
  - correctAnswer: the word itself (e.g. "Hello")
  - Accept the word as correct — if student typed "hello", "Hello", "HELLO" → all correct
- DO NOT ask "What does X mean?" at A1 — just ask them to say/type the word
- Topics: greetings, numbers 1-10, colors, family words, common objects`,
    A2: `A2 ELEMENTARY — Simple sentences and dialogues:
- Short phrases: "I am...", "I have...", "I like..."
- Explain grammar briefly in ${primaryLangName} with examples
- Practice simple dialogues: greetings, asking for things, introductions
- Mix flashcards with fill-in-the-blank exercises`,
    B1: `B1 INTERMEDIATE — Conversational practice:
- Simple conversations on family, hobbies, daily routine
- Introduce verb tenses naturally through conversation
- Mostly in ${langName}; use ${primaryLangName} only for brief clarifications
- Gently correct mistakes while keeping conversation flowing`,
    B2: `B2 UPPER-INTERMEDIATE — Deeper fluency:
- Wide range of topics: news, culture, opinions, abstract ideas
- Complex grammar: subjunctive, conditionals, passive voice
- Minimize ${primaryLangName} — challenge student to express in ${langName}`,
    C1: `C1 ADVANCED — Near-native expression:
- Sophisticated discussions, idioms, cultural nuance
- Teach entirely in ${langName}`,
    C2: `C2 PROFICIENT — Mastery:
- Native-like conversation, literature, complex debate
- Teach entirely in ${langName}`,
  };

  const languageTeachingPrompt = `
LANGUAGE: ${langName} | Age ${userAge} | CEFR Level: ${cefrCode}
STUDENT'S NATIVE LANGUAGE: ${primaryLangName} — use it for explanations at A1/A2 level.
AGE APPROACH: ${userAge <= 7 ? 'Ages 4-7: VERBAL + VISUAL ONLY. Listen/repeat, songs, games. No writing yet.' : userAge <= 12 ? 'Ages 8-12: Speaking + reading + simple writing. Fun conversations.' : 'Ages 13+: All four skills — speaking, listening, reading, writing.'}

CEFR TEACHING GUIDE:
${cefrGuides[cefrCode] || cefrGuides.A1}

Make it fun, celebrate small wins, vary activities every turn.
`;

  systemPrompt += languageTeachingPrompt;

  // Append language-specific curriculum (hiragana for Japanese, tones for Mandarin, etc.)
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
  const topic = (advancedTopics[subjectKey] || ADVANCED_TOPICS[subjectKey])?.find(t => t.id === topicId);
  if (topic) {
    // Special handling for languages - teach first, then practice
    if (subjectKey === 'languages') {
      const _langLvl = userProgress.subjects.languages?.languageLevels?.[topicId] ?? 0;
      const _cefr = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'][Math.min(Math.floor(_langLvl), 5)] || 'A1';
      if (_isAdultLang) {
        userMessage = _langLvl === 0
          ? `Start the ${topicId} lesson. CEFR ${_cefr} — complete beginner. Teach ONE practical greeting phrase. coach_say must be in ${topicId} only. Put the native translation only in study_board.visual.translation.`
          : `Continue the ${topicId} lesson at CEFR ${_cefr}. Introduce one practical phrase for real-life use, then role-play it. coach_say in ${topicId} only.`;
      } else {
      userMessage = _langLvl === 0
        ? `Start the ${topicId} lesson. CEFR Level: ${_cefr} — COMPLETE BEGINNER (zero ${topicId} words).

YOUR FIRST RESPONSE MUST BE A TEACH TURN:
- state: "teach"
- expect: "none"
- correctAnswer: null
- Introduce ONE useful word or phrase (e.g. a greeting)
- Show it on the study board as a flashcard (visualType: "flashcard") with the word and its meaning in the student's language
- Explain it warmly in coach_say — do NOT ask any question yet
- Tell them to type it or say "ready" when they want to practice

After they respond, THEN test them with a practice question (state: "ask") about the word you just taught.`
        : `Continue the ${topicId} lesson at CEFR level ${_cefr}. Build on existing knowledge. Introduce one new word or phrase appropriate for ${_cefr}, then practice it.`;
      }
    } else {
      // CRITICAL: Include the student's level when teaching topics
      userMessage = `Start teaching ${subject.name} - ${topic.name} at ${levelName} level. The student is at ${levelName} level, so teach ${topic.name} concepts appropriate for that level. Focus on: ${topic.description}. Present a NEW, VARIED question.`;
    }
  } else {
    if (subjectKey === 'languages' && topicId) {
      const _langLvl = userProgress.subjects.languages?.languageLevels?.[topicId] ?? 0;
      const _cefr = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'][Math.min(Math.floor(_langLvl), 5)] || 'A1';
      if (_isAdultLang) {
        userMessage = _langLvl === 0
          ? `Start the ${topicId} lesson. CEFR ${_cefr} — complete beginner. Teach ONE practical greeting phrase. coach_say must be in ${topicId} only. Put the native translation only in study_board.visual.translation.`
          : `Continue the ${topicId} lesson at CEFR ${_cefr}. Introduce one practical phrase for real-life use, then role-play it. coach_say in ${topicId} only.`;
      } else {
      userMessage = _langLvl === 0
        ? `Start the ${topicId} lesson. CEFR Level: ${_cefr} — COMPLETE BEGINNER (zero ${topicId} words).

YOUR FIRST RESPONSE MUST BE A TEACH TURN:
- state: "teach"
- expect: "none"
- correctAnswer: null
- Introduce ONE useful word or phrase (e.g. a greeting)
- Show it as a flashcard (visualType: "flashcard") with the word and its meaning in the student's language
- Explain it warmly — do NOT ask a question yet
- Tell them to type it or say "ready" when they want to practice

After they respond, THEN test them with a practice question (state: "ask") about what you just taught.`
        : `Continue ${topicId} lesson at CEFR level ${_cefr}. Build on existing knowledge. Introduce a new word or phrase appropriate for ${_cefr}, then practice it.`;
      }
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

    // ── Gemini story pre-generation for science/social-studies ──────────
    if ((subjectKey === 'science' || subjectKey === 'social-studies') && topicId && ageNum <= 13) {
      const topicObj = advancedTopics[subjectKey]?.find(t => t.id === topicId);
      const ageGroup = ageNum <= 6 ? '4-6' : ageNum <= 9 ? '7-9' : '10-13';
      const geminiStory = await callGemini('generate_story', {
        topic: topicObj?.name || topicId,
        ageGroup,
        level: levelName,
        subject: subject.name,
      }).catch(() => null);
      if (geminiStory?.title && geminiStory?.passage) {
        userMessage += `\n\nGemini has pre-generated a reading story for this lesson. USE THIS STORY as your study_board visual with visualType "story":
Title: "${geminiStory.title}"
Passage: "${geminiStory.passage}"
Comprehension question: "${geminiStory.question}"
Answer hint: "${geminiStory.answer_hint}"

Set study_board.visual = { title, passage, question, answer_hint } and visualType = "story".
After presenting the story, ask the student the comprehension question in coach_say.`;
      }
    }

    // ── Gemini word problem pre-generation for math ──────────────────────
    if (subjectKey === 'math' && ageNum >= 7 && ageNum <= 13 && !isHomeworkMode) {
      const _wpAgeGroup = ageNum <= 9 ? '7-9' : '10-13';
      const _wpTopicObj = topicId ? advancedTopics.math?.find(t => t.id === topicId) : null;
      const _wpProblem = await callGemini('word_problem', {
        topic: _wpTopicObj?.name || subject.name,
        operation: topicId || levelName,
        level: levelName,
        ageGroup: _wpAgeGroup,
      }).catch(() => null);
      if (_wpProblem?.problem && _wpProblem?.answer) {
        userMessage += `\n\nGemini pre-generated a math word problem. Use as your FIRST question:\nProblem: "${_wpProblem.problem}"\nCorrect answer: "${_wpProblem.answer}"\nHint: "${_wpProblem.hint || ''}"\n\nSet correctAnswer="${_wpProblem.answer}" and present in coach_say.`;
      }
    }

    console.log(`📤 Sending to API: level=${level}, levelName="${levelName}", difficultyBoost=${difficultyBoost}, userMessage="${userMessage.substring(0, 100)}..."`);

    fetchAbortRef.current?.abort();
    fetchAbortRef.current = new AbortController();
    let response;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: fetchAbortRef.current.signal,
          body: JSON.stringify({ system: systemPrompt, messages: [{ role: 'user', content: userMessage }] })
        });
        break;
      } catch (err) {
        if (err.name === 'AbortError' || attempt === 1) throw err;
        await new Promise(r => setTimeout(r, 1500));
        fetchAbortRef.current = new AbortController();
      }
    }

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

    const _isProMarkdownTrack = ['college', 'law', 'accounting', 'cpa', 'pro-coaching',
      'family-medicine', 'pharmacy', 'physical-therapy', 'nursing',
      'rtl-design', 'physical-design', 'lab-debug'].includes(subjectKey);

    if (_isProMarkdownTrack) {
      setCurrentCoachSay(''); // Full response goes in chat panel only — not duplicated in CoachSay
      setCurrentStudyBoard(null);
      setConversation([{ role: 'assistant', content: aiResponseText }]);
      const _pmAccent = {'college':'#4338CA','law':'#7C2D12','accounting':'#065F46','cpa':'#1E3A5F','pro-coaching':'#6B21A8','family-medicine':'#991B1B','pharmacy':'#5B21B6','physical-therapy':'#065F46','nursing':'#1E40AF','rtl-design':'#2563EB','physical-design':'#047857','lab-debug':'#B45309'};
      const _pmIcons = {'college':'🎓','law':'⚖️','accounting':'📊','cpa':'📋','pro-coaching':'💼','family-medicine':'🩺','pharmacy':'💊','physical-therapy':'🦴','nursing':'🏥','rtl-design':'⚡','physical-design':'🔬','lab-debug':'🛠️'};
      callGemini('extract_visual_data', {
        aiResponseText: aiResponseText.slice(0, 1800),
        subject: subjectKey,
        topic: topicId || subjectKey,
        accentColor: _pmAccent[subjectKey] || '#0A84FF',
        icon: _pmIcons[subjectKey] || '',
      }).then(result => {
        if (result?.type && result.type !== 'none' && result.props) {
          setCurrentStudyBoard({ visualType: 'remotion-video', visual: { type: result.type, ...result.props } });
        }
      }).catch(() => {});
    } else {
    try {
      const sunnyResponse = extractJSON(aiResponseText);
      validateSunnyResponse(sunnyResponse);
      
      sunnyResponse.study_board = normalizeStudyBoard(sunnyResponse.study_board);
      if (!sunnyResponse.study_board || !sunnyResponse.study_board.visual || sunnyResponse.study_board.visualType === 'none') {
        console.log('No visual in response, creating fallback');
        sunnyResponse.study_board = createSmartVisual(sunnyResponse.coach_say, subjectKey);
      }

      console.log('Final Sunny Response:', sunnyResponse);
      
      // Strip [L: ...] TTS markers before displaying — they're only for voice switching
      const displayCoachSay = sunnyResponse.coach_say.replace(/\[L:\s*(.*?)\]/g, '$1');
      setCurrentCoachSay(displayCoachSay);

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
      
      // Track AI state for language teach/ask cycle (first turn)
      if (subjectKey === 'languages') {
        lastAiStateRef.current = sunnyResponse.state || 'teach';
      }

      const aiMessage = {
        role: 'assistant',
        content: displayCoachSay,  // markers already stripped above
      };
      setConversation([aiMessage]);

// For spelling, always speak the word regardless of TTS toggle — it's the only way the student knows what to spell
if (subjectKey === 'spelling' && (sunnyResponse.audioPrompt || sunnyResponse.correctAnswer) && synthRef.current) {
  const word = sunnyResponse.audioPrompt || sunnyResponse.correctAnswer;
  setTimeout(() => speak(`The word is: ${word}. ${word}. Can you spell ${word}?`), 500);
}
// For reading: if the AI provided an audioPrompt (full sentence for a listening exercise), speak it after coach_say
if (subjectKey === 'reading' && sunnyResponse.audioPrompt && synthRef.current) {
  const sentence = sunnyResponse.audioPrompt;
  const instruction = sunnyResponse.coach_say || '';
  setTimeout(() => {
    if (instruction) {
      speak(instruction, () => setTimeout(() => speak(sentence), 500));
    } else {
      speak(sentence);
    }
  }, 500);
}
if (shouldUseTTS) {
  const _ttsDelay = subjectKey === 'languages' ? 1200 : 500;
  setTimeout(() => {
    if (subjectKey === 'spelling' && (sunnyResponse.audioPrompt || sunnyResponse.correctAnswer)) {
      // already spoken above — skip
      return;
    } else if (subjectKey === 'reading' && sunnyResponse.audioPrompt) {
      // already spoken above — skip
      return;
    } else if (subjectKey === 'languages') {
      // All speech in the target language — user clicks the flashcard to read the native translation.
      const targetLangCode = LANGUAGE_NAME_TO_CODE[topicId] || 'en';
      speakWithGemini(sunnyResponse.coach_say, null, targetLangCode);
    } else {
      speakWithGemini(sunnyResponse.coach_say);
    }
  }, _ttsDelay);
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
    speakWithGemini(fallbackCoachSay);
  }, 500);
}
    }
    } // end else (_isProMarkdownTrack)
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

const sendMessage = async (providedAnswer = null, silent = false) => {
  // Prevent overlapping requests
  if (isLoading) {
    console.log('🛑 sendMessage blocked — request already in flight');
    return;
  }

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

  // ── Goodbye detection ─────────────────────────────────────────────────────
  const _goodbyeRx = /\b(goodbye|bye( bye)?|see you( later)?|see ya|good ?night|farewell|take care|adios|ciao|au revoir|tạm biệt|chào|bái bai)\b/i;
  const _isSunnyBye = _goodbyeRx.test(answerToSend) && /\bsunny\b/i.test(answerToSend);
  const _isGenericBye = /^(goodbye|bye|bye bye|see you|see ya|good night|farewell|tạm biệt|chào nhé|bái bai)[\s!.]*$/i.test(answerToSend);
  if (_isSunnyBye || _isGenericBye) {
    const _name = userProgress?.name || 'there';
    const _byeLang = userProgress?.language || 'en';
    // Localized goodbye messages
    const _byeMsgs = _byeLang === 'vi' ? [
      `Tạm biệt ${_name}! Hôm nay bạn làm tốt lắm! Hẹn gặp lại! ⭐`,
      `Bái bai ${_name}! Sunny rất tự hào về bạn. Quay lại sớm nhé! 🌟`,
      `Hẹn gặp lại ${_name}! Bạn giỏi lắm hôm nay! Nghỉ ngơi nhé! 🚀`,
    ] : [
      `Goodbye, ${_name}! You did amazing today — keep that streak going! See you next time! ⭐`,
      `Bye bye, ${_name}! So proud of all the hard work you put in. Come back soon! 🌟`,
      `See you later, ${_name}! You were on fire today! Rest up and let's learn more next time! 🚀`,
    ];
    const _byeMsg = _byeMsgs[Math.floor(Math.random() * _byeMsgs.length)];
    setConversation(prev => [
      ...prev,
      { role: 'user', content: answerToSend },
      { role: 'assistant', content: _byeMsg },
    ]);
    setCurrentCoachSay(_byeMsg);
    setCurrentStudyBoard(null);
    setUserAnswer('');
    setIsLoading(false);
    // Stop interpreter mode before speaking goodbye
    speak(_byeMsg, null, _byeLang, 0.85);
    setTimeout(() => goHome(), 2800);
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

  // SPELLING: if user says "no" / "idk" / gives up — handle locally, skip API entirely.
  // The AI reliably ignores hints to stay on the same word, so we must enforce this ourselves.
  if (!silent && currentSubject === 'spelling' && currentStudyBoard?.correctAnswer) {
    const dontKnow = /^(no+|nope|idk|i don'?t know|skip|pass|give up|i give up|don'?t know|no idea|[.?!]+)$/i.test(answerToSend.trim());
    if (dontKnow) {
      const word = String(currentStudyBoard.correctAnswer).trim();
      const letters = word.toUpperCase().split('').join(' - ');
      const coachSay = `${letters}. ${word}! Now you try spelling it! 🌟`;
      const userMsg = { role: 'user', content: answerToSend };
      const aiMsg  = { role: 'assistant', content: coachSay };
      setConversation(prev => [...prev, userMsg, aiMsg]);
      setCurrentCoachSay(coachSay);
      // Keep the same study board (same word) — only update coach message
      setCurrentStudyBoard(prev => prev ? { ...prev } : prev);
      setUserAnswer('');
      if (synthRef.current) {
        const spelled = word.toUpperCase().split('').join('. ');
        setTimeout(() => speak(
          `No problem! The word is: ${word}. Spelled: ${spelled}. ${word}. Now you try!`,
          null, null, 0.62
        ), 300);
      }
      setIsLoading(false);
      return;
    }
  }

  setIsLoading(true);

  // Safety check - ensure userProgress exists
  if (!userProgress) {
    console.error('❌ sendMessage called but userProgress is null');
    setIsLoading(false);
    return;
  }


  // TTS should be enabled for young kids, language learners, and interview practice
  const ageNum = parseInt(userProgress.age);
  const forceVoiceOn = ageNum <= AGE_BOUNDARIES.VOICE_ALWAYS_MAX;
  const shouldUseTTS = (forceVoiceOn || ((ageNum <= AGE_BOUNDARIES.TTS_MAX || currentSubject === 'languages' || currentSubject === 'interview' || currentSubject === 'followup' || currentSubject === 'accent') && ttsEnabled)) && synthRef.current;


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

    // Client-side grading for numeric answers only (counting and math).
    // Skip for: silent/system messages, adult subjects, and string answers (sounds, words, letters)
    // — string phonetics are too nuanced; let the AI handle those.
    const isKidsSubject = !['skills', 'interview', 'life-coach', 'resume', 'followup'].includes(currentSubject);
    let clientGradeHint = '';
    if (!silent && isKidsSubject && typeof currentStudyBoard?.correctAnswer === 'number' && answerToSend) {
      const correctAns = currentStudyBoard.correctAnswer;
      const studentNorm = answerToSend.toLowerCase().trim();

      // Map spoken/typed word-numbers to digits
      const WORD_TO_NUM = {
        'zero':0,'one':1,'two':2,'three':3,'four':4,'five':5,
        'six':6,'seven':7,'eight':8,'nine':9,'ten':10,
        'eleven':11,'twelve':12,'thirteen':13,'fourteen':14,'fifteen':15,
        'sixteen':16,'seventeen':17,'eighteen':18,'nineteen':19,'twenty':20,
        'thirty':30,'forty':40,'fifty':50
      };

      // Try digit extraction first (handles "5", "5 frogs", "there are 5")
      const digitStr = studentNorm.replace(/[^0-9.]/g, '');
      let studentNum = digitStr ? parseFloat(digitStr) : NaN;

      // If no digits, try word-number matching (handles "four", "four dogs", "I see five")
      if (isNaN(studentNum)) {
        for (const w of studentNorm.split(/\s+/)) {
          if (WORD_TO_NUM[w] !== undefined) { studentNum = WORD_TO_NUM[w]; break; }
        }
      }

      // Only add a hint if we could confidently parse the student's number
      if (!isNaN(studentNum)) {
        const isRight = studentNum === correctAns;
        clientGradeHint = isRight
          ? '\n[GRADED: correct]'
          : `\n[GRADED: incorrect — correct answer is ${correctAns}, student said ${studentNum}]`;
      }
      // If we couldn't parse a number, don't add any hint — let the AI grade
    }

    // Memory game recall grading — deterministic, bypasses AI permissiveness.
    // Runs only when there's a live memory-game board and no numeric hint was already set.
    if (!silent && !clientGradeHint && currentStudyBoard?.visualType === 'memory-game') {
      const expectedItems = currentStudyBoard?.visual?.items;
      if (Array.isArray(expectedItems) && expectedItems.length > 0) {
        clientGradeHint = buildMemoryGradeHint(answerToSend, expectedItems);
      }
    }

    // Add current user answer to API messages
    // For interview voice answers with native lang set: append [voice answer] marker so Claude provides pronunciation tips
    const isInterviewVoice = currentSubject === 'interview' && isVoiceInput && interviewNativeLang;

    // For language learning voice answers: tell the AI what phrase was being practiced so it doesn't
    // treat a speech-recognition mishearing as a completely different sentence the user invented.
    let langPracticeHint = '';
    if (currentSubject === 'languages' && isVoiceInput) {
      const targetPhrase = currentStudyBoard?.correctAnswer || currentStudyBoard?.visual?.word;
      if (targetPhrase && targetPhrase.toLowerCase().trim() !== answerToSend.toLowerCase().trim()) {
        langPracticeHint = `\n[CONTEXT: The user was trying to say the target phrase "${targetPhrase}". Speech recognition captured "${answerToSend}" — this is likely a mispronunciation or mishearing, NOT a new sentence the user invented. Grade as an attempt at "${targetPhrase}" and give pronunciation correction if needed.]`;
      }
    }
    // For accent coach: always tell the AI what phrase was on the card — STT of accented speech is imperfect
    if (currentSubject === 'accent') {
      const targetPhrase = currentStudyBoard?.visual?.word;
      if (targetPhrase) {
        langPracticeHint = `\n[CONTEXT: The user was attempting to say: "${targetPhrase}". Speech recognition captured: "${answerToSend}". Treat this as their pronunciation attempt — assess how close it is and coach accordingly.]`;
      }
    }

    // Detect direct explanation/definition requests and force the right visual format
    let remotionHint = '';
    const _isChildSubject = !['skills', 'interview', 'life-coach', 'resume', 'followup', 'accent', 'trading', 'agents'].includes(currentSubject);
    if (_isChildSubject) {
      const _q = answerToSend.toLowerCase().trim();
      const _isConceptRequest = /\b(how does|how do|how (is|are)|explain (how|the|what)|what (is the|are the)|how (does|did)|why (does|do|is)|what causes|what happens)\b/i.test(_q)
        && /\b(work|happen|form|cause|make|cycle|process|system|work|function|affect|create|produce|form|change)\b/i.test(_q);
      const _isVocabRequest = !_isConceptRequest
        && /\b(what (does|is|are)|define|explain|meaning of|definition of|tell me about)\b/i.test(_q)
        && !/\bwhat is \d/.test(_q); // exclude "what is 2+3"
      const _isMathStepsRequest = /\b(how (do|does|can|do you)|show me how|walk me through|step[- ]by[- ]step|solve)\b/i.test(_q)
        && /\b(add|subtract|multiply|divide|fraction|equation|problem|calculate|simplify)\b/i.test(_q);
      const _isLangWordRequest = currentSubject === 'languages' && !isAdultUser
        && /\b(what (does|is)|how (do you|do i)|translate|meaning|say|word for)\b/i.test(_q);
      if (_isConceptRequest) {
        remotionHint = '\n[OVERRIDE: This is a concept/process explanation request. You MUST respond with state="teach", visualType="remotion-video", type="concept-reveal". Fill in title, emoji, facts array (2–4 items, one sentence each), and optional analogy. Do NOT use visualType "text" or "steps".]';
      } else if (_isLangWordRequest) {
        remotionHint = '\n[OVERRIDE: This is a language vocabulary request. You MUST respond with state="teach", visualType="remotion-video", type="phrase-reveal". Fill in phrase, phonetic, translation, language, example, exampleTranslation fields. Do NOT use visualType "flashcard", "choice", or "text".]';
      } else if (_isVocabRequest) {
        remotionHint = '\n[OVERRIDE: This is a direct definition request. You MUST respond with state="teach", visualType="remotion-video", type="vocab-reveal". Fill in word, phonetic, partOfSpeech, definition, example fields. Do NOT quiz. Do NOT use visualType "choice" or "text".]';
      } else if (_isMathStepsRequest) {
        remotionHint = '\n[OVERRIDE: This is a step-by-step math request. You MUST respond with state="teach", visualType="remotion-video", type="math-steps". Fill in problem, steps array (2–5 items), answer fields. Do NOT use visualType "choice" or "text".]';
      }
    }

    const apiAnswerText = (isInterviewVoice ? answerToSend + '\n[voice answer]' : answerToSend) + clientGradeHint + langPracticeHint + remotionHint;

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
            text: apiAnswerText || 'Here is my work!'
          }
        ]
      });
    } else {
      // Standard message
      apiMessages.push({
        role: 'user',
        content: apiAnswerText
      });
    }


    const ageNum = parseInt(userProgress.age);
    const isAdultSubject = ['skills', 'interview', 'life-coach', 'resume', 'followup', 'accent', 'trading', 'agents',
                            'college', 'law', 'accounting', 'cpa', 'pro-coaching',
                            'family-medicine', 'pharmacy', 'physical-therapy', 'nursing',
                            'rtl-design', 'physical-design', 'lab-debug'].includes(currentSubject);

    let systemPrompt;

    // ── ADULT SUBJECTS ────────────────────────────────────────────────────
    if (isAdultUser && currentSubject === 'languages') {
      const { getAdultLanguageSystemPrompt } = await import('./utils/sunnyPrompts');
      const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const langLevel = userProgress.subjects?.languages?.languageLevels?.[selectedTopic] ?? 0;
      const cefrCode = CEFR_LEVELS[Math.min(Math.floor(langLevel), 5)] || 'A1';
      const targetLang = advancedTopics.languages?.find(l => l.id === selectedTopic)?.name || selectedTopic || 'English';
      systemPrompt = getAdultLanguageSystemPrompt(targetLang, userProgress.name, cefrCode, userProgress.language || 'en');
    } else if (isAdultSubject) {
      if (currentSubject === 'skills') {
        const skill = SKILLS_TOPICS.find(s => s.id === selectedTopic);
        const { getSkillsSystemPrompt } = await import('./utils/sunnyPrompts');
        systemPrompt = getSkillsSystemPrompt(skill?.name || selectedTopic, userProgress.name, userProgress.language || 'en');
      } else if (currentSubject === 'interview') {
        const { getInterviewSystemPrompt } = await import('./utils/sunnyPrompts');
        systemPrompt = getInterviewSystemPrompt(interviewJobDesc, selectedTopic, interviewSearchResults, userProgress.name, interviewNativeLang);
      } else if (currentSubject === 'life-coach') {
        const { getLifeCoachSystemPrompt } = await import('./utils/sunnyPrompts');
        systemPrompt = getLifeCoachSystemPrompt(userProgress.name, userProgress.language || 'en');
      } else if (currentSubject === 'resume') {
        const { getResumeSystemPrompt } = await import('./utils/sunnyPrompts');
        systemPrompt = getResumeSystemPrompt(userProgress.name, resumeJobDesc, interviewNativeLang);
      } else if (currentSubject === 'followup') {
        const { getFollowupSystemPrompt } = await import('./utils/sunnyPrompts');
        systemPrompt = getFollowupSystemPrompt(userProgress.name, followupMode, followupCompany, followupNativeLang);
      } else if (currentSubject === 'accent') {
        const { getAccentCoachSystemPrompt } = await import('./utils/sunnyPrompts');
        systemPrompt = getAccentCoachSystemPrompt(userProgress.name, userProgress.language || 'en');
      } else if (currentSubject === 'trading' || currentSubject === 'agents') {
        // Agent pipeline mode — no chat turns, user can't type; just ignore
        if (selectedTopic === 'agents' || currentSubject === 'agents') {
          setIsLoading(false);
          return;
        }
        const { getTradingSystemPrompt, getStockResearchPrompt, get0DTEPrompt, getOptionsDeskPrompt } = await import('./utils/sunnyPrompts');
        const level = userProgress.subjects?.trading?.level || 0;
        if (selectedTopic === 'options-desk') {
          systemPrompt = getOptionsDeskPrompt(tradingOptionsStrategy, userProgress.name);
        } else if (selectedTopic === 'research') {
          systemPrompt = getStockResearchPrompt(tradingSymbolInput, userProgress.name);
        } else if (selectedTopic === '0dte') {
          systemPrompt = get0DTEPrompt(userProgress.name);
        } else {
          systemPrompt = getTradingSystemPrompt(selectedTopic, tradingSymbolInput, tradingSearchResults, userProgress.name, level);
          // Background mid-session search on new concept keywords
          const trimmedAnswer = (userAnswer || '').trim();
          if (trimmedAnswer.length > 10) {
            fetch('/api/search', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: `${trimmedAnswer} ${selectedTopic || 'stocks'} trading strategy site:reddit.com OR site:investopedia.com OR site:tradingview.com` })
            }).then(r => r.json()).then(d => {
              if (d.results?.length) setTradingSearchResults(prev => [...prev, ...d.results].slice(-10));
            }).catch(() => {});
          }
        }
      } else if (currentSubject === 'college') {
        // ── Professional & Academic Tracks ────────────────────────────────────
        const { getCollegeCourseSystemPrompt } = await import('./utils/sunnyPrompts');
        const COLLEGE_TOPICS_MAP = { 'intro-accounting': 'Intro Accounting', 'business-writing': 'Business Writing', 'economics-101': 'Economics', 'statistics': 'Statistics', 'algebra-calculus': 'Algebra & Calculus', 'essay-writing': 'Essay Writing', 'study-skills-college': 'Reading & Study Skills', 'intro-finance': 'Intro Finance', 'psychology': 'Psychology', 'bio-chem': 'Biology & Chemistry' };
        systemPrompt = getCollegeCourseSystemPrompt(COLLEGE_TOPICS_MAP[selectedTopic] || selectedTopic || 'General', userProgress.name, userProgress.language || 'en');
      } else if (currentSubject === 'law') {
        const { getLawSystemPrompt } = await import('./utils/sunnyPrompts');
        const LAW_TOPICS_MAP = { 'legal-reading': 'Legal Reading', 'case-briefing': 'Case Briefing', 'issue-spotting': 'Issue Spotting', 'legal-writing': 'Legal Writing', 'contract-vocab': 'Contract Vocabulary', 'legal-reasoning': 'Structured Reasoning', 'legal-interview': 'Legal Interview Prep', 'legal-communication': 'Professional Communication' };
        systemPrompt = getLawSystemPrompt(LAW_TOPICS_MAP[selectedTopic] || selectedTopic || 'Legal Reading', userProgress.name, userProgress.language || 'en');
      } else if (currentSubject === 'accounting') {
        const { getAccountingSystemPrompt } = await import('./utils/sunnyPrompts');
        const ACCT_TOPICS_MAP = { 'acct-concepts': 'Accounting Concepts', 'journal-entries': 'Journal Entries', 'financial-stmts': 'Financial Statements', 'auditing': 'Auditing Basics', 'tax-fundamentals': 'Tax Fundamentals', 'excel-workflow': 'Excel & Workflow', 'acct-interview': 'Interview Prep', 'client-explanation': 'Client Explanation' };
        systemPrompt = getAccountingSystemPrompt(ACCT_TOPICS_MAP[selectedTopic] || selectedTopic || 'Accounting Concepts', userProgress.name, userProgress.language || 'en');
      } else if (currentSubject === 'cpa') {
        const { getCpaExamSystemPrompt } = await import('./utils/sunnyPrompts');
        systemPrompt = getCpaExamSystemPrompt(selectedTopic || 'far', userProgress.name, userProgress.language || 'en');
      } else if (currentSubject === 'pro-coaching') {
        const { getProCoachingSystemPrompt } = await import('./utils/sunnyPrompts');
        const COACHING_TOPICS_MAP = { 'communication': 'Communication Coaching', 'workplace-writing': 'Workplace Writing', 'presentations': 'Presentation Coaching', 'structured-thinking': 'Structured Thinking', 'confidence': 'Confidence Building', 'roleplay': 'Scenario Roleplay', 'industry-flows': 'Industry Coaching', 'leadership': 'Leadership Skills' };
        systemPrompt = getProCoachingSystemPrompt(COACHING_TOPICS_MAP[selectedTopic] || selectedTopic || 'Communication Coaching', userProgress.name, userProgress.language || 'en');
      } else if (currentSubject === 'family-medicine') {
        // ── Health Education Tracks ──────────────────────────────────────────
        const { getFamilyMedicineSystemPrompt } = await import('./utils/sunnyPrompts');
        const FM_MAP = { 'clinical-reasoning': 'Clinical Reasoning', 'patient-history': 'Patient History', 'differential-dx': 'Differential Diagnosis', 'chronic-disease': 'Chronic Disease', 'preventive-care': 'Preventive Care', 'lab-interpretation': 'Lab Interpretation', 'patient-communication': 'Patient Communication', 'evidence-based': 'Evidence-Based Medicine' };
        systemPrompt = getFamilyMedicineSystemPrompt(FM_MAP[selectedTopic] || selectedTopic || 'Clinical Reasoning', userProgress.name, userProgress.language || 'en');
      } else if (currentSubject === 'pharmacy') {
        const { getPharmacySystemPrompt } = await import('./utils/sunnyPrompts');
        const RX_MAP = { 'pharmacokinetics': 'Pharmacokinetics', 'drug-interactions': 'Drug Interactions', 'dosage-calc': 'Dosage Calculations', 'top-200-drugs': 'Top 200 Drugs', 'counseling': 'Patient Counseling', 'compounding': 'Compounding', 'pharmacy-law': 'Pharmacy Law', 'otc-recommendations': 'OTC Recommendations' };
        systemPrompt = getPharmacySystemPrompt(RX_MAP[selectedTopic] || selectedTopic || 'Pharmacokinetics', userProgress.name, userProgress.language || 'en');
      } else if (currentSubject === 'physical-therapy') {
        const { getPhysicalTherapySystemPrompt } = await import('./utils/sunnyPrompts');
        const PT_MAP = { 'musculoskeletal': 'Musculoskeletal', 'neurological-rehab': 'Neurological Rehab', 'exercise-prescription': 'Exercise Prescription', 'gait-analysis': 'Gait Analysis', 'manual-therapy': 'Manual Therapy', 'patient-assessment': 'Patient Assessment', 'documentation': 'Clinical Documentation', 'geriatric-pt': 'Geriatric PT' };
        systemPrompt = getPhysicalTherapySystemPrompt(PT_MAP[selectedTopic] || selectedTopic || 'Musculoskeletal', userProgress.name, userProgress.language || 'en');
      } else if (currentSubject === 'nursing') {
        const { getNursingSystemPrompt } = await import('./utils/sunnyPrompts');
        const NURSING_MAP = { 'patient-assessment': 'Patient Assessment', 'medication-admin': 'Medication Administration', 'care-planning': 'Care Planning', 'clinical-skills': 'Clinical Skills', 'nclex-prep': 'NCLEX Prep', 'critical-thinking': 'Critical Thinking', 'patient-education': 'Patient Education', 'documentation': 'Nursing Documentation' };
        systemPrompt = getNursingSystemPrompt(NURSING_MAP[selectedTopic] || selectedTopic || 'Patient Assessment', userProgress.name, userProgress.language || 'en');
      // ── Semiconductor / Hardware Engineering Tracks ────────────────────────
      } else if (currentSubject === 'rtl-design') {
        const { getRTLDesignSystemPrompt } = await import('./utils/sunnyPrompts');
        const RTL_MAP = { 'combinational-logic': 'Combinational Logic', 'sequential-fsm': 'Sequential Logic & FSMs', 'pipelines-datapath': 'Pipelines & Datapath', 'fifo-protocols': 'FIFOs & Bus Protocols', 'clock-reset-cdc': 'Clocking, Reset & CDC', 'rtl-coding-style': 'RTL Coding Style', 'testbench-sim': 'Testbench & Simulation', 'waveform-debug': 'Waveform Debug', 'assertions-coverage': 'Assertions & Coverage', 'uvm-foundations': 'UVM Foundations' };
        systemPrompt = getRTLDesignSystemPrompt(RTL_MAP[selectedTopic] || selectedTopic || 'Combinational Logic', userProgress.name, userProgress.language || 'en');
      } else if (currentSubject === 'physical-design') {
        const { getPhysicalDesignSystemPrompt } = await import('./utils/sunnyPrompts');
        const PD_MAP = { 'synthesis-handoff': 'Synthesis & Handoff', 'floorplan-power': 'Floorplan & Power Planning', 'placement': 'Placement', 'cts': 'Clock Tree Synthesis', 'routing-congestion': 'Routing & Congestion', 'timing-closure': 'Timing Closure', 'signoff-drc-lvs': 'Signoff: DRC/LVS/STA', 'eco-debug': 'ECO & Debug' };
        systemPrompt = getPhysicalDesignSystemPrompt(PD_MAP[selectedTopic] || selectedTopic || 'Synthesis & Handoff', userProgress.name, userProgress.language || 'en');
      } else if (currentSubject === 'lab-debug') {
        const { getLabDebugSystemPrompt } = await import('./utils/sunnyPrompts');
        const LAB_MAP = { 'oscilloscope': 'Oscilloscope', 'logic-analyzer': 'Logic Analyzer', 'multimeter-power': 'Multimeter & Power Supply', 'waveform-reading': 'Waveform Reading', 'serial-debug': 'Serial & Debug Interfaces', 'board-bringup': 'Board Bring-Up', 'debug-workflow': 'Structured Debug Workflow', 'signal-integrity': 'Signal Integrity' };
        systemPrompt = getLabDebugSystemPrompt(LAB_MAP[selectedTopic] || selectedTopic || 'Oscilloscope', userProgress.name, userProgress.language || 'en');
      }
    } else if (isHomeworkMode) {
      systemPrompt = ageNum <= AGE_BOUNDARIES.AUTO_SUBMIT_MAX
        ? `You are Sunny, a brilliant, warm AI friend for ${userProgress.name}, who is ${ageNum} years old.

ACCURACY FIRST: Before answering, silently think through the facts. If you are not sure, say so honestly and give the best answer you can.

You can answer ANY question: science, animals, nature, space, history, stories, math, art, feelings — everything!

RULES:
- Use 1-3 SHORT, simple sentences (they are very young)
- Use simple words a ${ageNum}-year-old understands
- Use relatable comparisons ("as big as a school bus!")
- For HOMEWORK questions: ask a guiding question to help them figure it out themselves, don't just give the answer
- For CURIOSITY questions: explain clearly and enthusiastically — share the real answer!
- End with a fun related fact or an encouraging sentence
- If they upload a photo or image, describe what you see and help them with it

Be warm, enthusiastic, and make learning feel like magic.`

        : ageNum <= AGE_BOUNDARIES.YOUNG_MAX
        ? `You are Sunny, a brilliant, knowledgeable AI companion for ${userProgress.name}, who is ${ageNum} years old.

ACCURACY FIRST: Think carefully about facts before responding. Double-check any numbers, dates, or scientific claims in your head before writing them. If genuinely unsure, say "I think..." or "I'm not 100% sure, but..." and give your best answer.

You can answer ANY question the student has — science, history, animals, nature, space, math, geography, art, culture, current events, philosophy, feelings, literature, technology, or anything else.

RESPONSE STYLE (${ageNum}-year-old level):
- Keep answers concise: 2-4 sentences for simple questions, up to 8 for complex ones
- Use simple, clear language — explain jargon when you use it
- Use relatable analogies ("it's like...", "imagine if...")
- Use a warm, enthusiastic teacher tone

HOMEWORK vs. CURIOSITY:
- If the question sounds like a homework assignment they need to complete: guide with questions, give hints, help them think — don't just give the answer outright. This builds real understanding.
- If the question is pure curiosity, news, facts, "why does X happen", science exploration: give a clear, accurate, engaging answer with examples.

ACCURACY COMMITMENT:
- Always verify math by computing it yourself before stating an answer
- For historical dates and facts: state confidence level if not certain
- Never make up statistics or quotes
- It is better to say "I'm not certain" than to state something wrong

If they share a photo or image: describe what you see, identify what it is, and answer their question about it.

Always end with something that deepens curiosity — a related fun fact, a thought-provoking question, or encouragement.`

        : `You are Sunny, an accurate, knowledgeable AI assistant for ${userProgress.name}, who is ${ageNum} years old.

ACCURACY IS NON-NEGOTIABLE: Think through facts, dates, science, and math carefully before writing them. Verify calculations. If uncertain about specific data, say so explicitly ("I believe...", "roughly...", "you may want to confirm this, but..."). Never fabricate facts, statistics, or quotes.

SCOPE — you can discuss ANYTHING:
- Science & technology (physics, chemistry, biology, computing, AI, space, medicine)
- History & geography & world cultures
- Mathematics (explain concepts, check homework problems step by step)
- Literature, arts, music, film, philosophy
- Current events, economics, social issues (age-appropriate framing)
- How everyday things work
- Any genuine question or topic they are curious about

HOMEWORK GUIDANCE:
- When helping with homework problems: work through the APPROACH and REASONING, ask guiding questions, show the method — do not simply hand over the final answer without explanation. The goal is understanding, not just a grade.
- For essay or writing homework: give feedback, suggest improvements, explain WHY — don't write it for them.
- For factual lookup homework (definitions, historical events): answer directly since those are just knowledge retrieval.

RESPONSE STYLE (${ageNum}-year-old / ${ageNum <= 15 ? 'teen' : 'older teen / young adult'} level):
- Match their sophistication — they can handle nuance, complexity, and real explanations
- Be concise but complete: short answers for simple questions, thorough answers for complex ones
- Use clear structure: numbered steps for multi-part explanations, bullet points for lists
- Cite reasoning: explain HOW you know something, not just WHAT
- Acknowledge real complexity and multiple perspectives where they exist

Keep the tone conversational and collegial — like the smartest, most helpful person they know.`;
    } else if (currentSubject === 'smart') {
      const { getSmartModeSystemPrompt } = await import('./utils/sunnyPrompts');
      const _smLearnerCtx = buildSmartLearnerContext(userProgress);
      systemPrompt = getSmartModeSystemPrompt({
        name: userProgress.name,
        age: ageNum,
        profileLang: userProgress.language || 'en',
      }, _smLearnerCtx);
      // Early-turn injection: when user responds to opening (before any user message in history),
      // append learner context to the current user message so the model has topical context
      // even when the user said something vague like "Learn Something New"
      const _smUserMsgCount = conversation.filter(m => m.role === 'user').length;
      if (_smUserMsgCount === 0) {
        const lastApiMsg = apiMessages[apiMessages.length - 1];
        if (lastApiMsg && lastApiMsg.role === 'user' && typeof lastApiMsg.content === 'string') {
          const ctxParts = [];
          if (_smLearnerCtx.weakTopics.length > 0)
            ctxParts.push(`Weak areas: ${_smLearnerCtx.weakTopics.slice(0, 2).map(w => w.topic).join(', ')}`);
          if (_smLearnerCtx.lastSubject) ctxParts.push(`Last subject: ${_smLearnerCtx.lastSubject}`);
          if (_smLearnerCtx.enjoymentSubjects.length > 0)
            ctxParts.push(`Enjoys: ${_smLearnerCtx.enjoymentSubjects[0].subjKey}`);
          if (ctxParts.length > 0)
            lastApiMsg.content += `\n[LEARNER CONTEXT: ${ctxParts.join('. ')}. Use this to start teaching immediately — no more questions.]`;
        }
      }
    } else {
      const subject = subjects[currentSubject];
      const level = userProgress.subjects[currentSubject]?.level || 0;
      const ageGroup = userProgress.ageGroup || getAgeGroup(userProgress.age);
      const levelName = subject.levels?.[ageGroup]?.[level] || subject.levels?.[ageGroup]?.[0] || 'Professional';
      
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
      const _prevLangState = lastAiStateRef.current;
      const continuationInstruction = currentSubject === 'languages'
        ? 'PREVIOUS TURN STATE: ' + (_prevLangState || 'teach') + '\n' +
          'LANGUAGE TEACHING CYCLE — follow this strictly:\n' +
          '- Previous state was "teach" → student is NOW practicing. You MUST respond with state "ask", evaluate their attempt ("' + answerToSend + '"), and ask a practice question about the word just taught. DO NOT re-introduce the word.\n' +
          '- Previous state was "ask" → check their answer ("' + answerToSend + '"):\n' +
          '  - Correct: celebrate briefly, then TEACH a NEW word/phrase (state: "teach", expect: "none")\n' +
          '  - Incorrect: gently correct, reteach the same word, ask again (state: "ask")\n' +
          '- NEVER use state "teach" twice in a row. NEVER re-introduce a word you just taught.\n' +
          '- Always follow: TEACH → PRACTICE → TEACH → PRACTICE...'
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

      const _contPrimaryLang = LANGUAGES.find(l => l.code === (userProgress.language || 'en'))?.name || 'English';
      const _contCefrNum = currentSubject === 'languages' && selectedTopic
        ? (userProgress.subjects.languages?.languageLevels?.[selectedTopic] ?? 0) : 0;
      const _contCefr = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'][Math.min(Math.floor(_contCefrNum), 5)] || 'A1';
      const _contSubjProgress = userProgress.subjects?.[currentSubject];
      const _contMistakes = (_contSubjProgress?.recentAttempts || [])
        .filter(a => !a.success).slice(-5).map(a => a.topic).filter(Boolean);
      const _contWordBank = currentSubject === 'languages'
        ? Object.keys(userProgress.subjects?.languages?.wordBank || {}).slice(0, 30)
        : [];

      // Adaptive intelligence fields (continuation)
      const _contLast5 = (_contSubjProgress?.recentAttempts || []).slice(-5);
      const _contIsStruggling = _contLast5.filter(a => !a.success).length >= 3;
      const _contTotalAtt = _contSubjProgress?.totalAttempts || 0;
      const _contConfScore = Math.round(((_contSubjProgress?.correctAnswers || 0) / Math.max(_contTotalAtt, 1)) * 100);
      const _contConfLabel = _contTotalAtt >= 5 ? (_contConfScore >= 75 ? 'High' : _contConfScore >= 50 ? 'Medium' : 'Low') : null;
      const _contMasteryPct = Math.round(((_contSubjProgress?.level || 0) / Math.max(_contSubjProgress?.maxLevel || 1, 1)) * 100);
      const _contTopicStats = _contSubjProgress?.topicStats || {};
      const _contTwoDaysAgo = Date.now() - 172800000;
      const _contWeakTopics = Object.entries(_contTopicStats)
        .filter(([, s]) => s.attempts >= 3 && s.correct / s.attempts < 0.5).map(([t]) => t);
      const _contNextReview = Object.entries(_contTopicStats)
        .filter(([, s]) => s.lastSeen && s.lastSeen < _contTwoDaysAgo)
        .sort(([, a], [, b]) => a.lastSeen - b.lastSeen).map(([t]) => t);

      systemPrompt = getSunnySystemPrompt({
        name: userProgress.name,
        age: ageNum,
        profileLang: userProgress.language || 'en',
        learningLang: currentSubject === 'languages' ? selectedTopic : null,
        hasHistory: userProgress.assessmentCompleted,
        recentMistakes: _contMistakes,
        wordBank: _contWordBank,
        isStruggling: _contIsStruggling,
        confidenceLabel: _contConfLabel,
        masteryPct: _contMasteryPct,
        weakTopics: _contWeakTopics,
        nextReviewTopics: _contNextReview,
      }) + `\n\n=== CRITICAL LANGUAGE INSTRUCTION ===
RESPOND ENTIRELY IN ${_contPrimaryLang}.
ALL coach_say, feedback, and encouragement MUST be in ${_contPrimaryLang}.
${currentSubject === 'languages' && selectedTopic ? `Target language words/flashcards go in study_board fields only. CEFR level: ${_contCefr}.` : `The student only speaks ${_contPrimaryLang}.`}

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

    // Inject structured lesson content when source material has been loaded
    if (lessonContext && systemPrompt && !isAdultSubject) {
      const lc = lessonContext;
      systemPrompt += `\n\n=== LESSON SOURCE MATERIAL ===
Teach ONLY from this content. All questions and vocabulary must come directly from this source.
TITLE: ${lc.title}
EXPLANATION: ${lc.explanation}
VOCABULARY: ${lc.vocabulary.map(v => `${v.word} — ${v.definition}`).join(' | ')}
QUESTIONS TO USE (ask in order, easy to hard):
${lc.questions.map((q, i) => `${i + 1}. Q: ${q.question}  A: ${q.sampleAnswer}  Hint: ${q.hint}`).join('\n')}`;
    }

    // ── Gemini grammar_feedback: sequential, enriches Claude's context ────
    const _gAgeGroup = ageNum <= 6 ? '4-6' : ageNum <= 9 ? '7-9' : '10-13';
    if (currentSubject === 'writing' && !isAdultSubject && !isHomeworkMode && answerToSend.trim().length > 35) {
      const _gramData = await callGemini('grammar_feedback', {
        text: answerToSend.trim().substring(0, 400),
        ageGroup: _gAgeGroup,
      }).catch(() => null);
      if (_gramData?.corrected && _gramData?.errors?.length > 0) {
        const _lastIdx = apiMessages.length - 1;
        if (_lastIdx >= 0 && typeof apiMessages[_lastIdx]?.content === 'string') {
          apiMessages[_lastIdx] = {
            ...apiMessages[_lastIdx],
            content: apiMessages[_lastIdx].content +
              `\n\n[GRAMMAR ANALYSIS: Corrected: "${_gramData.corrected}". Errors: ${_gramData.errors.slice(0, 2).join('; ')}. Rule: "${_gramData.rule}". Praise: "${_gramData.praise}". Use these corrections warmly in your coach_say response.]`,
          };
        }
      }
    }

    // ── Gemini parallel tasks: explain_concept / math_hint ───────────────
    let _gParallelTask = null, _gParallelCtx = null;
    if (!isAdultSubject && !isHomeworkMode && ageNum <= 13) {
      if (remotionHint.includes('concept-reveal')) {
        _gParallelTask = 'explain_concept';
        _gParallelCtx = {
          concept: answerToSend.substring(0, 120),
          ageGroup: _gAgeGroup,
          subject: subjects[currentSubject]?.name || currentSubject,
        };
      } else if (currentSubject === 'math' && !apiAnswerText.includes('[GRADE: CORRECT]') && (currentStudyBoard?.correctAnswer || currentStudyBoard?.visual)) {
        _gParallelTask = 'math_hint';
        _gParallelCtx = {
          problem: currentCoachSay || currentStudyBoard?.audioPrompt || '',
          attempt: answerToSend,
          ageGroup: _gAgeGroup,
        };
      }
    }
    const _gParallelPromise = _gParallelTask ? callGemini(_gParallelTask, _gParallelCtx) : null;

    fetchAbortRef.current?.abort();
    fetchAbortRef.current = new AbortController();
    let response;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: fetchAbortRef.current.signal,
          body: JSON.stringify({ system: systemPrompt, messages: apiMessages })
        });
        break;
      } catch (err) {
        if (err.name === 'AbortError' || attempt === 1) throw err;
        await new Promise(r => setTimeout(r, 1500));
        fetchAbortRef.current = new AbortController();
      }
    }

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

    if (!isHomeworkMode && (!isAdultSubject || currentSubject === 'accent' || currentSubject === 'trading')) {
      try {
        const sunnyResponse = extractJSON(aiResponseText);
        validateSunnyResponse(sunnyResponse);
        
        sunnyResponse.study_board = normalizeStudyBoard(sunnyResponse.study_board);
        if (!sunnyResponse.study_board || !sunnyResponse.study_board.visual || sunnyResponse.study_board.visualType === 'none') {
          sunnyResponse.study_board = createSmartVisual(sunnyResponse.coach_say, currentSubject);
        }

        // ── Apply Gemini parallel results (explain_concept / math_hint) ──
        const _gResult = _gParallelPromise ? await _gParallelPromise.catch(() => null) : null;
        if (_gResult) {
          if (_gParallelTask === 'explain_concept' && _gResult.analogy
              && sunnyResponse.study_board?.visual?.type === 'concept-reveal'
              && !sunnyResponse.study_board.visual.analogy) {
            sunnyResponse.study_board.visual.analogy = _gResult.analogy;
          } else if (_gParallelTask === 'math_hint' && _gResult.hint
              && (sunnyResponse.graded === 'incorrect' || sunnyResponse.state === 'hint')) {
            sunnyResponse.coach_say += `  💡 ${_gResult.hint}`;
          }
        }

        setCurrentCoachSay(sunnyResponse.coach_say);
        setCurrentStudyBoard({
          ...sunnyResponse.study_board,
          audioPrompt: sunnyResponse.audioPrompt,
          correctAnswer: sunnyResponse.correctAnswer
        });

        // ── Gemini pronunciation_guide: non-blocking async enrichment ─────
        if (currentSubject === 'languages' && !isHomeworkMode && ageNum <= 13) {
          const _newPhrase = sunnyResponse.study_board?.visual?.phrase;
          if (_newPhrase && !sunnyResponse.study_board?.visual?.phonetic) {
            callGemini('pronunciation_guide', {
              word: _newPhrase,
              language: selectedTopic || 'Spanish',
            }).then(r => {
              if (r?.phonetic) {
                setCurrentStudyBoard(prev =>
                  prev?.visual?.phrase === _newPhrase && !prev.visual?.phonetic
                    ? { ...prev, visual: { ...prev.visual, phonetic: r.phonetic, ...(r.tip ? { tip: r.tip } : {}) } }
                    : prev
                );
              }
            }).catch(() => {});
          }
        }

        // Track AI state for language teach/ask cycle
        if (currentSubject === 'languages') {
          lastAiStateRef.current = sunnyResponse.state || 'teach';
        }

        const wasCorrect = sunnyResponse.graded === 'correct' || sunnyResponse.state === 'advance';
        await updateProgress(currentSubject, wasCorrect);

        // Trading: increment level when concept is completed
        if (currentSubject === 'trading' && sunnyResponse.conceptCompleted === true) {
          const up = JSON.parse(JSON.stringify(userProgress));
          if (!up.subjects.trading) up.subjects.trading = { level: 0 };
          up.subjects.trading.level = Math.min((up.subjects.trading.level || 0) + 1, 2);
          setUserProgress(up);
          await saveUserProgress(up);
        }

        // Trigger kid animations based on grading (only for non-adult subjects)
        if (!isAdultSubject && ageNum <= AGE_BOUNDARIES.TTS_MAX) {
          if (wasCorrect) {
            setCelebrationKey(k => k + 1);
          } else if (sunnyResponse.graded === 'incorrect') {
            setWrongAnim(true);
            setTimeout(() => setWrongAnim(false), 600);
          }
        }
        // Animate board in when new content arrives
        setBoardKey(k => k + 1);

        // Add both messages to conversation - strings only!
        const userMessage = {
          role: 'user',
          content: answerToSend
        };

        const aiMessage = {
          role: 'assistant',
          content: sunnyResponse.coach_say
        };
        
        setConversation(prev => silent ? [...prev, aiMessage] : [...prev, userMessage, aiMessage]);
        
// For reading: speak the full sentence (audioPrompt) after coach_say for listening exercises
if (currentSubject === 'reading' && sunnyResponse.audioPrompt && synthRef.current) {
  const sentence = sunnyResponse.audioPrompt;
  const instruction = sunnyResponse.coach_say || '';
  setTimeout(() => {
    if (instruction) {
      speak(instruction, () => setTimeout(() => speak(sentence), 500));
    } else {
      speak(sentence);
    }
  }, 500);
}
// For spelling: always speak slowly; spell word letter-by-letter on any wrong answer
if (currentSubject === 'reading' && sunnyResponse.audioPrompt) {
  // already handled above — fall through without the else-if below triggering
} else if (currentSubject === 'spelling' && synthRef.current) {
  const word = (sunnyResponse.audioPrompt || sunnyResponse.correctAnswer || '').toString().trim();
  const answeredWrong = sunnyResponse.graded === 'incorrect' || sunnyResponse.graded === 'partial'
    || sunnyResponse.state === 'teach' || sunnyResponse.state === 'hint';
  setTimeout(() => {
    if (word && answeredWrong) {
      // Speak feedback first, then spell the word letter by letter so the child can learn
      speak(sunnyResponse.coach_say, () => {
        const letters = word.toUpperCase().split('').join('. ');
        speak(`The word is ${word}. Spelled: ${letters}. ${word}.`, null, null, 0.62);
      }, null, 0.78);
    } else if (word) {
      // ASK turn: say the word clearly twice at a slow pace
      speak(`The word is: ${word}. ${word}. Can you spell it?`, null, null, 0.75);
    } else {
      speak(sunnyResponse.coach_say, null, null, 0.78);
    }
  }, 500);
} else if (shouldUseTTS) {
  const _ttsDelay2 = currentSubject === 'languages' ? 1200 : 500;
  setTimeout(() => {
    if (currentSubject === 'languages') {
      // All speech in the target language — user clicks the flashcard to read the native translation.
      const targetLangCode = LANGUAGE_NAME_TO_CODE[selectedTopic] || 'en';
      speakWithGemini(sunnyResponse.coach_say, null, targetLangCode);
    } else if (currentSubject === 'accent') {
      // Speak coach instruction, then demo the drill phrase, then auto-restart mic.
      // Accent drills keep browser TTS for precise chained timing.
      const restartMic = () => {
        if (!recognitionRef.current || isLoadingRef.current) return;
        try { recognitionRef.current.abort(); } catch (e) {}
        recognitionRef.current.lang = 'en-US';
        // 1.2s delay: lets TTS audio dissipate before mic opens
        setTimeout(() => {
          if (isLoadingRef.current) return; // still loading — skip
          try { recognitionRef.current.start(); setIsListening(true); } catch (e) {}
        }, 1200);
      };
      const phrase = sunnyResponse.study_board?.visual?.word || sunnyResponse.correctAnswer || '';
      if (phrase) {
        // Say instruction → demo phrase → restart mic
        speak(sunnyResponse.coach_say, () => setTimeout(() => speak(phrase, restartMic, 'en'), 400), 'en');
      } else {
        speak(sunnyResponse.coach_say, restartMic, 'en');
      }
    } else {
      speakWithGemini(sunnyResponse.coach_say, null);
    }
  }, _ttsDelay2);
}
      } catch (error) {
        console.error('Failed to parse response, using fallback');
        
        // Try to extract coach_say from broken JSON before using raw text
        const coachSayMatch = aiResponseText.match(/"coach_say"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const fallbackCoachSay = coachSayMatch ? coachSayMatch[1] : "Let's keep going! What do you think?";
        // For accent, preserve the current study board (don't replace with raw AI text)
        const fallbackBoard = currentSubject === 'accent' ? null : createSmartVisual(aiResponseText, currentSubject);

setCurrentCoachSay(fallbackCoachSay);
if (fallbackBoard) {
  setCurrentStudyBoard({
    ...fallbackBoard,
    audioPrompt: null,
    correctAnswer: null
  });
}
        
        // Fallback: JSON failed, check for "graded":"correct" substring
        const wasCorrect = /"graded"\s*:\s*"correct"/.test(aiResponseText);
        await updateProgress(currentSubject, wasCorrect);
        
        const userMessage = {
          role: 'user',
          content: answerToSend
        };
        
        const aiMessage = {
          role: 'assistant',
          content: fallbackCoachSay
        };
        
        setConversation(prev => silent ? [...prev, aiMessage] : [...prev, userMessage, aiMessage]);
        
if (shouldUseTTS) {
  setTimeout(() => {
    const ttsLangOverride = (currentSubject === 'interview' || currentSubject === 'followup') ? 'en' : null;
    speakWithGemini(fallbackCoachSay, null, ttsLangOverride);
  }, 500);
}
      }
    } else {
      // Adult/homework subjects use plain text — check graded field substring as best signal
      const wasCorrect = /"graded"\s*:\s*"correct"/.test(aiResponseText);

      if (!isHomeworkMode && !isAdultSubject) {
        await updateProgress(currentSubject, wasCorrect);
      }

      // Parse [TOPIC: xxx] tags from all professional + health + engineering track responses
      const _allProTracks = [
        'college', 'law', 'accounting', 'cpa', 'pro-coaching',
        'family-medicine', 'pharmacy', 'physical-therapy', 'nursing',
        'rtl-design', 'physical-design', 'lab-debug',
      ];
      if (_allProTracks.includes(currentSubject) && userProgress) {
        const _updatedProgress = extractAndTrackTopicTags(aiResponseText, currentSubject, wasCorrect, userProgress);
        if (_updatedProgress !== userProgress) {
          setUserProgress(_updatedProgress);
          saveUserProgress(_updatedProgress).catch(() => {});
        }

        // ── Gemini-to-Remotion pipeline ──────────────────────────────────────
        // Non-blocking: display text immediately, pop in Remotion animation when Gemini returns
        const _accentColors = {
          'college': '#4338CA', 'law': '#7C2D12', 'accounting': '#065F46', 'cpa': '#1E3A5F', 'pro-coaching': '#6B21A8',
          'family-medicine': '#991B1B', 'pharmacy': '#5B21B6', 'physical-therapy': '#065F46', 'nursing': '#1E40AF',
          'rtl-design': '#2563EB', 'physical-design': '#047857', 'lab-debug': '#B45309',
        };
        const _icons = {
          'college': '🎓', 'law': '⚖️', 'accounting': '📊', 'cpa': '📋', 'pro-coaching': '💼',
          'family-medicine': '🩺', 'pharmacy': '💊', 'physical-therapy': '🦴', 'nursing': '🏥',
          'rtl-design': '⚡', 'physical-design': '🔬', 'lab-debug': '🛠️',
        };
        callGemini('extract_visual_data', {
          aiResponseText: aiResponseText.slice(0, 1800),
          subject: currentSubject,
          topic: selectedTopic || currentSubject,
          accentColor: _accentColors[currentSubject] || '#0A84FF',
          icon: _icons[currentSubject] || '',
        }).then(result => {
          if (result?.type && result.type !== 'none' && result.props) {
            setCurrentStudyBoard({
              visualType: 'remotion-video',
              visual: { type: result.type, ...result.props },
            });
          }
        }).catch(() => {});

        // ── Drill/Flashcard enrichment (health + pro tracks) ─────────────────
        if (aiResponseText.includes('[DRILL_REQUEST]')) {
          callGemini('practice_question', {
            subject: currentSubject,
            topic: selectedTopic || currentSubject,
            difficulty: 'medium',
          }).then(result => {
            if (result?.question) {
              const drillText = `\n\n---\n**Practice Question (Gemini)**\n\n${result.question}${result.options ? '\n' + result.options.join('\n') : ''}\n\n<details><summary>Answer</summary>\n\n**${result.correctAnswer}** — ${result.explanation}\n</details>`;
              setConversation(prev => {
                const updated = [...prev];
                if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
                  updated[updated.length - 1] = { ...updated[updated.length - 1], content: updated[updated.length - 1].content + drillText };
                }
                return updated;
              });
            }
          }).catch(() => {});
        }

        if (aiResponseText.includes('[FLASHCARD_REQUEST]')) {
          callGemini('flashcard_set', {
            subject: currentSubject,
            topic: selectedTopic || currentSubject,
          }).then(result => {
            if (result?.cards?.length) {
              const cardText = '\n\n---\n**Flashcards (Gemini)**\n\n' + result.cards.map((c, i) =>
                `**${i + 1}. ${c.front}**\n${c.back}${c.mnemonic ? `\n*Memory: ${c.mnemonic}*` : ''}`
              ).join('\n\n');
              setConversation(prev => {
                const updated = [...prev];
                if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
                  updated[updated.length - 1] = { ...updated[updated.length - 1], content: updated[updated.length - 1].content + cardText };
                }
                return updated;
              });
            }
          }).catch(() => {});
        }

        // ── Engineering exercise + debug scenario enrichment ──────────────────
        const _isEngineering = ['rtl-design', 'physical-design', 'lab-debug'].includes(currentSubject);
        if (_isEngineering && aiResponseText.includes('[EXERCISE_REQUEST]')) {
          const _exerciseTask = currentSubject === 'physical-design' ? 'pd_drill'
            : currentSubject === 'lab-debug' ? 'lab_scenario' : 'engineering_exercise';
          callGemini(_exerciseTask, {
            subject: currentSubject,
            topic: selectedTopic || currentSubject,
            level: 'intermediate',
            language: currentSubject === 'rtl-design' ? 'SystemVerilog' : undefined,
          }).then(result => {
            if (result && (result.task || result.question || result.symptom)) {
              let exerciseText = '\n\n---\n**Exercise (Gemini)**\n\n';
              if (result.title) exerciseText += `**${result.title}**\n\n`;
              if (result.context) exerciseText += `${result.context}\n\n`;
              if (result.task) exerciseText += `${result.task}\n`;
              if (result.question) exerciseText += `${result.question}\n`;
              if (result.setup) exerciseText += `**Setup:** ${result.setup}\n`;
              if (result.symptom) exerciseText += `**Symptom:** ${result.symptom}\n`;
              if (result.context_snippet) exerciseText += `\`\`\`\n${result.context_snippet}\n\`\`\`\n`;
              if (result.starter) exerciseText += `\`\`\`\n${result.starter}\n\`\`\`\n`;
              if (result.options) exerciseText += '\n' + result.options.join('\n') + '\n';
              if (result.hints?.length) exerciseText += `\n<details><summary>Hints</summary>\n\n${result.hints.map(h => `- ${h}`).join('\n')}\n</details>`;
              if (result.solution_outline) exerciseText += `\n<details><summary>Solution Outline</summary>\n\n${result.solution_outline}\n</details>`;
              if (result.explanation) exerciseText += `\n<details><summary>Answer & Explanation</summary>\n\n**${result.correct_answer}** — ${result.explanation}\n</details>`;
              if (result.follow_up) exerciseText += `\n\n*Follow-up: ${result.follow_up}*`;
              if (result.safety_note) exerciseText += `\n\n> **Safety:** ${result.safety_note}`;
              setConversation(prev => {
                const updated = [...prev];
                if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
                  updated[updated.length - 1] = { ...updated[updated.length - 1], content: updated[updated.length - 1].content + exerciseText };
                }
                return updated;
              });
            }
          }).catch(() => {});
        }

        if (_isEngineering && aiResponseText.includes('[DEBUG_SCENARIO_REQUEST]')) {
          const _debugTask = currentSubject === 'lab-debug' ? 'lab_scenario' : 'engineering_debug_scenario';
          callGemini(_debugTask, {
            subject: currentSubject,
            topic: selectedTopic || currentSubject,
            level: 'intermediate',
          }).then(result => {
            if (result && (result.symptom || result.setup)) {
              let debugText = '\n\n---\n**Debug Scenario (Gemini)**\n\n';
              if (result.title) debugText += `**${result.title}**\n\n`;
              if (result.setup) debugText += `**Setup:** ${result.setup}\n`;
              if (result.symptom) debugText += `**Symptom:** ${result.symptom}\n`;
              if (result.instrument_state) debugText += `**Instrument state:** ${result.instrument_state}\n`;
              if (result.available_info?.length) debugText += '\n**Available info:**\n' + result.available_info.map(i => `- ${i}`).join('\n');
              if (result.questions?.length) debugText += '\n\n**Work through:**\n' + result.questions.map(q => `1. ${q}`).join('\n');
              if (result.red_herrings?.length) debugText += `\n\n<details><summary>Red herring to rule out</summary>\n\n${result.red_herrings.join('\n')}\n</details>`;
              debugText += `\n\n<details><summary>Root Cause & Fix</summary>\n\n**Root cause:** ${result.root_cause}\n\n**Fix:** ${result.fix}${result.teaching_point ? `\n\n**Key lesson:** ${result.teaching_point}` : ''}\n</details>`;
              if (result.safety_note) debugText += `\n\n> **Safety:** ${result.safety_note}`;
              setConversation(prev => {
                const updated = [...prev];
                if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
                  updated[updated.length - 1] = { ...updated[updated.length - 1], content: updated[updated.length - 1].content + debugText };
                }
                return updated;
              });
            }
          }).catch(() => {});
        }
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
    const ttsLangOverride = (currentSubject === 'interview' || currentSubject === 'followup') ? 'en' : null;
    speak(aiResponseText.substring(0, 140), null, ttsLangOverride);
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
    // For accent coach: restart mic after error so user can try again without tapping
    if (currentSubject === 'accent' && recognitionRef.current) {
      setTimeout(() => {
        try { recognitionRef.current.abort(); } catch (e) {}
        setTimeout(() => {
          try { recognitionRef.current.start(); setIsListening(true); } catch (e) {}
        }, 800);
      }, 1000);
    }
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
  // Memory game lifecycle events are informational only — items just hid, no message to send.
  if (choice && typeof choice === 'object' && choice.type === 'memory-items-hidden') {
    return;
  }
  // Agent pipeline events are objects with a `type` field
  if (choice && typeof choice === 'object' && choice.type) {
    handlePipelineInteraction(choice);
    return;
  }
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
    // STABILITY FIX: Full cleanup of all async pipelines on exit.
    // Cancel recognition, TTS, and all pending timers to prevent
    // callbacks firing after screen change.
    try { recognitionRef.current?.abort(); } catch {}
    try { synthRef.current?.cancel(); } catch {}
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    setIsListening(false);
    setIsSpeaking(false);
    setIsVoiceInput(false);
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
  const canStart = userName.trim() && userAge && parseInt(userAge) >= 4 && parseInt(userAge) <= 75;
  const isProMode = parseInt(userAge) >= 22;

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
                min="4" max="75"
                placeholder={t('welcome.agePlaceholder', selectedLanguage)}
                style={{
                  width: '100%', padding: '12px 14px', fontSize: 16, color: '#1C1C1E',
                  background: '#F9F9FB', border: '1.5px solid #E5E5EA', borderRadius: 12,
                  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = '#7C3AED'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.12)'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#E5E5EA'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F9F9FB'; }}
              />
              {isProMode && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', background: '#EDE9FE', padding: '3px 10px', borderRadius: 20 }}>
                    Professional Mode
                  </span>
                  <span style={{ fontSize: 12, color: '#64748B' }}>Language, Skills, Interview & Life Coach</span>
                </div>
              )}
              {!isProMode && !userAge && (
                <button onClick={() => setUserAge('25')} style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, fontSize: 13, color: '#7C3AED', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                  I'm a college student or professional →
                </button>
              )}
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
  const ageNum = userProgress ? parseInt(userProgress.age) : 0;
  const isYoung = ageNum <= 9;
  const isAdultUser = userProgress
    ? (ageNum >= 22 || userProgress.ageGroup === 'adult')
    : false;
  const subject = currentSubject
    ? (subjects[currentSubject] || (() => { const _s = ADULT_SUBJECTS[currentSubject]; return _s ? { name: _s.name, icon: _s.icon, color: 'from-indigo-500 to-purple-600', levels: {} } : null; })())
    : null;

  // 3. TOPIC SELECTION SCREEN
if (showTopicSelection && currentSubject && userProgress) {
  let subject = subjects[currentSubject];
  if (!subject) {
    const s = ADULT_SUBJECTS[currentSubject];
    const [c1, c2] = SUBJECT_CARD_GRADIENTS[currentSubject] || ['#6366F1', '#818CF8'];
    if (s) subject = { name: s.name, icon: s.icon, color: `from-[${c1}] to-[${c2}]` };
  }
  if (!subject) return null;
  const topics = advancedTopics[currentSubject] || ADVANCED_TOPICS[currentSubject] || [];
  
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
    const uiLang = userProgress.language || 'en'; // primary language for UI text

    // ── ADULT / PROFESSIONAL DASHBOARD ──────────────────────────────────
    if (isAdultUser) {
      // Trigger persona onboarding for new users who haven't completed it
      if (!userProgress.persona?.onboardingComplete && !showPersonaOnboarding) {
        setTimeout(() => setShowPersonaOnboarding(true), 600);
      }
      const langSubj = userProgress.subjects?.languages;
      const prefLang = langSubj?.preferredLanguage;
      const langTopics = advancedTopics.languages || [];
      const activeLang = prefLang ? langTopics.find(l => l.id === prefLang) : null;
      const CEFR = ['A1','A2','B1','B2','C1','C2'];
      const cefrCode = activeLang ? (CEFR[Math.min(Math.floor(langSubj?.languageLevels?.[prefLang] ?? 0), 5)] || 'A1') : null;
      const CARD_GRADIENTS = {
        languages:       ['#0891B2','#06B6D4'],
        skills:          ['#059669','#10B981'],
        interview:       ['#7C3AED','#4F46E5'],
        'life-coach':    ['#EA580C','#F59E0B'],
        resume:          ['#1D4ED8','#3B82F6'],
        followup:        ['#0F766E','#14B8A6'],
        accent:          ['#0E7490','#0891B2'],
        trading:         ['#15803D','#16A34A'],
        // Professional & Academic Tracks
        college:         ['#4338CA','#6366F1'],
        law:             ['#7C2D12','#9A3412'],
        accounting:      ['#065F46','#047857'],
        cpa:             ['#1E3A5F','#2563EB'],
        'pro-coaching':  ['#6B21A8','#9333EA'],
        // Health Education Tracks
        'family-medicine':  ['#991B1B','#DC2626'],
        'pharmacy':         ['#5B21B6','#7C3AED'],
        'physical-therapy': ['#065F46','#059669'],
        'nursing':          ['#1E40AF','#3B82F6'],
        // Semiconductor / Hardware Engineering Tracks
        'rtl-design':       ['#1E3A5F','#2563EB'],
        'physical-design':  ['#064E3B','#047857'],
        'lab-debug':        ['#78350F','#B45309'],
      };
      // Helper: launch any subject (handles resume-prompt check + action)
      const launchSubject = (key) => {
        const isLang = key === 'languages';
        const doDefault = () => {
          if (key === 'skills')        { setShowSkillsPicker(true); return; }
          if (key === 'interview')     { setShowInterviewSetup(true); return; }
          if (key === 'resume')        { setShowResumeSetup(true); return; }
          if (key === 'followup')      { setShowFollowupSetup(true); return; }
          if (key === 'accent')        { startAccentCoach(); return; }
          if (key === 'trading')       { setShowTradingSetup(true); return; }
          // Professional & Academic Tracks — all use topic picker
          if (key === 'college')       { setCurrentSubject('college'); setShowTopicSelection(true); return; }
          if (key === 'law')           { setCurrentSubject('law'); setShowTopicSelection(true); return; }
          if (key === 'accounting')    { setCurrentSubject('accounting'); setShowTopicSelection(true); return; }
          if (key === 'cpa')           { setCurrentSubject('cpa'); setShowTopicSelection(true); return; }
          if (key === 'pro-coaching')  { setCurrentSubject('pro-coaching'); setShowTopicSelection(true); return; }
          // Health Education Tracks — all use topic picker
          if (key === 'family-medicine')  { setCurrentSubject('family-medicine'); setShowTopicSelection(true); return; }
          if (key === 'pharmacy')         { setCurrentSubject('pharmacy'); setShowTopicSelection(true); return; }
          if (key === 'physical-therapy') { setCurrentSubject('physical-therapy'); setShowTopicSelection(true); return; }
          if (key === 'nursing')          { setCurrentSubject('nursing'); setShowTopicSelection(true); return; }
          // Semiconductor / Hardware Engineering Tracks — all use topic picker
          if (key === 'rtl-design')       { setCurrentSubject('rtl-design'); setShowTopicSelection(true); return; }
          if (key === 'physical-design')  { setCurrentSubject('physical-design'); setShowTopicSelection(true); return; }
          if (key === 'lab-debug')        { setCurrentSubject('lab-debug'); setShowTopicSelection(true); return; }
          if (isLang) {
            const savedKey = `tutor:session:${userProgress.name}:languages`;
            let saved = null;
            try { saved = JSON.parse(localStorage.getItem(savedKey)); } catch {}
            const isErr = saved?.conversation?.length === 1 && typeof saved.conversation[0]?.content === 'string' &&
              (saved.conversation[0].content.includes('Something went wrong') || saved.conversation[0].content.includes('API Error') || saved.conversation[0].content.includes('server is a bit busy'));
            if (isErr) { localStorage.removeItem(savedKey); saved = null; }
            if (saved?.conversation?.length > 0) { setResumeSubject('languages'); setResumeSessionData(saved); setShowResumePrompt(true); }
            else { setCurrentSubject('languages'); setShowTopicSelection(true); }
            return;
          }
          startLifeCoach();
        };
        if (!isLang) {
          const savedKey = `tutor:session:${userProgress.name}:${key}`;
          let saved = null;
          try { saved = JSON.parse(localStorage.getItem(savedKey)); } catch {}
          const isErr = saved?.conversation?.length === 1 && typeof saved.conversation[0]?.content === 'string' &&
            (saved.conversation[0].content.includes('Something went wrong') || saved.conversation[0].content.includes('API Error') || saved.conversation[0].content.includes('server is a bit busy'));
          if (isErr) { localStorage.removeItem(savedKey); saved = null; }
          if (saved?.conversation?.length > 0) { setResumeSubject(key); setResumeSessionData(saved); setShowResumePrompt(true); return; }
        }
        doDefault();
      };

      // ── Time-based greeting ──────────────────────────────────────────────
      const _hour = new Date().getHours();
      const _greeting = _hour < 12 ? 'Good morning' : _hour < 17 ? 'Good afternoon' : 'Good evening';

      // ── Most recent non-errored session for "Continue Learning" hero ─────
      const _recentKey = Object.keys(ADULT_SUBJECTS).find(k => {
        try {
          const d = JSON.parse(localStorage.getItem(`tutor:session:${userProgress.name}:${k}`));
          if (!d?.conversation?.length) return false;
          const isErr = d.conversation.length === 1 && typeof d.conversation[0]?.content === 'string' &&
            (d.conversation[0].content.includes('Something went wrong') || d.conversation[0].content.includes('API Error') || d.conversation[0].content.includes('server is a bit busy'));
          return !isErr;
        } catch { return false; }
      });

      // ── Sidebar navigation groups (duplicate-audited) ────────────────────
      // Accent Coach and Language Learning are merged under one section.
      // Interview, Resume, Follow-up are all Career Tools.
      // No true duplicates remain.
      const NAV_GROUPS = [
        { section: 'EDUCATION', items: [
          { key: 'college',    label: 'College Courses' },
          { key: 'law',        label: 'Legal Studies' },
          { key: 'accounting', label: 'Accounting' },
          { key: 'cpa',        label: 'CPA Exam Prep' },
        ]},
        { section: 'HEALTH', items: [
          { key: 'family-medicine',  label: 'Family Medicine' },
          { key: 'pharmacy',         label: 'Pharmacy' },
          { key: 'physical-therapy', label: 'Physical Therapy' },
          { key: 'nursing',          label: 'Nursing' },
        ]},
        { section: 'ENGINEERING', items: [
          { key: 'rtl-design',       label: 'RTL Design' },
          { key: 'physical-design',  label: 'Physical Design' },
          { key: 'lab-debug',        label: 'Lab Tools & Debug' },
        ]},
        { section: 'CAREER', items: [
          { key: 'interview',     label: 'Interview Prep' },
          { key: 'resume',        label: 'Resume Review' },
          { key: 'followup',      label: 'Follow-up Email' },
          { key: 'pro-coaching',  label: 'Pro Coaching' },
        ]},
        { section: 'LANGUAGE', items: [
          { key: 'languages', label: 'Language Learning' },
          { key: 'accent',    label: 'Accent Coach' },
        ]},
        { section: 'SKILLS', items: [
          { key: 'skills', label: 'Skills Training' },
        ]},
        { section: 'FINANCE', items: [
          { key: 'trading', label: 'Stock Trading' },
        ]},
        { section: 'PERSONAL', items: [
          { key: 'life-coach', label: 'Life Coach' },
        ]},
      ];

      // ── Center workspace sections ────────────────────────────────────────
      const WORKSPACE_SECTIONS = [
        { title: 'Education',                  subtitle: 'College courses, exam prep, and professional development',  accent: '#4338CA', tools: ['college', 'law', 'accounting', 'cpa'] },
        { title: 'Health Education',           subtitle: 'Clinical reasoning, pharmacology, and patient care',        accent: '#991B1B', tools: ['family-medicine', 'pharmacy', 'physical-therapy', 'nursing'] },
        { title: 'Semiconductor Engineering',  subtitle: 'RTL design, physical design, and hardware lab skills',       accent: '#2563EB', tools: ['rtl-design', 'physical-design', 'lab-debug'] },
        { title: 'Career & Coaching',          subtitle: 'Land your next role and grow as a professional',            accent: '#7C3AED', tools: ['interview', 'resume', 'followup', 'pro-coaching'] },
        { title: 'Language & Communication',   subtitle: 'Master new languages and refine your accent',               accent: '#0891B2', tools: ['languages', 'accent'] },
        { title: 'Technical Skills',           subtitle: 'Code and engineering mastery',                              accent: '#059669', tools: ['skills'] },
        { title: 'Finance & Personal',         subtitle: 'Navigate markets and life with confidence',                 accent: '#EA580C', tools: ['trading', 'life-coach'] },
      ];

      // ── Weak topics (sorted worst-first) ─────────────────────────────────
      const _weakTopics = [];
      Object.entries(userProgress.subjects || {}).forEach(([subjKey, subjData]) => {
        Object.entries(subjData.topicStats || {}).forEach(([topic, stats]) => {
          if (stats.attempts >= 2 && stats.correct / stats.attempts < 0.6)
            _weakTopics.push({ subjKey, topic, score: stats.correct / stats.attempts });
        });
      });
      _weakTopics.sort((a, b) => a.score - b.score);

      // ── Sunny's Recommendation (priority: weak topic > active lang > recent session > default) ─
      const _rec = (() => {
        if (_weakTopics.length > 0) {
          const w = _weakTopics[0];
          return { key: w.subjKey, tag: 'REVIEW NEEDED', tagColor: '#DC2626',
            reason: `You struggled with "${w.topic}" last time. Let's reinforce it today so it sticks.` };
        }
        if (activeLang) return { key: 'languages', tag: 'DAILY PRACTICE', tagColor: '#0891B2',
          reason: `Daily practice is the fastest path to fluency. You're at ${cefrCode} — keep the momentum going.` };
        if (_recentKey) return { key: _recentKey, tag: 'IN PROGRESS', tagColor: '#059669',
          reason: 'Finishing sessions locks in what you learned. Resume where you left off.' };
        return { key: 'interview', tag: "SUNNY'S PICK", tagColor: '#7C3AED',
          reason: "Interview prep delivers real career results. Start with a company or role you're targeting." };
      })();

      return (
        <>
        <div style={{ height: '100vh', fontFamily: sysFont, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F8FAFC' }}>

          {/* Mobile header — hidden on tablet/desktop where sidebar takes over */}
          <div className="adult-mobile-header" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
            <div style={{ padding: '11px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #059669, #0891B2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>
                  {userProgress.name[0].toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>{userProgress.name}</p>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#7C3AED', background: '#EDE9FE', padding: '1px 6px', borderRadius: 8 }}>PRO</span>
                </div>
              </div>
              <button onClick={logout} style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}>Sign Out</button>
            </div>
          </div>

          {/* Three-panel body */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* ── LEFT SIDEBAR — visible ≥768px ── */}
            <div className="adult-sidebar">
              {/* User identity */}
              <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #059669, #0891B2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                    {userProgress.name[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userProgress.name}</p>
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#7C3AED', background: '#EDE9FE', padding: '1px 6px', borderRadius: 8, flexShrink: 0 }}>PRO</span>
                    </div>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>AI Learning Platform</p>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 8px' }}>
                {NAV_GROUPS.map(group => (
                  <div key={group.section} style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 9, fontWeight: 800, color: '#CBD5E1', letterSpacing: '0.10em', margin: '0 0 4px', paddingLeft: 8 }}>{group.section}</p>
                    {group.items.map(item => {
                      const subj = ADULT_SUBJECTS[item.key];
                      return (
                        <button key={item.key} onClick={() => launchSubject(item.key)}
                          style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 9, textAlign: 'left', WebkitTapHighlightColor: 'transparent', transition: 'background 0.1s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                        >
                          <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>{subj?.icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Sign out */}
              <div style={{ padding: '10px 8px 14px', borderTop: '1px solid #F1F5F9', flexShrink: 0 }}>
                <button onClick={logout}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 9, textAlign: 'left', transition: 'background 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                >
                  <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>↩</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#94A3B8' }}>Sign Out</span>
                </button>
              </div>
            </div>

            {/* ── CENTER WORKSPACE — AI-first hierarchy ── */}
            <div style={{ flex: 1, overflowY: 'auto', background: '#F8FAFC' }}>
              <div style={{ maxWidth: 700, margin: '0 auto', padding: '26px 20px 72px' }}>

                {/* 0. Smart Mode — Primary AI Hero */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #1E3A5F 100%)',
                    borderRadius: 18, padding: '20px 20px 18px',
                    position: 'relative', overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(79,70,229,0.28), 0 2px 8px rgba(0,0,0,0.12)',
                  }}>
                    <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', left: -20, bottom: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(79,70,229,0.10)', pointerEvents: 'none' }} />
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 15, background: 'linear-gradient(135deg, #6366F1, #4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 16px rgba(99,102,241,0.50)' }}>
                          <Sparkles style={{ width: 26, height: 26, color: '#fff' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 800, color: '#A5B4FC', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 3 }}>Sunny's Best Feature</div>
                          <div style={{ fontSize: 19, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px', lineHeight: 1.15 }}>AI Smart Mode</div>
                          <div style={{ fontSize: 11, color: 'rgba(165,180,252,0.80)', marginTop: 2 }}>Adaptive · Cross-subject · Personalized</div>
                        </div>
                        <button onClick={startSmartMode} style={{
                          padding: '10px 18px', borderRadius: 12, flexShrink: 0,
                          background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                          color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(99,102,241,0.55)', whiteSpace: 'nowrap',
                        }}>Start Now →</button>
                      </div>
                      <p style={{ fontSize: 12, color: 'rgba(199,210,254,0.75)', margin: '0 0 14px', lineHeight: 1.55 }}>
                        Learn, interpret, translate, or get help with documents — one intelligent AI coach.
                      </p>
                      {/* Adult quick actions — prioritized for adult workflows */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {[
                          ['🗣️', 'Interpreter', 'interpreter', 'Live two-way'],
                          ['🌍', 'Translate', 'translate', 'Signs & menus'],
                          ['📄', 'Documents', 'practical', 'Forms & letters'],
                        ].map(([icon, label, intent, sub]) => (
                          <button key={intent} onClick={() => intent === 'interpreter' ? setInterpreterOpen(true) : startSmartModeWithIntent(intent)} style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                            padding: '14px 8px 12px', borderRadius: 14,
                            background: 'rgba(165,180,252,0.12)', border: '1px solid rgba(165,180,252,0.22)',
                            color: '#fff', cursor: 'pointer', minHeight: 72,
                          }}>
                            <span style={{ fontSize: 22 }}>{icon}</span>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
                            <span style={{ fontSize: 9, color: 'rgba(199,210,254,0.60)', fontWeight: 500 }}>{sub}</span>
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                        <button onClick={() => startSmartModeWithIntent('homework')} style={{
                          fontSize: 11, fontWeight: 600, padding: '6px 16px', borderRadius: 20,
                          background: 'rgba(165,180,252,0.10)', border: '1px solid rgba(165,180,252,0.18)',
                          color: 'rgba(199,210,254,0.70)', cursor: 'pointer',
                        }}>🎓 Homework Help</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. Greeting */}
                <div style={{ marginBottom: 20 }}>
                  <h1 style={{ fontSize: 21, fontWeight: 800, color: '#0F172A', margin: '0 0 2px', letterSpacing: '-0.3px' }}>{_greeting}, {userProgress.name}</h1>
                  <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Sunny is ready to guide your session today.</p>
                </div>

                {/* 2. Sunny's Recommendation — dark hero, AI-first */}
                {(() => {
                  const rs = ADULT_SUBJECTS[_rec.key];
                  const [rg1, rg2] = CARD_GRADIENTS[_rec.key] || ['#4F46E5', '#7C3AED'];
                  return (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{
                        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                        borderRadius: 20, padding: '20px 22px', position: 'relative', overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.20)',
                      }}>
                        <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: `${rg1}18`, pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', bottom: -40, right: 50, width: 120, height: 120, borderRadius: '50%', background: `${rg2}10`, pointerEvents: 'none' }} />
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12, position: 'relative' }}>
                          <div style={{ width: 48, height: 48, borderRadius: 13, background: `linear-gradient(135deg, ${rg1}, ${rg2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, boxShadow: `0 4px 14px ${rg1}60` }}>
                            {rs?.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ marginBottom: 4 }}>
                              <span style={{ fontSize: 9, fontWeight: 800, color: _rec.tagColor, background: `${_rec.tagColor}22`, padding: '2px 9px', borderRadius: 20, letterSpacing: '0.08em' }}>✦ {_rec.tag}</span>
                            </div>
                            <p style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.45)', margin: '0 0 2px', letterSpacing: '0.07em' }}>SUNNY'S RECOMMENDATION</p>
                            <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>{rs?.name}</p>
                          </div>
                        </div>
                        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', margin: '0 0 16px', lineHeight: 1.6, position: 'relative' }}>{_rec.reason}</p>
                        <button onClick={() => launchSubject(_rec.key)}
                          style={{ background: `linear-gradient(135deg, ${rg1}, ${rg2})`, border: 'none', borderRadius: 11, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 14px ${rg1}55`, transition: 'opacity 0.15s', position: 'relative' }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                        >Start Now →</button>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Today's Plan row */}
                {(() => {
                  const streak = userProgress.streak || 0;
                  const planCards = [
                    {
                      label: "TODAY'S CHALLENGE",
                      title: ADULT_SUBJECTS[_rec.key]?.name || 'Practice Session',
                      sub: 'Sunny recommends this for today',
                      color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE',
                      action: () => launchSubject(_rec.key), cta: 'Start →',
                    },
                    _weakTopics.length > 0 ? {
                      label: 'REVIEW NEEDED',
                      title: _weakTopics[0].topic,
                      sub: `${Math.round(_weakTopics[0].score * 100)}% accuracy — needs work`,
                      color: '#DC2626', bg: '#FEF2F2', border: '#FECACA',
                      action: () => launchSubject(_weakTopics[0].subjKey), cta: 'Review →',
                    } : {
                      label: 'REVIEW',
                      title: 'All caught up!',
                      sub: 'No weak topics right now',
                      color: '#059669', bg: '#F0FDF4', border: '#BBF7D0',
                      action: null, cta: null,
                    },
                    {
                      label: streak > 0 ? `${streak}-DAY STREAK` : 'BUILD STREAK',
                      title: streak >= 7 ? 'On fire! 🔥' : streak > 0 ? `${streak} days strong` : 'Start today',
                      sub: streak >= 7 ? 'Keep the momentum' : streak > 0 ? 'Keep going!' : 'Every session counts',
                      color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA',
                      action: () => launchSubject(_rec.key), cta: streak > 0 ? 'Keep going →' : 'Begin →',
                    },
                  ];
                  return (
                    <div style={{ marginBottom: 18 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', margin: '0 0 9px' }}>TODAY'S PLAN</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 }}>
                        {planCards.map(card => (
                          <div key={card.label} style={{ background: card.bg, borderRadius: 13, border: `1px solid ${card.border}`, padding: '12px 13px' }}>
                            <p style={{ fontSize: 8, fontWeight: 800, color: card.color, letterSpacing: '0.08em', margin: '0 0 5px', opacity: 0.9 }}>{card.label}</p>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: '0 0 3px', lineHeight: 1.3 }}>{card.title}</p>
                            <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 9px', lineHeight: 1.4 }}>{card.sub}</p>
                            {card.action && (
                              <button onClick={card.action} style={{ fontSize: 11, fontWeight: 700, color: card.color, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{card.cta}</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* 4. Ask Sunny command input */}
                <div style={{ marginBottom: 22 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', margin: '0 0 9px' }}>ASK SUNNY</p>
                  <form onSubmit={e => {
                    e.preventDefault();
                    const val = (e.target.elements.askSunny?.value || '').trim();
                    if (!val) return;
                    const v = val.toLowerCase();
                    if (/spanish|french|chinese|japanese|korean|german|arabic|italian|hindi|language|vocab|fluent/i.test(v)) launchSubject('languages');
                    else if (/accent|pronunc/i.test(v)) launchSubject('accent');
                    else if (/interview|job|hire|company|role|behavioral|technical interview/i.test(v)) launchSubject('interview');
                    else if (/resume|cv|cover letter/i.test(v)) launchSubject('resume');
                    else if (/follow.?up|thank.?you email|reply email/i.test(v)) launchSubject('followup');
                    else if (/python|javascript|\bjs\b|code|programming|sql|\bjava\b|verilog|react|coding/i.test(v)) launchSubject('skills');
                    else if (/stock|trade|market|invest|option|crypto|forex|chart/i.test(v)) launchSubject('trading');
                    else if (/coach|health|law|legal|document|life|tax|insurance/i.test(v)) launchSubject('life-coach');
                    else launchSubject(_rec.key);
                    e.target.reset();
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                      <span style={{ padding: '0 12px', fontSize: 17, color: '#6366F1', flexShrink: 0 }}>✦</span>
                      <input
                        name="askSunny"
                        placeholder='Try "Help me prep for a Google interview" or "Practice French"'
                        style={{ flex: 1, padding: '13px 4px', fontSize: 14, border: 'none', outline: 'none', background: 'transparent', color: '#0F172A', fontFamily: sysFont }}
                        onFocus={e => { e.currentTarget.closest('div').style.borderColor = '#6366F1'; }}
                        onBlur={e => { e.currentTarget.closest('div').style.borderColor = '#E5E7EB'; }}
                      />
                      <button type="submit" style={{ margin: 5, padding: '9px 16px', background: '#0F172A', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#334155'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#0F172A'; }}
                      >Ask →</button>
                    </div>
                  </form>
                </div>

                {/* 5. Continue Learning — if a prior session exists */}
                {_recentKey && (() => {
                  const rs = ADULT_SUBJECTS[_recentKey];
                  const [rg1, rg2] = CARD_GRADIENTS[_recentKey];
                  return (
                    <div style={{ marginBottom: 22 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', margin: '0 0 9px' }}>CONTINUE LEARNING</p>
                      <button onClick={() => launchSubject(_recentKey)} style={{
                        display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left',
                        background: '#fff', border: `1px solid ${rg1}28`, borderLeft: `4px solid ${rg1}`,
                        cursor: 'pointer', borderRadius: 13, padding: '13px 16px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        WebkitTapHighlightColor: 'transparent', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 18px ${rg1}25`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none'; }}
                      >
                        <div style={{ width: 42, height: 42, borderRadius: 11, background: `linear-gradient(135deg, ${rg1}, ${rg2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                          {rs.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: rg1, margin: '0 0 2px', letterSpacing: '0.05em' }}>RESUME SESSION</p>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>{rs.name}</p>
                        </div>
                        <span style={{ fontSize: 15, color: rg1, flexShrink: 0 }}>›</span>
                      </button>
                    </div>
                  );
                })()}

                {/* 6. Browse All Tools — subjects secondary to AI guidance */}
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', margin: '0 0 14px' }}>BROWSE ALL TOOLS</p>
                  {WORKSPACE_SECTIONS.map(section => (
                    <div key={section.title} style={{ marginBottom: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                        <div style={{ width: 3, height: 15, borderRadius: 2, background: section.accent, flexShrink: 0 }} />
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#334155', margin: 0 }}>{section.title}</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {section.tools.map(key => {
                          const subj = ADULT_SUBJECTS[key];
                          if (!subj) return null;
                          const [g1, g2] = CARD_GRADIENTS[key] || ['#0891B2', '#06B6D4'];
                          return (
                            <button key={key} onClick={() => launchSubject(key)}
                              style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
                                background: '#fff', border: '1px solid #E5E7EB', borderLeft: `3px solid ${g1}`,
                                cursor: 'pointer', borderRadius: 10, padding: '10px 13px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                WebkitTapHighlightColor: 'transparent', transition: 'all 0.12s' }}
                              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,0.09)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'none'; }}
                            >
                              <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${g1}22, ${g2}14)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                                {subj.icon}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>{subj.name}</p>
                                  {key === 'languages' && activeLang && (
                                    <span style={{ fontSize: 10, fontWeight: 600, color: g1, background: `${g1}14`, padding: '1px 6px', borderRadius: 7 }}>
                                      {activeLang.icon} {activeLang.name} · {cefrCode}
                                    </span>
                                  )}
                                </div>
                                <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>{subj.desc}</p>
                              </div>
                              <span style={{ fontSize: 13, color: '#CBD5E1', flexShrink: 0 }}>›</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 7. Mobile-only AI insights — mirrors right panel for small screens */}
                <div className="adult-insights-mobile">
                  <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', margin: '0 0 9px' }}>AI INSIGHTS</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {[
                      { label: 'Sessions',   value: userProgress.totalActivities || 0, color: '#059669', bg: '#F0FDF4', border: '#BBF7D0', icon: '📚' },
                      { label: 'Day Streak', value: `${userProgress.streak || 0} 🔥`,  color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
                      { label: 'Points',     value: userProgress.totalPoints || 0,     color: '#0891B2', bg: '#F0F9FF', border: '#BAE6FD', icon: '⭐' },
                    ].map(s => (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: s.bg, borderRadius: 11, border: `1px solid ${s.border}` }}>
                        {s.icon && <span style={{ fontSize: 15 }}>{s.icon}</span>}
                        <span style={{ fontSize: 13, color: '#475569', fontWeight: 500, flex: 1 }}>{s.label}</span>
                        <span style={{ fontSize: 17, fontWeight: 800, color: s.color }}>{s.value}</span>
                      </div>
                    ))}
                    {_weakTopics.length > 0 && (
                      <div style={{ padding: '11px 13px', background: '#FFFBEB', borderRadius: 11, border: '1px solid #FDE68A' }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: '#92400E', margin: '0 0 2px', letterSpacing: '0.06em' }}>⚠ REVIEW NEEDED</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#B45309', margin: 0 }}>{_weakTopics[0].topic}</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* ── RIGHT INSIGHTS PANEL — visible ≥1024px ── */}
            <div className="adult-right-panel">
              <div style={{ padding: '22px 16px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>

                <p style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', letterSpacing: '0.03em', margin: '0 0 12px' }}>Today's Progress</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {[
                    { label: 'Sessions',   value: userProgress.totalActivities || 0, color: '#059669', bg: '#F0FDF4', icon: '📚' },
                    { label: 'Day Streak', value: `${userProgress.streak || 0}`,     color: '#EA580C', bg: '#FFF7ED', icon: '🔥' },
                    { label: 'Points',     value: userProgress.totalPoints || 0,     color: '#0891B2', bg: '#F0F9FF', icon: '⭐' },
                  ].map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: s.bg, borderRadius: 12, border: `1px solid ${s.color}22` }}>
                      <span style={{ fontSize: 17 }}>{s.icon}</span>
                      <span style={{ fontSize: 13, color: '#475569', fontWeight: 500, flex: 1 }}>{s.label}</span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</span>
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', letterSpacing: '0.03em', margin: '0 0 12px' }}>AI Insights</p>
                {(() => {
                  const weakTopics = [];
                  Object.values(userProgress.subjects || {}).forEach(s => {
                    Object.entries(s.topicStats || {}).forEach(([topic, stats]) => {
                      if (stats.attempts >= 3 && stats.correct / stats.attempts < 0.5) weakTopics.push(topic);
                    });
                  });
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {weakTopics.length > 0 ? weakTopics.slice(0, 2).map(topic => (
                        <div key={topic} style={{ padding: '12px 14px', background: '#FFFBEB', borderRadius: 12, border: '1px solid #FDE68A' }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#92400E', margin: '0 0 3px', letterSpacing: '0.05em' }}>⚠ REVIEW NEEDED</p>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#B45309', margin: 0 }}>{topic}</p>
                        </div>
                      )) : (
                        <div style={{ padding: '12px 14px', background: '#F0FDF4', borderRadius: 12, border: '1px solid #BBF7D0' }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#065F46', margin: '0 0 3px', letterSpacing: '0.05em' }}>✓ ON TRACK</p>
                          <p style={{ fontSize: 12, color: '#047857', margin: 0 }}>All topics looking good!</p>
                        </div>
                      )}
                      {activeLang && (
                        <div style={{ padding: '12px 14px', background: '#EFF6FF', borderRadius: 12, border: '1px solid #BFDBFE' }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#1E40AF', margin: '0 0 4px', letterSpacing: '0.05em' }}>RECOMMENDED</p>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#1D4ED8', margin: '0 0 2px' }}>{activeLang.icon} {activeLang.name} — {cefrCode}</p>
                          <p style={{ fontSize: 11, color: '#3B82F6', margin: 0 }}>Practice daily for steady progress</p>
                        </div>
                      )}
                      {_recentKey && (
                        <div style={{ padding: '12px 14px', background: '#F5F3FF', borderRadius: 12, border: '1px solid #DDD6FE' }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#5B21B6', margin: '0 0 4px', letterSpacing: '0.05em' }}>SUGGESTED</p>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#6D28D9', margin: '0 0 6px' }}>Resume {ADULT_SUBJECTS[_recentKey]?.name}</p>
                          <button onClick={() => launchSubject(_recentKey)} style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', background: 'rgba(124,58,237,0.08)', border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: 8 }}>Start now →</button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

          </div>{/* end three-panel body */}

          {/* Session Resume Prompt */}
          {showResumePrompt && resumeSessionData && (
            <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 110 }} onClick={() => setShowResumePrompt(false)}>
              <div className="modal-sheet" style={{ width: '100%', background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 20px 40px', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
                <div style={{ width: 40, height: 4, background: '#E2E8F0', borderRadius: 2, margin: '0 auto 20px' }} />
                <p style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Continue where you left off?</p>
                <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24 }}>You have a previous {ADULT_SUBJECTS[resumeSubject]?.name || resumeSubject} session.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={() => {
                      const saved = resumeSessionData;
                      const { conversation: rConv, coachSay: rCoach, studyBoard: rBoard } = trimGoodbye(saved.conversation, saved.currentCoachSay || '', saved.currentStudyBoard || null);
                      setConversation(rConv);
                      setCurrentSubject(resumeSubject);
                      setSelectedTopic(saved.selectedTopic || null);
                      setInterviewJobDesc(saved.interviewJobDesc || '');
                      setInterviewCompany(saved.interviewCompany || '');
                      setInterviewNativeLang(saved.interviewNativeLang || '');
                      setFollowupMode(saved.followupMode || 'thankyou');
                      setFollowupCompany(saved.followupCompany || '');
                      setFollowupNativeLang(saved.followupNativeLang || '');
                      setTradingSymbolInput(saved.tradingSymbolInput || '');
                      setTradingSearchResults(saved.tradingSearchResults || []);
                      setUserAnswer('');
                      setUploadedImage(null);
                      setCurrentCoachSay(rCoach);
                      setCurrentStudyBoard(rBoard);
                      setTranslatedMessages({});
                      justResumedRef.current = true;
                      setShowResumePrompt(false);
                      setScreen('activity');
                    }}
                    style={{ width: '100%', padding: '13px 0', borderRadius: 13, background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Continue Session
                  </button>
                  <button
                    onClick={() => {
                      const k = resumeSubject;
                      localStorage.removeItem(`tutor:session:${userProgress?.name}:${k}`);
                      setShowResumePrompt(false);
                      // Adult subjects
                      if (k === 'skills') setShowSkillsPicker(true);
                      else if (k === 'interview') setShowInterviewSetup(true);
                      else if (k === 'resume') setShowResumeSetup(true);
                      else if (k === 'followup') setShowFollowupSetup(true);
                      else if (k === 'languages') { setCurrentSubject('languages'); setShowTopicSelection(true); }
                      else if (k === 'trading') setShowTradingSetup(true);
                      // Kids subjects
                      else startActivity(k);
                    }}
                    style={{ width: '100%', padding: '13px 0', borderRadius: 13, background: '#F1F5F9', border: 'none', color: '#0F172A', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Start New Session
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Skills Picker Modal */}
          {showSkillsPicker && (
            <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }} onClick={() => setShowSkillsPicker(false)}>
              <div className="modal-sheet" style={{ width: '100%', background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 20px 40px', maxHeight: '70vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ width: 40, height: 4, background: '#E2E8F0', borderRadius: 2, margin: '0 auto 20px' }} />
                <p style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Choose a Skill</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {SKILLS_TOPICS.map(skill => (
                    <button key={skill.id} onClick={() => startSkillsActivity(skill.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 14, background: '#F8FAFC', border: '1.5px solid #E2E8F0', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 24 }}>{skill.icon}</span>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>{skill.name}</p>
                        <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>{skill.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Interview Setup Modal */}
          {showInterviewSetup && (
            <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }} onClick={() => setShowInterviewSetup(false)}>
              <div className="modal-sheet" style={{ width: '100%', background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 20px 40px' }} onClick={e => e.stopPropagation()}>
                <div style={{ width: 40, height: 4, background: '#E2E8F0', borderRadius: 2, margin: '0 auto 20px' }} />
                <p style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Tell me about the role</p>
                <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>I'll research the company and tailor your coaching.</p>
                <input
                  value={interviewCompany}
                  onChange={e => setInterviewCompany(e.target.value)}
                  placeholder="Company name (e.g. Apple, KLA, Google)"
                  style={{ width: '100%', padding: '12px 14px', fontSize: 15, borderRadius: 12, border: '1.5px solid #E2E8F0', marginBottom: 10, boxSizing: 'border-box', outline: 'none' }}
                />
                <select
                  value={interviewNativeLang}
                  onChange={e => setInterviewNativeLang(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', fontSize: 14, borderRadius: 12, border: '1.5px solid #E2E8F0', marginBottom: 10, boxSizing: 'border-box', outline: 'none', background: '#fff', color: interviewNativeLang ? '#0F172A' : '#94A3B8' }}
                >
                  <option value="">My native language — for translation &amp; pronunciation tips (optional)</option>
                  {LANGUAGES.filter(l => l.code !== 'en').map(l => (
                    <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                  ))}
                </select>
                <textarea
                  value={interviewJobDesc}
                  onChange={e => setInterviewJobDesc(e.target.value)}
                  placeholder="Paste the job description, or describe the role and what you know about it…"
                  rows={4}
                  style={{ width: '100%', padding: '12px 14px', fontSize: 15, borderRadius: 12, border: '1.5px solid #E2E8F0', marginBottom: 10, boxSizing: 'border-box', outline: 'none', resize: 'none' }}
                />
                {/* Image upload row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <button onClick={() => interviewCameraRef.current?.click()} title="Take photo of JD"
                    style={{ width: 38, height: 38, borderRadius: 10, background: '#F2F2F7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Camera style={{ width: 18, height: 18, color: '#8E8E93' }} />
                  </button>
                  <input ref={interviewCameraRef} type="file" accept="image/*" capture="environment" onChange={handleInterviewJdImageUpload} style={{ display: 'none' }} />
                  <button onClick={() => interviewFileRef.current?.click()} title="Upload JD image"
                    style={{ width: 38, height: 38, borderRadius: 10, background: '#F2F2F7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Upload style={{ width: 18, height: 18, color: '#8E8E93' }} />
                  </button>
                  <input ref={interviewFileRef} type="file" accept="image/*" onChange={handleInterviewJdImageUpload} style={{ display: 'none' }} />
                  {interviewJdImage ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                      <img src={interviewJdImage} alt="JD" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid #E2E8F0' }} />
                      <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>Image attached</span>
                      <button onClick={() => setInterviewJdImage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#8E8E93', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: '#8E8E93' }}>or snap / upload the job posting</span>
                  )}
                </div>
                <button
                  onClick={() => startInterviewPrep(interviewJobDesc, interviewCompany, interviewJdImage)}
                  disabled={!interviewJobDesc.trim() && !interviewCompany.trim() && !interviewJdImage}
                  style={{ width: '100%', padding: '13px 0', borderRadius: 13, background: (!interviewJobDesc.trim() && !interviewCompany.trim() && !interviewJdImage) ? '#C7C7CC' : 'linear-gradient(135deg, #7C3AED, #4F46E5)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                  Start Coaching →
                </button>
              </div>
            </div>
          )}
          {/* Resume Review Setup Modal */}
          {showResumeSetup && (
            <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }} onClick={() => setShowResumeSetup(false)}>
              <div className="modal-sheet" style={{ width: '100%', background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 20px 40px', maxHeight: '88vh', overflowY: 'auto', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
                <div style={{ width: 40, height: 4, background: '#E2E8F0', borderRadius: 2, margin: '0 auto 20px' }} />
                <p style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Resume Review & Polish</p>
                <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>Share your resume and the job — I'll rewrite it to stand out.</p>

                {/* Resume input */}
                <p style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', letterSpacing: 1, marginBottom: 6 }}>YOUR RESUME</p>
                <textarea
                  value={resumeText}
                  onChange={e => setResumeText(e.target.value)}
                  placeholder="Paste your resume text here…"
                  rows={5}
                  style={{ width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 12, border: '1.5px solid #E2E8F0', marginBottom: 8, boxSizing: 'border-box', outline: 'none', resize: 'none' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <button onClick={() => resumeCameraRef.current?.click()} title="Take photo of resume"
                    style={{ width: 38, height: 38, borderRadius: 10, background: '#F2F2F7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Camera style={{ width: 18, height: 18, color: '#8E8E93' }} />
                  </button>
                  <input ref={resumeCameraRef} type="file" accept="image/*" capture="environment" onChange={handleResumeFileUpload} style={{ display: 'none' }} />
                  <button onClick={() => resumeFileRef.current?.click()} title="Upload resume (PDF, Word .docx, image, or .txt)"
                    style={{ width: 38, height: 38, borderRadius: 10, background: '#F2F2F7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Upload style={{ width: 18, height: 18, color: '#8E8E93' }} />
                  </button>
                  <input ref={resumeFileRef} type="file" accept="image/*,.pdf,.txt,.md,.docx,.doc" onChange={handleResumeFileUpload} style={{ display: 'none' }} />
                  {resumeImage ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                      {resumeImage.includes('application/pdf') ? (
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📄</div>
                      ) : (
                        <img src={resumeImage} alt="Resume" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid #E2E8F0', flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>
                        {resumeImage.includes('application/pdf') ? 'PDF attached' : 'Image attached'}
                      </span>
                      <button onClick={() => setResumeImage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#8E8E93', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: '#8E8E93' }}>Upload PDF, image, or .txt file</span>
                  )}
                </div>

                {/* Job description */}
                <p style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', letterSpacing: 1, marginBottom: 6 }}>TARGET JOB DESCRIPTION <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional but recommended)</span></p>
                <textarea
                  value={resumeJobDesc}
                  onChange={e => setResumeJobDesc(e.target.value)}
                  placeholder="Paste the job description so I can tailor your resume to it…"
                  rows={4}
                  style={{ width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 12, border: '1.5px solid #E2E8F0', marginBottom: 14, boxSizing: 'border-box', outline: 'none', resize: 'none' }}
                />

                <button
                  onClick={() => startResumeReview(resumeText, resumeImage, resumeJobDesc)}
                  disabled={!resumeText.trim() && !resumeImage}
                  style={{ width: '100%', padding: '13px 0', borderRadius: 13, background: (!resumeText.trim() && !resumeImage) ? '#C7C7CC' : 'linear-gradient(135deg, #1D4ED8, #3B82F6)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                  Polish My Resume →
                </button>
              </div>
            </div>
          )}

          {/* Interview Follow-up Setup Modal */}
          {showFollowupSetup && (
            <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }} onClick={() => setShowFollowupSetup(false)}>
              <div className="modal-sheet" style={{ width: '100%', background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 20px 40px', maxHeight: '88vh', overflowY: 'auto', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
                <div style={{ width: 40, height: 4, background: '#E2E8F0', borderRadius: 2, margin: '0 auto 20px' }} />
                <p style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Interview Follow-up</p>
                <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>Write a thank you email or reply to the interviewer.</p>

                {/* Mode toggle */}
                <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 12, padding: 4, marginBottom: 14 }}>
                  {[{ id: 'thankyou', label: 'Thank You Email' }, { id: 'reply', label: 'Reply to Email' }].map(opt => (
                    <button key={opt.id} onClick={() => setFollowupMode(opt.id)}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: followupMode === opt.id ? '#fff' : 'transparent', color: followupMode === opt.id ? '#0F172A' : '#64748B', boxShadow: followupMode === opt.id ? '0 1px 4px rgba(0,0,0,0.10)' : 'none' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                <input
                  value={followupCompany}
                  onChange={e => setFollowupCompany(e.target.value)}
                  placeholder="Company / interviewer name (optional)"
                  style={{ width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 12, border: '1.5px solid #E2E8F0', marginBottom: 10, boxSizing: 'border-box', outline: 'none' }}
                />

                <select
                  value={followupNativeLang}
                  onChange={e => setFollowupNativeLang(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', fontSize: 14, borderRadius: 12, border: '1.5px solid #E2E8F0', marginBottom: followupMode === 'reply' ? 10 : 14, boxSizing: 'border-box', outline: 'none', background: '#fff', color: followupNativeLang ? '#0F172A' : '#94A3B8' }}>
                  <option value="">My native language — for translation (optional)</option>
                  {LANGUAGES.filter(l => l.code !== 'en').map(l => (
                    <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                  ))}
                </select>

                {followupMode === 'reply' && (
                  <>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', letterSpacing: 1, marginBottom: 6 }}>PASTE THE INTERVIEWER'S EMAIL</p>
                    <textarea
                      value={followupEmailText}
                      onChange={e => setFollowupEmailText(e.target.value)}
                      placeholder="Paste the email content here…"
                      rows={5}
                      style={{ width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 12, border: '1.5px solid #E2E8F0', marginBottom: 8, boxSizing: 'border-box', outline: 'none', resize: 'none' }}
                    />
                    <button
                      onClick={async () => { try { const t = await navigator.clipboard.readText(); setFollowupEmailText(t); } catch (e) { /* user denied */ } }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 14 }}>
                      <Upload style={{ width: 14, height: 14 }} /> Paste from Clipboard
                    </button>
                  </>
                )}

                <button
                  onClick={() => startInterviewFollowup(followupMode, followupEmailText, followupCompany)}
                  disabled={followupMode === 'reply' && !followupEmailText.trim() && !followupCompany.trim()}
                  style={{ width: '100%', padding: '13px 0', borderRadius: 13, background: (followupMode === 'reply' && !followupEmailText.trim() && !followupCompany.trim()) ? '#C7C7CC' : 'linear-gradient(135deg, #0F766E, #14B8A6)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                  {followupMode === 'thankyou' ? 'Write Thank You Email →' : 'Help Me Reply →'}
                </button>
              </div>
            </div>
          )}

          {/* Trading Setup Modal */}
          {showTradingSetup && (() => {
            const DESK_STRATEGIES = [
              { id: 'tastytrade-0dte',      firm: 'Tastytrade',  name: '0DTE SPX Spread',        desc: 'Daily credit spread trade ticket with exact strikes' },
              { id: 'citadel-regime',       firm: 'Citadel',     name: 'Market Regime',           desc: 'GREEN/YELLOW/RED regime verdict for premium sellers' },
              { id: 'sig-theta',            firm: 'SIG',         name: 'Theta Decay Dashboard',   desc: 'Hourly P&L schedule and 90-day compounding model' },
              { id: 'twosigma-strikes',     firm: 'Two Sigma',   name: 'Strike Selection',        desc: 'Probability matrix for exact strike placement' },
              { id: 'deshaw-condor',        firm: 'D.E. Shaw',   name: 'Iron Condor Builder',     desc: 'Full condor setup with adjustment protocol' },
              { id: 'janestreet-premarket', firm: 'Jane Street', name: 'Pre-Market Briefing',     desc: '8 AM analysis: what to trade and how today' },
              { id: 'wolverine-risk',       firm: 'Wolverine',   name: 'Risk Management',         desc: 'Hard rules, loss limits, and daily checklist' },
              { id: 'akuna-skew',           firm: 'Akuna',       name: 'Skew Analysis',           desc: 'Exploit put/call mispricing with jade lizards & BWBs' },
              { id: 'peak6-calendar',       firm: 'Peak6',       name: 'Weekly Calendar',         desc: 'Day-by-day action plan Mon–Fri' },
              { id: 'imc-earnings',         firm: 'IMC',         name: 'Earnings IV Crush',       desc: 'Sell premium before earnings, capture the crush' },
              { id: 'optiver-eod',          firm: 'Optiver',     name: 'EOD Theta Scalping',      desc: '2:30–4:00 PM playbook for max decay capture' },
              { id: 'citadel-performance',  firm: 'Citadel',     name: 'Performance Dashboard',   desc: 'Monthly metrics, equity curve & improvement plan' },
            ];
            return (
              <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }} onClick={() => setShowTradingSetup(false)}>
                <div className="modal-sheet" style={{ width: '100%', background: '#fff', borderRadius: '24px 24px 0 0', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                  {/* Fixed header */}
                  <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
                    <div style={{ width: 40, height: 4, background: '#E2E8F0', borderRadius: 2, margin: '0 auto 16px' }} />
                    <p style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Trading & Analysis</p>
                    <p style={{ fontSize: 13, color: '#64748B', marginBottom: 14 }}>Choose a market or strategy to begin.</p>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: 1, marginBottom: 10 }}>ASSET CLASS</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
                      {[
                        { id: 'stocks',       icon: '📈', name: 'Stocks',          desc: 'AAPL, TSLA, NVDA…' },
                        { id: 'crypto',       icon: '₿',  name: 'Crypto',          desc: 'BTC, ETH, altcoins' },
                        { id: 'forex',        icon: '💱', name: 'Forex',           desc: 'EUR/USD, pairs' },
                        { id: 'options',      icon: '🎯', name: 'Options',         desc: 'Calls, puts, Greeks' },
                        { id: 'research',     icon: '🔬', name: 'GS Research',     desc: 'Institutional equity note' },
                        { id: '0dte',         icon: '⚡', name: '0DTE SPX',        desc: 'Quick credit spread ticket' },
                        { id: 'options-desk', icon: '🏛️', name: 'Options Desk',   desc: '12 institutional strategies' },
                        { id: 'agents',       icon: '🤖', name: 'AI Agents',       desc: '6-agent prediction market pipeline' },
                      ].map(ac => (
                        <button key={ac.id} onClick={() => setTradingAssetClass(ac.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12,
                            background: tradingAssetClass === ac.id ? '#EFF6FF' : '#F8FAFC',
                            border: `1.5px solid ${tradingAssetClass === ac.id ? '#3B82F6' : '#E2E8F0'}`,
                            cursor: 'pointer', textAlign: 'left' }}>
                          <span style={{ fontSize: 20 }}>{ac.icon}</span>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>{ac.name}</p>
                            <p style={{ fontSize: 10, color: '#64748B', margin: '1px 0 0' }}>{ac.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Scrollable body */}
                  <div style={{ overflowY: 'auto', padding: '0 20px', flex: 1 }}>
                    {/* Options Desk strategy picker */}
                    {tradingAssetClass === 'options-desk' && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: 1, margin: '4px 0 10px' }}>SELECT STRATEGY</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {DESK_STRATEGIES.map((s, idx) => (
                            <button key={s.id} onClick={() => setTradingOptionsStrategy(s.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                                background: tradingOptionsStrategy === s.id ? '#EFF6FF' : '#F8FAFC',
                                border: `1.5px solid ${tradingOptionsStrategy === s.id ? '#3B82F6' : '#E2E8F0'}`,
                                cursor: 'pointer' }}>
                              <div style={{ width: 28, height: 28, borderRadius: 8, background: tradingOptionsStrategy === s.id ? '#3B82F6' : '#E2E8F0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                color: tradingOptionsStrategy === s.id ? '#fff' : '#64748B', fontSize: 11, fontWeight: 800 }}>
                                {idx + 1}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>{s.name}</p>
                                <p style={{ fontSize: 10, color: '#64748B', margin: '1px 0 0' }}>{s.firm} · {s.desc}</p>
                              </div>
                              {tradingOptionsStrategy === s.id && <span style={{ color: '#3B82F6', fontSize: 16, flexShrink: 0 }}>✓</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Symbol input for non-special modes */}
                    {tradingAssetClass !== '0dte' && tradingAssetClass !== 'options-desk' && tradingAssetClass !== 'agents' && (
                      <input
                        value={tradingSymbolInput}
                        onChange={e => setTradingSymbolInput(e.target.value.toUpperCase())}
                        placeholder={tradingAssetClass === 'research' ? 'Stock symbol — e.g. AAPL, NVDA, TSLA' : 'Specific symbol (optional) — e.g. TSLA, ETH-USD'}
                        style={{ width: '100%', padding: '12px 14px', fontSize: 15, borderRadius: 12, border: '1.5px solid #E2E8F0', marginBottom: 14, boxSizing: 'border-box', outline: 'none' }}
                      />
                    )}
                  </div>
                  {/* Fixed footer button */}
                  <div style={{ padding: '12px 20px 36px', flexShrink: 0 }}>
                    <button
                      onClick={() => {
                        if (tradingAssetClass === 'agents') {
                          setShowTradingSetup(false);
                          startAgentPipeline();
                        } else {
                          startTradingLesson(tradingAssetClass, tradingSymbolInput);
                        }
                      }}
                      style={{ width: '100%', padding: '13px 0', borderRadius: 13, background: tradingAssetClass === 'agents' ? 'linear-gradient(135deg, #1D4ED8, #3B82F6)' : tradingAssetClass === 'options-desk' ? 'linear-gradient(135deg, #1D4ED8, #3B82F6)' : 'linear-gradient(135deg, #15803D, #16A34A)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                      {tradingAssetClass === 'agents' ? 'Launch Pipeline →' : tradingAssetClass === 'research' ? 'Run Analysis →' : tradingAssetClass === '0dte' ? 'Get Trade Setup →' : tradingAssetClass === 'options-desk' ? 'Open Strategy →' : 'Start Lesson →'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

        </div>

        {/* ── Persona Onboarding Modal ─────────────────────────────────────── */}
        {showPersonaOnboarding && (() => {
          const sysF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, system-ui, sans-serif';
          const STEPS = [
            {
              q: 'What best describes you?',
              field: 'type',
              options: [
                { val: 'college', label: 'College Student', desc: 'Taking courses, writing papers, studying for exams' },
                { val: 'professional', label: 'Working Professional', desc: 'Building skills and advancing your career' },
                { val: 'career-changer', label: 'Career Changer', desc: 'Moving into a new field or role' },
                { val: 'exam-candidate', label: 'Exam Candidate', desc: 'Preparing for CPA, bar, or professional certification' },
              ],
            },
            {
              q: "What's your primary goal right now?",
              field: 'goal',
              options: [
                { val: 'course-help', label: 'Course Help', desc: 'Get support for specific college courses' },
                { val: 'exam-prep', label: 'Exam Prep', desc: 'Prepare for CPA, bar exam, or professional certification' },
                { val: 'career-skills', label: 'Career Skills', desc: 'Improve communication, writing, and professional effectiveness' },
                { val: 'interview', label: 'Interview Prep', desc: 'Prepare for job interviews and firm networking' },
              ],
            },
            {
              q: 'What field are you in or targeting?',
              field: 'field',
              options: [
                { val: 'accounting', label: 'Accounting / Finance', desc: 'Accounting, CPA, audit, tax, corporate finance' },
                { val: 'law', label: 'Law / Legal', desc: 'Law school, legal practice, paralegal' },
                { val: 'health', label: 'Medicine / Healthcare', desc: 'Nursing, pharmacy, physical therapy, medical education' },
                { val: 'hardware', label: 'Semiconductor / Hardware', desc: 'RTL design, physical design, FPGA, chip verification, lab debug' },
                { val: 'tech', label: 'Tech / Engineering', desc: 'Software, systems, data science, engineering' },
                { val: 'other', label: 'Other / General', desc: 'Business, consulting, or other fields' },
              ],
            },
          ];
          const step = STEPS[personaStep];
          const handlePersonaAnswer = async (val) => {
            const updated = { ...personaAnswers, [step.field]: val };
            setPersonaAnswers(updated);
            if (personaStep < STEPS.length - 1) {
              setPersonaStep(s => s + 1);
            } else {
              // Save persona and close
              const persona = { ...updated, onboardingComplete: true, completedAt: Date.now() };
              const newProgress = { ...userProgress, persona };
              setUserProgress(newProgress);
              setShowPersonaOnboarding(false);
              setPersonaStep(0);
              setPersonaAnswers({});
              try { await saveUserProgress(newProgress); } catch {}
            }
          };
          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ background: '#fff', borderRadius: 24, padding: '32px 28px', maxWidth: 440, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.22)' }}>
                {/* Progress dots */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
                  {STEPS.map((_, i) => (
                    <div key={i} style={{ width: i === personaStep ? 20 : 8, height: 8, borderRadius: 4, background: i === personaStep ? '#4F46E5' : i < personaStep ? '#A5B4FC' : '#E2E8F0', transition: 'all 0.2s' }} />
                  ))}
                </div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6366F1', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px', fontFamily: sysF }}>
                  {personaStep + 1} of {STEPS.length}
                </p>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 22px', lineHeight: 1.3, fontFamily: sysF }}>{step.q}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {step.options.map(opt => (
                    <button key={opt.val} onClick={() => handlePersonaAnswer(opt.val)} style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 14, border: '1.5px solid #E2E8F0', background: '#FAFBFF', cursor: 'pointer', transition: 'all 0.15s', fontFamily: sysF }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366F1'; e.currentTarget.style.background = '#F5F3FF'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#FAFBFF'; }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', marginBottom: 2 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <button onClick={() => { setShowPersonaOnboarding(false); setPersonaStep(0); setPersonaAnswers({}); }} style={{ marginTop: 18, width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', background: 'none', color: '#94A3B8', fontSize: 13, cursor: 'pointer', fontFamily: sysF }}>
                  Skip for now
                </button>
              </div>
            </div>
          );
        })()}

        <InterpreterOverlay
          open={interpreterOpen}
          onClose={() => setInterpreterOpen(false)}
          speakViaOpenAI={speakViaOpenAI}
          speakViaGemini={speakViaGemini}
          speak={speak}
          dialect={viAccent}
        />
        </>
      );
    }
    // ── END ADULT DASHBOARD ─────────────────────────────────────────────

    return (
      <>
      <div className="app-bg" style={{ height: '100vh', fontFamily: sysFont, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(15,23,42,0.06)', flexShrink: 0,
        }}>
        <div className="dash-center" style={{ padding: '13px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 19, flexShrink: 0,
              boxShadow: '0 0 0 3px rgba(124,58,237,0.14), 0 2px 10px rgba(124,58,237,0.22)',
            }}>
              {userProgress.name[0].toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.2px' }}>
                {isYoung ? `Hi ${userProgress.name}! 👋` : (() => {
                  const h = new Date().getHours();
                  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
                  return `${greeting}, ${userProgress.name}`;
                })()}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#7C3AED', background: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(124,58,237,0.15)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>✦ AI-Powered</span>
                <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>
                  {isYoung ? 'Ready to learn?' : 'Your personal tutor'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={logout} style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px' }}>
            Sign Out
          </button>
        </div>{/* end dash-center */}
        </div>{/* end top bar */}

        {/* Stats row */}
        <div style={{ flexShrink: 0, padding: '12px 0 4px' }}>
        <div className="dash-center" style={{ display: 'flex', gap: 8, padding: '0 16px' }}>
          <div className="stat-tile">
            <p style={{ fontSize: 28, fontWeight: 800, color: '#7C3AED', margin: 0, letterSpacing: '-0.5px' }}>{userProgress.totalPoints}</p>
            <p style={{ fontSize: 10, color: '#94A3B8', margin: '3px 0 0', fontWeight: 600, letterSpacing: '0.03em' }}>⭐ POINTS</p>
          </div>
          <div className="stat-tile">
            <p style={{ fontSize: 28, fontWeight: 800, color: '#2563EB', margin: 0, letterSpacing: '-0.5px' }}>{userProgress.totalActivities}</p>
            <p style={{ fontSize: 10, color: '#94A3B8', margin: '3px 0 0', fontWeight: 600, letterSpacing: '0.03em' }}>📖 SESSIONS</p>
          </div>
          <div className="stat-tile" style={userProgress.streak >= 3 ? { background: 'linear-gradient(135deg, rgba(234,88,12,0.07), rgba(251,146,60,0.05))', borderColor: 'rgba(234,88,12,0.15)' } : {}}>
            <p style={{ fontSize: 28, fontWeight: 800, color: userProgress.streak > 0 ? '#EA580C' : '#CBD5E1', margin: 0, letterSpacing: '-0.5px' }}>
              {userProgress.streak > 0 ? userProgress.streak : '—'}
            </p>
            <p style={{ fontSize: 10, color: '#94A3B8', margin: '3px 0 0', fontWeight: 600, letterSpacing: '0.03em' }}>
              {userProgress.streak >= 3 ? '🔥 STREAK' : userProgress.streak > 0 ? '🔥 DAY STREAK' : '💤 STREAK'}
            </p>
          </div>
        </div>{/* end dash-center */}
        </div>{/* end stats row */}

        {/* Subjects + Homework — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="dash-center" style={{ padding: '8px 16px 32px' }}>

          {/* Subject groupings with Continue Learning strip */}
          {(() => {
            const subjectGroupDefs = [
              { label: 'Core Academics', keys: ['reading', 'writing', 'math', 'science', 'social-studies'] },
              { label: 'STEM', keys: ['chemistry', 'physics', 'programming', 'engineering', 'ai-data-science'] },
              { label: 'Skills', keys: ['spelling', 'logic', 'social', 'study-skills', 'career', 'test-prep'] },
            ];

            // Find most recently practiced subject for AI suggestion
            const lastActiveEntry = Object.entries(userProgress.subjects || {})
              .filter(([k]) => k !== 'languages' && subjects[k] && (userProgress.subjects[k]?.totalAttempts || 0) > 0)
              .sort(([, a], [, b]) => {
                const ts = (s) => Math.max(...Object.values(s.topicStats || {}).map(t => t.lastSeen || 0), 0);
                return ts(b) - ts(a);
              })[0];

            // Compute weak topics across all subjects for AI chips row
            const _weakChipTopics = [];
            Object.values(userProgress.subjects || {}).forEach(s => {
              Object.entries(s.topicStats || {}).forEach(([topic, stats]) => {
                if (stats.attempts >= 3 && stats.correct / stats.attempts < 0.5)
                  _weakChipTopics.push(topic);
              });
            });

            const renderSubjectCard = (subjectKey) => {
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
              const [g1, g2]      = SUBJECT_CARD_GRADIENTS[subjectKey] || ['#4F46E5', '#7C3AED'];
              const SubjectIcon   = typeof subject.icon !== 'string' ? subject.icon : null;

              return (
                <button key={subjectKey} onClick={() => {
                  const savedKey = `tutor:session:${userProgress.name}:${subjectKey}`;
                  let saved = null;
                  try { saved = JSON.parse(localStorage.getItem(savedKey)); } catch {}
                  const savedIsError = saved?.conversation?.length === 1 &&
                    typeof saved.conversation[0]?.content === 'string' &&
                    (saved.conversation[0].content.includes('Something went wrong') ||
                     saved.conversation[0].content.includes('API Error') ||
                     saved.conversation[0].content.includes('server is a bit busy'));
                  if (savedIsError) { localStorage.removeItem(savedKey); saved = null; }
                  if (saved && saved.conversation?.length > 0) {
                    setResumeSubject(subjectKey);
                    setResumeSessionData(saved);
                    setShowResumePrompt(true);
                  } else {
                    startActivity(subjectKey);
                  }
                }} className="subject-card">
                  {/* Gradient header */}
                  <div style={{
                    background: `linear-gradient(135deg, ${g1} 0%, ${g2} 100%)`,
                    padding: '20px 16px 14px', position: 'relative', overflow: 'hidden',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  }}>
                    <div style={{ position: 'absolute', right: -14, top: -14, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.09)' }} />
                    <div style={{ position: 'absolute', right: 6, bottom: -22, width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                    <div>
                      <div className="subject-icon" style={{ marginBottom: 9, lineHeight: 1 }}>
                        {SubjectIcon
                          ? <SubjectIcon style={{ width: 30, height: 30, color: 'rgba(255,255,255,0.95)', display: 'block' }} />
                          : <span style={{ fontSize: 30, display: 'block' }}>{subject.icon}</span>
                        }
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px', lineHeight: 1.2 }}>
                        {t(`subject.${subjectKey}`, uiLang)}
                      </div>
                    </div>
                    {isAdvanced && (
                      <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.92)', background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '3px 7px', flexShrink: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        Advanced
                      </span>
                    )}
                  </div>
                  {/* Card body */}
                  <div style={{ padding: '12px 16px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '68%' }}>
                        {gradeName} · {levelName}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: g1, background: `${g1}1A`, padding: '2px 7px', borderRadius: 8, flexShrink: 0, letterSpacing: '0.02em' }}>
                        Lv.{subjectProgress.level + 1}
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${g1}, ${g2})`, borderRadius: 3, transition: 'width 0.5s ease' }} />
                    </div>
                    {pct > 0 && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4, textAlign: 'right', fontWeight: 500 }}>{pct}%</div>}
                  </div>
                </button>
              );
            };

            return (
              <>
                {/* Smart Mode hero for kids/teens */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #312E81 0%, #4F46E5 60%, #6366F1 100%)',
                    borderRadius: 20, padding: '18px 18px 16px',
                    position: 'relative', overflow: 'hidden',
                    boxShadow: '0 6px 24px rgba(79,70,229,0.30)',
                  }}>
                    <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                      <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(255,255,255,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Sparkles style={{ width: 26, height: 26, color: '#fff' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.60)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>✦ New!</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.15 }}>Smart Mode</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.70)', marginTop: 2 }}>Sunny picks what to learn next!</div>
                      </div>
                      <button onClick={startSmartMode} style={{
                        padding: '10px 16px', borderRadius: 14, flexShrink: 0,
                        background: 'rgba(255,255,255,0.22)',
                        color: '#fff', fontSize: 13, fontWeight: 700,
                        border: '1.5px solid rgba(255,255,255,0.35)', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>Go! →</button>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', margin: '0 0 14px', lineHeight: 1.5 }}>
                      Get homework help, use the interpreter, or translate!
                    </p>
                    {/* Kids quick actions — Homework first, then Interpreter & Translate */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {[
                        ['🎓', 'Homework', 'homework', 'Ask anything'],
                        ['🗣️', 'Interpreter', 'interpreter', 'Live translate'],
                        ['🌍', 'Translate', 'translate', 'Signs & text'],
                      ].map(([icon, label, intent, sub]) => (
                        <button key={intent} onClick={() => intent === 'interpreter' ? setInterpreterOpen(true) : startSmartModeWithIntent(intent)} style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          padding: '14px 8px 12px', borderRadius: 14,
                          background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.28)',
                          color: '#fff', cursor: 'pointer', minHeight: 72,
                        }}>
                          <span style={{ fontSize: 22 }}>{icon}</span>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{sub}</span>
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                      <button onClick={() => startSmartModeWithIntent('practical')} style={{
                        fontSize: 11, fontWeight: 600, padding: '6px 16px', borderRadius: 20,
                        background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)',
                        color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
                      }}>📄 Document Help</button>
                    </div>
                  </div>
                </div>

                {/* ✦ AI Suggestion — Continue Learning */}
                {lastActiveEntry && (() => {
                  const [lastKey] = lastActiveEntry;
                  const [lg1, lg2] = SUBJECT_CARD_GRADIENTS[lastKey] || ['#4F46E5', '#7C3AED'];
                  const lastData = subjects[lastKey];
                  const lastProgress = userProgress.subjects[lastKey];
                  const sgGrade = lastProgress.gradeLevel || getGradeFromAge(userProgress.age);
                  const sgGroup = getAgeGroupForGrade(sgGrade);
                  const lvlName = lastData.levels[sgGroup]?.[lastProgress.level]
                                || lastData.levels[userProgress.ageGroup]?.[lastProgress.level]
                                || 'Beginner';
                  const LastIcon = typeof lastData.icon !== 'string' ? lastData.icon : null;
                  const heroPct = Math.min(Math.round(((lastProgress.correctAnswers || 0) / Math.max((lastProgress.totalAttempts || 0), 1)) * 100), 100);
                  return (
                    <div style={{ marginBottom: 20 }}>
                      <p className="dash-section-label">✦ AI Suggestion — Resume Learning</p>
                      {/* Hero card */}
                      <div style={{
                        background: `linear-gradient(135deg, ${lg1}1A 0%, ${lg2}0F 100%)`,
                        borderRadius: 22, border: `1px solid ${lg1}28`,
                        overflow: 'hidden', position: 'relative',
                        boxShadow: `0 4px 24px ${lg1}14, 0 2px 8px rgba(0,0,0,0.04)`,
                      }}>
                        {/* Decorative circles */}
                        <div style={{ position: 'absolute', right: -30, top: -30, width: 150, height: 150, borderRadius: '50%', background: `${lg1}0D`, pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', right: 30, bottom: -50, width: 100, height: 100, borderRadius: '50%', background: `${lg2}09`, pointerEvents: 'none' }} />
                        {/* Main content */}
                        <div style={{ padding: '18px 20px 16px', position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                            {/* 72px icon */}
                            <div style={{ width: 72, height: 72, borderRadius: 20, background: `linear-gradient(135deg, ${lg1}, ${lg2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 6px 22px ${lg1}45` }}>
                              {LastIcon
                                ? <LastIcon style={{ width: 32, height: 32, color: '#fff' }} />
                                : <span style={{ fontSize: 32 }}>{lastData.icon}</span>}
                            </div>
                            {/* Text */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 800, color: lg1, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>Continue Learning</div>
                              <div style={{ fontSize: 21, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.4px', lineHeight: 1.15 }}>{t(`subject.${lastKey}`, uiLang)}</div>
                              <div style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>{lvlName}</div>
                            </div>
                            {/* CTA button */}
                            <button onClick={() => startActivity(lastKey)} style={{ padding: '11px 20px', borderRadius: 14, flexShrink: 0, background: `linear-gradient(135deg, ${lg1}, ${lg2})`, color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: `0 4px 14px ${lg1}45`, fontFamily: sysFont }}>
                              Continue →
                            </button>
                          </div>
                          {/* Progress bar */}
                          <div style={{ height: 5, background: `${lg1}20`, borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${heroPct}%`, background: `linear-gradient(90deg, ${lg1}, ${lg2})`, borderRadius: 3, transition: 'width 0.6s ease' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                            <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>Level {(lastProgress.level || 0) + 1}</span>
                            {heroPct > 0 && <span style={{ fontSize: 10, color: lg1, fontWeight: 700 }}>{heroPct}% accuracy</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* AI context chips — weak topics + streak */}
                {(_weakChipTopics.length > 0 || userProgress.streak > 1) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {_weakChipTopics.slice(0, 2).map(topic => (
                      <span key={topic} style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, background: '#FEF3C7', color: '#92400E', border: '1px solid rgba(146,64,14,0.15)', padding: '5px 12px' }}>
                        ⚠ Review: {topic}
                      </span>
                    ))}
                    {userProgress.streak > 1 && (
                      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, background: 'linear-gradient(135deg, rgba(234,88,12,0.12), rgba(251,146,60,0.08))', color: '#EA580C', border: '1px solid rgba(234,88,12,0.20)', padding: '5px 12px' }}>
                        🔥 {userProgress.streak} day streak — keep it up!
                      </span>
                    )}
                  </div>
                )}

                {/* Subject groups */}
                {subjectGroupDefs.map(group => {
                  const cards = group.keys.map(k => renderSubjectCard(k)).filter(Boolean);
                  if (cards.length === 0) return null;
                  return (
                    <div key={group.label} style={{ marginBottom: 24 }}>
                      <p className="dash-section-label">{group.label}</p>
                      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                        {cards}
                      </div>
                    </div>
                  );
                })}
              </>
            );
          })()}

          {/* Language Learning Card */}
          {(() => {
            const langSubj = userProgress.subjects.languages;
            const preferredLanguage = langSubj?.preferredLanguage;
            const languageLevels = langSubj?.languageLevels || {};
            const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
            const CEFR_NAMES = { A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate', B2: 'Upper-Intermediate', C1: 'Advanced', C2: 'Proficient' };
            const langTopics = advancedTopics.languages || [];
            const activeLang = preferredLanguage ? langTopics.find(l => l.id === preferredLanguage) : null;
            const levelNum = activeLang ? (languageLevels[preferredLanguage] ?? 0) : 0;
            const cefrCode = CEFR[Math.min(Math.floor(levelNum), 5)] || 'A1';
            const cefrName = CEFR_NAMES[cefrCode] || 'Beginner';
            const pct = Math.round((Math.floor(levelNum) / 5) * 100);
            return (
              <div style={{ marginTop: 14 }}>
                <p className="dash-section-label">{t('dashboard.learnLanguage', uiLang)}</p>
                <div className="card-3d" style={{ borderRadius: 18, overflow: 'hidden' }}>
                  {/* Teal gradient header */}
                  <div style={{ background: 'linear-gradient(135deg, #0891B2 0%, #06B6D4 100%)', padding: '14px 18px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
                    <span style={{ fontSize: 30 }}>{activeLang ? activeLang.icon : '🌍'}</span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{activeLang ? activeLang.name : t('dashboard.learnLanguage', uiLang)}</div>
                      {activeLang && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '2px 7px' }}>{cefrCode}</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{cefrName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: '14px 18px 18px' }}>
                    {activeLang ? (
                      <>
                        <div style={{ height: 5, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #0891B2, #06B6D4)', borderRadius: 3 }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => startActivityWithTopic('languages', preferredLanguage)}
                            style={{ flex: 1, padding: '10px 0', borderRadius: 12, background: 'linear-gradient(135deg, #0891B2, #06B6D4)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {t('dashboard.continueLanguage', uiLang)}
                          </button>
                          <button onClick={() => { setCurrentSubject('languages'); setShowTopicSelection(true); }}
                            style={{ padding: '10px 14px', borderRadius: 12, background: '#F1F5F9', border: 'none', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {t('dashboard.switchLanguage', uiLang)}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 12px', fontWeight: 500 }}>
                          {t('dashboard.pickLanguage', uiLang)}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {langTopics.map(lang => (
                            <button key={lang.id} onClick={() => startActivityWithTopic('languages', lang.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 20, background: '#F8FAFC', border: '1.5px solid #E2E8F0', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#0F172A', fontFamily: 'inherit' }}>
                              <span>{lang.icon}</span>
                              <span>{lang.name}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Ask Sunny — AI assistant */}
          <button onClick={startHomeworkHelp}
            style={{ width: '100%', marginTop: 16, padding: '18px 20px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', borderRadius: 20, fontFamily: sysFont, boxSizing: 'border-box', background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)', boxShadow: '0 8px 28px rgba(124,58,237,0.38), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, flexShrink: 0,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
            }}>
              <Sparkles style={{ width: 26, height: 26, color: '#fff' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.2px' }}>
                {isYoung ? 'Ask Sunny Anything!' : 'Ask Sunny'}
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', margin: '4px 0 0', lineHeight: 1.4 }}>
                {isYoung
                  ? 'Science, animals, stories, homework — I know it all!'
                  : 'Homework, coding, science, essays, or exam prep'}
              </p>
            </div>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
              <path d="M1 1l6 6-6 6" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>{/* end dash-center */}
        </div>{/* end scrollable */}
      </div>{/* end app-bg */}

      {/* Session Resume Prompt — kids dashboard */}
      {showResumePrompt && resumeSessionData && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 110 }} onClick={() => setShowResumePrompt(false)}>
          <div className="modal-sheet" style={{ width: '100%', background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 20px 40px', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: '#E2E8F0', borderRadius: 2, margin: '0 auto 20px' }} />
            <p style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Continue where you left off?</p>
            <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24 }}>You have a previous {subjects[resumeSubject]?.name || resumeSubject} session.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => {
                  const saved = resumeSessionData;
                  const { conversation: rConv, coachSay: rCoach, studyBoard: rBoard } = trimGoodbye(saved.conversation, saved.currentCoachSay || '', saved.currentStudyBoard || null);
                  setConversation(rConv);
                  setCurrentSubject(resumeSubject);
                  setSelectedTopic(saved.selectedTopic || null);
                  setUserAnswer('');
                  setUploadedImage(null);
                  setCurrentCoachSay(rCoach);
                  setCurrentStudyBoard(rBoard);
                  setTranslatedMessages({});
                  justResumedRef.current = true;
                  setShowResumePrompt(false);
                  setScreen('activity');
                }}
                style={{ width: '100%', padding: '13px 0', borderRadius: 13, background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
              >
                Continue Session
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem(`tutor:session:${userProgress?.name}:${resumeSubject}`);
                  setShowResumePrompt(false);
                  startActivity(resumeSubject);
                }}
                style={{ width: '100%', padding: '13px 0', borderRadius: 13, background: '#F1F5F9', border: 'none', color: '#0F172A', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
              >
                Start New Session
              </button>
            </div>
          </div>
        </div>
      )}

      <InterpreterOverlay
        open={interpreterOpen}
        onClose={() => setInterpreterOpen(false)}
        speakViaOpenAI={speakViaOpenAI}
        speakViaGemini={speakViaGemini}
        speak={speak}
      />
      </>
    );
  }

// 5.ACTIVITY SCREEN
  if (screen === 'activity' && userProgress && currentSubject) {
    const sysFont = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif';
    const accentColors = { reading: '#3B82F6', writing: '#10B981', math: '#8B5CF6', spelling: '#F59E0B', social: '#EC4899', logic: '#6366F1', languages: '#06B6D4', 'test-prep': '#EF4444', career: '#F97316', skills: '#059669', interview: '#7C3AED', 'life-coach': '#EA580C', resume: '#1D4ED8', followup: '#0F766E', smart: '#6366F1', college: '#4338CA', law: '#9A3412', accounting: '#047857', cpa: '#2563EB', 'pro-coaching': '#9333EA', 'family-medicine': '#DC2626', pharmacy: '#7C3AED', 'physical-therapy': '#059669', nursing: '#3B82F6', 'rtl-design': '#2563EB', 'physical-design': '#047857', 'lab-debug': '#B45309' };
    const accent = accentColors[currentSubject] || '#7C3AED';
    const isAdultSubject = engineIsAdultSubject(currentSubject);

    // Mic is always available for all ages and all subjects — only suppressed when browser lacks speech support
    const isVoiceInputSubject = true;
    // Pro markdown tracks use plain-text AI responses (not JSON), shown directly in chat
    const isProMarkdownSubject = ['college', 'law', 'accounting', 'cpa', 'pro-coaching',
      'family-medicine', 'pharmacy', 'physical-therapy', 'nursing',
      'rtl-design', 'physical-design', 'lab-debug'].includes(currentSubject);
    // Chat subjects show full AI messages in the conversation panel
    const isChatSubject = isHomeworkMode || isProMarkdownSubject ||
      ['skills', 'interview', 'life-coach', 'resume', 'followup'].includes(currentSubject);

    // Compute subtitle
    const activitySubtitle = (() => {
      if (currentSubject === 'smart') return 'Learn · Interpret · Translate · Assist';
      if (currentSubject === 'skills') { const s = SKILLS_TOPICS.find(t => t.id === selectedTopic); return s ? `${s.name} — ${s.desc}` : 'Skills Training'; }
      if (currentSubject === 'trading' && selectedTopic === 'options-desk') {
        const DESK_LABELS = { 'tastytrade-0dte': 'Tastytrade · 0DTE SPX', 'citadel-regime': 'Citadel · Market Regime', 'sig-theta': 'SIG · Theta Decay', 'twosigma-strikes': 'Two Sigma · Strike Selection', 'deshaw-condor': 'D.E. Shaw · Iron Condor', 'janestreet-premarket': 'Jane Street · Pre-Market', 'wolverine-risk': 'Wolverine · Risk Management', 'akuna-skew': 'Akuna · Skew Analysis', 'peak6-calendar': 'Peak6 · Weekly Calendar', 'imc-earnings': 'IMC · Earnings IV Crush', 'optiver-eod': 'Optiver · EOD Scalping', 'citadel-performance': 'Citadel · Performance Dashboard' };
        return DESK_LABELS[tradingOptionsStrategy] || 'Options Desk';
      }
      if (currentSubject === 'interview') return selectedTopic && selectedTopic !== 'general' ? `Interview Prep · ${selectedTopic}` : 'Interview Coaching';
      if (currentSubject === 'life-coach') return 'Law · Health · Documents · Life Decisions';
      if (currentSubject === 'resume') return selectedTopic === 'tailored' ? 'Resume Review · Tailored to Job' : 'Resume Review & Polish';
      if (currentSubject === 'followup') return followupMode === 'thankyou' ? `Thank You Email${followupCompany ? ' · ' + followupCompany : ''}` : `Email Reply${followupCompany ? ' · ' + followupCompany : ''}`;
      if (isHomeworkMode) return isYoung ? 'Ask me anything!' : 'Homework · Science · Anything';
      if (isYoung) return 'Let\'s learn together!';
      if (selectedTopic) {
        if (currentSubject === 'languages' && userProgress.subjects[currentSubject]?.languageLevels?.[selectedTopic] !== undefined) {
          const ll = userProgress.subjects[currentSubject].languageLevels[selectedTopic];
          return `${selectedTopic.charAt(0).toUpperCase() + selectedTopic.slice(1)} · ${['Beginner','Elementary','Intermediate','Advanced'][ll] || 'Beginner'}`;
        }
        const tp = (advancedTopics[currentSubject] || ADVANCED_TOPICS[currentSubject])?.find(t => t.id === selectedTopic);
        return tp ? tp.name : selectedTopic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
      const _sp = userProgress.subjects[currentSubject];
      const _sg = _sp?.gradeLevel || getGradeFromAge(userProgress.age);
      const _ag = getAgeGroupForGrade(_sg);
      const _ln = subject?.levels?.[_ag]?.[_sp?.level] || subject?.levels?.[userProgress.ageGroup]?.[_sp?.level] || 'Beginner';
      const _gn = GRADES[_sg]?.name || _sg;
      return `${_gn} · ${_ln} (${(_sp?.level ?? 0) + 1}/${(_sp?.maxLevel ?? 0) + 1})`;
    })();

    const handleExtractLesson = async () => {
      setLessonExtracting(true);
      setLessonError('');
      try {
        const _subj = currentSubject || '';
        const _grade = userProgress?.subjects?.[currentSubject]?.gradeLevel || getGradeFromAge(userProgress?.age || 10);
        const res = await fetch('/api/extract-lesson', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: lessonInputText, subject: _subj, gradeLevel: _grade }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Extraction failed');
        setLessonPreview(data);
      } catch (err) {
        setLessonError(err.message || 'Something went wrong. Try again.');
      } finally {
        setLessonExtracting(false);
      }
    };

    return (
      <div className="app-bg activity-screen-root" style={{ display: 'flex', flexDirection: 'column', fontFamily: sysFont }}>

        {/* Header — paddingTop uses safe-area-inset-top for iPhone notch / Dynamic Island */}
        <div style={{
          background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(15,23,42,0.08)',
          paddingTop: 'max(10px, env(safe-area-inset-top))',
          paddingBottom: 10, paddingLeft: 16, paddingRight: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={goHome} style={{ width: 34, height: 34, borderRadius: '50%', background: '#F2F2F7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Home style={{ width: 16, height: 16, color: '#3C3C43' }} />
            </button>
            {isHomeworkMode ? (
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles style={{ width: 18, height: 18, color: '#7C3AED' }} />
              </div>
            ) : subject && (
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {typeof subject.icon === 'string'
                  ? <span style={{ fontSize: 18 }}>{subject.icon}</span>
                  : <subject.icon style={{ width: 18, height: 18, color: accent }} />}
              </div>
            )}
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>
                {isHomeworkMode ? 'Ask Sunny' : currentSubject === 'smart' ? '✦ Smart Mode' : currentSubject === 'trading' ? 'Options Desk' : subject?.name}
              </p>
              <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>{activitySubtitle}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Trading: quick "Change Topic" chip */}
            {currentSubject === 'trading' && (
              <button onClick={() => setShowTradingSetup(true)}
                style={{ padding: '5px 12px', borderRadius: 20, background: '#EFF6FF', border: '1.5px solid #3B82F6', color: '#1D4ED8', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {selectedTopic === 'options-desk' ? 'Change Strategy' : 'Change Topic'}
              </button>
            )}
            {/* Adult non-trading: New Session button */}
            {isAdultUser && currentSubject !== 'trading' && currentSubject !== 'languages' && (
              <button onClick={() => {
                localStorage.removeItem(`tutor:session:${userProgress?.name}:${currentSubject}`);
                setConversation([]);
                setCurrentCoachSay('');
                setCurrentStudyBoard(null);
                if (currentSubject === 'skills') { setScreen('dashboard'); setShowSkillsPicker(true); }
                else if (currentSubject === 'interview') { setScreen('dashboard'); setShowInterviewSetup(true); }
                else if (currentSubject === 'resume') { setScreen('dashboard'); setShowResumeSetup(true); }
                else if (currentSubject === 'followup') { setScreen('dashboard'); setShowFollowupSetup(true); }
                else if (currentSubject === 'smart') startSmartMode();
                else if (['college','law','accounting','cpa','pro-coaching','family-medicine','pharmacy','physical-therapy','nursing','rtl-design','physical-design','lab-debug'].includes(currentSubject)) { setShowTopicSelection(true); }
                else startLifeCoach();
              }}
                style={{ padding: '5px 12px', borderRadius: 20, background: '#F1F5F9', border: '1.5px solid #CBD5E1', color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                New Session
              </button>
            )}
            {/* Lesson source button — shown for structured subjects only */}
            {!isAdultUser && !isHomeworkMode && !isAdultSubject && (
              <button
                onClick={() => setShowLessonExtractor(true)}
                title="Load source material"
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: lessonContext ? `${accent}18` : '#F2F2F7',
                  border: lessonContext ? `1.5px solid ${accent}60` : 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <BookOpen style={{ width: 15, height: 15, color: lessonContext ? accent : '#8E8E93' }} />
              </button>
            )}
            {/* Streak badge — shown for kids ≤13 when streak ≥ 2 */}
            {ageNum <= AGE_BOUNDARIES.TTS_MAX && !isAdultUser && (() => {
              const streak = userProgress?.subjects?.[currentSubject]?.currentStreak || 0;
              if (streak < 2) return null;
              return (
                <div className="streak-pulse" style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  background: streak >= 5 ? 'linear-gradient(135deg,#FF6B35,#FF9500)' : 'linear-gradient(135deg,#FF9500,#FFCC02)',
                  borderRadius: 20, padding: '4px 10px',
                  fontSize: streak >= 5 ? 15 : 13, fontWeight: 800, color: '#fff',
                  boxShadow: '0 2px 8px rgba(255,149,0,0.4)',
                }}>
                  🔥 {streak}
                </div>
              );
            })()}
            {/* Interpreter indicator — moved to dedicated status bar below header */}
            {/* Vietnamese accent selector — shown when vi is active language OR in interpreter pair */}
            {(userProgress?.language === 'vi') && (currentSubject === 'smart' || currentSubject === 'languages') && (
              <div style={{ display: 'flex', gap: 2 }}>
                {[['N','northern','Hanoi'],['S','southern','Saigon'],['C','central','Hue']].map(([abbr, val, city]) => (
                  <button key={val} title={`${city} accent`} onClick={() => {
                    setViAccent(val);
                    try {
                      localStorage.setItem('tutor:viAccent', val);
                      localStorage.setItem('tutor:viAccent:userChosen', 'true');
                    } catch {}
                  }} style={{
                    width: 24, height: 24, borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 10, fontWeight: 800,
                    background: viAccent === val ? '#0891B2' : '#F2F2F7',
                    color: viAccent === val ? '#fff' : '#8E8E93',
                  }}>{abbr}</button>
                ))}
              </div>
            )}
            {/* TTS button — hidden for very young (always on), toggleable for 10–13 */}
            {userProgress && ageNum > AGE_BOUNDARIES.VOICE_ALWAYS_MAX && ageNum <= AGE_BOUNDARIES.TTS_MAX && synthRef.current && (
              <button onClick={() => setTtsEnabled(!ttsEnabled)}
                style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: ttsEnabled ? accent : '#F2F2F7' }}>
                {ttsEnabled
                  ? <Volume2 style={{ width: 16, height: 16, color: '#fff' }} />
                  : <VolumeX style={{ width: 16, height: 16, color: '#8E8E93' }} />}
              </button>
            )}
            {/* Always-on voice badge for kids ≤9 */}
            {userProgress && ageNum <= AGE_BOUNDARIES.VOICE_ALWAYS_MAX && synthRef.current && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${accent}18`, borderRadius: 20, padding: '4px 10px' }}>
                <Volume2 style={{ width: 13, height: 13, color: accent }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: accent }}>Voice On</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Celebration overlay — canvas confetti on correct answer ── */}
        {!isAdultUser && ageNum <= AGE_BOUNDARIES.TTS_MAX && (
          <ConfettiCanvas trigger={celebrationKey} />
        )}

        {/* Subject accent strip — colored bar under header */}
        <div style={{ height: 3, flexShrink: 0, background: `linear-gradient(90deg, ${accent}, ${accent}70, transparent)` }} />


        {/* Main Content — two columns on iPad, stacked on iPhone */}
        <div className="activity-content">

          {/* Board panel: CoachSay + StudyBoard */}
          <div className="activity-board-panel" ref={boardPanelRef}>
            {!isHomeworkMode && (currentCoachSay || currentStudyBoard) && (
              <>
                {currentCoachSay && (() => {
                  // For spelling, filter out any message that contains the word to spell
                  // (prevents AI from revealing the word as visible text)
                  if (currentSubject === 'spelling' && currentStudyBoard) {
                    const word = currentStudyBoard.correctAnswer || currentStudyBoard.audioPrompt || '';
                    if (word && currentCoachSay.toLowerCase().includes(word.toLowerCase())) return null;
                  }
                  const showLangCoachTranslate = isAdultUser && currentSubject === 'languages';
                  const _nativeLangCode = userProgress?.language || 'en';
                  const _nativeLangEntry = LANGUAGES.find(l => l.code === _nativeLangCode);
                  const _nativeLangName = _nativeLangEntry?.name || 'English';
                  const _nativeLangFlag = _nativeLangEntry?.flag || '';
                  return (
                    <div>
                      <CoachSay message={currentCoachSay} isYoung={isYoung} isSpeaking={isSpeaking} />
                      {showLangCoachTranslate && (
                        <div style={{ paddingLeft: 52, marginTop: 4 }}>
                          <button
                            onClick={() => {
                              if (langCoachTranslation) { setLangCoachTranslation(''); return; }
                              setLangCoachTranslating(true);
                              fetch('/api/chat', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  system: `Translate the following text to ${_nativeLangName}. Return ONLY the translation, nothing else.`,
                                  messages: [{ role: 'user', content: currentCoachSay }]
                                })
                              }).then(r => r.json()).then(data => {
                                const t = data?.content?.[0]?.text || '';
                                if (t) setLangCoachTranslation(t);
                                setLangCoachTranslating(false);
                              }).catch(() => setLangCoachTranslating(false));
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, border: `1px solid ${langCoachTranslation ? '#86EFAC' : '#CBD5E1'}`, background: langCoachTranslation ? '#F0FDF4' : '#F8FAFC', color: langCoachTranslation ? '#166534' : '#6B7280', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: sysFont }}
                          >
                            {langCoachTranslating ? '…' : langCoachTranslation ? `Hide ${_nativeLangFlag}` : `View in ${_nativeLangName} ${_nativeLangFlag}`}
                          </button>
                          {langCoachTranslation && (
                            <div style={{ marginTop: 6, padding: '8px 12px', background: '#F8FAFC', borderRadius: 10, borderLeft: '3px solid #0891B2', fontSize: 13, color: '#334155', lineHeight: 1.5, fontStyle: 'italic' }}>
                              {langCoachTranslation}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {currentStudyBoard && (
                  <StudyBoard
                    key={boardKey}
                    isTransition={boardKey > 1}
                    visual={currentStudyBoard.visual}
                    visualType={currentStudyBoard.visualType}
                    visualColor={currentStudyBoard.visualColor}
                    isYoung={isYoung}
                    wrongAnswer={wrongAnim}
                    onInteraction={handleStudyBoardInteraction}
                    onSubmit={handleStudyBoardSubmit}
                    onRepeat={(currentSubject === 'spelling' || currentSubject === 'reading') && synthRef.current ? () => {
                      if (currentSubject === 'reading') {
                        const sentence = currentStudyBoard.audioPrompt;
                        if (sentence) speak(sentence);
                      } else {
                        const word = currentStudyBoard.audioPrompt || currentStudyBoard.correctAnswer;
                        if (word) speak(`The word is: ${word}. ${word}. Can you spell ${word}?`);
                      }
                    } : undefined}
                    onSpeak={currentSubject === 'languages' && synthRef.current ? () => {
                      const word = currentStudyBoard.visual?.word || currentStudyBoard.correctAnswer;
                      if (word) {
                        const targetLangCode = LANGUAGE_NAME_TO_CODE[selectedTopic] || 'en';
                        speak(`${word}.`, null, targetLangCode);
                      }
                    } : undefined}
                    onReplayAudio={synthRef.current && currentCoachSay ? () => {
                      const replayLang = currentSubject === 'languages'
                        ? (LANGUAGE_NAME_TO_CODE[selectedTopic] || 'en')
                        : 'en';
                      speak(currentCoachSay, null, replayLang);
                    } : undefined}
                  />
                )}
              </>
            )}
          </div>

          {/* Chat panel: messages + input */}
          <div className="activity-chat-panel" role="region" aria-label="Conversation">

          {/* Messages — the ONLY scrollable region on mobile; board panel stays pinned above */}
          <div role="log" aria-live="polite" aria-label="Chat messages" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 12 }}>
            {(() => {
              const sliceStart = Math.max(0, conversation.length - 5);
              return conversation.slice(-5).map((msg, sliceIdx) => {
                const msgKey = sliceStart + sliceIdx;
                // For structured teaching subjects, AI messages are shown in CoachSay+StudyBoard on the board panel.
                // Don't duplicate them in the chat — show only the user's answers here.
                if (!isChatSubject && msg.role === 'assistant') return null;
                return (
              <div key={msgKey} className="msg-in" style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: msg.role === 'user' ? '82%' : '88%',
                  background: msg.role === 'user' ? accent : 'linear-gradient(135deg, rgba(107,127,216,0.065) 0%, rgba(255,255,255,0.97) 100%)',
                  color: msg.role === 'user' ? '#fff' : '#1C1C1E',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  padding: '12px 16px',
                  boxShadow: msg.role === 'user' ? `0 2px 12px ${accent}30` : '0 2px 14px rgba(107,127,216,0.10), 0 1px 4px rgba(0,0,0,0.05)',
                  fontSize: isYoung ? 16 : 15,
                  lineHeight: 1.55,
                  fontFamily: sysFont,
                }}>
                  {msg.image && (
                    <img src={msg.image} alt="Work" style={{ width: '100%', maxWidth: 320, borderRadius: 10, marginBottom: 8, display: 'block' }} />
                  )}
                  {(() => {
                    let display = (msg.content || '').replace(/\[L:\s*(.*?)\]/g, '$1');
                    // For spelling, redact the word from AI messages so it never appears as text
                    if (currentSubject === 'spelling' && msg.role === 'assistant' && currentStudyBoard) {
                      const word = currentStudyBoard.correctAnswer || currentStudyBoard.audioPrompt || '';
                      if (word) {
                        display = display.replace(new RegExp(`\\b${word}\\b`, 'gi'), '___');
                      }
                    }
                    // Pro/health/engineering markdown tracks: render structured markdown
                    if (isProMarkdownSubject && msg.role === 'assistant') {
                      const renderBold = (text) => {
                        const parts = text.split(/\*\*(.*?)\*\*/);
                        return parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p);
                      };
                      return (
                        <div style={{ lineHeight: 1.65 }}>
                          {display.split('\n').map((line, li) => {
                            if (/^\[TOPIC:/.test(line)) return null;
                            if (!line.trim()) return <div key={li} style={{ height: 5 }} />;
                            const hm = line.match(/^(#{1,3}) (.+)/);
                            if (hm) return <div key={li} style={{ fontSize: hm[1].length === 1 ? 15 : 14, fontWeight: 700, color: '#1C1C1E', marginTop: 10, marginBottom: 2 }}>{hm[2]}</div>;
                            if (line === '---') return <div key={li} style={{ height: 1, background: '#E5E5EA', margin: '8px 0' }} />;
                            const bm = line.match(/^[-*] (.+)/);
                            if (bm) return <div key={li} style={{ display: 'flex', gap: 6, marginTop: 3 }}><span style={{ color: accent, flexShrink: 0 }}>•</span><span>{renderBold(bm[1])}</span></div>;
                            const nm = line.match(/^(\d+)\. (.+)/);
                            if (nm) return <div key={li} style={{ display: 'flex', gap: 6, marginTop: 3 }}><span style={{ color: accent, fontWeight: 600, flexShrink: 0 }}>{nm[1]}.</span><span>{renderBold(nm[2])}</span></div>;
                            return <div key={li} style={{ marginTop: 2 }}>{renderBold(line)}</div>;
                          })}
                        </div>
                      );
                    }
                    return <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{display}</p>;
                  })()}
                  {msg.role === 'assistant' && isYoung && synthRef.current && (
                    <button
                      onClick={() => speak(msg.content)}
                      style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: accent, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: sysFont }}
                    >
                      <Volume2 style={{ width: 12, height: 12 }} /> Listen
                    </button>
                  )}
                  {/* Interview: Hear in English + native language translation */}
                  {msg.role === 'assistant' && currentSubject === 'interview' && synthRef.current && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => speak(msg.content, null, 'en')}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: '#F3F0FF', border: '1px solid #C4B5FD', color: '#6D28D9', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: sysFont }}
                      >
                        <Volume2 style={{ width: 12, height: 12 }} /> Hear in English
                      </button>
                      {interviewNativeLang && (
                        <button
                          onClick={() => translateMessage(msgKey, msg.content)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: translatedMessages[msgKey] ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${translatedMessages[msgKey] ? '#86EFAC' : '#CBD5E1'}`, color: translatedMessages[msgKey] ? '#166534' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: sysFont }}
                        >
                          {translatingIdx === msgKey ? '…' : translatedMessages[msgKey] ? `Hide ${LANGUAGES.find(l => l.code === interviewNativeLang)?.flag || ''}` : `View in ${LANGUAGES.find(l => l.code === interviewNativeLang)?.name || interviewNativeLang}`}
                        </button>
                      )}
                    </div>
                  )}
                  {/* Translation bubble — interview */}
                  {msg.role === 'assistant' && currentSubject === 'interview' && translatedMessages[msgKey] && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: '#F8FAFC', borderRadius: 10, borderLeft: '3px solid #7C3AED', fontSize: 13, color: '#334155', lineHeight: 1.5, fontStyle: 'italic' }}>
                      {translatedMessages[msgKey]}
                    </div>
                  )}

                  {/* Language learning: tap to view in native language */}
                  {msg.role === 'assistant' && isAdultUser && currentSubject === 'languages' && (() => {
                    const _nlCode = userProgress?.language || 'en';
                    const _nlEntry = LANGUAGES.find(l => l.code === _nlCode);
                    const _nlName = _nlEntry?.name || 'English';
                    const _nlFlag = _nlEntry?.flag || '';
                    return (
                      <div style={{ marginTop: 6 }}>
                        <button
                          onClick={() => translateMessage(msgKey, msg.content)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: translatedMessages[msgKey] ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${translatedMessages[msgKey] ? '#86EFAC' : '#CBD5E1'}`, color: translatedMessages[msgKey] ? '#166534' : '#475569', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: sysFont }}
                        >
                          {translatingIdx === msgKey ? '…' : translatedMessages[msgKey] ? `Hide ${_nlFlag}` : `View in ${_nlName} ${_nlFlag}`}
                        </button>
                        {translatedMessages[msgKey] && (
                          <div style={{ marginTop: 6, padding: '8px 10px', background: '#F8FAFC', borderRadius: 10, borderLeft: '3px solid #0891B2', fontSize: 13, color: '#334155', lineHeight: 1.5, fontStyle: 'italic' }}>
                            {translatedMessages[msgKey]}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Resume: Copy + Download Word + Save PDF */}
                  {msg.role === 'assistant' && currentSubject === 'resume' && msg.content.length > 100 && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => copyToClipboard(msg.content, msgKey)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 20, background: copiedKey === msgKey ? '#F0FDF4' : '#F1F5F9', border: `1px solid ${copiedKey === msgKey ? '#86EFAC' : '#CBD5E1'}`, color: copiedKey === msgKey ? '#166534' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: sysFont }}>
                        {copiedKey === msgKey ? '✓ Copied!' : 'Copy Text'}
                      </button>
                      <button
                        onClick={() => downloadAsWord(msg.content, 'resume')}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 20, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: sysFont }}>
                        Download Word
                      </button>
                      <button
                        onClick={() => printAsPDF(msg.content, 'Resume')}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 20, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: sysFont }}>
                        Save PDF
                      </button>
                    </div>
                  )}

                  {/* Follow-up: Copy email + optional translate */}
                  {msg.role === 'assistant' && currentSubject === 'followup' && msg.content.length > 60 && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => copyToClipboard(msg.content, msgKey)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 20, background: copiedKey === msgKey ? '#F0FDF4' : '#F0FDFA', border: `1px solid ${copiedKey === msgKey ? '#86EFAC' : '#99F6E4'}`, color: copiedKey === msgKey ? '#166534' : '#0F766E', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: sysFont }}>
                        {copiedKey === msgKey ? '✓ Copied!' : 'Copy Email'}
                      </button>
                      {followupNativeLang && (
                        <button
                          onClick={() => translateMessage(msgKey, msg.content)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 20, background: translatedMessages[msgKey] ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${translatedMessages[msgKey] ? '#86EFAC' : '#CBD5E1'}`, color: translatedMessages[msgKey] ? '#166534' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: sysFont }}>
                          {translatingIdx === msgKey ? '…' : translatedMessages[msgKey] ? `Hide ${LANGUAGES.find(l => l.code === followupNativeLang)?.flag || ''}` : `Translate to ${LANGUAGES.find(l => l.code === followupNativeLang)?.name || followupNativeLang}`}
                        </button>
                      )}
                    </div>
                  )}
                  {/* Translation bubble — followup */}
                  {msg.role === 'assistant' && currentSubject === 'followup' && translatedMessages[msgKey] && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: '#F0FDFA', borderRadius: 10, borderLeft: '3px solid #0F766E', fontSize: 13, color: '#134E4A', lineHeight: 1.5, fontStyle: 'italic' }}>
                      {translatedMessages[msgKey]}
                    </div>
                  )}
                </div>
              </div>
                );
              });
            })()}

            {isLoading && (
              <ThinkingShimmer
                label={undefined}
                accent={accent}
              />
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input Area */}
          {!isLoading && (
            <div style={{ flexShrink: 0, paddingTop: 10 }} className="safe-bottom">
              {/* Hidden file inputs — always rendered for ref access */}
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: 'none' }} />
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
              {/* Upload + listening row */}
              {(
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(107,127,216,0.08)', border: '1px solid rgba(107,127,216,0.14)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Take Photo"
                    aria-label="Take photo"
                  >
                    <Camera style={{ width: 17, height: 17, color: '#6B7FD8' }} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(107,127,216,0.08)', border: '1px solid rgba(107,127,216,0.14)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Upload Image"
                    aria-label="Upload image"
                  >
                    <Upload style={{ width: 17, height: 17, color: '#6B7FD8' }} aria-hidden="true" />
                  </button>
                  <div style={{ flex: 1 }} />
                  {isListening && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(107,127,216,0.08)', borderRadius: 8, padding: '4px 10px' }}>
                      <div className="calm-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: '#6B7FD8' }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#6B7FD8', fontFamily: sysFont }}>Listening...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Image Preview */}
              {uploadedImage && (
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <img src={uploadedImage} alt="Upload" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 12, border: '1px solid #E5E5EA' }} />
                  <button
                    onClick={() => setUploadedImage(null)}
                    aria-label="Remove uploaded image"
                    style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 style={{ width: 14, height: 14, color: '#fff' }} aria-hidden="true" />
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

              {/* Text + Mic + Send — unified glass pill */}
              <div className={isListening ? 'input-breathing' : ''} style={{ display: 'flex', gap: 6, alignItems: 'flex-end', background: 'rgba(255,255,255,0.96)', border: '1.5px solid rgba(107,127,216,0.22)', borderRadius: 20, padding: '4px 4px 4px 14px', boxShadow: '0 2px 16px rgba(107,127,216,0.10), 0 1px 4px rgba(0,0,0,0.04)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease' }}>
                <textarea
                  ref={textareaRef}
                  autoFocus
                  value={userAnswer}
                  onChange={(e) => { setUserAnswer(e.target.value); setIsVoiceInput(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(userAnswer); } }}
                  onFocus={() => { /* iOS: do NOT call scrollIntoView here — it scrolls the document body and pushes the lesson board off-screen. The messages container (overflow-y:auto) is the only scroll context on mobile. */ }}
                  placeholder={speechSupported ? "Tap mic or type..." : "Type your answer..."}
                  rows={2}
                  style={{ flex: 1, padding: '8px 4px', fontSize: 16, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontFamily: sysFont, color: '#1C1C1E', lineHeight: 1.5 }}
                />
                {speechSupported && isVoiceInputSubject && (
                  <button
                    onClick={toggleListening}
                    title={isListening ? "Stop listening" : "Speak your answer"}
                    className={isListening ? 'calm-pulse-shadow' : ''}
                    style={{ width: 42, height: 42, borderRadius: 14, border: 'none', cursor: 'pointer', flexShrink: 0, background: isListening ? '#6B7FD8' : '#F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s ease' }}
                  >
                    {isListening ? <MicOff style={{ width: 18, height: 18, color: '#fff' }} /> : <Mic style={{ width: 18, height: 18, color: '#8E8E93' }} />}
                  </button>
                )}
                <button
                  onClick={() => sendMessage(userAnswer)}
                  disabled={!userAnswer.trim() && !uploadedImage}
                  aria-label="Send message"
                  style={{ width: 42, height: 42, borderRadius: 14, border: 'none', cursor: 'pointer', flexShrink: 0, background: (!userAnswer.trim() && !uploadedImage) ? '#F2F2F7' : `linear-gradient(135deg, ${accent}, ${accent}CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: (!userAnswer.trim() && !uploadedImage) ? 'none' : `0 3px 10px ${accent}40` }}
                >
                  <Send style={{ width: 18, height: 18, color: (!userAnswer.trim() && !uploadedImage) ? '#C7C7CC' : '#fff' }} aria-hidden="true" />
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

        {/* ── Lesson Extractor Modal ── */}
        {showLessonExtractor && (
          <div
            onClick={(e) => { if (e.target === e.currentTarget) { setShowLessonExtractor(false); setLessonPreview(null); } }}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            }}
          >
            <div style={{
              background: '#fff', borderRadius: '24px 24px 0 0',
              paddingBottom: 'env(safe-area-inset-bottom,16px)',
              width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 -8px 48px rgba(0,0,0,0.18)', fontFamily: sysFont,
            }}>
              {/* Handle */}
              <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 36, height: 4, background: '#E5E5EA', borderRadius: 2 }} />
              </div>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 16px' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E' }}>Load Lesson Material</div>
                  <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>Paste text to guide today's lesson</div>
                </div>
                <button
                  onClick={() => { setShowLessonExtractor(false); setLessonPreview(null); }}
                  style={{ width: 30, height: 30, borderRadius: '50%', background: '#F2F2F7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#8E8E93', lineHeight: 1 }}
                >×</button>
              </div>
              <div style={{ padding: '0 20px 24px' }}>
                {!lessonPreview ? (
                  <>
                    <textarea
                      value={lessonInputText}
                      onChange={(e) => { setLessonInputText(e.target.value); setLessonError(''); }}
                      placeholder="Paste your source text here — textbook passage, notes, article, flashcards..."
                      rows={7}
                      style={{
                        width: '100%', borderRadius: 12, border: '1.5px solid #E5E5EA',
                        padding: '12px 14px', fontSize: 15, lineHeight: 1.6,
                        fontFamily: sysFont, color: '#1C1C1E', resize: 'none',
                        background: '#FAFAFA', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                    {lessonError && (
                      <div style={{ fontSize: 13, color: '#EF4444', marginTop: 6 }}>{lessonError}</div>
                    )}
                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                      {lessonContext && (
                        <button
                          onClick={() => { setLessonContext(null); setShowLessonExtractor(false); }}
                          style={{ flex: '0 0 auto', padding: '10px 16px', borderRadius: 12, border: '1.5px solid #E5E5EA', background: '#fff', color: '#EF4444', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: sysFont }}
                        >Clear Lesson</button>
                      )}
                      <button
                        onClick={handleExtractLesson}
                        disabled={lessonExtracting || lessonInputText.trim().length < 50}
                        style={{
                          flex: 1, padding: '12px 20px', borderRadius: 12, border: 'none',
                          background: (lessonExtracting || lessonInputText.trim().length < 50) ? '#E5E5EA' : `linear-gradient(135deg, ${accent}, ${accent}CC)`,
                          color: (lessonExtracting || lessonInputText.trim().length < 50) ? '#8E8E93' : '#fff',
                          fontSize: 15, fontWeight: 700, cursor: (lessonExtracting || lessonInputText.trim().length < 50) ? 'not-allowed' : 'pointer',
                          fontFamily: sysFont,
                        }}
                      >{lessonExtracting ? 'Extracting...' : 'Extract Lesson'}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ background: '#F2F2F7', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', marginBottom: 4 }}>{lessonPreview.title}</div>
                      <div style={{ fontSize: 13, color: '#3C3C43', lineHeight: 1.55 }}>{lessonPreview.explanation}</div>
                    </div>
                    {lessonPreview.vocabulary?.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                          Vocabulary ({lessonPreview.vocabulary.length} words)
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {lessonPreview.vocabulary.map((v, i) => (
                            <div key={i} style={{ background: '#F2F2F7', borderRadius: 10, padding: '8px 12px' }}>
                              <span style={{ fontWeight: 700, color: accent }}>{v.word}</span>
                              <span style={{ color: '#3C3C43', fontSize: 13 }}> — {v.definition}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {lessonPreview.questions?.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                          Questions ({lessonPreview.questions.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {lessonPreview.questions.map((q, i) => (
                            <div key={i} style={{ background: '#F2F2F7', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: '#1C1C1E' }}>
                              {i + 1}. {q.question}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => { setLessonPreview(null); }}
                        style={{ flex: '0 0 auto', padding: '10px 16px', borderRadius: 12, border: '1.5px solid #E5E5EA', background: '#fff', color: '#8E8E93', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: sysFont }}
                      >Redo</button>
                      <button
                        onClick={() => { setLessonContext(lessonPreview); setLessonPreview(null); setLessonInputText(''); setShowLessonExtractor(false); }}
                        style={{
                          flex: 1, padding: '12px 20px', borderRadius: 12, border: 'none',
                          background: 'linear-gradient(135deg, #10B981, #059669)',
                          color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: sysFont,
                        }}
                      >Use This Lesson</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

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
        <InterpreterOverlay
          open={interpreterOpen}
          onClose={() => setInterpreterOpen(false)}
          speakViaOpenAI={speakViaOpenAI}
          speakViaGemini={speakViaGemini}
          speak={speak}
          dialect={viAccent}
        />
      </div>
    );
  }

  return null;
}
