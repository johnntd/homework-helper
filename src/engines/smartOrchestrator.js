/**
 * smartOrchestrator.js
 *
 * Top-level intelligence layer for Sunny's Smart Mode.
 * Handles intent detection, mode selection, first message building,
 * system prompt selection, grading hints, and message composition.
 *
 * Pure JS module — no React imports.
 * Uses dynamic `await import()` for sunnyPrompts functions (same pattern as App.jsx).
 */

import { buildMemoryGradeHint } from '../utils/gradeMemory.js';
import { AGE_BOUNDARIES } from './learnerMemory.js';
import { isEnglishVietnamesePair } from './languageEngine.js';

// === MODE CONSTANTS ===

export const MODES = {
  SMART_TUTOR: 'smart_tutor',
  INTERPRETER: 'interpreter',
  TRANSLATION: 'translation',
  HOMEWORK_HELP: 'homework_help',
  DOCUMENT_ASSIST: 'document_assist',
  WRITING_ASSIST: 'writing_assist',
};

// === SMART START ACTIVITY ===

/**
 * Selects the single best coaching topic in JavaScript so the model doesn't have to decide.
 * Extracted from App.jsx `chooseSmartStartActivity` lines 3931-3974.
 *
 * @param {{ weakTopics: Array, lastSubject: string|null, enjoymentSubjects: Array }} ctx
 * @param {number} ageNum
 * @returns {{ type: string, topic: string, subjKey: string, accuracy?: number, coaching: string }}
 */
export function chooseStartActivity(ctx, ageNum) {
  // Priority 1: weakest topic with confirmed evidence (most impactful drill)
  if (ctx.weakTopics.length > 0) {
    const w = ctx.weakTopics[0];
    return {
      type: 'weak',
      topic: w.topic,
      subjKey: w.subjKey,
      accuracy: Math.round(w.accuracy * 100),
      coaching: `Warm up on "${w.topic}" — accuracy has been ${Math.round(w.accuracy * 100)}%. Start with one question, no intro.`,
    };
  }
  // Priority 2: resume last subject
  if (ctx.lastSubject) {
    return {
      type: 'resume',
      topic: ctx.lastSubject,
      subjKey: ctx.lastSubject,
      coaching: `Resume ${ctx.lastSubject}. Pick a good next question within it and ask immediately.`,
    };
  }
  // Priority 3: most-visited subject (high engagement)
  if (ctx.enjoymentSubjects.length > 0) {
    const e = ctx.enjoymentSubjects[0];
    return {
      type: 'enjoyment',
      topic: e.subjKey,
      subjKey: e.subjKey,
      coaching: `Continue ${e.subjKey} — learner has done ${e.sessions} sessions there. Ask a slightly more challenging question.`,
    };
  }
  // Priority 4: age-appropriate default (no history)
  const byAge = ageNum < 8 ? 'animal classification'
    : ageNum < 11 ? 'basic math'
    : ageNum < 14 ? 'science'
    : ageNum < 18 ? 'algebra or reading comprehension'
    : 'critical thinking or vocabulary';
  return {
    type: 'default',
    topic: byAge,
    subjKey: byAge.split(' ')[0],
    coaching: `No prior history. Start with one simple ${byAge} question right now.`,
  };
}

// === FIRST MESSAGE BUILDER ===

/**
 * Builds the first user message for Smart Mode as a DIRECT TEACHING DIRECTIVE.
 * The model receives an instruction, not a question — so it teaches instead of routing.
 * Extracted from App.jsx `buildSmartFirstMessage` lines 3979-4015.
 *
 * @param {string} name
 * @param {object} ctx - learner context from buildLearnerContext
 * @param {number} ageNum
 * @param {string|object|null} intentHint - 'interpreter'|'translate'|'homework'|'practical'|{type,pair}|null
 * @returns {string}
 */
export function buildFirstMessage(name, ctx, ageNum, intentHint = null, profileLang = 'en') {
  // Capability quick-launch: enter a non-tutor mode immediately
  if (intentHint) {
    // intentHint may be a string (simple intent) or {type, pair} for interpreter with pre-selected pair
    if (typeof intentHint === 'object' && intentHint?.type === 'interpreter' && intentHint?.pair) {
      const { fromName, toName } = intentHint.pair;
      // Greeting must be in the user's native language, not hardcoded English.
      // The AI will generate a natural greeting in profileLang.
      const langInstruction = profileLang === 'en'
        ? `- coach_say: "${fromName} ↔ ${toName} — ready! Speak and I'll translate."`
        : `- coach_say: A short, natural greeting in the user's native language (${profileLang}) saying the interpreter is ready for ${fromName} ↔ ${toName}. Do NOT use English for this greeting.`;
      return `[CAPABILITY: INTERPRETER]\nLanguage pair ALREADY SELECTED: ${fromName} ↔ ${toName}\nDo NOT ask which languages — already confirmed by user.\nUser's native language: ${profileLang}. Greet them in their native language.\nFirst response:\n${langInstruction}\n- study_board: {"visual":"${fromName} ↔ ${toName}","visualType":"text","visualColor":"blue"}\n- subject: "interpreter"\n- expect: "text"\n- graded: "none"\n- state: "ask"\nBegin immediately.`;
    }
    const intentMessages = {
      interpreter: `[CAPABILITY: INTERPRETER] Enter live interpreter mode. Ask which two languages once, then begin immediately.`,
      translate: `[CAPABILITY: TRANSLATE] Enter translation mode. Ask what text or image to translate, then translate it immediately.`,
      homework: `[CAPABILITY: HOMEWORK] Learner needs homework help. Use learner history to start immediately. One question: which subject/assignment if not obvious, then teach.`,
      practical: `[CAPABILITY: PRACTICAL] Learner needs help with a letter, form, or document. Ask them to share it, then explain and assist immediately.`,
    };
    return intentMessages[intentHint] || `Start coaching immediately.`;
  }

  // Compute the best activity in JavaScript
  const activity = chooseStartActivity(ctx, ageNum);
  const lines = [
    `[DIRECT COACHING DIRECTIVE — follow exactly]`,
    `Learner: ${name}, age ${ageNum}${ctx.streak > 1 ? `, ${ctx.streak}-day streak` : ''}`,
    `Action: ${activity.coaching}`,
  ];

  if (activity.type === 'weak') {
    lines.push(`Coaching style: warm and encouraging — "Last time this was a bit tricky, let's try one!"`);
  } else if (activity.type === 'resume') {
    lines.push(`Coaching style: familiar continuation — brief acknowledgment, then the question.`);
  } else if (activity.type === 'enjoyment') {
    lines.push(`Coaching style: energetic and slightly challenging — they're good at this.`);
  } else {
    lines.push(`Coaching style: friendly opener — introduce with one sentence, then the question.`);
  }
  lines.push(`RULES: No capability card. No clarifying questions. No "what would you like to work on?" Just coach.`);
  return lines.join('\n');
}

// === MID-SESSION INTENT DETECTION ===

/**
 * Detects user intent from a message to decide if mode should switch.
 *
 * @param {string} userMessage
 * @param {string|null} currentMode - current MODES value
 * @returns {{ mode: string, confidence: number }}
 */
export function detectIntent(userMessage, currentMode) {
  const msg = userMessage.toLowerCase().trim();

  // Interpreter intent
  if (/\b(interpret|interpreter|translate.*live|real.?time.*translat)\b/i.test(msg)) {
    return { mode: MODES.INTERPRETER, confidence: 0.9 };
  }

  // Translation intent
  if (/\b(translate|translation|what does .* mean|how do you say)\b/i.test(msg)) {
    return { mode: MODES.TRANSLATION, confidence: 0.8 };
  }

  // Homework intent
  if (/\b(homework|assignment|problem set|classwork|worksheet)\b/i.test(msg)) {
    return { mode: MODES.HOMEWORK_HELP, confidence: 0.85 };
  }

  // Document assist intent
  if (/\b(letter|form|document|notice|tax|official|application)\b/i.test(msg)) {
    return { mode: MODES.DOCUMENT_ASSIST, confidence: 0.7 };
  }

  // Writing assist intent
  if (/\b(write|draft|compose|email|reply|respond to)\b/i.test(msg)) {
    return { mode: MODES.WRITING_ASSIST, confidence: 0.65 };
  }

  // Stay in current mode
  return { mode: currentMode || MODES.SMART_TUTOR, confidence: 0.5 };
}

// === CLIENT-SIDE GRADE HINT ===

/**
 * Computes a deterministic grading hint for numeric answers and memory-game recall.
 * Extracted from sendMessage lines 5006-5052.
 *
 * @param {string} answerToSend
 * @param {object|null} currentStudyBoard
 * @param {string} currentSubject
 * @returns {string} grade hint string to append, or empty string
 */
export function computeClientGradeHint(answerToSend, currentStudyBoard, currentSubject) {
  const isKidsSubject = !['skills', 'interview', 'life-coach', 'resume', 'followup'].includes(currentSubject);

  // Numeric grading
  if (isKidsSubject && typeof currentStudyBoard?.correctAnswer === 'number' && answerToSend) {
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
      return studentNum === correctAns
        ? '\n[GRADED: correct]'
        : `\n[GRADED: incorrect — correct answer is ${correctAns}, student said ${studentNum}]`;
    }
    // If we couldn't parse a number, don't add any hint — let the AI grade
  }

  // Memory game recall grading — deterministic, bypasses AI permissiveness.
  // Runs only when there's a live memory-game board and no numeric hint was already set.
  if (currentStudyBoard?.visualType === 'memory-game') {
    const expectedItems = currentStudyBoard?.visual?.items;
    if (Array.isArray(expectedItems) && expectedItems.length > 0) {
      return buildMemoryGradeHint(answerToSend, expectedItems);
    }
  }

  return '';
}

// === LANGUAGE PRACTICE HINT ===

/**
 * Builds a hint for the AI when the user is doing language or accent practice via voice.
 * Extracted from sendMessage lines 5060-5073.
 *
 * @param {string} currentSubject
 * @param {boolean} isVoiceInput
 * @param {object|null} currentStudyBoard
 * @param {string} answerToSend
 * @returns {string}
 */
export function buildLangPracticeHint(currentSubject, isVoiceInput, currentStudyBoard, answerToSend) {
  if (currentSubject === 'languages' && isVoiceInput) {
    const targetPhrase = currentStudyBoard?.correctAnswer || currentStudyBoard?.visual?.word;
    if (targetPhrase && targetPhrase.toLowerCase().trim() !== answerToSend.toLowerCase().trim()) {
      return `\n[CONTEXT: The user was trying to say the target phrase "${targetPhrase}". Speech recognition captured "${answerToSend}" — this is likely a mispronunciation or mishearing, NOT a new sentence the user invented. Grade as an attempt at "${targetPhrase}" and give pronunciation correction if needed.]`;
    }
  }
  // For accent coach: always tell the AI what phrase was on the card — STT of accented speech is imperfect
  if (currentSubject === 'accent') {
    const targetPhrase = currentStudyBoard?.visual?.word;
    if (targetPhrase) {
      return `\n[CONTEXT: The user was attempting to say: "${targetPhrase}". Speech recognition captured: "${answerToSend}". Treat this as their pronunciation attempt — assess how close it is and coach accordingly.]`;
    }
  }
  return '';
}

// === USER MESSAGE BUILDER ===

/**
 * Composes the complete user message object for the API.
 *
 * @param {object} config
 * @param {string} config.answerToSend
 * @param {string} config.currentSubject
 * @param {object|null} config.currentStudyBoard
 * @param {boolean} config.isVoiceInput
 * @param {string|null} config.selectedTopic
 * @param {string|null} config.interviewNativeLang
 * @param {string|null} config.uploadedImage - base64 data URL or null
 * @param {boolean} config.silent
 * @returns {{ role: 'user', content: string|Array }}
 */
export function buildUserMessage({ answerToSend, currentSubject, currentStudyBoard, isVoiceInput,
                                    selectedTopic, interviewNativeLang, uploadedImage, silent }) {
  const clientGradeHint = computeClientGradeHint(answerToSend, currentStudyBoard, currentSubject);
  const langPracticeHint = buildLangPracticeHint(currentSubject, isVoiceInput, currentStudyBoard, answerToSend);

  const isInterviewVoice = currentSubject === 'interview' && isVoiceInput && interviewNativeLang;
  const apiAnswerText = (isInterviewVoice ? answerToSend + '\n[voice answer]' : answerToSend) + clientGradeHint + langPracticeHint;

  if (uploadedImage) {
    const base64Data = uploadedImage.split(',')[1];
    const mediaType = uploadedImage.split(';')[0].split(':')[1];
    return {
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
        { type: 'text', text: apiAnswerText || 'Here is my work!' }
      ]
    };
  }

  return { role: 'user', content: apiAnswerText };
}

// === INTERPRETER INJECTION ===

/**
 * Builds the interpreter mode injection prepended to the user's message.
 * Extracted from sendMessage lines 5273-5284.
 *
 * @param {{ fromName: string, toName: string }|null} activePair
 * @param {'from'|'to'} interpreterTurn
 * @param {string} userMessageContent
 * @returns {string}
 */
export function buildInterpreterInjection(activePair, interpreterTurn, userMessageContent) {
  const lang1 = activePair?.fromName || 'Language 1';
  const lang2 = activePair?.toName || 'Language 2';
  const isEnVi = isEnglishVietnamesePair(activePair);
  const sttNote = isEnVi
    ? `\nIMPORTANT: Speech captured via Vietnamese STT. Vietnamese input has proper diacritics. English input may appear as phonetic Vietnamese (e.g., "hê lô" = "hello"). Detect English even when spelled phonetically. For Vietnamese output, use proper diacritics.\n`
    : '';
  return `[LIVE INTERPRETER — AUTO-DETECT]\n` +
    `LANGUAGE PAIR: ${lang1} ↔ ${lang2}\n` +
    `TASK: Detect which language the following text is in, then translate to the OTHER language.\n` +
    `- If the text is in ${lang1}, translate it into ${lang2}.\n` +
    `- If the text is in ${lang2}, translate it into ${lang1}.\n` +
    sttNote +
    `CRITICAL RULES:\n` +
    `- Output ONLY the translation. Nothing else.\n` +
    `- Do NOT mix languages. The entire output must be in the target language.\n` +
    `- Do NOT add "Translation:", language labels, or any commentary.\n` +
    `- Do NOT repeat the original text in the source language.\n` +
    `- Your response will be spoken aloud by TTS. Output clean natural text only.\n\n` +
    `[Speech to detect and translate]:\n` +
    userMessageContent;
}

// === EARLY TURN CONTEXT INJECTION ===

/**
 * Appends learner context to the user message on early turns (before any user message in history)
 * so the model has topical context even when the user said something vague.
 * Extracted from sendMessage lines 5256-5268.
 *
 * @param {{ weakTopics: Array, lastSubject: string|null, enjoymentSubjects: Array }} learnerContext
 * @param {string} userMessageContent
 * @returns {string}
 */
export function buildEarlyTurnContextInjection(learnerContext, userMessageContent) {
  const ctxParts = [];
  if (learnerContext.weakTopics.length > 0)
    ctxParts.push(`Weak areas: ${learnerContext.weakTopics.slice(0, 2).map(w => w.topic).join(', ')}`);
  if (learnerContext.lastSubject)
    ctxParts.push(`Last subject: ${learnerContext.lastSubject}`);
  if (learnerContext.enjoymentSubjects.length > 0)
    ctxParts.push(`Enjoys: ${learnerContext.enjoymentSubjects[0].subjKey}`);

  if (ctxParts.length > 0) {
    return userMessageContent + `\n[LEARNER CONTEXT: ${ctxParts.join('. ')}. Use this to start teaching immediately — no more questions.]`;
  }
  return userMessageContent;
}

// === HOMEWORK PROMPT ===

/**
 * Builds the homework mode system prompt with age-appropriate templates.
 * Extracted from sendMessage lines 5173-5244.
 *
 * @param {string} name
 * @param {number} ageNum
 * @returns {string}
 */
export function buildHomeworkPrompt(name, ageNum) {
  if (ageNum <= AGE_BOUNDARIES.AUTO_SUBMIT_MAX) {
    return `You are Sunny, a brilliant, warm AI friend for ${name}, who is ${ageNum} years old.

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

Be warm, enthusiastic, and make learning feel like magic.`;
  }

  if (ageNum <= AGE_BOUNDARIES.YOUNG_MAX) {
    return `You are Sunny, a brilliant, knowledgeable AI companion for ${name}, who is ${ageNum} years old.

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

Always end with something that deepens curiosity — a related fun fact, a thought-provoking question, or encouragement.`;
  }

  // Older (10+)
  return `You are Sunny, an accurate, knowledgeable AI assistant for ${name}, who is ${ageNum} years old.

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
}

// === SYSTEM PROMPT SELECTOR ===

/**
 * The big system prompt selector. Handles:
 * 1. Adult language learning
 * 2. Adult subjects (skills, interview, life-coach, resume, followup, accent, trading)
 * 3. Homework mode
 * 4. Smart Mode
 * 5. Regular kid subjects
 *
 * Uses dynamic imports for sunnyPrompts functions (same pattern as the original).
 *
 * @param {object} config
 * @returns {Promise<string|null>}
 */
export async function selectSystemPrompt(config) {
  const { currentSubject, selectedTopic, userProgress, isAdultUser, isHomeworkMode,
          answerToSend, lastAiState, conversation, isInterpreterMode, activePair,
          interpreterTurn, interviewJobDesc, interviewCompany, interviewSearchResults,
          interviewNativeLang, followupMode, followupCompany, followupNativeLang,
          tradingSymbolInput, tradingSearchResults, tradingOptionsStrategy,
          resumeJobDesc, subjectsDef, advancedTopicsDef, subjectConstraintsDef } = config;

  const ageNum = parseInt(userProgress.age);

  // 1. Adult language learning
  if (isAdultUser && currentSubject === 'languages') {
    const { getAdultLanguageSystemPrompt } = await import('../utils/sunnyPrompts.js');
    const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const langLevel = userProgress.subjects?.languages?.languageLevels?.[selectedTopic] ?? 0;
    const cefrCode = CEFR[Math.min(Math.floor(langLevel), 5)] || 'A1';
    const targetLang = advancedTopicsDef?.languages?.find(l => l.id === selectedTopic)?.name || selectedTopic || 'English';
    return getAdultLanguageSystemPrompt(targetLang, userProgress.name, cefrCode, userProgress.language || 'en');
  }

  // 2. Adult subjects
  const isAdultSubject = ['skills', 'interview', 'life-coach', 'resume', 'followup', 'accent', 'trading', 'agents',
                          'college', 'law', 'accounting', 'cpa', 'pro-coaching',
                          'family-medicine', 'pharmacy', 'physical-therapy', 'nursing',
                          'rtl-design', 'physical-design', 'lab-debug'].includes(currentSubject);
  if (isAdultSubject) {
    // ── Professional & Academic Tracks ──────────────────────────────────────
    if (currentSubject === 'college') {
      const { getCollegeCourseSystemPrompt } = await import('../utils/sunnyPrompts.js');
      const COLLEGE_TOPICS = [
        { id: 'intro-accounting', name: 'Intro Accounting' }, { id: 'business-writing', name: 'Business Writing' },
        { id: 'economics-101', name: 'Economics' }, { id: 'statistics', name: 'Statistics' },
        { id: 'algebra-calculus', name: 'Algebra & Calculus' }, { id: 'essay-writing', name: 'Essay Writing' },
        { id: 'study-skills-college', name: 'Reading & Study Skills' }, { id: 'intro-finance', name: 'Intro Finance' },
        { id: 'psychology', name: 'Psychology' }, { id: 'bio-chem', name: 'Biology & Chemistry' },
      ];
      const topic = COLLEGE_TOPICS.find(t => t.id === selectedTopic);
      return getCollegeCourseSystemPrompt(topic?.name || selectedTopic || 'General', userProgress.name, userProgress.language || 'en');
    }
    if (currentSubject === 'law') {
      const { getLawSystemPrompt } = await import('../utils/sunnyPrompts.js');
      const LAW_TOPICS = [
        { id: 'legal-reading', name: 'Legal Reading' }, { id: 'case-briefing', name: 'Case Briefing' },
        { id: 'issue-spotting', name: 'Issue Spotting' }, { id: 'legal-writing', name: 'Legal Writing' },
        { id: 'contract-vocab', name: 'Contract Vocabulary' }, { id: 'legal-reasoning', name: 'Structured Reasoning' },
        { id: 'legal-interview', name: 'Legal Interview Prep' }, { id: 'legal-communication', name: 'Professional Communication' },
      ];
      const topic = LAW_TOPICS.find(t => t.id === selectedTopic);
      return getLawSystemPrompt(topic?.name || selectedTopic || 'Legal Reading', userProgress.name, userProgress.language || 'en');
    }
    if (currentSubject === 'accounting') {
      const { getAccountingSystemPrompt } = await import('../utils/sunnyPrompts.js');
      const ACCT_TOPICS = [
        { id: 'acct-concepts', name: 'Accounting Concepts' }, { id: 'journal-entries', name: 'Journal Entries' },
        { id: 'financial-stmts', name: 'Financial Statements' }, { id: 'auditing', name: 'Auditing Basics' },
        { id: 'tax-fundamentals', name: 'Tax Fundamentals' }, { id: 'excel-workflow', name: 'Excel & Workflow' },
        { id: 'acct-interview', name: 'Interview Prep' }, { id: 'client-explanation', name: 'Client Explanation' },
      ];
      const topic = ACCT_TOPICS.find(t => t.id === selectedTopic);
      return getAccountingSystemPrompt(topic?.name || selectedTopic || 'Accounting Concepts', userProgress.name, userProgress.language || 'en');
    }
    if (currentSubject === 'cpa') {
      const { getCpaExamSystemPrompt } = await import('../utils/sunnyPrompts.js');
      return getCpaExamSystemPrompt(selectedTopic || 'far', userProgress.name, userProgress.language || 'en');
    }
    if (currentSubject === 'pro-coaching') {
      const { getProCoachingSystemPrompt } = await import('../utils/sunnyPrompts.js');
      const COACHING_TOPICS = [
        { id: 'communication', name: 'Communication Coaching' }, { id: 'workplace-writing', name: 'Workplace Writing' },
        { id: 'presentations', name: 'Presentation Coaching' }, { id: 'structured-thinking', name: 'Structured Thinking' },
        { id: 'confidence', name: 'Confidence Building' }, { id: 'roleplay', name: 'Scenario Roleplay' },
        { id: 'industry-flows', name: 'Industry Coaching' }, { id: 'leadership', name: 'Leadership Skills' },
      ];
      const topic = COACHING_TOPICS.find(t => t.id === selectedTopic);
      return getProCoachingSystemPrompt(topic?.name || selectedTopic || 'Communication Coaching', userProgress.name, userProgress.language || 'en');
    }
    // ── Health Education Tracks ──────────────────────────────────────────────
    if (currentSubject === 'family-medicine') {
      const { getFamilyMedicineSystemPrompt } = await import('../utils/sunnyPrompts.js');
      const FM_TOPICS = [
        { id: 'clinical-reasoning', name: 'Clinical Reasoning' }, { id: 'patient-history', name: 'Patient History' },
        { id: 'differential-dx', name: 'Differential Diagnosis' }, { id: 'chronic-disease', name: 'Chronic Disease' },
        { id: 'preventive-care', name: 'Preventive Care' }, { id: 'lab-interpretation', name: 'Lab Interpretation' },
        { id: 'patient-communication', name: 'Patient Communication' }, { id: 'evidence-based', name: 'Evidence-Based Medicine' },
      ];
      const topic = FM_TOPICS.find(t => t.id === selectedTopic);
      return getFamilyMedicineSystemPrompt(topic?.name || selectedTopic || 'Clinical Reasoning', userProgress.name, userProgress.language || 'en');
    }
    if (currentSubject === 'pharmacy') {
      const { getPharmacySystemPrompt } = await import('../utils/sunnyPrompts.js');
      const RX_TOPICS = [
        { id: 'pharmacokinetics', name: 'Pharmacokinetics' }, { id: 'drug-interactions', name: 'Drug Interactions' },
        { id: 'dosage-calc', name: 'Dosage Calculations' }, { id: 'top-200-drugs', name: 'Top 200 Drugs' },
        { id: 'counseling', name: 'Patient Counseling' }, { id: 'compounding', name: 'Compounding' },
        { id: 'pharmacy-law', name: 'Pharmacy Law' }, { id: 'otc-recommendations', name: 'OTC Recommendations' },
      ];
      const topic = RX_TOPICS.find(t => t.id === selectedTopic);
      return getPharmacySystemPrompt(topic?.name || selectedTopic || 'Pharmacokinetics', userProgress.name, userProgress.language || 'en');
    }
    if (currentSubject === 'physical-therapy') {
      const { getPhysicalTherapySystemPrompt } = await import('../utils/sunnyPrompts.js');
      const PT_TOPICS = [
        { id: 'musculoskeletal', name: 'Musculoskeletal' }, { id: 'neurological-rehab', name: 'Neurological Rehab' },
        { id: 'exercise-prescription', name: 'Exercise Prescription' }, { id: 'gait-analysis', name: 'Gait Analysis' },
        { id: 'manual-therapy', name: 'Manual Therapy' }, { id: 'patient-assessment', name: 'Patient Assessment' },
        { id: 'documentation', name: 'Clinical Documentation' }, { id: 'geriatric-pt', name: 'Geriatric PT' },
      ];
      const topic = PT_TOPICS.find(t => t.id === selectedTopic);
      return getPhysicalTherapySystemPrompt(topic?.name || selectedTopic || 'Musculoskeletal', userProgress.name, userProgress.language || 'en');
    }
    if (currentSubject === 'nursing') {
      const { getNursingSystemPrompt } = await import('../utils/sunnyPrompts.js');
      const NURSING_TOPICS = [
        { id: 'patient-assessment', name: 'Patient Assessment' }, { id: 'medication-admin', name: 'Medication Administration' },
        { id: 'care-planning', name: 'Care Planning' }, { id: 'clinical-skills', name: 'Clinical Skills' },
        { id: 'nclex-prep', name: 'NCLEX Prep' }, { id: 'critical-thinking', name: 'Critical Thinking' },
        { id: 'patient-education', name: 'Patient Education' }, { id: 'documentation', name: 'Nursing Documentation' },
      ];
      const topic = NURSING_TOPICS.find(t => t.id === selectedTopic);
      return getNursingSystemPrompt(topic?.name || selectedTopic || 'Patient Assessment', userProgress.name, userProgress.language || 'en');
    }
    // ── Semiconductor / Hardware Engineering Tracks ──────────────────────────
    if (currentSubject === 'rtl-design') {
      const { getRTLDesignSystemPrompt } = await import('../utils/sunnyPrompts.js');
      const RTL_TOPICS = [
        { id: 'combinational-logic', name: 'Combinational Logic' }, { id: 'sequential-fsm', name: 'Sequential Logic & FSMs' },
        { id: 'pipelines-datapath', name: 'Pipelines & Datapath' }, { id: 'fifo-protocols', name: 'FIFOs & Bus Protocols' },
        { id: 'clock-reset-cdc', name: 'Clocking, Reset & CDC' }, { id: 'rtl-coding-style', name: 'RTL Coding Style' },
        { id: 'testbench-sim', name: 'Testbench & Simulation' }, { id: 'waveform-debug', name: 'Waveform Debug' },
        { id: 'assertions-coverage', name: 'Assertions & Coverage' }, { id: 'uvm-foundations', name: 'UVM Foundations' },
      ];
      const topic = RTL_TOPICS.find(t => t.id === selectedTopic);
      return getRTLDesignSystemPrompt(topic?.name || selectedTopic || 'Combinational Logic', userProgress.name, userProgress.language || 'en');
    }
    if (currentSubject === 'physical-design') {
      const { getPhysicalDesignSystemPrompt } = await import('../utils/sunnyPrompts.js');
      const PD_TOPICS = [
        { id: 'synthesis-handoff', name: 'Synthesis & Handoff' }, { id: 'floorplan-power', name: 'Floorplan & Power Planning' },
        { id: 'placement', name: 'Placement' }, { id: 'cts', name: 'Clock Tree Synthesis' },
        { id: 'routing-congestion', name: 'Routing & Congestion' }, { id: 'timing-closure', name: 'Timing Closure' },
        { id: 'signoff-drc-lvs', name: 'Signoff: DRC/LVS/STA' }, { id: 'eco-debug', name: 'ECO & Debug' },
      ];
      const topic = PD_TOPICS.find(t => t.id === selectedTopic);
      return getPhysicalDesignSystemPrompt(topic?.name || selectedTopic || 'Synthesis & Handoff', userProgress.name, userProgress.language || 'en');
    }
    if (currentSubject === 'lab-debug') {
      const { getLabDebugSystemPrompt } = await import('../utils/sunnyPrompts.js');
      const LAB_TOPICS = [
        { id: 'oscilloscope', name: 'Oscilloscope' }, { id: 'logic-analyzer', name: 'Logic Analyzer' },
        { id: 'multimeter-power', name: 'Multimeter & Power Supply' }, { id: 'waveform-reading', name: 'Waveform Reading' },
        { id: 'serial-debug', name: 'Serial & Debug Interfaces' }, { id: 'board-bringup', name: 'Board Bring-Up' },
        { id: 'debug-workflow', name: 'Structured Debug Workflow' }, { id: 'signal-integrity', name: 'Signal Integrity' },
      ];
      const topic = LAB_TOPICS.find(t => t.id === selectedTopic);
      return getLabDebugSystemPrompt(topic?.name || selectedTopic || 'Oscilloscope', userProgress.name, userProgress.language || 'en');
    }
    if (currentSubject === 'skills') {
      const { getSkillsSystemPrompt } = await import('../utils/sunnyPrompts.js');
      const SKILLS_TOPICS_LOCAL = [
        { id: 'python', name: 'Python' }, { id: 'javascript', name: 'JavaScript' },
        { id: 'cpp', name: 'C++' }, { id: 'java', name: 'Java' },
        { id: 'verilog', name: 'Verilog' }, { id: 'systemverilog', name: 'SystemVerilog' },
        { id: 'sql', name: 'SQL' }
      ];
      const skill = SKILLS_TOPICS_LOCAL.find(s => s.id === selectedTopic);
      return getSkillsSystemPrompt(skill?.name || selectedTopic, userProgress.name, userProgress.language || 'en');
    }
    if (currentSubject === 'interview') {
      const { getInterviewSystemPrompt } = await import('../utils/sunnyPrompts.js');
      return getInterviewSystemPrompt(interviewJobDesc, selectedTopic, interviewSearchResults, userProgress.name, interviewNativeLang);
    }
    if (currentSubject === 'life-coach') {
      const { getLifeCoachSystemPrompt } = await import('../utils/sunnyPrompts.js');
      return getLifeCoachSystemPrompt(userProgress.name, userProgress.language || 'en');
    }
    if (currentSubject === 'resume') {
      const { getResumeSystemPrompt } = await import('../utils/sunnyPrompts.js');
      return getResumeSystemPrompt(userProgress.name, resumeJobDesc, interviewNativeLang);
    }
    if (currentSubject === 'followup') {
      const { getFollowupSystemPrompt } = await import('../utils/sunnyPrompts.js');
      return getFollowupSystemPrompt(userProgress.name, followupMode, followupCompany, followupNativeLang);
    }
    if (currentSubject === 'accent') {
      const { getAccentCoachSystemPrompt } = await import('../utils/sunnyPrompts.js');
      return getAccentCoachSystemPrompt(userProgress.name, userProgress.language || 'en');
    }
    if (currentSubject === 'trading' || currentSubject === 'agents') {
      // Agent pipeline mode — no chat turns, user can't type; just ignore
      if (selectedTopic === 'agents' || currentSubject === 'agents') return null;
      const { getTradingSystemPrompt, getStockResearchPrompt, get0DTEPrompt, getOptionsDeskPrompt } = await import('../utils/sunnyPrompts.js');
      const level = userProgress.subjects?.trading?.level || 0;
      if (selectedTopic === 'options-desk') return getOptionsDeskPrompt(tradingOptionsStrategy, userProgress.name);
      if (selectedTopic === 'research') return getStockResearchPrompt(tradingSymbolInput, userProgress.name);
      if (selectedTopic === '0dte') return get0DTEPrompt(userProgress.name);
      return getTradingSystemPrompt(selectedTopic, tradingSymbolInput, tradingSearchResults, userProgress.name, level);
    }
    return null;
  }

  // 3. Homework mode
  if (isHomeworkMode) {
    return buildHomeworkPrompt(userProgress.name, ageNum);
  }

  // 4. Smart Mode
  if (currentSubject === 'smart') {
    const { getSmartModeSystemPrompt } = await import('../utils/sunnyPrompts.js');
    const { buildLearnerContext } = await import('./learnerMemory.js');
    const learnerCtx = buildLearnerContext(userProgress);
    return getSmartModeSystemPrompt({
      name: userProgress.name,
      age: ageNum,
      profileLang: userProgress.language || 'en',
    }, learnerCtx);
  }

  // 5. Regular kid subjects
  return buildTeachingPrompt(config);
}

// === TEACHING PROMPT BUILDER ===

/**
 * Builds the full teaching system prompt for regular subjects by calling
 * getSunnySystemPrompt and appending constraints, continuation instructions, etc.
 * Extracted from sendMessage lines 5286-5397.
 *
 * @param {object} config - same config object as selectSystemPrompt
 * @returns {Promise<string>}
 */
async function buildTeachingPrompt(config) {
  const { currentSubject, selectedTopic, userProgress, answerToSend, lastAiState,
          subjectsDef, advancedTopicsDef, subjectConstraintsDef } = config;

  // Import LANGUAGES from languageEngine here to avoid circular deps
  const { LANGUAGES } = await import('./languageEngine.js');
  const { getAgeGroup } = await import('../utils/sunnyPrompts.js');

  const ageNum = parseInt(userProgress.age);
  const subject = subjectsDef[currentSubject];
  const ageGroup = userProgress.ageGroup || getAgeGroup(userProgress.age);
  const level = userProgress.subjects[currentSubject]?.level || 0;
  const levelName = subject.levels[ageGroup]?.[level] || subject.levels[ageGroup]?.[0] || 'Beginner';

  // Get subject constraint — handle topics dynamically for ALL subjects
  let constraint;
  if (selectedTopic) {
    const topic = advancedTopicsDef?.[currentSubject]?.find(t => t.id === selectedTopic);
    if (topic) {
      // Topic-specific constraint for ANY subject with topics
      constraint = `CRITICAL: ONLY teach ${topic.name.toUpperCase()}. Focus exclusively on: ${topic.description}. DO NOT switch to other topics. Every question must be about ${topic.name}.`;
    } else {
      constraint = subjectConstraintsDef[currentSubject];
    }
  } else {
    constraint = subjectConstraintsDef[currentSubject];
  }

  // Build continuation instruction outside the template literal to avoid nested backtick errors
  const topicDisplayName = selectedTopic
    ? (advancedTopicsDef?.[currentSubject]?.find(t => t.id === selectedTopic)?.name || selectedTopic)
    : null;

  const _prevLangState = lastAiState;
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

  // Build adaptive intelligence fields
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

  const { getSunnySystemPrompt } = await import('../utils/sunnyPrompts.js');

  return getSunnySystemPrompt({
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
SUBJECT: ${subject.name}${selectedTopic ? ` - TOPIC: ${advancedTopicsDef?.[currentSubject]?.find(t => t.id === selectedTopic)?.name || selectedTopic}` : ''}
LEVEL: ${levelName}
${constraint}

${selectedTopic ? `CRITICAL: Student selected ${advancedTopicsDef?.[currentSubject]?.find(t => t.id === selectedTopic)?.name || selectedTopic} specifically. DO NOT switch to other topics within ${subject.name}. Stick to ${advancedTopicsDef?.[currentSubject]?.find(t => t.id === selectedTopic)?.name || selectedTopic} ONLY. Teach at ${levelName} level.` : `Stay on ${subject.name} ONLY.`}

User just answered: "${answerToSend}".
${continuationInstruction}`;
}
