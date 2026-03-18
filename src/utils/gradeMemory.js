/**
 * gradeMemory.js
 * Deterministic memory recall grading for Sunny's memory-game activity.
 *
 * Rules:
 *  - Normalize items and student tokens (lowercase, trim, strip punctuation).
 *  - Split the student's answer on commas, semicolons, "and", or newlines.
 *  - "correct"   → all expected items recalled, no wrong extras.
 *  - "partial"   → 1+ correct items but some missing or extras present.
 *  - "incorrect" → blank answer, or no expected items matched at all.
 *
 * "Close enough for their age" does NOT apply here — memory recall is
 * binary per item. Only exact normalized matches count.
 *
 * @param {string} answer        The student's raw typed/spoken answer.
 * @param {string[]} expectedItems  The items that were shown (from study_board.visual.items).
 * @returns {{ grade: 'correct'|'partial'|'incorrect'|'none',
 *             matched: string[],
 *             missing: string[],
 *             extra: string[],
 *             score: number }}   score = matched / total (0–1).
 */
export function gradeMemoryRecall(answer, expectedItems) {
  if (!Array.isArray(expectedItems) || expectedItems.length === 0) {
    return { grade: 'none', matched: [], missing: [], extra: [], score: 0 };
  }

  // Blank answer — nothing recalled
  if (!answer || !answer.trim()) {
    return {
      grade: 'incorrect',
      matched: [],
      missing: [...expectedItems],
      extra: [],
      score: 0,
    };
  }

  // Normalize: lowercase, strip punctuation/numbers, collapse spaces
  const normalize = (s) =>
    s.toLowerCase().trim().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();

  // Split student answer on: commas, semicolons, the word "and", newlines
  const tokens = answer
    .split(/[,;\n]+|\band\b/i)
    .map((t) => normalize(t))
    .filter(Boolean);

  const normalizedExpected = expectedItems.map(normalize);

  // Track which expected indices have been matched (prevent double-counting)
  const matchedIndices = [];
  const extra = [];

  for (const token of tokens) {
    if (!token) continue;
    const idx = normalizedExpected.findIndex(
      (e, i) => e === token && !matchedIndices.includes(i)
    );
    if (idx !== -1) {
      matchedIndices.push(idx);
    } else {
      extra.push(token);
    }
  }

  const matched = matchedIndices.map((i) => expectedItems[i]);
  const missing = expectedItems.filter((_, i) => !matchedIndices.includes(i));
  const score = matched.length / expectedItems.length;

  let grade;
  if (matched.length === expectedItems.length && extra.length === 0) {
    grade = 'correct';
  } else if (matched.length > 0) {
    grade = 'partial';
  } else {
    grade = 'incorrect';
  }

  return { grade, matched, missing, extra, score };
}

/**
 * Build the [GRADED: ...] hint string injected into the user message before
 * sending to the AI. The hint is authoritative — the AI must not override it.
 *
 * @param {string} answer
 * @param {string[]} expectedItems
 * @returns {string}  The hint to append, or '' if items are unavailable.
 */
export function buildMemoryGradeHint(answer, expectedItems) {
  if (!Array.isArray(expectedItems) || expectedItems.length === 0) return '';

  const result = gradeMemoryRecall(answer, expectedItems);
  const expectedStr = expectedItems.join(', ');

  if (result.grade === 'correct') {
    return `\n[GRADED: correct — student recalled all ${expectedItems.length} item(s): ${expectedStr}]`;
  }

  const parts = [];
  if (result.matched.length > 0) parts.push(`got: ${result.matched.join(', ')}`);
  if (result.missing.length > 0) parts.push(`missed: ${result.missing.join(', ')}`);
  if (result.extra.length > 0)   parts.push(`wrong extras: ${result.extra.join(', ')}`);

  const detail = parts.join('; ');

  if (result.grade === 'partial') {
    return `\n[GRADED: incorrect — expected all of: ${expectedStr}; ${detail}. Give feedback naming what they remembered and what they missed.]`;
  }

  // grade === 'incorrect' (nothing matched or blank)
  return `\n[GRADED: incorrect — expected: ${expectedStr}; student recalled none correctly. Gently reveal the items.]`;
}
