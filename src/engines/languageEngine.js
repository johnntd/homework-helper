/**
 * languageEngine.js
 *
 * Pure JS module that unifies all language-related capabilities:
 * locale maps, speech recognition language selection, TTS configuration,
 * interpreter turn management, CEFR levels, and language-specific tips.
 *
 * No React imports. Only imports from ./learnerMemory.js for AGE_BOUNDARIES.
 */

import { AGE_BOUNDARIES } from './learnerMemory.js';

// === LANGUAGE CONSTANTS ===

export const LANGUAGES = [
  { code: 'en', name: 'English', flag: '\u{1F1FA}\u{1F1F8}', nativeName: 'English' },
  { code: 'es', name: 'Spanish', flag: '\u{1F1EA}\u{1F1F8}', nativeName: 'Espa\u00f1ol' },
  { code: 'vi', name: 'Vietnamese', flag: '\u{1F1FB}\u{1F1F3}', nativeName: 'Ti\u1EBFng Vi\u1EC7t' },
  { code: 'zh', name: 'Mandarin', flag: '\u{1F1E8}\u{1F1F3}', nativeName: '\u4E2D\u6587' },
  { code: 'fr', name: 'French', flag: '\u{1F1EB}\u{1F1F7}', nativeName: 'Fran\u00e7ais' },
  { code: 'ar', name: 'Arabic', flag: '\u{1F1F8}\u{1F1E6}', nativeName: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629' },
  { code: 'hi', name: 'Hindi', flag: '\u{1F1EE}\u{1F1F3}', nativeName: '\u0939\u093F\u0928\u094D\u0926\u0940' },
  { code: 'pt', name: 'Portuguese', flag: '\u{1F1E7}\u{1F1F7}', nativeName: 'Portugu\u00eas' },
  { code: 'ja', name: 'Japanese', flag: '\u{1F1EF}\u{1F1F5}', nativeName: '\u65E5\u672C\u8A9E' },
  { code: 'ko', name: 'Korean', flag: '\u{1F1F0}\u{1F1F7}', nativeName: '\uD55C\uAD6D\uC5B4' },
  { code: 'de', name: 'German', flag: '\u{1F1E9}\u{1F1EA}', nativeName: 'Deutsch' },
  { code: 'ru', name: 'Russian', flag: '\u{1F1F7}\u{1F1FA}', nativeName: '\u0420\u0443\u0441\u0441\u043A\u0438\u0439' }
];

export const LANGUAGE_LOCALE_MAP = {
  'en': 'en-US', 'es': 'es-ES', 'vi': 'vi-VN', 'zh': 'zh-CN',
  'fr': 'fr-FR', 'ar': 'ar-SA', 'hi': 'hi-IN', 'pt': 'pt-BR',
  'ja': 'ja-JP', 'ko': 'ko-KR', 'de': 'de-DE', 'it': 'it-IT', 'ru': 'ru-RU'
};

export const LANGUAGE_NAME_TO_CODE = {
  'english': 'en', 'spanish': 'es', 'french': 'fr', 'japanese': 'ja',
  'korean': 'ko', 'chinese': 'zh', 'mandarin': 'zh', 'german': 'de',
  'italian': 'it', 'portuguese': 'pt', 'russian': 'ru', 'arabic': 'ar',
  'hindi': 'hi', 'vietnamese': 'vi'
};

// === CEFR CONSTANTS ===

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const CEFR_NAMES = {
  A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate',
  B2: 'Upper-Intermediate', C1: 'Advanced', C2: 'Proficient'
};

// === INTERPRETER CONSTANTS ===

export const INTERPRETER_QUICK_PAIRS = [
  { fromName: 'Vietnamese', toName: 'English', fromCode: 'vi', toCode: 'en' },
  { fromName: 'English', toName: 'Japanese', fromCode: 'en', toCode: 'ja' },
  { fromName: 'English', toName: 'Korean', fromCode: 'en', toCode: 'ko' },
  { fromName: 'English', toName: 'Chinese', fromCode: 'en', toCode: 'zh' },
  { fromName: 'Vietnamese', toName: 'Spanish', fromCode: 'vi', toCode: 'es' },
];

// === CEFR HELPERS ===

export function getCEFRCode(level) {
  return CEFR_LEVELS[Math.min(Math.floor(level), 5)] || 'A1';
}

export function getCEFRName(code) {
  return CEFR_NAMES[code] || 'Beginner';
}

export function getCEFRFromProgress(userProgress, langCode) {
  const level = userProgress?.subjects?.languages?.languageLevels?.[langCode] ?? 0;
  return getCEFRCode(level);
}

// === SPEECH RECOGNITION LANGUAGE SELECTION ===

/**
 * Determines the correct BCP-47 locale for speech recognition.
 * Extracted from toggleListening/startListeningNow logic in App.jsx.
 */
export function getRecognitionLocale({ currentSubject, selectedTopic, userProgress, currentUser, selectedLanguage }) {
  const ADULT_ENGLISH_SUBJECTS = ['interview', 'followup', 'skills', 'resume', 'life-coach', 'accent'];

  if (ADULT_ENGLISH_SUBJECTS.includes(currentSubject)) {
    return 'en-US';
  }

  const langSource = userProgress?.language || currentUser?.language || selectedLanguage;

  if (currentSubject === 'languages' && selectedTopic) {
    // Learning a language -- recognize the TARGET language, not profile language
    const recognitionLang = LANGUAGE_NAME_TO_CODE[selectedTopic] || selectedTopic;
    return LANGUAGE_LOCALE_MAP[recognitionLang] || 'en-US';
  }

  return LANGUAGE_LOCALE_MAP[langSource] || 'en-US';
}

// === TTS CONFIGURATION ===

/**
 * Determines if TTS should be active for the current context.
 * Extracted from sendMessage line 4947-4949.
 */
export function shouldUseTTS({ ageNum, currentSubject, ttsEnabled, synthAvailable }) {
  const forceVoiceOn = ageNum <= AGE_BOUNDARIES.VOICE_ALWAYS_MAX;
  const ttsSubjects = ['languages', 'interview', 'followup', 'accent'];
  return (forceVoiceOn || ((ageNum <= AGE_BOUNDARIES.TTS_MAX || ttsSubjects.includes(currentSubject)) && ttsEnabled)) && synthAvailable;
}

/**
 * Get TTS language override for current context.
 */
export function getTTSLangOverride(currentSubject, selectedTopic) {
  if (currentSubject === 'interview' || currentSubject === 'followup') return 'en';
  if (currentSubject === 'languages' && selectedTopic) {
    return LANGUAGE_NAME_TO_CODE[selectedTopic] || 'en';
  }
  return null;
}

// === INTERPRETER TURN MANAGEMENT ===

/**
 * Get the language code for TTS output in interpreter mode.
 * Extracted from sendMessage lines 5530-5532.
 */
export function getInterpreterSpeakCode(interpreterTurn, activePair) {
  if (interpreterTurn === 'from') {
    return activePair?.toCode;    // listening to fromLang -> speak result in toLang
  }
  return activePair?.fromCode;   // listening to toLang   -> speak result in fromLang
}

/**
 * Flip the interpreter turn direction.
 */
export function flipInterpreterTurn(currentTurn) {
  return currentTurn === 'from' ? 'to' : 'from';
}

/**
 * Get the interpreter recognition locale for the current turn.
 */
export function getInterpreterRecognitionLocale(interpreterTurn, activePair) {
  const langCode = interpreterTurn === 'from' ? activePair?.fromCode : activePair?.toCode;
  return LANGUAGE_LOCALE_MAP[langCode] || 'en-US';
}

// === LANGUAGE-SPECIFIC TIPS ===

/**
 * Returns language-specific learning tips based on target language and learner age.
 * Extracted from App.jsx getLanguageSpecificTips (lines 4041-4137).
 */
export function getLanguageSpecificTips(langCode, age) {
  const ageNum = parseInt(age);
  const tips = {
    'es': `Spanish Tips:
- It's phonetic - sounds match letters!
- Focus on pronunciation: rr, \u00f1, j sounds
- Gender matters: el (masculine) vs la (feminine)
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Start with: colors, numbers, greetings, animals' : ''}
${ageNum > 7 ? '- Use cognates: "animal" = animal, "chocolate" = chocolate' : ''}
- Verbs change based on who does the action`,

    'fr': `French Tips:
- Many silent letters (letters you don't say)
- Words connect together (liaisons)
- Gender: le (masculine) vs la (feminine)
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Start with songs: "Fr\u00e8re Jacques", "Alouette"' : ''}
- Nasal sounds are special: an, on, in, un
- Accent marks change pronunciation: \u00e9 \u00e8 \u00ea`,

    'zh': `Chinese (Mandarin) Tips:
- It's TONAL - pitch changes the meaning!
- 4 tones plus neutral: \u2192 \u02CA \u02C7 \u02CB (flat, rising, dip, falling)
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Only speaking/listening for young learners' : ''}
- Start with Pinyin (romanization)
- Characters come much later
- Simple words first: m\u0101ma (mom), b\u00E0ba (dad), m\u0101o (cat)`,

    'vi': `Vietnamese Tips:
- It's TONAL - 6 different tones!
- Use tone markers: \u00E0 \u00E1 \u1EA3 \u00E3 \u1EA1
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Focus purely on speaking and listening' : ''}
- Pronunciation is key to being understood
- Grammar is actually simple (no conjugations!)
- Many Chinese loanwords`,

    'ja': `Japanese Tips:
- 3 writing systems (hiragana, katakana, kanji)
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Writing comes much later, focus on speaking' : ''}
${ageNum > 7 ? '- Start with hiragana (phonetic alphabet)' : ''}
- Politeness levels matter a lot
- Word order: subject-object-verb
- No plural forms!`,

    'ko': `Korean Tips:
- Hangul alphabet is logical and learnable!
- 14 consonants + 10 vowels = all sounds
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Focus on speaking and listening first' : ''}
- Respect levels are very important
- Word order: subject-object-verb
- Many Chinese-origin words`,

    'de': `German Tips:
- Many English cognates (similar words!)
- Three genders: der (masc), die (fem), das (neuter)
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Start with animals, colors, family' : ''}
- Compound words can be very long
- Verb goes to the end in subordinate clauses
- Pronunciation is regular once you learn the rules`,

    'pt': `Portuguese Tips:
- Similar to Spanish but different pronunciation
- Nasal sounds are key: \u00E3o, \u00E3, \u00F5e
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Start with: animals, colors, family words' : ''}
- Gender: o (masculine) vs a (feminine)
- Brazilian vs European Portuguese differ
- Many verb tenses`,

    'ar': `Arabic Tips:
- Written right to left!
- Letters change shape (beginning/middle/end/alone)
${ageNum <= AGE_BOUNDARIES.VERY_YOUNG_MAX ? '- Pure speaking/listening approach' : ''}
- Emphasis sounds: \u0639 \u062D \u0642
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
}

// === VIETNAMESE VOICE SELECTION ===

/**
 * Select the best Vietnamese TTS voice based on accent preference.
 */
export function getVietnameseVoice(voices, accent = 'southern') {
  if (!voices?.length) return null;
  const viVoices = voices.filter(v => v.lang && v.lang.startsWith('vi'));
  if (!viVoices.length) return null;

  // Log all available Vietnamese voices for debugging
  console.log(`[TTS] Vietnamese voices available (${viVoices.length}):`, viVoices.map(v => `"${v.name}" (${v.lang})`).join(', '));

  // Try to match accent by keywords in voice name
  const accentKeywords = {
    northern: ['hanoi', 'northern', 'hà nội', 'bắc'],
    southern: ['saigon', 'southern', 'hồ chí minh', 'ho chi minh', 'nam'],
    central: ['hue', 'central', 'huế', 'trung'],
  };

  const keywords = accentKeywords[accent] || [];
  const match = viVoices.find(v =>
    keywords.some(kw => v.name.toLowerCase().includes(kw))
  );
  if (match) {
    console.log(`[TTS] Vietnamese accent match: "${match.name}" for accent=${accent}`);
    return match;
  }

  // Prefer Enhanced/Premium quality
  const enhanced = viVoices.find(v =>
    v.name.includes('Enhanced') || v.name.includes('Premium')
  );
  if (enhanced) {
    console.log(`[TTS] Vietnamese enhanced voice: "${enhanced.name}"`);
    return enhanced;
  }

  // Prefer male voice (Lân) — often clearer for interpretation
  const male = viVoices.find(v =>
    v.name.toLowerCase().includes('lân') || v.name.toLowerCase().includes('lan')
  );
  if (male) {
    console.log(`[TTS] Vietnamese male voice: "${male.name}"`);
    return male;
  }

  // NOTE: Most platforms have only 1-2 Vietnamese voices with no accent label.
  // Accent differentiation is done via prosody (pitch/rate) in speak().
  console.log(`[TTS] Vietnamese: no accent/male match, using "${viVoices[0].name}" with prosody adjustment`);
  return viVoices[0];
}

// === LANGUAGE LEARNING STAGES ===

export const LANGUAGE_LEARNING_STAGES = {
  YOUNG: { maxAge: 7, focus: 'listening_speaking', methods: ['verbal', 'songs', 'games'], assessment: 'verbal_only', readingRequired: false },
  MIDDLE: { maxAge: 12, focus: 'speaking_reading', methods: ['conversation', 'reading', 'simple_writing'], assessment: 'verbal_and_written', readingRequired: true },
  OLDER: { maxAge: 999, focus: 'comprehensive', methods: ['conversation', 'reading', 'writing', 'grammar'], assessment: 'comprehensive', readingRequired: true },
};

export function getLanguageLearningStage(age) {
  const ageNum = parseInt(age);
  if (ageNum <= 7) return LANGUAGE_LEARNING_STAGES.YOUNG;
  if (ageNum <= 12) return LANGUAGE_LEARNING_STAGES.MIDDLE;
  return LANGUAGE_LEARNING_STAGES.OLDER;
}
