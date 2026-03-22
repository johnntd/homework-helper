/**
 * /api/lesson-plan
 *
 * Generates a structured daily lesson plan for Sunny AI Coach.
 * Equivalent to a NotebookLM study guide — takes a topic (and optional source
 * text) and returns a fully-scoped scene plan ready for the DailyLessonVideo
 * Remotion composition.
 *
 * Input:  { topic, subject, gradeLevel, language?, sourceText? }
 * Output: {
 *   title, color,
 *   intro:              { title, subtitle, emoji },
 *   teachingScenes:     [{ title, emoji, facts[], analogy }] × 3
 *   pronunciationScene: { phrase, phonetic, translation, language, example, exampleTranslation }
 *   practicePrompt:     { question, hint }
 *   recap:              { title, points[] }
 * }
 */

const SUBJECT_COLORS = {
  reading: '#3B82F6', writing: '#10B981', math: '#8B5CF6',
  spelling: '#F59E0B', social: '#EC4899', logic: '#6366F1',
  languages: '#06B6D4', science: '#22C55E', history: '#F97316',
  default: '#0A84FF',
};

const ALLOWED_ORIGIN = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:5173';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { topic, subject = '', gradeLevel = '', language = 'English', sourceText = '' } = req.body;
    if (!topic || typeof topic !== 'string' || topic.trim().length < 2) {
      return res.status(400).json({ error: 'topic is required' });
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

    const color = SUBJECT_COLORS[subject] || SUBJECT_COLORS.default;
    const gradeInfo = gradeLevel ? ` (grade ${gradeLevel})` : '';
    const langInfo = subject === 'languages' ? ` Target language: ${language}.` : '';
    const sourceBlock = sourceText?.trim().length > 50
      ? `\n\nUse this source material as the primary content:\n<source>\n${sourceText.slice(0, 5000)}\n</source>`
      : '';

    const prompt = `You are a curriculum expert designing a mobile micro-lesson for Sunny AI Coach — a tutoring app for kids${gradeInfo}.

Topic: "${topic}"
Subject: ${subject || 'general'}${langInfo}${sourceBlock}

Generate a complete 6-scene daily lesson plan. Return ONLY valid JSON, no markdown fences:
{
  "title": "5-7 word lesson title",
  "intro": {
    "title": "Engaging 4-6 word hook title",
    "subtitle": "Today we learn: [topic in plain language]",
    "emoji": "single relevant emoji"
  },
  "teachingScenes": [
    {
      "title": "Scene 1 topic name",
      "emoji": "single emoji",
      "facts": ["fact 1 — one clear sentence", "fact 2", "fact 3"],
      "analogy": "Think of it like... (optional relatable analogy or empty string)"
    },
    {
      "title": "Scene 2 topic name",
      "emoji": "single emoji",
      "facts": ["fact 1", "fact 2", "fact 3"],
      "analogy": ""
    },
    {
      "title": "Scene 3 topic name",
      "emoji": "single emoji",
      "facts": ["fact 1", "fact 2"],
      "analogy": "Think of it like... or empty string"
    }
  ],
  "pronunciationScene": {
    "phrase": "key word or phrase to practice${subject === 'languages' ? ' in ' + language : ''}",
    "phonetic": "how to pronounce it (e.g. /foh-toh-SIN-thuh-sis/)",
    "translation": "what it means in plain English",
    "language": "${subject === 'languages' ? language : 'English'}",
    "example": "example sentence using the phrase",
    "exampleTranslation": "translation of example if non-English, else empty string"
  },
  "practicePrompt": {
    "question": "one clear question the student should answer based on today's lesson",
    "hint": "one-word or 3-word hint"
  },
  "recap": {
    "title": "Great work today!",
    "points": [
      "Key takeaway 1 — short, memorable",
      "Key takeaway 2",
      "Key takeaway 3"
    ]
  }
}

Rules:
- Each fact: 1 sentence, max 15 words, age-appropriate for grade ${gradeLevel || 'K-8'}
- pronunciationScene: pick the single most important vocabulary word from the lesson
- practicePrompt: open-ended question that makes the student think, not just recall
- recap points: 3 most important things from the lesson, each ≤12 words
- All content must be accurate and educational`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'API error' });

    const raw = data?.content?.[0]?.text || '{}';
    const s = raw.indexOf('{');
    const e = raw.lastIndexOf('}');
    const plan = s !== -1 ? JSON.parse(raw.slice(s, e + 1)) : null;
    if (!plan?.title) return res.status(500).json({ error: 'Failed to parse lesson plan' });

    return res.status(200).json({ ...plan, color });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
