/**
 * learnerMemory.js
 *
 * Pure JS module that centralizes all learner data constants, computation,
 * and persistence logic extracted from App.jsx.
 *
 * No React imports. Functions receive data and return results.
 * All state mutations happen in App.jsx by calling setState with the returned values.
 */

// === CONSTANTS (extracted from App.jsx lines 13-77) ===

export const AGE_BOUNDARIES = {
  AUTO_SUBMIT_MAX: 6,
  VOICE_ALWAYS_MAX: 9,
  TTS_MAX: 13,
  VERY_YOUNG_MAX: 7,
  YOUNG_MAX: 9,
  MIDDLE_MAX: 12,
  TEEN_MIN: 13,
  TEEN_MAX: 18
};

export const GRADES = {
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
  'college': { name: 'College',      ageGroup: '14-18', next: null      },
  'adult':   { name: 'Professional', ageGroup: 'adult', next: null      }
};

export const getGradeFromAge = (age) => {
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
  if (ageNum >= 22) return 'adult';
  return 'college'; // 18-21
};

export const getNextGrade = (currentGrade) => {
  return GRADES[currentGrade]?.next || null;
};

export const getAgeGroupForGrade = (grade) => {
  return GRADES[grade]?.ageGroup || '10-13';
};

export const gradeToNum = (grade) => {
  if (grade === 'K') return 0;
  if (grade === 'college') return 13;
  return parseInt(grade) || 0;
};

// === NON-SCORING SUBJECTS ===
// These subjects skip the standard point-scoring schema in updateProgress.
const NON_SCORING = [
  'accent', 'trading', 'research', '0dte', 'options-desk',
  'interview', 'life-coach', 'skills', 'followup', 'resume', 'agents'
];

// === LEARNER CONTEXT ===

/**
 * buildLearnerContext
 *
 * Extracted from App.jsx `buildSmartLearnerContext` (lines 3889-3928).
 * Takes userProgress, returns a rich context object summarizing the
 * learner's strengths, weaknesses, enjoyment, and session history.
 *
 * @param {object} userProgress
 * @returns {{
 *   weakTopics: Array<{topic: string, subjKey: string, accuracy: number, attempts: number}>,
 *   strongTopics: Array<{topic: string, subjKey: string, accuracy: number}>,
 *   enjoymentSubjects: Array<{subjKey: string, sessions: number}>,
 *   lastSubject: string|null,
 *   totalSessions: number,
 *   streak: number,
 * }}
 */
export function buildLearnerContext(userProgress) {
  const subjects = userProgress?.subjects || {};
  const weakTopics = [];
  const strongTopics = [];
  const enjoymentSubjects = [];
  let lastSubject = null;
  let lastSubjectTime = 0;

  Object.entries(subjects).forEach(([subjKey, sd]) => {
    // Last active subject: most recent attempt timestamp
    const recentAttempts = sd.recentAttempts || [];
    const lastAttempt = recentAttempts[recentAttempts.length - 1];
    if (lastAttempt?.timestamp && lastAttempt.timestamp > lastSubjectTime) {
      lastSubjectTime = lastAttempt.timestamp;
      lastSubject = subjKey;
    }

    // Enjoyment signal: subjects visited 3+ times
    const sessCount = sd.activitiesCompleted || 0;
    if (sessCount >= 3) {
      enjoymentSubjects.push({ subjKey, sessions: sessCount });
    }

    // Topic accuracy stats
    Object.entries(sd.topicStats || {}).forEach(([topic, stats]) => {
      const acc = stats.attempts > 0 ? stats.correct / stats.attempts : 0;
      if (stats.attempts >= 2 && acc < 0.6) {
        weakTopics.push({ topic, subjKey, accuracy: acc, attempts: stats.attempts });
      }
      if (stats.attempts >= 3 && acc >= 0.8) {
        strongTopics.push({ topic, subjKey, accuracy: acc });
      }
    });
  });

  weakTopics.sort((a, b) => a.accuracy - b.accuracy);
  strongTopics.sort((a, b) => b.accuracy - a.accuracy);
  enjoymentSubjects.sort((a, b) => b.sessions - a.sessions);

  return {
    weakTopics: weakTopics.slice(0, 5),
    strongTopics: strongTopics.slice(0, 3),
    enjoymentSubjects: enjoymentSubjects.slice(0, 3),
    lastSubject,
    totalSessions: Object.values(subjects).reduce((s, sd) => s + (sd.activitiesCompleted || 0), 0),
    streak: userProgress?.streak || 0,
  };
}

/**
 * buildEnhancedLearnerProfile
 *
 * Extends buildLearnerContext with unfinished lessons, language levels,
 * per-subject progress, and recent wins.
 *
 * @param {object} userProgress
 * @returns {object} Enhanced profile including all fields from buildLearnerContext plus:
 *   - unfinishedLessons: Array<{subjectKey: string, savedAt: number}>
 *   - languageLevelByLang: Record<string, any>
 *   - progressBySubject: Record<string, {level: number, maxLevel: number, pct: number}>
 *   - recentWins: Array<{topic: string, subjKey: string, timestamp: number}>
 */
export function buildEnhancedLearnerProfile(userProgress) {
  const base = buildLearnerContext(userProgress);
  const name = userProgress?.name;

  // --- Unfinished lessons: scan localStorage for tutor:session:{name}:* keys ---
  const unfinishedLessons = [];
  if (name) {
    try {
      const prefix = `tutor:session:${name}:`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const subjectKey = key.slice(prefix.length);
          try {
            const session = JSON.parse(localStorage.getItem(key));
            if (session?.conversation?.length && !isErrorSession(session)) {
              unfinishedLessons.push({
                subjectKey,
                savedAt: session.savedAt || session.timestamp || 0,
              });
            }
          } catch { /* skip corrupted entries */ }
        }
      }
    } catch { /* localStorage may be unavailable */ }
  }

  // --- Language levels ---
  const languageLevelByLang = userProgress?.subjects?.languages?.languageLevels || {};

  // --- Progress by subject ---
  const progressBySubject = {};
  const subjects = userProgress?.subjects || {};
  Object.entries(subjects).forEach(([subjKey, sd]) => {
    const level = sd.level || 0;
    const maxLevel = sd.maxLevel || 1;
    const pct = maxLevel > 0 ? Math.round((level / maxLevel) * 100) : 0;
    progressBySubject[subjKey] = { level, maxLevel, pct };
  });

  // --- Recent wins: last 5 successful attempts across all subjects ---
  const allWins = [];
  Object.entries(subjects).forEach(([subjKey, sd]) => {
    const attempts = sd.recentAttempts || [];
    attempts.forEach((a) => {
      if (a.success) {
        allWins.push({
          topic: a.topic || 'general',
          subjKey,
          timestamp: a.timestamp || 0,
        });
      }
    });
  });
  allWins.sort((a, b) => b.timestamp - a.timestamp);
  const recentWins = allWins.slice(0, 5);

  return {
    ...base,
    unfinishedLessons,
    languageLevelByLang,
    progressBySubject,
    recentWins,
  };
}

// === PROGRESS COMPUTATION ===

/**
 * computeProgressUpdate
 *
 * Pure function extracted from `updateProgress` (App.jsx lines 2233-2299).
 * Returns { updatedProgress, advancementPending } instead of calling setState.
 *
 * @param {object} userProgress - current progress (will NOT be mutated)
 * @param {string} subjectKey
 * @param {boolean} wasCorrect
 * @param {string|null} selectedTopic
 * @param {object} subjectsDef - subjects definition object for level lookups
 * @returns {{ updatedProgress: object, advancementPending: object|null }|null}
 *   Returns null if subject is non-scoring or missing required data.
 *   advancementPending is { subjectKey, currentGrade, nextGrade } or null.
 */
export function computeProgressUpdate(userProgress, subjectKey, wasCorrect, selectedTopic, subjectsDef) {
  // Adult/accent subjects don't use the standard point-scoring schema
  if (NON_SCORING.includes(subjectKey)) return null;

  const newProgress = JSON.parse(JSON.stringify(userProgress));
  const subject = newProgress.subjects[subjectKey];
  if (!subject || subject.totalAttempts === undefined) return null; // guard against missing schema

  let advancementPending = null;

  subject.totalAttempts += 1;

  // Per-topic mastery tracking
  if (selectedTopic) {
    if (!subject.topicStats) subject.topicStats = {};
    if (!subject.topicStats[selectedTopic]) {
      subject.topicStats[selectedTopic] = { attempts: 0, correct: 0, lastSeen: null };
    }
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
        // AT MAX LEVEL - track advancement streak
        subject.difficultyBoost   = (subject.difficultyBoost   || 0) + 1;
        subject.advancementStreak = (subject.advancementStreak || 0) + 1;
        subject.currentStreak     = 0;

        if (subject.advancementStreak >= 5) {
          const currentGrade = subject.gradeLevel;
          const nextGrade    = getNextGrade(currentGrade);
          if (nextGrade) {
            subject.readyForAdvancement = true;
            advancementPending = { subjectKey, currentGrade, nextGrade };
          } else {
            subject.readyForAdvancement = true;
          }
        } else {
          subject.readyForAdvancement = subject.advancementStreak >= 3;
        }
      }
    }
  } else {
    subject.currentStreak = 0;
  }

  subject.activitiesCompleted += 1;
  newProgress.totalActivities += 1;
  newProgress.lastActivity = new Date().toISOString();

  return { updatedProgress: newProgress, advancementPending };
}

/**
 * trackAttempt
 *
 * Extracted from App.jsx lines 2140-2169.
 * Returns { updatedProgress, isStruggling }.
 *
 * @param {object} userProgress - current progress (will NOT be mutated)
 * @param {string} subjectKey
 * @param {boolean} wasSuccessful
 * @param {string|null} selectedTopic
 * @returns {{ updatedProgress: object, isStruggling: boolean }}
 */
export function trackAttempt(userProgress, subjectKey, wasSuccessful, selectedTopic) {
  const newProgress = JSON.parse(JSON.stringify(userProgress));
  const subjectProgress = newProgress.subjects[subjectKey];

  if (!subjectProgress) {
    return { updatedProgress: newProgress, isStruggling: false };
  }

  if (!subjectProgress.recentAttempts) {
    subjectProgress.recentAttempts = [];
  }

  subjectProgress.recentAttempts.push({
    timestamp: Date.now(),
    success: wasSuccessful,
    topic: selectedTopic || 'general',
    level: subjectProgress.level,
  });

  // Keep only last 20 attempts to avoid bloat
  if (subjectProgress.recentAttempts.length > 20) {
    subjectProgress.recentAttempts = subjectProgress.recentAttempts.slice(-20);
  }

  // Calculate recent performance
  const last5 = subjectProgress.recentAttempts.slice(-5);
  const failures = last5.filter(a => !a.success).length;
  const isStruggling = failures >= 3;

  return { updatedProgress: newProgress, isStruggling };
}

/**
 * computeGradeAdvancement
 *
 * Extracted from advanceGrade (App.jsx lines 2173-2204).
 * Returns { updatedProgress, oldGradeName, newGradeName, toast } or null if can't advance.
 *
 * @param {object} userProgress - current progress (will NOT be mutated)
 * @param {string} subjectKey
 * @param {object} subjectsDef - subjects definition object for level lookups
 * @returns {{ updatedProgress: object, oldGradeName: string, newGradeName: string, toast: string }|null}
 */
export function computeGradeAdvancement(userProgress, subjectKey, subjectsDef) {
  const newProgress = JSON.parse(JSON.stringify(userProgress));
  const subject = newProgress.subjects[subjectKey];
  if (!subject) return null;

  const currentGrade = subject.gradeLevel;
  const nextGrade = getNextGrade(currentGrade);

  if (!nextGrade) {
    return null; // Already at College or adult - no further advancement
  }

  const oldGradeName = GRADES[currentGrade]?.name || currentGrade;
  const newGradeName = GRADES[nextGrade]?.name || nextGrade;
  const newAgeGroup  = getAgeGroupForGrade(nextGrade);
  const newMaxLevel  = (subjectsDef[subjectKey]?.levels?.[newAgeGroup]?.length ?? 1) - 1;

  subject.gradeLevel          = nextGrade;
  subject.level               = 0;
  subject.maxLevel            = newMaxLevel;
  subject.advancementStreak   = 0;
  subject.readyForAdvancement = false;
  subject.difficultyBoost     = 0;
  subject.currentStreak       = 0;

  const subjectName = subjectsDef[subjectKey]?.name || subjectKey;
  const toast = `Now learning ${newGradeName} ${subjectName}!`;

  return { updatedProgress: newProgress, oldGradeName, newGradeName, toast };
}

// === SESSION PERSISTENCE ===

/**
 * saveSession - Persist session data to localStorage.
 *
 * @param {string} userName
 * @param {string} subjectKey
 * @param {object} data - { conversation, currentCoachSay, currentStudyBoard, lastActivity, timestamp, ... }
 */
export function saveSession(userName, subjectKey, data) {
  try {
    localStorage.setItem(`tutor:session:${userName}:${subjectKey}`, JSON.stringify(data));
  } catch { /* localStorage may be full or unavailable */ }
}

/**
 * loadSession - Load a saved session from localStorage.
 *
 * @param {string} userName
 * @param {string} subjectKey
 * @returns {object|null}
 */
export function loadSession(userName, subjectKey) {
  try {
    const raw = localStorage.getItem(`tutor:session:${userName}:${subjectKey}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * clearSession - Remove a saved session from localStorage.
 *
 * @param {string} userName
 * @param {string} subjectKey
 */
export function clearSession(userName, subjectKey) {
  try {
    localStorage.removeItem(`tutor:session:${userName}:${subjectKey}`);
  } catch { /* ignore */ }
}

/**
 * isErrorSession - Returns true if the session contains only an error message.
 * Used to avoid restoring sessions that ended in an error state.
 *
 * @param {object} session
 * @returns {boolean}
 */
export function isErrorSession(session) {
  if (!session?.conversation?.length) return false;
  if (session.conversation.length !== 1) return false;
  const content = session.conversation[0]?.content;
  if (typeof content !== 'string') return false;
  return content.includes('Something went wrong') ||
         content.includes('API Error') ||
         content.includes('server is a bit busy');
}

/**
 * findRecentSession - Returns the key of the first subject that has a non-error saved session.
 *
 * @param {string} userName
 * @param {string[]} subjectKeys - ordered list of subject keys to check
 * @returns {string|null} - the subject key with a valid session, or null
 */
export function findRecentSession(userName, subjectKeys) {
  return subjectKeys.find(k => {
    const session = loadSession(userName, k);
    if (!session?.conversation?.length) return false;
    return !isErrorSession(session);
  }) || null;
}

// === PROGRESS PERSISTENCE ===

/**
 * saveProgress - Persist userProgress to Firestore (if authenticated) and localStorage.
 *
 * Extracted from saveUserProgress (App.jsx lines 2111-2137).
 * Takes db and setDocFn as params to avoid importing firebase directly.
 *
 * @param {object} progress - the full userProgress object
 * @param {string|null} firebaseUid - current user's Firebase UID, or null for offline-only
 * @param {object|null} db - Firestore db instance
 * @param {Function|null} setDocFn - Firestore setDoc function
 */
export async function saveProgress(progress, firebaseUid, db, setDocFn) {
  if (firebaseUid && db && setDocFn) {
    try {
      const { doc } = await import('firebase/firestore');
      await setDocFn(doc(db, 'users', firebaseUid), progress, { merge: true });
    } catch (error) {
      console.error('Firestore save failed:', error);
    }
  }

  const cacheKey = firebaseUid ? `tutor:uid:${firebaseUid}` : `tutor:${progress.name}:${progress.age}`;
  try {
    localStorage.setItem(cacheKey, JSON.stringify(progress));
  } catch { /* localStorage may be full or unavailable */ }

  if (!firebaseUid) {
    try {
      const key = `tutor:${progress.name}:${progress.age}`;
      localStorage.setItem(key, JSON.stringify(progress));
      sessionStorage.setItem(key, JSON.stringify(progress));
    } catch { /* ignore */ }
  }
}
