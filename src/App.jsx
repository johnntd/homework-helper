import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Send, Sparkles, BookOpen, Trash2, Home, Mic, MicOff, Star, Trophy, TrendingUp, Brain, Heart, Users, Book, Pencil, Hash, Smile, Lightbulb, Award, BarChart3, Target, Volume2, VolumeX } from 'lucide-react';
import CoachSay from './components/CoachSay';
import StudyBoard from './components/StudyBoard';
import { getSunnySystemPrompt, extractJSON, validateSunnyResponse } from './utils/sunnyPrompts';
import { t } from './utils/translations'; // ADD THIS LINE

// Age boundaries - centralized constants
const AGE_BOUNDARIES = {
  AUTO_SUBMIT_MAX: 6,      // Kids 6 and under get auto-submit
  VERY_YOUNG_MAX: 7,       // Ages 4-7 language learning stage
  YOUNG_MAX: 9,            // Age group 7-9
  MIDDLE_MAX: 12,          // Ages 8-12 language learning stage  
  TEEN_MIN: 13,            // Age group 10-13
  TEEN_MAX: 18             // Ages 13+ language learning stage
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
  const [selectedLanguage, setSelectedLanguage] = useState('en'); // ADD THIS LINE
  const [isVoiceInput, setIsVoiceInput] = useState(false); // Track if answer came from voice
  const autoSubmitTimerRef = useRef(null); // Track auto-submit timer

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
        { question: "What letter is this?", visual: "A", visualType: "letter", level: 0, speak: "What letter is this?" },
        { question: "What sound does this make?", visual: "M", visualType: "letter", level: 1, speak: "What sound does this letter make?" },
        { question: "What word starts with this letter?", visual: "B", visualType: "letter", level: 2, speak: "Tell me a word that starts with B" }
      ],
      '7-9': [
        { question: "What happens in the middle of a story?", level: 1 },
        { question: "Can you summarize a book you read?", level: 3 }
      ]
    },
    'math': {
      '4-6': [
        { question: "Count the frogs!", visual: { count: 3, emoji: '🐸' }, visualType: "emoji", level: 0, speak: "Count the frogs" },
        { question: "How many apples total?", visual: { count1: 3, count2: 2, emoji: '🍎' }, visualType: "addition-emoji", level: 2, speak: "How many apples total?" },
        { question: "Count the stars!", visual: { count: 10, emoji: '⭐' }, visualType: "emoji", level: 3, speak: "Count all the stars" }
      ],
      '7-9': [
        { question: "What is 7 × 8?", level: 1 },
        { question: "What is 1/2 + 1/4?", level: 3 }
      ]
    },
    'writing': {
      '4-6': [
        { question: "Tell me your name!", visualType: "none", level: 0, speak: "What's your name?" },
        { question: "Tell me a story!", visualType: "none", level: 2, speak: "Tell me about your favorite toy" }
      ]
    },
    'spelling': {
      '4-6': [
        { question: "Spell CAT!", visual: "CAT", visualType: "word", level: 1, speak: "Spell CAT" },
        { question: "Spell DOG!", visual: "DOG", visualType: "word", level: 3, speak: "Spell DOG" }
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
            // Auto-retry for no-speech
            setTimeout(() => {
              if (isListening) {
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
      
      // iOS FIX: Initialize speech synthesis with a silent utterance on first user interaction
      // This is required because iOS requires user interaction to enable audio
      const initIOSAudio = () => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
          console.log('iOS detected: Initializing speech synthesis...');
          const silentUtterance = new SpeechSynthesisUtterance('');
          silentUtterance.volume = 0;
          window.speechSynthesis.speak(silentUtterance);
          console.log('iOS speech synthesis initialized');
        }
      };
      
      // Initialize on first click anywhere in the document
      document.addEventListener('click', initIOSAudio, { once: true });
      document.addEventListener('touchstart', initIOSAudio, { once: true });
    }

    loadRecentUsers();
  }, []);

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

  // Autofocus textarea after each response
  useEffect(() => {
    if (textareaRef.current && screen === 'activity' && !isLoading) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [conversation, screen, isLoading]); // Refocus when conversation updates (new response) or screen changes

/*
  const loadUserProgress = async (user) => {
    try {
      const result = await window.storage.get(`user:${user.name}:${user.age}`);
      if (result && result.value) {
        const progress = JSON.parse(result.value);
        setUserProgress(progress);
        
        if (parseInt(user.age) <= 6) {
          setTtsEnabled(true);
        }
        
        setScreen('dashboard');
        console.log('Loaded from persistent storage');
        return;
      }
    } catch (error) {
      console.log('Persistent storage check failed, trying localStorage');
    }

    try {
      const stored = localStorage.getItem(`tutor:${user.name}:${user.age}`);
      if (stored) {
        const progress = JSON.parse(stored);
        setUserProgress(progress);
        
        if (parseInt(user.age) <= 6) {
          setTtsEnabled(true);
        }
        
        setScreen('dashboard');
        console.log('Loaded from localStorage');
        return;
      }
    } catch (error) {
      console.log('localStorage check failed, trying sessionStorage');
    }

    try {
      const stored = sessionStorage.getItem(`tutor:${user.name}:${user.age}`);
      if (stored) {
        const progress = JSON.parse(stored);
        setUserProgress(progress);
        
        if (parseInt(user.age) <= 6) {
          setTtsEnabled(true);
        }
        
        setScreen('dashboard');
        console.log('Loaded from sessionStorage');
        return;
      }
    } catch (error) {
      console.log('sessionStorage check failed');
    }

    if (parseInt(user.age) <= 6) {
      setTtsEnabled(true);
    }
    
    console.log('No saved progress, starting assessment');
    setScreen('assessment');
    startAssessment(user);
  };
  */

  const loadUserProgress = async (user) => {
  let progress = null;
  
  try {
    const result = await window.storage.get(`user:${user.name}:${user.age}`);
    if (result && result.value) {
      progress = JSON.parse(result.value);
      console.log('Loaded from persistent storage');
    }
  } catch (error) {
    console.log('Persistent storage check failed, trying localStorage');
  }

  if (!progress) {
    try {
      const stored = localStorage.getItem(`tutor:${user.name}:${user.age}`);
      if (stored) {
        progress = JSON.parse(stored);
        console.log('Loaded from localStorage');
      }
    } catch (error) {
      console.log('localStorage check failed, trying sessionStorage');
    }
  }

  if (!progress) {
    try {
      const stored = sessionStorage.getItem(`tutor:${user.name}:${user.age}`);
      if (stored) {
        progress = JSON.parse(stored);
        console.log('Loaded from sessionStorage');
      }
    } catch (error) {
      console.log('sessionStorage check failed');
    }
  }

  // MIGRATION: Add new subjects if they don't exist in saved progress
  if (progress) {
    console.log('📥 Loaded progress:', JSON.stringify(progress.subjects, null, 2));
    const ageGroup = getAgeGroup(user.age);
    let needsSave = false;
    
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
          currentStreak: 0
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
      }
    });
    
    // Save migrated progress
    if (needsSave) {
      console.log('💾 Saving migrated progress with new subjects');
      await saveUserProgress(progress);
    }
    
    setUserProgress(progress);
    
    if (parseInt(user.age) <= 6) {
      setTtsEnabled(true);
    }
    
    setScreen('dashboard');
    return;
  }

  // No saved progress - start assessment
  if (parseInt(user.age) <= 6) {
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
  if (parseInt(userProgress.age) <= 6 && firstQuestion.speak) {
    setTimeout(() => speak(firstQuestion.speak), 500);
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
        currentStreak: 0
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
          const toSpeak = questions[0].speak || questions[0].question;
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
          const toSpeak = nextQ.speak || nextQ.question;
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
        const toSpeak = nextQ.speak || nextQ.question;
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
            const toSpeak = questions[0].speak || questions[0].question;
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
    const key = `tutor:${progress.name}:${progress.age}`;
    const data = JSON.stringify(progress);

    try {
      await window.storage.set(`user:${progress.name}:${progress.age}`, data);
      console.log('Saved to persistent storage');
    } catch (error) {
      console.log('Persistent storage failed, trying localStorage');
    }

    try {
      localStorage.setItem(key, data);
      console.log('Saved to localStorage');
    } catch (error) {
      console.log('localStorage failed, trying sessionStorage');
    }

    try {
      sessionStorage.setItem(key, data);
      console.log('Saved to sessionStorage');
    } catch (error) {
      console.log('All storage methods failed');
    }

    loadRecentUsers();
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
          // AT MAX LEVEL - Increase difficulty instead of leveling up
          subject.difficultyBoost = (subject.difficultyBoost || 0) + 1;
          subject.currentStreak = 0;
          console.log(`🎯 Max level reached! Difficulty boost: ${subject.difficultyBoost}`);
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
      
      // Set language dynamically based on user's language
      if (userProgress && userProgress.language) {
        // CRITICAL: For language learning, recognize the TARGET language, not profile language
        let recognitionLang = userProgress.language; // Default: user's profile language
        
        console.log('🔍 Debug: currentSubject =', currentSubject, ', selectedTopic =', selectedTopic, ', userLang =', userProgress.language);
        
        if (currentSubject === 'languages' && selectedTopic) {
          // Learning a language - recognize the TARGET language
          recognitionLang = LANGUAGE_NAME_TO_CODE[selectedTopic] || selectedTopic;
          console.log('🎯 Language learning mode: recognizing', selectedTopic, '->', recognitionLang);
        } else {
          console.log('✅ Regular mode: using profile language', recognitionLang);
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
  
  // iOS FIX: If no voices loaded yet, try to load them
  if (voices.length === 0) {
    console.log('iOS Fix: No voices loaded, requesting voices...');
    // Try to trigger voice loading
    window.speechSynthesis.getVoices();
    
    // Wait a bit and try again
    setTimeout(() => {
      const retryVoices = synthRef.current.getVoices();
      console.log('iOS Fix: Voices after retry:', retryVoices.length);
      if (retryVoices.length > 0) {
        speak(text); // Retry speaking
      }
    }, 100);
    return;
  }
  
  // Get user's language (default to English)
  const userLang = userProgress?.language || 'en';
  
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
const getLanguageName = (code) => {
  const names = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'zh': 'Chinese (Mandarin)',
    'vi': 'Vietnamese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'de': 'German',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ar': 'Arabic',
    'hi': 'Hindi'
  };
  return names[code] || code.toUpperCase();
};

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
    const shouldUseTTS = (ageNum <= AGE_BOUNDARIES.AUTO_SUBMIT_MAX || subjectKey === 'languages') && ttsEnabled && synthRef.current;
    
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
  learningLang: topicId, // For language learning
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
const isLearningForeignLanguage = (userProgress.language || 'en') !== 'en';
const userAge = ageNum;

if (isLearningForeignLanguage) {
  const stage = getLanguageLearningStage(userAge);
  const langName = getLanguageName(userProgress.language || 'en');
  
  const languageTeachingPrompt = `
LANGUAGE: ${langName} | Age ${userAge} | ${stage.focus}
${userAge <= 7 ? 'Ages 4-7: VERBAL ONLY. Listen/repeat 3-5x, songs, visual+verbal, games. NO reading/writing.' : userAge <= 12 ? 'Ages 8-12: Speaking+reading+simple writing. Conversations, simple texts, basic writing.' : 'Ages 13+: All skills. Speaking, listening, reading, writing, grammar, culture.'}
Make it fun, use interests, celebrate wins, little/often.
`;

  systemPrompt += languageTeachingPrompt;
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
    // Special handling for languages - trust Claude to teach well
    if (subjectKey === 'languages') {
      userMessage = level === 0 
        ? `Let's start learning ${topicId}! The student doesn't know any ${topicId} yet, so introduce some basic words naturally and help them practice.`
        : `Continue teaching ${topicId}. The student knows some basics. Build on their knowledge with new vocabulary or simple phrases.`;
    } else {
      // CRITICAL: Include the student's level when teaching topics
      userMessage = `Start teaching ${subject.name} - ${topic.name} at ${levelName} level. The student is at ${levelName} level, so teach ${topic.name} concepts appropriate for that level. Focus on: ${topic.description}. Present a NEW, VARIED question.`;
    }
  } else {
    if (subjectKey === 'languages' && topicId) {
      userMessage = level === 0
        ? `Start teaching ${topicId} to a complete beginner. Introduce some useful basic words and help them practice pronunciation.`
        : `Continue ${topicId} lesson at beginner level. Introduce new vocabulary naturally.`;
    } else {
      userMessage = `Start teaching ${subject.name} at level: ${levelName}. Present a NEW, VARIED question (use random numbers and different objects/scenarios each time).`;
    }
  }
} else {
  if (subjectKey === 'career') {
    userMessage = `Begin career counseling session with ${userProgress.name} (age ${userProgress.age}). Start with a warm introduction, then begin the comprehensive assessment. Remember: be conversational, ask one question at a time, and make this a dialogue, not an interrogation.`;
  } else {
    userMessage = `Start teaching ${subject.name} at level: ${levelName}${difficultyBoost > 0 ? ` (student has MASTERED this level ${difficultyBoost} times - challenge them with HARDER questions!)` : ''}. Present a NEW, VARIED question (use random numbers and different objects/scenarios each time).`;
  }
}

    console.log(`📤 Sending to API: level=${level}, levelName="${levelName}", difficultyBoost=${difficultyBoost}, userMessage="${userMessage.substring(0, 100)}..."`);
    
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userMessage
        }]
      })
    });

    if (!response.ok) {
      console.error('API Error:', response.status, response.statusText);
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
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
      
      const fallbackCoachSay = aiResponseText.substring(0, 140);
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
    // For spelling, speak the word to spell, not the instructions
    if (currentSubject === 'spelling' && sunnyResponse.study_board?.audioWord) {
      // Speak the word clearly, repeat it twice
      speak(`The word is: ${sunnyResponse.study_board.audioWord}. ${sunnyResponse.study_board.audioWord}.`);
    } else if (currentSubject === 'languages' && sunnyResponse.correctAnswer) {
      // For language learning, speak the target WORD (correctAnswer), not visual (might be emoji)
      const targetWord = sunnyResponse.correctAnswer;
      speak(sunnyResponse.coach_say, () => {
        // After instruction finishes, speak the target word 3 times
        speak(`${targetWord}. ${targetWord}. ${targetWord}.`);
      });
    } else {
      speak(sunnyResponse.coach_say);
    }
  }, 500);
}
    }
  } catch (error) {
    console.error('Error:', error);
    
    // Check if it's an overloaded/rate limit error (529, 529, etc.)
    const is529Error = error.message && (error.message.includes('529') || error.message.includes('overload'));
    
    let errorMessage;
    if (is529Error) {
      errorMessage = {
        role: 'assistant',
        content: 'Sunny is thinking really hard right now! 🤔 The server is a bit busy. Please try again in a moment! ⏱️'
      };
    } else {
      errorMessage = {
        role: 'assistant',
        content: 'Oops! Something went wrong. Let\'s try again! 🌟'
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
  const shouldUseTTS = (ageNum <= AGE_BOUNDARIES.AUTO_SUBMIT_MAX || currentSubject === 'languages') && ttsEnabled && synthRef.current;

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
      const level = userProgress.subjects[currentSubject].level;
      const levelName = subject.levels[userProgress.ageGroup][level];
      
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
If correct: Give next ${selectedTopic ? `${advancedTopics[currentSubject]?.find(t => t.id === selectedTopic)?.name || selectedTopic} question at ${levelName} level` : `${subject.name} question`}.
If incorrect: Teach ${selectedTopic ? `${advancedTopics[currentSubject]?.find(t => t.id === selectedTopic)?.name || selectedTopic} concept at ${levelName} level` : `${subject.name} concept`} and retry.`;


    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        system: systemPrompt,
        messages: apiMessages
      })
    });

    if (!response.ok) {
      console.error('API Error:', response.status, response.statusText);
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
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
        
        const fallbackCoachSay = aiResponseText.substring(0, 140);
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
    // For spelling, speak the word to spell, not the instructions
    if (currentSubject === 'spelling' && sunnyResponse.study_board?.audioWord) {
      // Speak the word clearly, repeat it twice
      speak(`The word is: ${sunnyResponse.study_board.audioWord}. ${sunnyResponse.study_board.audioWord}.`);
    } else {
      speak(sunnyResponse.coach_say);
    }
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
    // For spelling, speak the word to spell, not the instructions
    if (currentSubject === 'spelling' && sunnyResponse.study_board?.audioWord) {
      // Speak the word clearly, repeat it twice
      speak(`The word is: ${sunnyResponse.study_board.audioWord}. ${sunnyResponse.study_board.audioWord}.`);
    } else {
      speak(sunnyResponse.coach_say);
    }
  }, 500);
}
    }
      
    setUserAnswer('');
    setUploadedImage(null);
      
  } catch (error) {
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
    setCurrentUser({ name: user.name, age: user.age });
    setUserName(user.name);
    setUserAge(user.age.toString());
    loadUserProgress({ name: user.name, age: user.age });
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

  const logout = () => {
    setCurrentUser(null);
    setUserProgress(null);
    setUserName('');
    setUserAge('');
    setScreen('welcome');
  };

// 1. WELCOME SCREEN
if (screen === 'welcome') {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 flex items-center justify-center p-3 sm:p-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap');
        .bounce { animation: bounce 2s infinite; }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
      `}</style>
      
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-4 sm:p-8">
        <div className="text-center mb-6 sm:mb-8">
          <div className="bounce mb-4">
            <Brain className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-purple-500" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-3 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent" style={{ fontFamily: 'Fredoka, sans-serif' }}>
            {t('welcome.title', selectedLanguage)}
          </h1>
          <p className="text-gray-600 text-lg" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {t('welcome.subtitle', selectedLanguage)}
          </p>
        </div>

        {/* Language Selection */}
        <div className="mb-6">
          <h3 className="text-xl font-bold mb-4 text-center" style={{ fontFamily: 'Fredoka, sans-serif' }}>
            {t('welcome.chooseLang', selectedLanguage)}
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setSelectedLanguage(lang.code)}
                className={`p-4 rounded-xl border-3 transition-all ${
                  selectedLanguage === lang.code
                    ? 'border-purple-500 bg-purple-50 scale-105 shadow-lg'
                    : 'border-gray-200 bg-white hover:border-purple-300'
                }`}
              >
                <div className="text-4xl mb-1">{lang.flag}</div>
                <div className="font-bold text-sm">{lang.nativeName}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {recentUsers.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {t('welcome.continue', selectedLanguage)}
              </h3>
              <div className="space-y-2">
                {recentUsers.map((user, idx) => (
                  <button
                    key={idx}
                    onClick={() => continueAsUser(user)}
                    className="w-full p-4 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-xl border-2 border-purple-200 transition-all text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-purple-900" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                          {user.name}
                        </p>
                        <p className="text-sm text-purple-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          {t('welcome.ageLabel', selectedLanguage).split('?')[0]} {user.age} • {user.totalPoints} {t('dashboard.points', selectedLanguage)}
                        </p>
                      </div>
                      <div className="text-2xl">→</div>
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {t('welcome.orStartNew', selectedLanguage)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {t('welcome.nameLabel', selectedLanguage)}
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder={t('welcome.namePlaceholder', selectedLanguage)}
              className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none text-lg"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {t('welcome.ageLabel', selectedLanguage)}
            </label>
            <input
              type="number"
              value={userAge}
              onChange={(e) => setUserAge(e.target.value)}
              min="4"
              max="18"
              placeholder={t('welcome.agePlaceholder', selectedLanguage)}
              className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none text-lg"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={!userName.trim() || !userAge || parseInt(userAge) < 4 || parseInt(userAge) > 18}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-4 font-bold text-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: 'Fredoka, sans-serif' }}
          >
            {t('welcome.startButton', selectedLanguage)}
          </button>
        </div>
      </div>
    </div>
  );
}

  // 2. ASSESSMENT SCREEN
  if (screen === 'assessment' && currentAssessment && currentUser) {
    const ageNum = parseInt(currentUser.age);
    const isYoung = ageNum <= AGE_BOUNDARIES.YOUNG_MAX;
    const isVeryYoung = ageNum <= AGE_BOUNDARIES.AUTO_SUBMIT_MAX;
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
              {currentQuestion.question}
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
                {isListening ? '🔴 Listening...' : '👆 Tap to Answer'}
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
                      ? '✨ Done!' 
                      : 'Next! →'
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
                  placeholder="Your answer..."
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
                  ? 'Finish Assessment ✨' 
                  : 'Next Question →'
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

  // 4. DASHBOARD SCREEN ← COMES AFTER TOPIC SELECTION
  if (screen === 'dashboard' && userProgress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 p-3 sm:p-6">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap');
        `}</style>

        <div className="max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                {isYoung ? `Hi ${userProgress.name}! 👋` : `Welcome back, ${userProgress.name}!`}
              </h1>
              <p className="text-gray-600 text-lg sm:text-xl" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {isYoung ? 'Ready to learn and have fun? 🌟' : 'Ready to continue your learning journey?'}
              </p>
            </div>
            <button
              onClick={logout}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-semibold"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Switch User
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-xl">
                  <Star className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>Total Points</p>
                  <p className="text-3xl font-bold" style={{ fontFamily: 'Fredoka, sans-serif' }}>{userProgress.totalPoints}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-gradient-to-r from-green-400 to-emerald-400 rounded-xl">
                  <Trophy className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>Activities</p>
                  <p className="text-3xl font-bold" style={{ fontFamily: 'Fredoka, sans-serif' }}>{userProgress.totalActivities}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-xl">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>Streak</p>
                  <p className="text-3xl font-bold" style={{ fontFamily: 'Fredoka, sans-serif' }}>{userProgress.streak} 🔥</p>
                </div>
              </div>
            </div>
          </div>

  {/* Subjects Grid */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
  {Object.keys(subjects).map((subjectKey) => {
    const subject = subjects[subjectKey];
    const subjectProgress = userProgress.subjects[subjectKey];
    
    // Skip if no progress data yet
    if (!subjectProgress) {
      console.warn('Missing progress for subject:', subjectKey);
      return null;
    }
    
    const levelName = subject.levels[userProgress.ageGroup][subjectProgress.level];
    const progressPercent = ((subjectProgress.level + 1) / (subjectProgress.maxLevel + 1)) * 100;

    return (
      <button
        key={subjectKey}
        onClick={() => startActivity(subjectKey)}
        className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all text-left group"
      >
        <div className={`p-4 bg-gradient-to-r ${subject.color} rounded-xl inline-block mb-4 group-hover:scale-110 transition-transform`}>
          {typeof subject.icon === 'string' ? (
            <span className="text-5xl">{subject.icon}</span>
          ) : (
            <subject.icon className="w-10 h-10 text-white" />
          )}
        </div>
        <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Fredoka, sans-serif' }}>
          {subject.name}
        </h3>
        <p className="text-gray-600 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Level: {levelName}
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div 
            className={`h-2 rounded-full bg-gradient-to-r ${subject.color}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-sm text-gray-500" style={{ fontFamily: 'Poppins, sans-serif' }}>
          {subjectProgress.points} points • {subjectProgress.activitiesCompleted} activities
        </p>
      </button>
    );
  })}
</div>

          {/* Homework Help */}
          <button
            onClick={startHomeworkHelp}
            className="w-full bg-gradient-to-r from-orange-400 to-red-400 text-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all"
          >
            <div className="flex items-center justify-center gap-4">
              <Lightbulb className="w-12 h-12" />
              <div className="text-left">
                <h3 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                  {isYoung ? 'Need Help? 🤔' : 'Homework Help'}
                </h3>
                <p className="text-white/90" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {isYoung ? 'Show me your homework!' : 'Get help with any homework question'}
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

// 5.ACTIVITY SCREEN
  if (screen === 'activity' && userProgress && currentSubject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap');
          .message-slide {
            animation: slideIn 0.3s ease-out;
          }
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          /* iOS Safe Area Support */
          @supports (padding: max(0px)) {
            .safe-area-bottom {
              padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
            }
          }
        `}</style>

        <div className="h-screen flex flex-col w-full">
          {/* Header - Fixed at Top */}
          <div className="flex-shrink-0 p-2 sm:p-4">
            <div className="bg-white rounded-2xl shadow-lg p-3 sm:p-4 max-w-7xl mx-auto">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
{!isHomeworkMode && subject && (
  <div className={`p-3 bg-gradient-to-r ${subject.color} rounded-xl`}>
    {typeof subject.icon === 'string' ? (
      <span className="text-3xl">{subject.icon}</span>
    ) : (
      <subject.icon className="w-6 h-6 text-white" />
    )}
  </div>
)}
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-red-600 bg-clip-text text-transparent" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                      {isYoung ? (isHomeworkMode ? 'Homework Helper! 🌟' : `${subject?.name}! 📚`) : (isHomeworkMode ? 'Homework Help' : subject?.name)}
                    </h1>
                    <p className="text-sm text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {isYoung ? (isHomeworkMode ? 'I\'m here to help you!' : 'Let\'s learn together!') : (isHomeworkMode ? 'Get guided assistance' : (() => {
                        // For any subject with a selected topic, show the topic name
                        if (selectedTopic) {
                          // Languages: show language-specific level
                          if (currentSubject === 'languages' && userProgress.subjects[currentSubject]?.languageLevels?.[selectedTopic] !== undefined) {
                            const langLevel = userProgress.subjects[currentSubject].languageLevels[selectedTopic];
                            const levelNames = ['Beginner', 'Elementary', 'Intermediate', 'Advanced'];
                            return `${selectedTopic.charAt(0).toUpperCase() + selectedTopic.slice(1)} - ${levelNames[langLevel] || 'Beginner'}`;
                          }
                          // Other subjects with topics: show topic name
                          const topic = advancedTopics[currentSubject]?.find(t => t.id === selectedTopic);
                          if (topic) {
                            return topic.name;
                          }
                          // Fallback: show topic ID capitalized
                          return selectedTopic.charAt(0).toUpperCase() + selectedTopic.slice(1);
                        }
                        // No topic selected: show subject level
                        return `Level: ${subject?.levels[userProgress.ageGroup][userProgress.subjects[currentSubject].level]}`;
                      })())}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isYoung && synthRef.current && (
                    <button
                      onClick={() => setTtsEnabled(!ttsEnabled)}
                      className={`p-2 rounded-xl transition-colors ${ttsEnabled ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                      title={ttsEnabled ? "Sound ON" : "Sound OFF"}
                    >
                      {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    onClick={goHome}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    <Home className="w-4 h-4" />
                    <span className="text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>Home</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area - Flexible Container */}
          <div className="flex-1 flex flex-col px-2 sm:px-4 pb-2 sm:pb-4 overflow-hidden">
            <div className="bg-white rounded-2xl shadow-lg flex flex-col h-full overflow-hidden max-w-7xl mx-auto w-full">
              
              {/* Sunny Dual-Surface Interface - Sticky at Top */}
              {!isHomeworkMode && (currentCoachSay || currentStudyBoard) && (
                <div className="flex-shrink-0 p-4 bg-white border-b-2 border-gray-100">
                  {currentCoachSay && (
                    <CoachSay 
                      message={currentCoachSay}
                      isYoung={isYoung}
                      color={subject?.color || 'from-purple-400 to-purple-600'}
                    />
                  )}
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
                </div>
              )}
              
              {/* Conversation History - Scrollable Middle */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {conversation.slice(-5).map((msg, idx) => (
                  <div
                    key={idx}
                    className={`message-slide p-3 rounded-xl ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white ml-8'
                        : 'bg-gray-100 mr-8'
                    }`}
                  >
                    {msg.image && (
                      <img src={msg.image} alt="Work" className="w-full max-w-md object-cover rounded-lg mb-2" />
                    )}
                    <div className="flex items-start gap-2">
                      <p className="whitespace-pre-wrap flex-1 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {msg.content}
                      </p>
                      {msg.role === 'assistant' && isYoung && synthRef.current && (
                        <button
                          onClick={() => speak(msg.content)}
                          className="flex-shrink-0 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                          title="Listen again"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="text-center py-8">
                    <div className="inline-block w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Input Area - Sticky at Bottom, ALWAYS VISIBLE */}
              {!isLoading && (
                <div className="flex-shrink-0 p-4 bg-white border-t-2 border-gray-100 safe-area-bottom">
                  {/* Upload Buttons */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl p-3 flex flex-col items-center gap-1 hover:from-blue-600 hover:to-cyan-600 transition-all"
                    >
                      <Camera className="w-6 h-6" />
                      <span className="font-semibold text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {isYoung ? 'Camera 📸' : 'Take Photo'}
                      </span>
                    </button>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-3 flex flex-col items-center gap-1 hover:from-purple-600 hover:to-pink-600 transition-all"
                    >
                      <Upload className="w-6 h-6" />
                      <span className="font-semibold text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {isYoung ? 'Gallery 🖼️' : 'Upload Image'}
                      </span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  {/* Uploaded Image Preview */}
                  {uploadedImage && (
                    <div className="relative mb-3 message-slide">
                      <img src={uploadedImage} alt="Upload" className="w-full rounded-xl border-4 border-gray-200" />
                      <button
                        onClick={() => setUploadedImage(null)}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Listening Indicator */}
                  {isListening && (
                    <div className="mb-3 p-4 bg-red-50 border-2 border-red-300 rounded-xl animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
                        <p className="text-red-700 font-bold" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                          🎤 Listening... Speak now!
                        </p>
                      </div>
                      <p className="text-sm text-red-600 mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Speak clearly and wait for your words to appear below
                      </p>
                    </div>
                  )}

                  {/* Voice Input Detected - Manual Submit Helper */}
                  {!isListening && isVoiceInput && userAnswer && (
                    <div className="mb-3 p-3 bg-green-50 border-2 border-green-400 rounded-xl">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <p className="text-green-700 text-sm font-semibold" style={{ fontFamily: 'Poppins, sans-serif' }}>
                            I heard: <span className="font-bold">"{userAnswer}"</span>
                          </p>
                        </div>
                        {userProgress && parseInt(userProgress.age) > 6 && (
                          <button
                            onClick={() => {
                              sendMessage(userAnswer);
                              setIsVoiceInput(false);
                            }}
                            className="px-4 py-1 bg-green-500 text-white rounded-lg text-sm font-bold hover:bg-green-600 transition-colors"
                            style={{ fontFamily: 'Fredoka, sans-serif' }}
                          >
                            ✓ Send This
                          </button>
                        )}
                      </div>
                      {userProgress && parseInt(userProgress.age) <= 6 && (
                        <p className="text-xs text-green-600 mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          Sending in 1.5 seconds...
                        </p>
                      )}
                    </div>
                  )}

                  {/* Text Input with Mic and Send */}
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      autoFocus
                      value={userAnswer}
                      onChange={(e) => {
                        setUserAnswer(e.target.value);
                        setIsVoiceInput(false); // Reset voice flag when typing
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage(userAnswer);
                        }
                      }}
                      onFocus={(e) => {
                        // iOS keyboard fix - scroll input into view
                        setTimeout(() => {
                          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                      }}
                      placeholder={isYoung ? (speechSupported ? "Tap mic to speak! 🎤 or Type... 💭" : "Type your answer... 💭") : "Type your answer..."}
                      className={`w-full p-3 pr-20 border-2 rounded-xl focus:border-purple-400 focus:outline-none resize-none transition-all ${
                        userAnswer && isYoung && speechSupported 
                          ? 'border-green-400 bg-green-50' 
                          : 'border-gray-200'
                      }`}
                      style={{ fontFamily: 'Poppins, sans-serif', fontSize: '16px' }}
                      rows="2"
                    />
                    
                    <div className="absolute right-2 bottom-2 flex gap-2">
                      {speechSupported && (
                        <button
                          onClick={toggleListening}
                          title={isListening ? "Click to stop listening" : "Click to speak your answer"}
                          className={`p-2 rounded-xl transition-all ${
                            isListening 
                              ? 'bg-red-500 hover:bg-red-600 animate-pulse shadow-lg shadow-red-300' 
                              : 'bg-blue-500 hover:bg-blue-600 shadow-md'
                          } text-white`}
                        >
                          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                      )}
                      
                      <button
                        onClick={() => sendMessage(userAnswer)}
                        disabled={!userAnswer.trim() && !uploadedImage}
                        className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
