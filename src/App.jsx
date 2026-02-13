import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Send, Sparkles, BookOpen, Trash2, Home, Mic, MicOff, Star, Trophy, TrendingUp, Brain, Heart, Users, Book, Pencil, Hash, Smile, Lightbulb, Award, BarChart3, Target, Volume2, VolumeX } from 'lucide-react';

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
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  // Assessment questions by subject and age group
  const assessmentQuestions = {
    'reading': {
      '4-6': [
        { question: "Can you tell me what letter this is: A?", level: 0 },
        { question: "Can you read this word: CAT?", level: 2 },
        { question: "Can you read: The cat runs fast?", level: 3 }
      ],
      '7-9': [
        { question: "What happens in the middle of a story?", level: 1 },
        { question: "Can you summarize a book you read?", level: 3 }
      ]
    },
    'math': {
      '4-6': [
        { question: "Can you count to 20?", level: 0 },
        { question: "What is 5 + 3?", level: 2 },
        { question: "If you have 10 cookies and eat 4, how many are left?", level: 4 }
      ],
      '7-9': [
        { question: "What is 7 × 8?", level: 1 },
        { question: "What is 1/2 + 1/4?", level: 3 }
      ]
    },
    'writing': {
      '4-6': [
        { question: "Can you write your name?", level: 1 },
        { question: "Can you write a sentence about your favorite toy?", level: 3 }
      ]
    },
    'spelling': {
      '4-6': [
        { question: "Can you spell: CAT?", level: 1 },
        { question: "Can you spell: PLAY?", level: 3 }
      ]
    }
  };

  const subjects = {
    reading: { 
      name: 'Reading', 
      icon: Book,
      color: 'from-blue-400 to-blue-600',
      emoji: '📚',
      levels: {
        '4-6': ['ABC Letters', 'Phonics & Sounds', 'Simple Words', 'Short Sentences', 'Easy Books'],
        '7-9': ['Reading Fluency', 'Comprehension', 'Story Elements', 'Chapter Books', 'Making Inferences'],
        '10-13': ['Advanced Reading', 'Literary Analysis', 'Critical Thinking', 'Research Skills', 'Text Structure'],
        '14-18': ['Literature Analysis', 'Academic Reading', 'Rhetorical Analysis', 'Research & Citation', 'Advanced Comprehension']
      }
    },
    writing: { 
      name: 'Writing', 
      icon: Pencil,
      color: 'from-green-400 to-green-600',
      emoji: '✍️',
      levels: {
        '4-6': ['Drawing Letters', 'Writing Letters', 'Writing Words', 'Simple Sentences', 'Short Stories'],
        '7-9': ['Paragraph Writing', 'Descriptive Writing', 'Story Writing', 'Letter Writing', 'Organization'],
        '10-13': ['Essay Structure', 'Persuasive Writing', 'Research Papers', 'Creative Writing', 'Editing Skills'],
        '14-18': ['Academic Essays', 'Argumentative Writing', 'Literary Analysis', 'Research Papers', 'Advanced Composition']
      }
    },
    math: { 
      name: 'Math', 
      icon: Hash,
      color: 'from-red-400 to-red-600',
      emoji: '🔢',
      levels: {
        '4-6': ['Counting 1-20', 'Counting to 100', 'Adding & Subtracting', 'Shapes & Patterns', 'Simple Word Problems'],
        '7-9': ['Multiplication', 'Division', 'Fractions', 'Decimals', 'Word Problems'],
        '10-13': ['Pre-Algebra', 'Algebra Basics', 'Geometry', 'Statistics', 'Advanced Problem Solving'],
        '14-18': ['Algebra II', 'Geometry & Trig', 'Pre-Calculus', 'Calculus', 'Advanced Math']
      }
    },
    spelling: { 
      name: 'Spelling', 
      icon: Pencil,
      color: 'from-purple-400 to-purple-600',
      emoji: '🔤',
      levels: {
        '4-6': ['3-Letter Words', 'Sight Words', 'Word Families', 'Simple Patterns', 'Common Words'],
        '7-9': ['Multi-syllable Words', 'Prefixes/Suffixes', 'Homophones', 'Spelling Rules', 'Complex Patterns'],
        '10-13': ['Advanced Vocabulary', 'Greek/Latin Roots', 'Technical Terms', 'Spelling Conventions', 'Domain-Specific'],
        '14-18': ['Academic Vocabulary', 'Subject-Specific Terms', 'Etymology', 'Advanced Conventions', 'Professional Writing']
      }
    },
    social: { 
      name: 'Social Skills', 
      icon: Users,
      color: 'from-pink-400 to-pink-600',
      emoji: '🤝',
      levels: {
        '4-6': ['Feelings', 'Sharing', 'Kindness', 'Making Friends', 'Good Manners'],
        '7-9': ['Empathy', 'Teamwork', 'Conflict Resolution', 'Communication', 'Responsibility'],
        '10-13': ['Leadership', 'Peer Relationships', 'Problem Solving', 'Decision Making', 'Self-Awareness'],
        '14-18': ['Emotional Intelligence', 'Collaboration', 'Cultural Awareness', 'Professional Skills', 'Critical Thinking']
      }
    },
    logic: { 
      name: 'Logic & Problem Solving', 
      icon: Lightbulb,
      color: 'from-orange-400 to-orange-600',
      emoji: '🧩',
      levels: {
        '4-6': ['Patterns', 'Sorting', 'Matching', 'Simple Puzzles', 'Shapes & Colors'],
        '7-9': ['Logic Puzzles', 'Word Problems', 'Sequences', 'Strategy Games', 'Critical Thinking'],
        '10-13': ['Deductive Reasoning', 'Problem Solving', 'Logic Challenges', 'Algebra Logic', 'Analytical Thinking'],
        '14-18': ['Advanced Logic', 'Mathematical Reasoning', 'Programming Logic', 'Scientific Method', 'Complex Problem Solving']
      }
    }
  };

  const getAgeGroup = (age) => {
    const ageNum = parseInt(age);
    if (ageNum >= 4 && ageNum <= 6) return '4-6';
    if (ageNum >= 7 && ageNum <= 9) return '7-9';
    if (ageNum >= 10 && ageNum <= 13) return '10-13';
    if (ageNum >= 14 && ageNum <= 18) return '14-18';
    return '7-9';
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setUserAnswer(prev => (prev + ' ' + transcript).trim());
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }

    // Initialize text-to-speech
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

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
        setScreen('dashboard');
      } else {
        // New user - start assessment
        setScreen('assessment');
        startAssessment(user);
      }
    } catch (error) {
      console.log('Storage not available, using session storage');
      // New user - start assessment
      setScreen('assessment');
      startAssessment(user);
    }
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
    } else {
      // No assessment questions for this age/subject, skip to dashboard
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
      // More questions in current subject
      setCurrentAssessment({
        ...currentAssessment,
        currentQuestionIndex: nextQuestionIndex,
        answers: newAnswers
      });
      setUserAnswer('');
    } else {
      // Finished current subject, determine level
      const determinedLevel = determineLevel(newAnswers);
      const newResults = {
        ...assessmentResults,
        [currentAssessment.subject]: determinedLevel
      };
      setAssessmentResults(newResults);

      // Move to next subject
      const subjectKeys = Object.keys(subjects);
      const nextSubjectIndex = assessmentSubjectIndex + 1;

      if (nextSubjectIndex < subjectKeys.length) {
        const nextSubject = subjectKeys[nextSubjectIndex];
        const ageGroup = getAgeGroup(currentUser.age);
        const nextQuestions = assessmentQuestions[nextSubject]?.[ageGroup] || [];

        if (nextQuestions.length > 0) {
          setCurrentAssessment({
            subject: nextSubject,
            questions: nextQuestions,
            currentQuestionIndex: 0,
            answers: []
          });
          setAssessmentSubjectIndex(nextSubjectIndex);
          setUserAnswer('');
        } else {
          // Skip subjects without questions
          finishAssessment(currentUser, newResults);
        }
      } else {
        // All subjects done
        finishAssessment(currentUser, newResults);
      }
    }
  };

  const determineLevel = (answers) => {
    // Simple logic: if they can answer questions at a certain level, set them there
    // Look at the highest level they answered confidently
    if (answers.length === 0) return 0;

    const lastAnswer = answers[answers.length - 1];
    const isConfident = lastAnswer.answer.toLowerCase().includes('yes') || 
                       lastAnswer.answer.toLowerCase().includes('can');

    if (isConfident && lastAnswer.level > 0) {
      return lastAnswer.level;
    }

    // Check previous answers
    for (let i = answers.length - 1; i >= 0; i--) {
      const ans = answers[i];
      const confident = ans.answer.toLowerCase().includes('yes') || 
                       ans.answer.toLowerCase().includes('can');
      if (confident) {
        return ans.level;
      }
    }

    return 0; // Default to level 0
  };

  const finishAssessment = async (user, levels) => {
    const initialProgress = createInitialProgress(user, levels);
    await saveUserProgress(initialProgress);
    setUserProgress(initialProgress);
    setScreen('dashboard');
    setCurrentAssessment(null);
  };

  const saveUserProgress = async (progress) => {
    try {
      await window.storage.set(`user:${progress.name}:${progress.age}`, JSON.stringify(progress));
    } catch (error) {
      console.log('Could not save to persistent storage');
    }
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
      
      const accuracy = subject.correctAnswers / subject.totalAttempts;
      if (accuracy > 0.8 && subject.currentStreak >= 3) {
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
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speak = (text) => {
    if (!synthRef.current || !ttsEnabled) return;

    // Stop any current speech
    synthRef.current.cancel();

    // Remove emojis and clean text
    const cleanText = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.9; // Slightly slower for kids
    utterance.pitch = 1.1; // Slightly higher pitch for friendly tone
    utterance.volume = 1.0;

    // Try to use a child-friendly voice
    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Female') || 
      voice.name.includes('Samantha') ||
      voice.name.includes('Karen')
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
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

  const startActivity = async (subjectKey) => {
    setIsHomeworkMode(false);
    setCurrentSubject(subjectKey);
    setConversation([]);
    setUserAnswer('');
    setUploadedImage(null);
    setScreen('activity');
    
    const subject = subjects[subjectKey];
    const level = userProgress.subjects[subjectKey].level;
    const levelName = subject.levels[userProgress.ageGroup][level];
    
    setIsLoading(true);

    try {
      const ageNum = parseInt(userProgress.age);
      const systemPrompt = getSystemPrompt(subjectKey, levelName, ageNum);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: `Create an engaging ${levelName} activity for ${subject.name}.`
          }]
        })
      });

      const data = await response.json();
      const aiMessage = {
        role: 'assistant',
        content: data.content[0].text
      };
      setConversation([aiMessage]);
      
      // Auto-speak for young kids
      if (parseInt(userProgress.age) <= 6) {
        setTimeout(() => speak(data.content[0].text), 300);
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
- Use 1-2 short sentences
- LOTS of emojis for everything! 🎨🌟✨
- Use visual formatting:
  * Big emojis to show concepts
  * Simple pictures with emojis
  * Number lines with emojis: 🟢🟢🟢
  * Letters in boxes: [A] [B] [C]
- Ask ONE clear question
- Be super encouraging!`,
      '7-9': `You are a helpful tutor for an elementary student (age ${age}).
- Keep it brief (2-3 sentences)
- Use emojis and visual aids
- Format with:
  * Bullet points for lists
  * Number emojis: 1️⃣ 2️⃣ 3️⃣
  * Visual examples with symbols
- Ask direct questions
- Be encouraging`,
      '10-13': `You are a tutor for a middle schooler (age ${age}).
- Be concise and direct (3-4 sentences)
- Use visual formatting when helpful:
  * Bullet points and numbering
  * Simple diagrams with symbols
  * Math equations clearly formatted
- Challenge them appropriately
- Stay encouraging`,
      '14-18': `You are a tutor for a high school student (age ${age}).
- Be direct and efficient
- Use proper formatting:
  * Clear structure with headers
  * Mathematical notation
  * Step-by-step breakdowns
- Challenge their thinking
- Professional but supportive`
    };

    const ageGroup = getAgeGroup(age);
    const visualInstructions = age <= 6 
      ? `
VISUAL EXAMPLES FOR YOUNG KIDS:
Counting: Show with emojis! 🍎🍎🍎 = 3 apples!
Letters: [A] looks like this! 🅰️
Shapes: ⭐ ⚫ ⬛ 🔺
Patterns: 🔴🔵🔴🔵 - what comes next?`
      : age <= 9
      ? `
VISUAL AIDS:
- Use emojis for concepts
- Show steps: 1️⃣ First... 2️⃣ Then...
- Visual examples when helpful`
      : '';

    return `${basePrompts[ageGroup]}

Teaching: ${subjects[subjectKey].name} - ${levelName}
${visualInstructions}

RULES:
- Create ONE quick activity or question
- Use VISUAL elements - emojis, formatting, symbols
- No long explanations - be direct
- Guide with hints, don't give answers
- ${age <= 6 ? 'VERY short responses (1-2 sentences max)' : age <= 9 ? 'Short responses (2-3 sentences)' : 'Concise responses (3-4 sentences)'}`;
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
      
      let systemPrompt;
      
      if (isHomeworkMode) {
        // Homework help mode
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
        // Regular subject learning
        const subject = subjects[currentSubject];
        const level = userProgress.subjects[currentSubject].level;
        const levelName = subject.levels[userProgress.ageGroup][level];
        
        systemPrompt = getSystemPrompt(currentSubject, levelName, ageNum) + `

When reviewing:
- Be BRIEF - ${ageNum <= 6 ? '1 sentence' : ageNum <= 9 ? '2 sentences' : '2-3 sentences'} max
- Use emojis and simple formatting
- If correct: "Great!" + why + next step
- If wrong: Encourage + hint
- Start with CORRECT or NEEDS_WORK`;
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
      const aiResponse = data.content[0].text;
      
      if (!isHomeworkMode) {
        const wasCorrect = aiResponse.toLowerCase().includes('correct') || 
                          aiResponse.toLowerCase().includes('great job') ||
                          aiResponse.toLowerCase().includes('excellent');
        
        await updateProgress(currentSubject, wasCorrect);
      }

      const aiMessage = {
        role: 'assistant',
        content: aiResponse
      };

      setConversation(prev => [...prev, aiMessage]);
      setUserAnswer('');
      setUploadedImage(null);
      
      // Auto-speak for young kids
      if (ageNum <= 6) {
        setTimeout(() => speak(aiResponse), 300);
      }
      
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

  const goHome = () => {
    setScreen('dashboard');
    setCurrentSubject(null);
    setConversation([]);
    setUserAnswer('');
    setUploadedImage(null);
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
    const currentQuestion = currentAssessment.questions[currentAssessment.currentQuestionIndex];
    const progress = (currentAssessment.currentQuestionIndex / currentAssessment.questions.length) * 100;
    const subjectInfo = subjects[currentAssessment.subject];

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-100 to-pink-100 flex items-center justify-center p-6">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap');
        `}</style>
        
        <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <div className="text-6xl mb-3">{subjectInfo.emoji}</div>
            <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Fredoka, sans-serif' }}>
              {isYoung ? 'Quick Check! 🌟' : 'Quick Assessment'}
            </h1>
            <p className="text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {isYoung ? `Let's see what you know about ${subjectInfo.name}!` : `Help us understand your ${subjectInfo.name} level`}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full bg-gradient-to-r ${subjectInfo.color} transition-all duration-300`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2 text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Question {currentAssessment.currentQuestionIndex + 1} of {currentAssessment.questions.length}
            </p>
          </div>

          {/* Question */}
          <div className="bg-gray-50 rounded-2xl p-6 mb-6">
            <p className="text-xl font-semibold text-gray-800" style={{ fontFamily: 'Fredoka, sans-serif' }}>
              {currentQuestion.question}
            </p>
          </div>

          {/* Answer Input */}
          <div className="relative mb-6">
            <textarea
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder={isYoung ? "Tell me your answer! 🎤" : "Type your answer..."}
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

          {isYoung && speechSupported && (
            <div className="mb-4 text-center">
              <p className="text-sm text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {isListening ? '🔴 Listening... speak now!' : '👆 Tap the microphone to talk!'}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={() => submitAssessmentAnswer(userAnswer)}
            disabled={!userAnswer.trim()}
            className={`w-full bg-gradient-to-r ${subjectInfo.color} text-white rounded-xl p-4 font-bold text-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
            style={{ fontFamily: 'Fredoka, sans-serif' }}
          >
            {currentAssessment.currentQuestionIndex === currentAssessment.questions.length - 1 
              ? (isYoung ? 'Done! 🎉' : 'Finish')
              : (isYoung ? 'Next! →' : 'Next Question →')
            }
          </button>

          {/* Skip Option */}
          <button
            onClick={() => finishAssessment(currentUser, assessmentResults)}
            className="w-full mt-3 text-gray-500 hover:text-gray-700 py-2 text-sm"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Skip assessment (start from beginning)
          </button>
        </div>
      </div>
    );
  }

  // DASHBOARD SCREEN
  if (screen === 'dashboard' && userProgress) {
    const ageNum = parseInt(userProgress.age);
    const isYoung = ageNum <= 9;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-4">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap');
          .subject-card {
            transition: all 0.3s ease;
          }
          .subject-card:hover {
            transform: translateY(-8px) scale(1.02);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
          }
        `}</style>

        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                  {isYoung ? `Hi ${userProgress.name}! 👋` : `Welcome back, ${userProgress.name}!`}
                </h1>
                <p className="text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Age {userProgress.age} • Total Points: {userProgress.totalPoints} ⭐
                </p>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Logout
              </button>
            </div>
          </div>

          {/* Progress Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl shadow-lg p-6 text-white">
              <Trophy className="w-10 h-10 mb-2" />
              <div className="text-3xl font-bold" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                {userProgress.totalPoints}
              </div>
              <div className="text-sm opacity-90" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Total Points
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-400 to-purple-400 rounded-2xl shadow-lg p-6 text-white">
              <Target className="w-10 h-10 mb-2" />
              <div className="text-3xl font-bold" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                {userProgress.totalActivities}
              </div>
              <div className="text-sm opacity-90" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Activities Done
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-400 to-teal-400 rounded-2xl shadow-lg p-6 text-white">
              <Award className="w-10 h-10 mb-2" />
              <div className="text-3xl font-bold" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                {Object.values(userProgress.subjects).reduce((sum, s) => sum + s.level, 0)}
              </div>
              <div className="text-sm opacity-90" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Levels Unlocked
              </div>
            </div>
          </div>

          {/* Subjects */}
          <div>
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Fredoka, sans-serif' }}>
              {isYoung ? 'What do you want to learn? 🎯' : 'Choose a Subject'}
            </h2>
            
            {/* Homework Help Card - Featured */}
            <div className="mb-6">
              <button
                onClick={startHomeworkHelp}
                className="w-full bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 rounded-2xl shadow-2xl p-6 text-left hover:shadow-3xl transition-all hover:scale-102"
              >
                <div className="flex items-center gap-4">
                  <div className="text-7xl">📝</div>
                  <div className="flex-1">
                    <h3 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                      {isYoung ? 'Help with Homework! 🌟' : 'Homework Help'}
                    </h3>
                    <p className="text-white text-lg opacity-90" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {isYoung ? 'Got homework? I can help! 📸' : 'Upload your homework and get guided help'}
                    </p>
                  </div>
                  <Camera className="w-12 h-12 text-white" />
                </div>
              </button>
            </div>
            
            <h3 className="text-xl font-semibold mb-4 text-gray-600" style={{ fontFamily: 'Fredoka, sans-serif' }}>
              {isYoung ? 'Or learn something new! 🚀' : 'Subject Practice'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(subjects).map(([key, subject]) => {
                const progress = userProgress.subjects[key];
                const IconComponent = subject.icon;
                const levelName = subject.levels[userProgress.ageGroup][progress.level];
                
                return (
                  <button
                    key={key}
                    onClick={() => startActivity(key)}
                    className="subject-card bg-white rounded-2xl shadow-lg p-6 text-left hover:shadow-2xl"
                  >
                    <div className={`text-6xl mb-3`}>{subject.emoji}</div>
                    <h3 className={`text-2xl font-bold mb-2 bg-gradient-to-r ${subject.color} bg-clip-text text-transparent`} style={{ fontFamily: 'Fredoka, sans-serif' }}>
                      {subject.name}
                    </h3>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        <span className="text-gray-600">Level:</span>
                        <span className="font-semibold">{levelName}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full bg-gradient-to-r ${subject.color}`}
                          style={{ width: `${((progress.level + 1) / (progress.maxLevel + 1)) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-sm text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      <span>⭐ {progress.points} pts</span>
                      <span>✅ {progress.activitiesCompleted}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVITY SCREEN
  if (screen === 'activity') {
    const ageNum = parseInt(userProgress.age);
    const isYoung = ageNum <= 9;

    // Homework mode
    if (isHomeworkMode) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 p-4">
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap');
            .message-slide { animation: slideIn 0.3s ease-out; }
            @keyframes slideIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-5xl">📝</span>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-red-600 bg-clip-text text-transparent" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                      {isYoung ? 'Homework Helper! 🌟' : 'Homework Help'}
                    </h1>
                    <p className="text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {isYoung ? 'I\'m here to help you!' : 'Get guided assistance'}
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

            {/* Conversation */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="space-y-4 mb-6">
                {conversation.map((msg, idx) => (
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
                      <p className="whitespace-pre-wrap flex-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
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
                        className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  <div className="relative mb-4">
                    <textarea
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      placeholder={isYoung ? "Tell me about your homework! 🎤" : "Describe your homework question..."}
                      className="w-full p-4 pr-16 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none text-lg"
                      style={{ fontFamily: 'Poppins, sans-serif' }}
                      rows="3"
                    />
                    {speechSupported && (
                      <button
                        onClick={toggleListening}
                        className={`absolute right-3 bottom-3 p-3 rounded-full transition-all ${
                          isListening 
                            ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                            : 'bg-blue-500 hover:bg-blue-600'
                        } text-white`}
                        title={isListening ? "Stop" : "Tap to talk"}
                      >
                        {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                      </button>
                    )}
                  </div>

                  {isYoung && speechSupported && (
                    <div className="mb-4 text-center">
                      <p className="text-sm text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {isListening ? '🔴 Listening... speak now!' : '👆 Tap the microphone to talk!'}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={sendMessage}
                    disabled={!userAnswer.trim() && !uploadedImage}
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl p-4 flex items-center justify-center gap-3 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontFamily: 'Fredoka, sans-serif' }}
                  >
                    <Send className="w-6 h-6" />
                    {isYoung ? 'Send!' : 'Get Help'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Regular subject learning
    if (currentSubject) {
      const subject = subjects[currentSubject];
      const ageNum = parseInt(userProgress.age);
      const isYoung = ageNum <= 9;

      return (
      <div className={`min-h-screen bg-gradient-to-br from-${subject.color.split('-')[1]}-50 via-white to-${subject.color.split('-')[3]}-50 p-4`}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap');
          .message-slide { animation: slideIn 0.3s ease-out; }
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-5xl">{subject.emoji}</span>
                <div>
                  <h1 className={`text-3xl font-bold bg-gradient-to-r ${subject.color} bg-clip-text text-transparent`} style={{ fontFamily: 'Fredoka, sans-serif' }}>
                    {subject.name}
                  </h1>
                  <p className="text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    Level: {subject.levels[userProgress.ageGroup][userProgress.subjects[currentSubject].level]}
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

          {/* Conversation */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="space-y-4 mb-6">
              {conversation.map((msg, idx) => (
                <div
                  key={idx}
                  className={`message-slide ${isYoung ? 'young-mode' : ''} p-4 rounded-xl ${
                    msg.role === 'user'
                      ? `bg-gradient-to-r ${subject.color} text-white ml-8`
                      : 'bg-gray-100 mr-8'
                  }`}
                >
                  {msg.image && (
                    <img src={msg.image} alt="Work" className="w-32 h-32 object-cover rounded-lg mb-2" />
                  )}
                  <div className="flex items-start gap-3">
                    <p 
                      className="whitespace-pre-wrap flex-1" 
                      style={{ fontFamily: 'Poppins, sans-serif', fontSize: isYoung ? '1.125rem' : '1rem' }}
                    >
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
                  <div className="inline-block w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Input Area */}
            {conversation.length > 0 && !isLoading && (
              <div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className={`bg-gradient-to-r ${subject.color} text-white rounded-xl p-4 flex flex-col items-center gap-2`}
                  >
                    <Camera className="w-8 h-8" />
                    <span className="font-semibold text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {isYoung ? 'Take Photo' : 'Camera'}
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
                    className={`bg-gradient-to-r ${subject.color} text-white rounded-xl p-4 flex flex-col items-center gap-2`}
                  >
                    <Upload className="w-8 h-8" />
                    <span className="font-semibold text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {isYoung ? 'Upload' : 'Upload File'}
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
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}

                <div className="relative mb-4">
                  <textarea
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder={isYoung ? "Type or speak your answer! 🎤" : "Type your answer here..."}
                    className="w-full p-4 pr-16 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none text-lg"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                    rows="3"
                  />
                  {speechSupported && (
                    <button
                      onClick={toggleListening}
                      className={`absolute right-3 bottom-3 p-3 rounded-full transition-all ${
                        isListening 
                          ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                          : 'bg-blue-500 hover:bg-blue-600'
                      } text-white`}
                      title={isListening ? "Stop" : "Tap to talk"}
                    >
                      {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>
                  )}
                </div>

                {isYoung && speechSupported && (
                  <div className="mb-4 text-center">
                    <p className="text-sm text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {isListening ? '🔴 Listening... speak now!' : '👆 Tap the microphone to talk!'}
                    </p>
                  </div>
                )}

                <button
                  onClick={sendMessage}
                  disabled={!userAnswer.trim() && !uploadedImage}
                  className={`w-full bg-gradient-to-r ${subject.color} text-white rounded-xl p-4 flex items-center justify-center gap-3 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                  style={{ fontFamily: 'Fredoka, sans-serif' }}
                >
                  <Send className="w-6 h-6" />
                  {isYoung ? 'Send!' : 'Submit Answer'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
    }
  }

  return null;
}
