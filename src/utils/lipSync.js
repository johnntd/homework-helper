/**
 * Lip-Sync Engine — Maps spoken words to mouth shape targets.
 *
 * Used with SpeechSynthesisUtterance.onboundary to drive MouthShape
 * component transitions in real time during TTS playback.
 *
 * The onboundary event fires at word boundaries (not phoneme-level),
 * so we analyze the word's dominant sound to pick a shape.
 *
 * Shapes: 'open' | 'round' | 'wide' | 'closed' | 'teeth'
 *
 * Supports English and Vietnamese (with diacritics).
 */

// Vietnamese vowels with diacritics
const VI_OPEN = /[aàáảãạăắằẳẵặâấầẩẫậ]/i;
const VI_ROUND = /[oòóỏõọôốồổỗộơớờởỡợuùúủũụưứừửữự]/i;
const VI_WIDE = /[eèéẻẽẹêếềểễệiìíỉĩị]/i;

/**
 * Analyze a word and return the mouth shape it most closely matches.
 */
export function wordToMouthShape(word) {
  if (!word || word.length === 0) return 'closed';
  const w = word.toLowerCase().trim();

  // Short words / punctuation → closed
  if (w.length <= 1 && !/[aeiou]/.test(w)) return 'closed';

  // Leading consonant clusters that define mouth position
  if (/^(f|v|ph)/.test(w)) return 'teeth';
  if (/^th/.test(w)) return 'teeth';
  if (/^(m|b|p|n)$/.test(w)) return 'closed'; // single consonant words
  if (/^(m|b|p)/.test(w) && w.length <= 3) return 'closed';

  // Vietnamese diacritical vowel analysis
  if (VI_ROUND.test(w)) return 'round';
  if (VI_WIDE.test(w)) return 'wide';
  if (VI_OPEN.test(w)) return 'open';

  // English vowel pattern analysis
  if (/oo|ou|ow|o[^n]|u[^nst]/.test(w)) return 'round';
  if (/ee|ea|ie|ey|i[^ng]/.test(w)) return 'wide';
  if (/a[^l]|ah|ar/.test(w)) return 'open';

  // Default: open mouth (most common speaking position)
  return 'open';
}

/**
 * Extract the word at a given character index from text.
 * Used with onboundary event's charIndex.
 */
export function getWordAtIndex(text, charIndex) {
  if (!text || charIndex < 0 || charIndex >= text.length) return '';
  // Find word boundaries around charIndex
  let start = charIndex;
  let end = charIndex;
  while (start > 0 && /\S/.test(text[start - 1])) start--;
  while (end < text.length && /\S/.test(text[end])) end++;
  return text.slice(start, end).replace(/[^a-zA-ZÀ-ỹ]/g, '');
}

/**
 * Lip-sync shape sequence: pre-compute shapes for a sentence.
 * Returns array of { shape, word, charIndex } for debugging/preview.
 */
export function computeLipSyncSequence(text) {
  if (!text) return [];
  const words = text.split(/\s+/);
  let charIndex = 0;
  return words.map(word => {
    const shape = wordToMouthShape(word);
    const entry = { shape, word, charIndex };
    charIndex += word.length + 1; // +1 for space
    return entry;
  });
}
