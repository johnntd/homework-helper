import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Send, Sparkles, BookOpen, Trash2, Home, Mic, MicOff, Star, Trophy, TrendingUp, Brain, Heart, Users, Book, Pencil, Hash, Smile, Lightbulb, Award, BarChart3, Target, Volume2, VolumeX } from 'lucide-react';
import CoachSay from './components/CoachSay';
import StudyBoard from './components/StudyBoard';
import { getSunnySystemPrompt, extractJSON, validateSunnyResponse } from './utils/sunnyPrompts';

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
  const synthRef = useRef(null);

  // Assessment questions by subject and age group
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
        '4-6': ['ABC Letters', 'Letter Sounds', 'Simple Words', 'Short Sentences'],
        '7-9': ['Reading Fluency', 'Story Elements', 'Main Idea', 'Making Inferences'],
        '10-13': ['Complex Texts', 'Literary Devices', 'Critical Analysis', 'Research Skills'],
        '14-18': ['Advanced Literature', 'Rhetorical Analysis', 'Academic Writing', 'College Prep']
      }
    },
    'writing': {
      name: 'Writing',
      icon: Pencil,
      color: 'from-green-400 to-green-600',
      levels: {
        '4-6': ['Drawing Letters', 'First Words', 'Simple Sentences', 'Short Stories'],
        '7-9': ['Paragraphs', 'Story Writing', 'Descriptive Writing', 'Essay Basics'],
        '10-13': ['Essay Structure', 'Argumentative Writing', 'Research Papers', 'Creative Writing'],
        '14-18': ['Advanced Essays', 'Literary Analysis', 'College Essays', 'Professional Writing']
      }
    },
    'math': {
      name: 'Math',
      icon: Hash,
      color: 'from-purple-400 to-purple-600',
      levels: {
        '4-6': ['Counting 1-10', 'Simple Addition', 'Basic Subtraction', 'Number Recognition'],
        '7-9': ['Multiplication', 'Division', 'Fractions', 'Word Problems'],
        '10-13': ['Algebra Basics', 'Geometry', 'Equations', 'Statistics'],
        '14-18': ['Advanced Algebra', 'Trigonometry', 'Calculus Prep', 'SAT Math']
      }
    },
    'spelling': {
      name: 'Spelling',
      icon: Book,
      color: 'from-yellow-400 to-orange-500',
      levels: {
        '4-6': ['3-Letter Words', '4-Letter Words', 'Simple Phonics', 'Sight Words'],
        '7-9': ['Common Words', 'Vowel Patterns', 'Prefixes/Suffixes', 'Spelling Rules'],
        '10-13': ['Advanced Words', 'Root Words', 'Greek/Latin Roots', 'Vocabulary'],
        '14-18': ['SAT Vocabulary', 'Academic Terms', 'Technical Terms', 'Etymology']
      }
    },
    'social': {
      name: 'Social Skills',
      icon: Users,
      color: 'from-pink-400 to-pink-600',
      levels: {
        '4-6': ['Sharing', 'Taking Turns', 'Being Kind', 'Making Friends'],
        '7-9': ['Teamwork', 'Empathy', 'Conflict Resolution', 'Communication'],
        '10-13': ['Leadership', 'Peer Relationships', 'Self-Awareness', 'Respect'],
        '14-18': ['Networking', 'Professional Skills', 'Emotional Intelligence', 'Cultural Awareness']
      }
    },
    'logic': {
      name: 'Logic & Reasoning',
      icon: Lightbulb,
      color: 'from-indigo-400 to-indigo-600',
      levels: {
        '4-6': ['Patterns', 'Matching', 'Sorting', 'Simple Puzzles'],
        '7-9': ['Logical Sequences', 'Problem Solving', 'Critical Thinking', 'Deduction'],
        '10-13': ['Abstract Reasoning', 'Strategy Games', 'Logic Puzzles', 'Hypothesis Testing'],
        '14-18': ['Formal Logic', 'Scientific Method', 'Philosophical Reasoning', 'Debate Skills']
      }
    }
  };

  const getAgeGroup = (age) => {
    const ageNum = parseInt(age);
    if (ageNum >= 4 && ageNum <= 6) return '4-6';
    if (ageNum >= 7 && ageNum <= 9) return '7-9';
    if (ageNum >= 10 && ageNum <= 13) return '10-13';
    if (ageNum >= 14 && ageNum <= 18) return '14-18';
    return '10-13';
  };

  useEffect(() => {
    // Setup speech recognition
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setUserAnswer(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      setSpeechSupported(true);
    }

    // Setup speech synthesis
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
      
      // Load voices
      const loadVoices = () => {
        window.speechSynthesis.getVoices();
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }

    loadRecentUsers();
  }, []);

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

  const createInitialProgress = (user, levels = {}) => {
    const ageGroup = getAgeGroup(user.age);
    const progress = {
      name: user.name,
      age: user.age,
      ageGroup: ageGroup,
      totalPoints: 0,
      totalActivities: 0,
      streak: 0,
      lastActivity: new Date().toISOString(),
      assessmentCompleted: Object.keys(levels).length > 0,
      subjects: {}
    };

    Object.keys(subjects).forEach(subjectKey => {
      progress.subjects[subjectKey] = {
        level: levels[subjectKey] || 0,
        maxLevel: subjects[subjectKey].levels[ageGroup].length - 1,
        points: 0,
        activitiesCompleted: 0,
        correctAnswers: 0,
        totalAttempts: 0,
        currentStreak: 0
      };
    });

    return progress;
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

  const submitAssessmentAnswer = (answer) => {
    if (!currentAssessment) return;

    const newAnswers = [...currentAssessment.answers, {
      questionIndex: currentAssessment.currentQuestionIndex,
      answer: answer,
      level: currentAssessment.questions[currentAssessment.currentQuestionIndex].level
    }];

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
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Could not start recognition:', error);
      }
    }
  };

  const startListeningNow = () => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
    }
    
    setTimeout(() => {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        console.log('Started listening');
      } catch (error) {
        console.error('Could not start recognition:', error);
      }
    }, 100);
  };

  const speak = (text) => {
    if (!synthRef.current) {
      console.log('Speech synthesis not available');
      return;
    }
    
    if (!ttsEnabled) {
      console.log('TTS is disabled');
      return;
    }

    console.log('Speaking:', text.substring(0, 50) + '...');

    synthRef.current.cancel();

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
    
    if (voices.length > 0) {
      const preferredVoice = voices.find(voice => 
        voice.name.includes('Female') || 
        voice.name.includes('Samantha') ||
        voice.name.includes('Karen') ||
        voice.name.includes('Google') ||
        voice.lang.includes('en-US')
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        console.log('Using voice:', preferredVoice.name);
      } else {
        console.log('Using default voice');
      }
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      console.log('Speech started');
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
      console.log('Speech ended');
    };
    
    utterance.onerror = (event) => {
      setIsSpeaking(false);
      console.error('Speech error:', event);
    };

    try {
      synthRef.current.speak(utterance);
      console.log('Speech queued successfully');
    } catch (error) {
      console.error('Error speaking:', error);
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
    if (subject === 'spelling' || text.includes('spell')) {
      const wordMatch = text.match(/spell ([a-z]+)/i);
      if (wordMatch) {
        return {
          visual: wordMatch[1].toUpperCase(),
          visualType: 'word',
          visualColor: 'purple'
        };
      }
      return {
        visual: 'CAT',
        visualType: 'word',
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

  const startActivity = async (subjectKey) => {
    setIsHomeworkMode(false);
    setCurrentSubject(subjectKey);
    setConversation([]);
    setUserAnswer('');
    setUploadedImage(null);
    setCurrentCoachSay('');
    setCurrentStudyBoard(null);
    setScreen('activity');
    
    const subject = subjects[subjectKey];
    const level = userProgress.subjects[subjectKey].level;
    const levelName = subject.levels[userProgress.ageGroup][level];
    
    setIsLoading(true);

    try {
      const ageNum = parseInt(userProgress.age);
      
      const systemPrompt = getSunnySystemPrompt({
        name: userProgress.name,
        age: ageNum,
        profileLang: 'en',
        learningLang: null,
        hasHistory: userProgress.assessmentCompleted
      });

      const userMessage = `Start teaching ${subject.name} at level: ${levelName}. Present the first question.`;

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

      const data = await response.json();
      const aiResponseText = data.content[0].text;
      
      console.log('AI Response:', aiResponseText);
      
      try {
        const sunnyResponse = extractJSON(aiResponseText);
        validateSunnyResponse(sunnyResponse);
        
        // Intelligent fallback: If no visual provided, create it
        if (!sunnyResponse.study_board || !sunnyResponse.study_board.visual || sunnyResponse.study_board.visualType === 'none') {
          console.log('No visual in response, creating fallback');
          sunnyResponse.study_board = createSmartVisual(sunnyResponse.coach_say, subjectKey);
        }
        
        console.log('Final Sunny Response:', sunnyResponse);
        
        setCurrentCoachSay(sunnyResponse.coach_say);
        setCurrentStudyBoard(sunnyResponse.study_board);
        
        const aiMessage = {
          role: 'assistant',
          content: sunnyResponse.coach_say,
          sunnyData: sunnyResponse
        };
        setConversation([aiMessage]);
        
        if (ageNum <= 6 && ttsEnabled && synthRef.current) {
          setTimeout(() => {
            speak(sunnyResponse.coach_say);
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
        setCurrentStudyBoard(fallbackBoard);
        
        const aiMessage = {
          role: 'assistant',
          content: fallbackCoachSay
        };
        setConversation([aiMessage]);
        
        if (ageNum <= 6 && ttsEnabled && synthRef.current) {
          setTimeout(() => {
            speak(fallbackCoachSay);
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Oops! Something went wrong. Let\'s try again! 🌟'
      };
      setConversation([errorMessage]);
    }

    setIsLoading(false);
  };

  const getSystemPrompt = (subjectKey, levelName, age) => {
    const basePrompts = {
      '4-6': `You are a fun tutor for a little kid (age ${age}). 
CRITICAL RULES:
- Use 1 sentence only (2 max)
- Use BIG emojis to show concepts: 🍎🍎🍎 = 3 apples
- For letters: show them like [A] [B] [C]
- For counting: use emojis 🐸🐸🐸
- For colors/shapes: ⭐ 🔴 🔵 ⬛ 🔺
- Ask ONE simple question
- Super encouraging!

Example good responses:
"Let's count! 🍎🍎🍎 How many apples?"
"What letter? [A]"
"Add them! 🐸🐸 + 🐸 = ?"`,
      '7-9': `You are a helpful tutor for an elementary student (age ${age}).
- Keep it brief (2-3 sentences)
- Use emojis and visuals when helpful
- Ask direct questions
- Be encouraging`,
      '10-13': `You are a tutor for a middle schooler (age ${age}).
- Be concise and direct (3-4 sentences)
- Use clear examples
- Challenge them appropriately
- Stay encouraging`,
      '14-18': `You are a tutor for a high school student (age ${age}).
- Be direct and efficient
- Provide clear explanations
- Challenge their thinking
- Professional but supportive`
    };

    const ageGroup = getAgeGroup(age);
    return `${basePrompts[ageGroup]}

Teaching: ${subjects[subjectKey].name} - ${levelName}

RULES:
- Create ONE quick activity or question
- Guide with hints, don't give answers
- ${age <= 6 ? 'VERY short (1-2 sentences), lots of visual emojis!' : age <= 9 ? 'Short (2-3 sentences)' : 'Concise (3-4 sentences)'}`;
  };

  const sendMessage = async () => {
    if (!userAnswer.trim() && !uploadedImage) return;

    const userMessage = {
      role: 'user',
      content: userAnswer || 'Here is my answer!',
      image: uploadedImage
    };

    setConversation([...conversation, userMessage]);
    setIsLoading(true);

    try {
      const messages = conversation.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      if (uploadedImage) {
        const base64Data = uploadedImage.split(',')[1];
        const mediaType = uploadedImage.split(';')[0].split(':')[1];
        
        messages.push({
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
              text: userAnswer.trim() || 'Here is my work!'
            }
          ]
        });
      } else {
        messages.push({
          role: 'user',
          content: userAnswer.trim()
        });
      }

      const ageNum = parseInt(userProgress.age);
      const subject = subjects[currentSubject];
      const level = userProgress.subjects[currentSubject].level;
      const levelName = subject.levels[userProgress.ageGroup][level];
      
      let systemPrompt;

if (isHomeworkMode) {
  systemPrompt = ageNum <= 6
    ? `You are helping a ${ageNum}-year-old with homework.
- Use 1-2 VERY short sentences
- Simple words
- Guide with questions, don't give answers
- Super encouraging!
- Use lots of emojis`
    : ageNum <= 9
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
  
  // Get subject-specific constraints
  const subjectConstraints = {
    'math': 'ONLY ask math questions: counting, addition, subtraction, numbers. DO NOT ask about letters, spelling, or reading.',
    'reading': 'ONLY ask reading questions: letters, sounds, words. DO NOT ask about math, counting, or numbers.',
    'spelling': 'ONLY ask spelling questions: spell words. DO NOT ask about math or reading.',
    'writing': 'ONLY ask writing questions: sentences, stories. DO NOT ask about math or reading.',
    'social': 'ONLY ask social skills questions: sharing, kindness, friends. DO NOT ask about math or reading.',
    'logic': 'ONLY ask logic questions: patterns, puzzles. DO NOT ask about math or reading.'
  };

  systemPrompt = getSunnySystemPrompt({
    name: userProgress.name,
    age: ageNum,
    profileLang: 'en',
    learningLang: null,
    hasHistory: userProgress.assessmentCompleted
  }) + `\n\n=== CRITICAL SUBJECT CONSTRAINT ===
SUBJECT: ${subject.name}
LEVEL: ${levelName}
${subjectConstraints[currentSubject]}

If you change subjects, the lesson will fail. Stay on ${subject.name} ONLY.

User just answered: "${userAnswer}". 
If correct: Give next ${subject.name} question.
If incorrect: Teach ${subject.name} concept and retry.`;
}
      


      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          system: systemPrompt,
          messages: messages
        })
      });

      const data = await response.json();
      const aiResponseText = data.content[0].text;
      
      if (!isHomeworkMode) {
        try {
          const sunnyResponse = extractJSON(aiResponseText);
          validateSunnyResponse(sunnyResponse);
          
          if (!sunnyResponse.study_board || !sunnyResponse.study_board.visual || sunnyResponse.study_board.visualType === 'none') {
            sunnyResponse.study_board = createSmartVisual(sunnyResponse.coach_say, currentSubject);
          }
          
          setCurrentCoachSay(sunnyResponse.coach_say);
          setCurrentStudyBoard(sunnyResponse.study_board);
          
          const wasCorrect = sunnyResponse.state === 'advance' || 
                           aiResponseText.toLowerCase().includes('correct') || 
                           aiResponseText.toLowerCase().includes('great job');
          await updateProgress(currentSubject, wasCorrect);
          
          const aiMessage = {
            role: 'assistant',
            content: sunnyResponse.coach_say,
            sunnyData: sunnyResponse
          };
          setConversation(prev => [...prev, aiMessage]);
          
          if (ageNum <= 6 && ttsEnabled && synthRef.current) {
            setTimeout(() => {
              speak(sunnyResponse.coach_say);
            }, 500);
          }
        } catch (error) {
          console.error('Failed to parse response, using fallback');
          
          const fallbackCoachSay = aiResponseText.substring(0, 140);
          const fallbackBoard = createSmartVisual(aiResponseText, currentSubject);
          
          setCurrentCoachSay(fallbackCoachSay);
          setCurrentStudyBoard(fallbackBoard);
          
          const wasCorrect = aiResponseText.toLowerCase().includes('correct') || 
                           aiResponseText.toLowerCase().includes('great job');
          await updateProgress(currentSubject, wasCorrect);
          
          const aiMessage = {
            role: 'assistant',
            content: fallbackCoachSay
          };
          setConversation(prev => [...prev, aiMessage]);
          
          if (ageNum <= 6 && ttsEnabled && synthRef.current) {
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

        const aiMessage = {
          role: 'assistant',
          content: aiResponseText
        };

        setConversation(prev => [...prev, aiMessage]);
        
        if (ageNum <= 6 && ttsEnabled && synthRef.current) {
          setTimeout(() => {
            speak(aiResponseText);
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
      setCurrentUser({ name: userName, age: userAge });
      setScreen('dashboard');
    }
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

  // WELCOME SCREEN
  if (screen === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 flex items-center justify-center p-6">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap');
          .bounce { animation: bounce 2s infinite; }
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-15px); }
          }
        `}</style>
        
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="bounce mb-4">
              <Brain className="w-20 h-20 mx-auto text-purple-500" />
            </div>
            <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent" style={{ fontFamily: 'Fredoka, sans-serif' }}>
              Smart Learning
            </h1>
            <p className="text-gray-600 text-lg" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Your Personal AI Tutor
            </p>
          </div>

          <div className="space-y-4">
            {recentUsers.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Continue Learning
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
                            Age {user.age} • {user.totalPoints} points
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
                      or start new
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                What's your name?
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none text-lg"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                How old are you?
              </label>
              <input
                type="number"
                value={userAge}
                onChange={(e) => setUserAge(e.target.value)}
                min="4"
                max="18"
                placeholder="Enter your age (4-18)"
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
              Start Learning! 🚀
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ASSESSMENT SCREEN
  if (screen === 'assessment' && currentAssessment && currentUser) {
    const ageNum = parseInt(currentUser.age);
    const isYoung = ageNum <= 9;
    const isVeryYoung = ageNum <= 6;
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
                className={`h-2 rounded-full bg-gradient-to-r ${subjectInfo.color} transition-all duration-300`}
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

  // DASHBOARD SCREEN
  if (screen === 'dashboard' && userProgress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 p-6">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap');
        `}</style>

        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                {isYoung ? `Hi ${userProgress.name}! 👋` : `Welcome back, ${userProgress.name}!`}
              </h1>
              <p className="text-gray-600 text-xl" style={{ fontFamily: 'Poppins, sans-serif' }}>
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
              const Icon = subject.icon;
              const levelName = subject.levels[userProgress.ageGroup][subjectProgress.level];
              const progressPercent = ((subjectProgress.level + 1) / (subjectProgress.maxLevel + 1)) * 100;

              return (
                <button
                  key={subjectKey}
                  onClick={() => startActivity(subjectKey)}
                  className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all text-left group"
                >
                  <div className={`p-4 bg-gradient-to-r ${subject.color} rounded-xl inline-block mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-10 h-10 text-white" />
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

  // ACTIVITY SCREEN
  if (screen === 'activity' && userProgress && currentSubject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 p-6">
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
        `}</style>

        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  {!isHomeworkMode && subject && (
                    <div className={`p-4 bg-gradient-to-r ${subject.color} rounded-xl`}>
                      <subject.icon className="w-8 h-8 text-white" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-red-600 bg-clip-text text-transparent" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                      {isYoung ? (isHomeworkMode ? 'Homework Helper! 🌟' : `${subject?.name}! 📚`) : (isHomeworkMode ? 'Homework Help' : subject?.name)}
                    </h1>
                    <p className="text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {isYoung ? (isHomeworkMode ? 'I\'m here to help you!' : 'Let\'s learn together!') : (isHomeworkMode ? 'Get guided assistance' : `Level: ${subject?.levels[userProgress.ageGroup][userProgress.subjects[currentSubject].level]}`)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isYoung && synthRef.current && (
                    <button
                      onClick={() => setTtsEnabled(!ttsEnabled)}
                      className={`p-3 rounded-xl transition-colors ${ttsEnabled ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                      title={ttsEnabled ? "Sound ON" : "Sound OFF"}
                    >
                      {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </button>
                  )}
                  <button
                    onClick={goHome}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    <Home className="w-5 h-5" />
                    <span style={{ fontFamily: 'Poppins, sans-serif' }}>Home</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Conversation */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            {/* Sunny Dual-Surface Interface - ALWAYS AT TOP */}
            {!isHomeworkMode && (currentCoachSay || currentStudyBoard) && (
              <div className="mb-6 sticky top-0 bg-white z-10 pb-4 border-b-2 border-gray-100">
                {console.log('RENDERING SUNNY INTERFACE')}
                {console.log('CoachSay:', currentCoachSay)}
                {console.log('StudyBoard:', currentStudyBoard)}
                
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
                    onInteraction={(choice) => setUserAnswer(choice)}
                  />
                )}
              </div>
            )}
            
            {/* Conversation History - Scrollable, shows last 5 messages */}
            <div className="max-h-96 overflow-y-auto mb-6 space-y-4">
              {conversation.slice(-5).map((msg, idx) => (
                <div
                  key={idx}
                  className={`message-slide p-4 rounded-xl ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white ml-8'
                      : 'bg-gray-100 mr-8'
                  }`}
                >
                  {msg.image && (
                    <img src={msg.image} alt="Work" className="w-full max-w-md object-cover rounded-lg mb-2" />
                  )}
                  <div className="flex items-start gap-3">
                    <p className="whitespace-pre-wrap flex-1 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {msg.content}
                    </p>
                    {msg.role === 'assistant' && isYoung && synthRef.current && (
                      <button
                        onClick={() => speak(msg.content)}
                        className="flex-shrink-0 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                        title="Listen again"
                      >
                        <Volume2 className="w-4 h-4" />
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

            {/* Input Area */}
            {!isLoading && (
              <div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl p-4 flex flex-col items-center gap-2"
                  >
                    <Camera className="w-8 h-8" />
                    <span className="font-semibold text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {isYoung ? 'Take Photo 📸' : 'Camera'}
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
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl p-4 flex flex-col items-center gap-2"
                  >
                    <Upload className="w-8 h-8" />
                    <span className="font-semibold text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {isYoung ? 'Upload 📤' : 'Upload File'}
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

                {uploadedImage && (
                  <div className="relative mb-4 message-slide">
                    <img src={uploadedImage} alt="Upload" className="w-full rounded-xl border-4 border-gray-200" />
                    <button
                      onClick={() => setUploadedImage(null)}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}

                <div className="relative">
                  <textarea
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={isYoung ? "Type your answer here... 💭" : "Type your answer..."}
                    className="w-full p-4 pr-24 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none resize-none"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                    rows="3"
                  />
                  
                  <div className="absolute right-2 bottom-2 flex gap-2">
                    {speechSupported && (
                      <button
                        onClick={toggleListening}
                        className={`p-3 rounded-xl transition-all ${
                          isListening 
                            ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                            : 'bg-blue-500 hover:bg-blue-600'
                        } text-white`}
                      >
                        {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                      </button>
                    )}
                    
                    <button
                      onClick={sendMessage}
                      disabled={!userAnswer.trim() && !uploadedImage}
                      className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
                    >
                      <Send className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
