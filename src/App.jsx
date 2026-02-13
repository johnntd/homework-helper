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
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  const subjects = {
    reading: { 
      name: 'Reading', 
      icon: Book,
      color: 'from-blue-400 to-blue-600',
      emoji: '📚',
      levels: {
        '4-6': ['ABC Letters', 'Phonics', 'Simple Words', 'Easy Sentences', 'Short Stories'],
        '7-9': ['Reading Fluency', 'Comprehension', 'Story Elements', 'Chapter Books', 'Inference'],
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
        '4-6': ['Letter Formation', 'Tracing', 'Writing Words', 'Simple Sentences', 'Short Stories'],
        '7-9': ['Paragraph Writing', 'Descriptive Writing', 'Narrative Stories', 'Letter Writing', 'Organization'],
        '10-13': ['Essay Structure', 'Persuasive Writing', 'Research Papers', 'Creative Writing', 'Editing Skills'],
        '14-18': ['Academic Essays', 'Argumentative Writing', 'Literary Analysis', 'Research Papers', 'Advanced Composition']
      }
    },
    spelling: { 
      name: 'Spelling', 
      icon: Hash,
      color: 'from-purple-400 to-purple-600',
      emoji: '🔤',
      levels: {
        '4-6': ['CVC Words', 'Sight Words', 'Word Families', 'Simple Patterns', 'Common Words'],
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
        '4-6': ['Patterns', 'Sorting', 'Counting', 'Simple Puzzles', 'Shapes & Colors'],
        '7-9': ['Math Logic', 'Word Problems', 'Sequences', 'Strategy Games', 'Critical Thinking'],
        '10-13': ['Deductive Reasoning', 'Problem Solving', 'Logic Puzzles', 'Algebra Concepts', 'Analytical Thinking'],
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
        setUserProgress(JSON.parse(result.value));
      } else {
        const initialProgress = createInitialProgress(user);
        await saveUserProgress(initialProgress);
        setUserProgress(initialProgress);
      }
    } catch (error) {
      console.log('Storage not available, using session storage');
      const initialProgress = createInitialProgress(user);
      setUserProgress(initialProgress);
    }
  };

  const createInitialProgress = (user) => {
    const ageGroup = getAgeGroup(user.age);
    const progress = {
      name: user.name,
      age: user.age,
      ageGroup: ageGroup,
      totalPoints: 0,
      totalActivities: 0,
      streak: 0,
      lastActivity: new Date().toISOString(),
      subjects: {}
    };

    Object.keys(subjects).forEach(subjectKey => {
      progress.subjects[subjectKey] = {
        level: 0,
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

  const startActivity = async (subjectKey) => {
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
      '4-6': 'You are a patient, super-friendly tutor for young children (ages 4-6). Use VERY simple words, short sentences, and LOTS of emojis and encouragement. Make everything fun like a game!',
      '7-9': 'You are an encouraging tutor for elementary students (ages 7-9). Use clear language, give examples, and make learning fun. Be supportive and patient.',
      '10-13': 'You are a helpful tutor for middle school students (ages 10-13). Explain concepts clearly, provide examples, and help them think critically. Be encouraging but mature.',
      '14-18': 'You are a knowledgeable tutor for high school students (ages 14-18). Provide in-depth explanations, challenge them intellectually, and help with complex concepts. Be professional but supportive.'
    };

    const ageGroup = getAgeGroup(age);
    return `${basePrompts[ageGroup]}

You are teaching ${subjects[subjectKey].name} at the "${levelName}" level.

IMPORTANT:
- Create ONE focused, interactive activity
- Ask clear questions that require thinking
- Never just give answers - guide with questions and hints
- Be very encouraging and positive
- Keep responses concise (3-5 sentences for young kids, more for older students)
- End with a specific question or task for the student`;
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
      
      const systemPrompt = getSystemPrompt(currentSubject, levelName, ageNum) + `

When reviewing answers:
- Praise effort and progress
- If correct: celebrate, explain why, give bonus info
- If incorrect: encourage, give hints, guide to correct answer
- Assess if answer shows understanding (respond with CORRECT or NEEDS_WORK at the start)
- Keep building on their learning`;

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
      
      const wasCorrect = aiResponse.toLowerCase().includes('correct') || 
                        aiResponse.toLowerCase().includes('great job') ||
                        aiResponse.toLowerCase().includes('excellent');
      
      await updateProgress(currentSubject, wasCorrect);

      const aiMessage = {
        role: 'assistant',
        content: aiResponse
      };

      setConversation(prev => [...prev, aiMessage]);
      setUserAnswer('');
      setUploadedImage(null);
      
      // Auto-speak for young kids
      if (parseInt(userProgress.age) <= 6) {
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
  if (screen === 'activity' && currentSubject) {
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
                  className={`message-slide p-4 rounded-xl ${
                    msg.role === 'user'
                      ? `bg-gradient-to-r ${subject.color} text-white ml-8`
                      : 'bg-gray-100 mr-8'
                  }`}
                >
                  {msg.image && (
                    <img src={msg.image} alt="Work" className="w-32 h-32 object-cover rounded-lg mb-2" />
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

  return null;
}
