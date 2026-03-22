/**
 * gradeMemory.test.mjs
 *
 * Run with: node src/utils/gradeMemory.test.mjs
 *
 * Tests gradeMemoryRecall() to ensure wrong answers are NEVER marked correct.
 */

import { gradeMemoryRecall, buildMemoryGradeHint } from './gradeMemory.js';

// ── tiny test harness ──────────────────────────────────────────────────────
let pass = 0;
let fail = 0;

function expect(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`      expected: ${JSON.stringify(expected)}`);
    console.error(`      actual:   ${JSON.stringify(actual)}`);
    fail++;
  }
}

function section(name) {
  console.log(`\n${name}`);
}

const ITEMS = ['Dog', 'Cat', 'Frog'];

// ── gradeMemoryRecall tests ────────────────────────────────────────────────

section('Exact match (different capitalisation)');
expect('all correct',            gradeMemoryRecall('dog, cat, frog', ITEMS).grade,   'correct');
expect('score = 1',              gradeMemoryRecall('dog, cat, frog', ITEMS).score,   1);
expect('no missing',             gradeMemoryRecall('dog, cat, frog', ITEMS).missing, []);
expect('no extras',              gradeMemoryRecall('dog, cat, frog', ITEMS).extra,   []);
expect('uppercase input',        gradeMemoryRecall('DOG, CAT, FROG', ITEMS).grade,   'correct');
expect('mixed case',             gradeMemoryRecall('Dog, Cat, Frog', ITEMS).grade,   'correct');

section('Different order — must still be correct');
expect('reversed order',         gradeMemoryRecall('frog, cat, dog', ITEMS).grade,   'correct');
expect('partial-shuffle',        gradeMemoryRecall('cat, dog, frog', ITEMS).grade,   'correct');

section('Separator variants');
expect('semicolons',             gradeMemoryRecall('dog; cat; frog', ITEMS).grade,   'correct');
expect('"and" separator',        gradeMemoryRecall('dog and cat and frog', ITEMS).grade, 'correct');
expect('newlines',               gradeMemoryRecall('dog\ncat\nfrog', ITEMS).grade,   'correct');
expect('mixed separators',       gradeMemoryRecall('dog, cat and frog', ITEMS).grade,'correct');

section('Partial recall — must be INCORRECT (not correct)');
const partial1 = gradeMemoryRecall('dog, cat', ITEMS);
expect('2 of 3 → incorrect',     partial1.grade,   'partial');  // grade is "partial" ...
// ...but buildMemoryGradeHint must map it to [GRADED: incorrect]
const hint1 = buildMemoryGradeHint('dog, cat', ITEMS);
expect('hint contains GRADED: incorrect', hint1.startsWith('\n[GRADED: incorrect'), true);
expect('hint mentions missing frog',      hint1.includes('Frog'),                    true);
expect('matched items tracked',           partial1.matched,  ['Dog', 'Cat']);
expect('missing tracked',                 partial1.missing,  ['Frog']);

section('Extra items — must be INCORRECT');
const extra1 = gradeMemoryRecall('dog, cat, frog, bird', ITEMS);
expect('extra item → partial',    extra1.grade,   'partial');
expect('extra tracked',           extra1.extra,   ['bird']);
const hint2 = buildMemoryGradeHint('dog, cat, frog, bird', ITEMS);
expect('hint contains GRADED: incorrect', hint2.startsWith('\n[GRADED: incorrect'), true);

section('Wrong items — must be INCORRECT');
expect('lion tiger frog → partial',    gradeMemoryRecall('lion, tiger, frog', ITEMS).grade,  'partial');
expect('lion tiger bear → incorrect',  gradeMemoryRecall('lion, tiger, bear', ITEMS).grade,  'incorrect');

section('Blank answer — must be INCORRECT');
expect('empty string',           gradeMemoryRecall('', ITEMS).grade,    'incorrect');
expect('spaces only',            gradeMemoryRecall('   ', ITEMS).grade, 'incorrect');
expect('null answer',            gradeMemoryRecall(null, ITEMS).grade,  'incorrect');
const hintBlank = buildMemoryGradeHint('', ITEMS);
expect('blank hint → incorrect', hintBlank.startsWith('\n[GRADED: incorrect'), true);

section('Score tracking');
expect('1 of 3 score',  gradeMemoryRecall('dog', ITEMS).score, 1/3);
expect('2 of 3 score',  gradeMemoryRecall('dog, cat', ITEMS).score, 2/3);
expect('0 of 3 score',  gradeMemoryRecall('elephant', ITEMS).score, 0);

section('No double-counting duplicates');
expect('dog, dog, cat not correct', gradeMemoryRecall('dog, dog, cat', ITEMS).grade, 'partial');
expect('dog, dog, cat missing frog', gradeMemoryRecall('dog, dog, cat', ITEMS).missing, ['Frog']);

section('Edge cases');
expect('empty items list → none',   gradeMemoryRecall('dog', []).grade,   'none');
expect('undefined items → none',    gradeMemoryRecall('dog', undefined).grade, 'none');

section('buildMemoryGradeHint — correct path');
const hintOk = buildMemoryGradeHint('dog, cat, frog', ITEMS);
expect('correct hint starts right', hintOk.startsWith('\n[GRADED: correct'), true);
expect('correct hint mentions all items', hintOk.includes('Dog') || hintOk.includes('dog'), true);

section('Hint never marks partial as correct');
const ANIMALS = ['Lion', 'Tiger', 'Bear', 'Eagle'];
const hintPartial = buildMemoryGradeHint('lion, tiger', ANIMALS);
expect('2/4 hint is incorrect', hintPartial.startsWith('\n[GRADED: incorrect'), true);

// ── summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error('GRADING TESTS FAILED — wrong answers can still be graded as correct!');
  process.exit(1);
} else {
  console.log('All grading tests passed. Wrong answers cannot be graded as correct.');
}
