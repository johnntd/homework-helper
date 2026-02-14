import { useState, useCallback } from 'react';

/**
 * useTurnLoop Hook
 * Implements Sunny's strict turn-based learning loop:
 * ASK → WAIT → EVAL → TEACH → RETRY → ADVANCE
 */

export const TURN_STATES = {
  ASK: 'asking',
  WAIT: 'waiting',
  EVAL: 'evaluating',
  TEACH: 'teaching',
  RETRY: 'retrying',
  ADVANCE: 'advancing'
};

export const EXPECT_TYPES = {
  DIGITS: 'digits',
  LETTER: 'letter',
  WORD: 'word',
  PHRASE: 'phrase',
  CHOICE: 'choice',
  TRACE: 'trace',
  FREEFORM: 'freeform',
  NONE: 'none'
};

export default function useTurnLoop() {
  const [state, setState] = useState(TURN_STATES.ASK);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [grading, setGrading] = useState(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [isStruggling, setIsStruggling] = useState(false);

  /**
   * ASK: Present a question
   */
  const ask = useCallback((question) => {
    setCurrentQuestion(question);
    setUserAnswer('');
    setGrading(null);
    setAttemptCount(0);
    setIsStruggling(false);
    setState(TURN_STATES.ASK);
    
    // Automatically transition to WAIT
    setTimeout(() => setState(TURN_STATES.WAIT), 100);
  }, []);

  /**
   * WAIT: Wait for user input (automatically managed)
   */
  const submitAnswer = useCallback((answer) => {
    setUserAnswer(answer);
    setState(TURN_STATES.EVAL);
  }, []);

  /**
   * EVAL: Evaluate the answer
   */
  const evaluate = useCallback((answer, correctAnswer, expectType) => {
    const result = gradeAnswer(answer, correctAnswer, expectType);
    setGrading(result);
    setAttemptCount(prev => prev + 1);
    
    // Detect struggle: multiple attempts or hesitation
    if (attemptCount >= 1 || result.partial) {
      setIsStruggling(true);
    }

    // Transition based on result
    if (result.correct) {
      setState(TURN_STATES.ADVANCE);
    } else {
      setState(TURN_STATES.TEACH);
    }

    return result;
  }, [attemptCount]);

  /**
   * TEACH: Provide instruction when wrong
   */
  const teach = useCallback((teachingContent) => {
    setState(TURN_STATES.TEACH);
    // Teaching content is provided by caller
    // After teaching, move to RETRY
    return () => setState(TURN_STATES.RETRY);
  }, []);

  /**
   * RETRY: Ask to try again after teaching
   */
  const retry = useCallback((simplifiedQuestion) => {
    setCurrentQuestion(simplifiedQuestion || currentQuestion);
    setUserAnswer('');
    setState(TURN_STATES.RETRY);
    
    // Transition back to WAIT
    setTimeout(() => setState(TURN_STATES.WAIT), 100);
  }, [currentQuestion]);

  /**
   * ADVANCE: Move to next question after success
   */
  const advance = useCallback(() => {
    setState(TURN_STATES.ADVANCE);
    // Caller will provide next question
    return () => setState(TURN_STATES.ASK);
  }, []);

  /**
   * Reset the turn loop
   */
  const reset = useCallback(() => {
    setState(TURN_STATES.ASK);
    setCurrentQuestion(null);
    setUserAnswer('');
    setGrading(null);
    setAttemptCount(0);
    setIsStruggling(false);
  }, []);

  return {
    // State
    state,
    currentQuestion,
    userAnswer,
    grading,
    attemptCount,
    isStruggling,
    
    // Actions
    ask,
    submitAnswer,
    evaluate,
    teach,
    retry,
    advance,
    reset,
    
    // Helpers
    isAsking: state === TURN_STATES.ASK,
    isWaiting: state === TURN_STATES.WAIT,
    isEvaluating: state === TURN_STATES.EVAL,
    isTeaching: state === TURN_STATES.TEACH,
    isRetrying: state === TURN_STATES.RETRY,
    isAdvancing: state === TURN_STATES.ADVANCE
  };
}

/**
 * Grading Engine
 * Evaluates answers based on expect type
 */
function gradeAnswer(userAnswer, correctAnswer, expectType) {
  if (!userAnswer || userAnswer.trim() === '') {
    return {
      correct: false,
      partial: false,
      feedback: 'Please provide an answer'
    };
  }

  const answer = userAnswer.trim();
  const correct = String(correctAnswer).trim();

  switch (expectType) {
    case EXPECT_TYPES.DIGITS:
      return gradeNumeric(answer, correct);
    
    case EXPECT_TYPES.LETTER:
      return gradeLetter(answer, correct);
    
    case EXPECT_TYPES.WORD:
      return gradeWord(answer, correct);
    
    case EXPECT_TYPES.PHRASE:
      return gradePhrase(answer, correct);
    
    case EXPECT_TYPES.CHOICE:
      return gradeChoice(answer, correct);
    
    case EXPECT_TYPES.FREEFORM:
      return gradeFreeform(answer, correct);
    
    default:
      return gradeGeneric(answer, correct);
  }
}

// Numeric grading: exact match or close
function gradeNumeric(answer, correct) {
  const numAnswer = parseFloat(answer.replace(/[^0-9.-]/g, ''));
  const numCorrect = parseFloat(correct);
  
  if (isNaN(numAnswer) || isNaN(numCorrect)) {
    return { correct: false, partial: false, feedback: 'Please enter a number' };
  }
  
  if (numAnswer === numCorrect) {
    return { correct: true, partial: false, feedback: 'Perfect!' };
  }
  
  // Close enough? (within 10%)
  const diff = Math.abs(numAnswer - numCorrect);
  const closeEnough = diff / numCorrect < 0.1;
  
  if (closeEnough) {
    return { correct: false, partial: true, feedback: 'Very close!' };
  }
  
  return { correct: false, partial: false, feedback: 'Try again' };
}

// Letter grading: exact match (case insensitive)
function gradeLetter(answer, correct) {
  const match = answer.toUpperCase() === correct.toUpperCase();
  return {
    correct: match,
    partial: false,
    feedback: match ? 'Great job!' : 'Not quite'
  };
}

// Word grading: exact or phonetic match
function gradeWord(answer, correct) {
  const answerClean = answer.toLowerCase().replace(/[^a-z]/g, '');
  const correctClean = correct.toLowerCase().replace(/[^a-z]/g, '');
  
  if (answerClean === correctClean) {
    return { correct: true, partial: false, feedback: 'Perfect spelling!' };
  }
  
  // Check phonetic similarity
  const phonetic = getPhoneticSimilarity(answerClean, correctClean);
  if (phonetic > 0.7) {
    return { correct: false, partial: true, feedback: 'Close! Check the spelling' };
  }
  
  return { correct: false, partial: false, feedback: 'Try again' };
}

// Phrase grading: similarity check
function gradePhrase(answer, correct) {
  const answerWords = answer.toLowerCase().split(/\s+/);
  const correctWords = correct.toLowerCase().split(/\s+/);
  
  // Count matching words
  const matches = answerWords.filter(word => 
    correctWords.includes(word)
  ).length;
  
  const similarity = matches / Math.max(answerWords.length, correctWords.length);
  
  if (similarity > 0.8) {
    return { correct: true, partial: false, feedback: 'Great!' };
  } else if (similarity > 0.5) {
    return { correct: false, partial: true, feedback: 'Almost there!' };
  } else {
    return { correct: false, partial: false, feedback: 'Try again' };
  }
}

// Choice grading: exact match
function gradeChoice(answer, correct) {
  const match = answer.trim() === correct.trim();
  return {
    correct: match,
    partial: false,
    feedback: match ? 'Correct!' : 'Not the right choice'
  };
}

// Freeform grading: look for key facts
function gradeFreeform(answer, requiredKeywords) {
  // requiredKeywords can be an array or string
  const keywords = Array.isArray(requiredKeywords) 
    ? requiredKeywords 
    : [requiredKeywords];
  
  const answerLower = answer.toLowerCase();
  const foundKeywords = keywords.filter(keyword => 
    answerLower.includes(keyword.toLowerCase())
  );
  
  const score = foundKeywords.length / keywords.length;
  
  if (score === 1) {
    return { correct: true, partial: false, feedback: 'Excellent answer!' };
  } else if (score > 0.5) {
    return { correct: false, partial: true, feedback: 'Good start, add more details' };
  } else {
    return { correct: false, partial: false, feedback: 'Try to include the main points' };
  }
}

// Generic grading: case-insensitive match
function gradeGeneric(answer, correct) {
  const match = answer.toLowerCase() === correct.toLowerCase();
  return {
    correct: match,
    partial: false,
    feedback: match ? 'Correct!' : 'Try again'
  };
}

// Simple phonetic similarity (Levenshtein distance)
function getPhoneticSimilarity(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  
  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);
  return 1 - (distance / maxLen);
}

/**
 * Usage Example:
 * 
 * const {
 *   state,
 *   currentQuestion,
 *   isWaiting,
 *   ask,
 *   submitAnswer,
 *   evaluate,
 *   teach,
 *   retry,
 *   advance
 * } = useTurnLoop();
 * 
 * // Start with a question
 * ask({
 *   text: "What is 7 + 8?",
 *   correctAnswer: "15",
 *   expectType: EXPECT_TYPES.DIGITS,
 *   visual: "7+8",
 *   visualType: "addition"
 * });
 * 
 * // When user answers
 * const result = evaluate(userInput, question.correctAnswer, question.expectType);
 * 
 * if (result.correct) {
 *   advance();
 * } else {
 *   teach(teachingContent);
 *   retry(simplifiedQuestion);
 * }
 */
