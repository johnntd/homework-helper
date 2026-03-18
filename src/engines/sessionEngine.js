/**
 * sessionEngine.js
 *
 * Pure JS module that manages session lifecycle, conversation utilities,
 * and goodbye handling. No React imports or hooks — all functions are pure
 * and testable.
 */

// ---------------------------------------------------------------------------
// Session State Enums
// ---------------------------------------------------------------------------

export const SESSION_STATES = {
  IDLE: 'idle',
  SESSION_START: 'session_start',
  LOAD_CONTEXT: 'load_context',
  START_TEACHING: 'start_teaching',
  DIAGNOSTIC_INFERENCE: 'diagnostic_inference',
  ADAPTIVE_TEACHING: 'adaptive_teaching',
  CHECK_UNDERSTANDING: 'check_understanding',
  PREREQUISITE_REVIEW: 'prerequisite_review',
  ADVANCE: 'advance',
  WRAP_OR_CONTINUE: 'wrap_or_continue',
};

export const INTERPRETER_STATES = {
  INTERPRETER_START: 'interpreter_start',
  LISTENING: 'listening',
  TRANSLATING: 'translating',
  SPEAKING: 'speaking',
  RESUME_LISTENING: 'resume_listening',
};

export const TRANSLATION_STATES = {
  INPUT_CAPTURE: 'input_capture',
  DETECT_LANGUAGE_OR_TASK: 'detect_language_or_task',
  EXPLAIN_OR_TRANSLATE: 'explain_or_translate',
  FOLLOWUP_GUIDANCE: 'followup_guidance',
};

// ---------------------------------------------------------------------------
// trimGoodbye
// ---------------------------------------------------------------------------

/**
 * Trims farewell exchanges from the end of a saved conversation so that
 * "Continue Session" resumes at the last real question.
 *
 * Extracted from App.jsx lines 117-154.
 */
export function trimGoodbye(conversation, savedCoachSay, savedStudyBoard) {
  const USER_BYE = ['bye', 'goodbye', 'see you', 'cya', 'c ya', 'good night', 'goodnight', 'gotta go', 'all done', "i'm done", 'im done', 'ttyl', 'talk later'];
  const AI_BYE = ['goodbye', 'bye!', 'bye bye', 'see you soon', 'see you next', 'take care!', 'until next time', 'great session today', "that's all for today", 'talk soon', 'until we meet', 'see you soon!', 'bye-bye', 'farewell', 'signing off', 'well done today!', 'great job today!', "you're all set for today"];

  const msgs = [...(conversation || [])];
  const originalLen = msgs.length;

  let changed = true;
  while (changed && msgs.length > 1) {
    changed = false;
    const last = msgs[msgs.length - 1];
    const prev = msgs.length >= 2 ? msgs[msgs.length - 2] : null;
    const lastText = (last?.content || '').toLowerCase();
    const prevText = (prev?.content || '').toLowerCase();

    if (last.role === 'assistant' && prev?.role === 'user' && USER_BYE.some(kw => prevText.includes(kw))) {
      msgs.pop(); msgs.pop(); changed = true;
    } else if (last.role === 'assistant' && AI_BYE.some(kw => lastText.includes(kw))) {
      msgs.pop(); changed = true;
    } else if (last.role === 'user' && USER_BYE.some(kw => lastText.includes(kw))) {
      msgs.pop(); changed = true;
    }
  }

  if (msgs.length === originalLen) {
    return { conversation: msgs, coachSay: savedCoachSay, studyBoard: savedStudyBoard };
  }
  const prevAss = [...msgs].reverse().find(m => m.role === 'assistant');
  return { conversation: msgs, coachSay: prevAss?.content?.slice(0, 300) || '', studyBoard: savedStudyBoard };
}

// ---------------------------------------------------------------------------
// isGoodbye
// ---------------------------------------------------------------------------

/**
 * Detects whether a user message is a goodbye.
 *
 * Extracted from sendMessage goodbye detection (App.jsx lines 4883-4887).
 */
export function isGoodbye(answerText) {
  const _goodbyeRx = /\b(goodbye|bye( bye)?|see you( later)?|see ya|good ?night|farewell|take care|adios|ciao|au revoir)\b/i;
  const _isSunnyBye = _goodbyeRx.test(answerText) && /\bsunny\b/i.test(answerText);
  const _isGenericBye = /^(goodbye|bye|bye bye|see you|see ya|good night|farewell)[\s!.]*$/i.test(answerText);
  return _isSunnyBye || _isGenericBye;
}

// ---------------------------------------------------------------------------
// generateGoodbye
// ---------------------------------------------------------------------------

/**
 * Returns a random goodbye message personalised with the student's name.
 *
 * Extracted from sendMessage lines 4889-4894.
 */
export function generateGoodbye(name) {
  const msgs = [
    `Goodbye, ${name}! You did amazing today — keep that streak going! See you next time! ⭐`,
    `Bye bye, ${name}! So proud of all the hard work you put in. Come back soon! 🌟`,
    `See you later, ${name}! You were on fire today! Rest up and let's learn more next time! 🚀`,
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

/**
 * Creates a new session object.
 */
export function createSession(subjectKey, topicId, options = {}) {
  return {
    id: `${subjectKey}-${Date.now()}`,
    subjectKey,
    topicId,
    state: SESSION_STATES.SESSION_START,
    conversation: [],
    coachSay: '',
    studyBoard: null,
    interpreterPair: options.interpreterPair || null,
    interpreterTurn: 'from',
    isInterpreterMode: options.isInterpreterMode || false,
    turnCount: 0,
    metadata: {
      startedAt: Date.now(),
      isHomework: options.isHomework || false,
      isAdult: options.isAdult || false,
    },
  };
}

// ---------------------------------------------------------------------------
// transitionState
// ---------------------------------------------------------------------------

/**
 * Returns an updated session with a new state (and optional payload merge).
 */
export function transitionState(session, newState, payload = {}) {
  return {
    ...session,
    state: newState,
    turnCount: session.turnCount + (payload.incrementTurn ? 1 : 0),
    ...payload,
  };
}

// ---------------------------------------------------------------------------
// buildApiMessages
// ---------------------------------------------------------------------------

/**
 * Converts a conversation array to properly formatted API messages, handling
 * content extraction from various formats.
 *
 * Extracted from sendMessage lines 4954-5003.
 */
export function buildApiMessages(conversation) {
  const apiMessages = [];
  let foundFirstUser = false;

  for (const msg of conversation) {
    if (!msg.content) continue;
    if (!foundFirstUser && msg.role === 'assistant') continue;
    if (msg.role === 'user') foundFirstUser = true;

    let contentString = '';
    if (typeof msg.content === 'string') {
      contentString = msg.content;
    } else if (msg.content && typeof msg.content === 'object') {
      if (typeof msg.content.content === 'string') {
        contentString = msg.content.content;
      } else if (msg.content.text && typeof msg.content.text === 'string') {
        contentString = msg.content.text;
      } else if (msg.content.answer && typeof msg.content.answer === 'string') {
        contentString = msg.content.answer;
      } else {
        const values = Object.values(msg.content);
        const stringValue = values.find(v => typeof v === 'string' && v.length > 0);
        contentString = stringValue || 'User response';
      }
    } else {
      contentString = String(msg.content);
    }

    apiMessages.push({ role: msg.role, content: contentString });
  }

  return apiMessages;
}

// ---------------------------------------------------------------------------
// canResume
// ---------------------------------------------------------------------------

/**
 * Determines whether a session has enough valid conversation history to
 * be resumed.
 */
export function canResume(session) {
  if (!session?.conversation?.length) return false;
  if (session.conversation.length === 1) {
    const content = session.conversation[0]?.content;
    if (typeof content === 'string' && (
      content.includes('Something went wrong') ||
      content.includes('API Error') ||
      content.includes('server is a bit busy')
    )) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// getSessionPhaseInstruction
// ---------------------------------------------------------------------------

/**
 * Returns a phase-aware instruction string to append to system prompts
 * based on the current session state.
 */
export function getSessionPhaseInstruction(state) {
  switch (state) {
    case SESSION_STATES.DIAGNOSTIC_INFERENCE:
      return 'You are in DIAGNOSTIC phase. Ask a question slightly harder than expected to gauge the student\'s real level. Do not teach yet — just assess.';
    case SESSION_STATES.PREREQUISITE_REVIEW:
      return 'The student struggled with a concept. Review the prerequisite knowledge before moving forward. Teach the foundation first.';
    case SESSION_STATES.ADVANCE:
      return 'The student has mastered this level. Increase the difficulty. Challenge them with a harder problem.';
    case SESSION_STATES.WRAP_OR_CONTINUE:
      return 'This session has been going for a while. Offer the student a choice: wrap up with a summary of what was learned, or continue to the next topic.';
    case SESSION_STATES.CHECK_UNDERSTANDING:
      return 'Check whether the student truly understood the concept. Ask a verification question that tests the same concept from a different angle.';
    default:
      return '';
  }
}
