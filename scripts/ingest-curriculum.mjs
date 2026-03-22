#!/usr/bin/env node
/**
 * NotebookLM Curriculum Ingestion Pipeline
 *
 * Processes curriculum source URLs through NotebookLM to produce structured
 * educational content (vocabulary, quiz questions, concepts) stored as JSON.
 * Sunny pulls from this content library at runtime instead of generating
 * generic content from scratch.
 *
 * Usage:
 *   node scripts/ingest-curriculum.mjs              # ingest all topics
 *   node scripts/ingest-curriculum.mjs --dry-run    # validate config only
 *   node scripts/ingest-curriculum.mjs --force      # re-ingest cached topics
 *
 * Prerequisites:
 *   pip install notebooklm-py
 *   notebooklm login   (use a dedicated non-primary Google account)
 *   ANTHROPIC_API_KEY set in .env
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, '.curriculum-cache');
const CONFIG_PATH = join(__dirname, 'curriculum-sources.json');

dotenv.config({ path: join(ROOT, '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nl(args) {
  try {
    return execSync(`notebooklm ${args}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    const msg = err.stderr?.trim() || err.message;
    throw new Error(`notebooklm ${args.split(' ')[0]}: ${msg}`);
  }
}

function checkDependencies() {
  try {
    execSync('notebooklm --version', { stdio: 'pipe' });
  } catch {
    console.error('notebooklm CLI not found. Run: pip install notebooklm-py');
    process.exit(1);
  }

  try {
    const status = nl('status');
    if (!status.includes('Authenticated')) {
      console.error('Not authenticated. Run: notebooklm login');
      process.exit(1);
    }
  } catch {
    console.error('notebooklm auth check failed. Run: notebooklm login');
    process.exit(1);
  }
}

// ─── Claude parsing ────────────────────────────────────────────────────────────

async function parseWithClaude(markdown, subject, grade, topic) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system:
        'You are a curriculum parser. Extract structured educational content from study guide markdown. Return ONLY valid JSON with no markdown fences or extra text.',
      messages: [
        {
          role: 'user',
          content: `Parse this ${subject} Grade ${grade} study guide for the topic "${topic}" and extract the best teaching content.\n\n${markdown.slice(0, 8000)}\n\nReturn exactly this JSON structure:\n{\n  "vocabulary": [\n    { "word": "...", "phonetic": "/optional/", "partOfSpeech": "noun|verb|adj...", "definition": "one clear sentence from the source", "example": "usage in a complete sentence" }\n  ],\n  "key_concepts": ["Brief concept statement"],\n  "quiz_questions": [\n    { "question": "...", "answer": "...", "difficulty": "easy|medium|hard", "type": "short-answer|multiple-choice" }\n  ],\n  "common_mistakes": ["A mistake students commonly make"],\n  "teaching_order": ["Concept to introduce first", "Then this"]\n}`,
        },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${JSON.stringify(data)}`);

  const raw = data?.content?.[0]?.text || '{}';
  try {
    const s = raw.indexOf('{');
    const e = raw.lastIndexOf('}');
    return s !== -1 ? JSON.parse(raw.slice(s, e + 1)) : null;
  } catch {
    return null;
  }
}

// ─── Topic ingestion ───────────────────────────────────────────────────────────

async function ingestTopic({ subject, grade, topic, sources }) {
  const slug = `${subject}-g${grade}-${topic.replace(/\s+/g, '-').toLowerCase()}`;
  const jsonPath = join(CACHE_DIR, `${slug}.json`);
  const mdPath = join(CACHE_DIR, `${slug}.md`);

  if (existsSync(jsonPath) && !FORCE) {
    console.log(`  skipped ${slug} (cached — use --force to re-ingest)`);
    return;
  }

  console.log(`\n${subject} / Grade ${grade} / ${topic}`);
  mkdirSync(CACHE_DIR, { recursive: true });

  // 1. Create notebook
  const notebookRaw = nl(`create "${subject} G${grade}: ${topic}" --json`);
  const { id: notebookId } = JSON.parse(notebookRaw);
  nl(`use ${notebookId}`);
  console.log(`  notebook ${notebookId}`);

  // 2. Add sources and wait
  for (const source of sources) {
    const sourceRaw = nl(`source add "${source}" --json`);
    const { source_id } = JSON.parse(sourceRaw);
    process.stdout.write(`  source ${source_id} ...`);
    nl(`source wait ${source_id}`);
    process.stdout.write(' ready\n');
  }

  // 3. Generate study guide
  process.stdout.write('  generating study guide ...');
  const genRaw = nl('generate report --format study-guide --json');
  const { task_id } = JSON.parse(genRaw);
  nl(`artifact wait ${task_id}`);
  process.stdout.write(' done\n');

  // 4. Download
  nl(`download report "${mdPath}"`);
  const markdown = readFileSync(mdPath, 'utf8');
  console.log(`  downloaded study guide (${(markdown.length / 1000).toFixed(1)}k chars)`);

  // 5. Parse with Claude
  process.stdout.write('  parsing with Claude ...');
  const structured = await parseWithClaude(markdown, subject, grade, topic);
  if (!structured) {
    console.error('\n  Claude parsing failed — raw markdown saved, skipping JSON output');
    return;
  }
  process.stdout.write(' done\n');

  // 6. Save
  const output = {
    subject,
    grade,
    topic,
    slug,
    notebookId,
    lastIngested: new Date().toISOString(),
    ...structured,
  };
  writeFileSync(jsonPath, JSON.stringify(output, null, 2));
  console.log(
    `  saved .curriculum-cache/${slug}.json` +
    `  (${structured.vocabulary?.length ?? 0} vocab  ${structured.quiz_questions?.length ?? 0} questions  ${structured.key_concepts?.length ?? 0} concepts)`
  );
}

// ─── Entry ─────────────────────────────────────────────────────────────────────

if (!existsSync(CONFIG_PATH)) {
  console.error(`Config not found: ${CONFIG_PATH}`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
const topics = config.topics || [];

if (topics.length === 0) {
  console.error('No topics defined in curriculum-sources.json');
  process.exit(1);
}

console.log('Sunny Curriculum Ingestion Pipeline');
console.log(`${topics.length} topic(s) configured\n`);
topics.forEach((t) =>
  console.log(`  ${t.subject} G${t.grade}: ${t.topic}  (${t.sources.length} sources)`)
);

if (DRY_RUN) {
  console.log('\nDry run complete. Config is valid.');
  process.exit(0);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('\nANTHROPIC_API_KEY not set in .env');
  process.exit(1);
}

checkDependencies();

console.log('\nStarting ingestion...');
for (const topic of topics) {
  await ingestTopic(topic);
}

console.log('\nDone. JSON files in .curriculum-cache/');
console.log('Next: push to Firestore with node scripts/push-to-firestore.mjs');
