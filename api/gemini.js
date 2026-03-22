// Gemini service — used by Sunny for story generation, concept explanations,
// grammar feedback, and math hints. Sunny remains the teaching orchestrator;
// Gemini is a supporting content-generation service.
const ALLOWED_ORIGIN = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:5173';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { task, context } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Graceful degradation — return a null result so caller falls back to Claude
    return res.json({ result: null, source: 'unavailable' });
  }

  const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  // Build task-specific prompt
  let prompt = '';
  switch (task) {
    case 'generate_story': {
      const { topic, ageGroup, level, subject } = context;
      const wordCount = ageGroup === '4-6' ? '60-80' : ageGroup === '7-9' ? '100-130' : '150-200';
      prompt = `Write a SHORT, engaging reading story (${wordCount} words) for a ${ageGroup}-year-old about "${topic}" related to ${subject}.
Requirements:
- Age-appropriate vocabulary
- Simple, clear sentences for young readers
- One clear main idea
- Engaging and warm tone
- End with ONE comprehension question the teacher can ask

Return ONLY valid JSON:
{
  "title": "Story title (max 6 words)",
  "passage": "The full story text...",
  "question": "One comprehension question to ask the student",
  "answer_hint": "Key words/ideas that should be in a correct answer"
}`;
      break;
    }

    case 'explain_concept': {
      const { concept, ageGroup, subject } = context;
      prompt = `Explain "${concept}" to a ${ageGroup}-year-old student studying ${subject}.
Requirements:
- Use simple analogies they would relate to
- Maximum 3 sentences
- Concrete, visual language
- End with a "try this" or "think about this" hook

Return ONLY valid JSON:
{
  "explanation": "The simple explanation...",
  "analogy": "A relatable analogy...",
  "hook": "A curiosity-sparking question or activity"
}`;
      break;
    }

    case 'grammar_feedback': {
      const { text, ageGroup } = context;
      prompt = `A ${ageGroup}-year-old student wrote: "${text}"
Analyze this for grammar, give encouraging feedback.

Return ONLY valid JSON:
{
  "corrected": "The corrected version of their text",
  "errors": ["Brief description of each error found"],
  "rule": "The main grammar rule to teach (one sentence)",
  "praise": "One specific thing they did well",
  "encouragement": "A warm, brief encouragement (max 15 words)"
}`;
      break;
    }

    case 'math_hint': {
      const { problem, attempt, ageGroup } = context;
      prompt = `A ${ageGroup}-year-old is trying to solve: "${problem}"
Their attempt: "${attempt}"

Give a helpful hint WITHOUT revealing the answer.

Return ONLY valid JSON:
{
  "hint": "A Socratic hint that guides without revealing (max 25 words)",
  "visual_suggestion": "A brief description of a visual/drawing that would help",
  "next_step": "The very next small step they should think about"
}`;
      break;
    }

    case 'pronunciation_guide': {
      const { word, language } = context;
      prompt = `Break down the pronunciation of "${word}" in ${language} for a language learner.

Return ONLY valid JSON:
{
  "syllables": ["syl", "la", "bles"],
  "phonetic": "Simple phonetic spelling (e.g. kohn-nyee-chee-WAH)",
  "tip": "One pronunciation tip (max 15 words)",
  "sounds_like": "An English word or phrase it sounds similar to (if applicable)"
}`;
      break;
    }

    case 'word_problem': {
      const { topic, operation, level, ageGroup } = context;
      prompt = `Create a fun, engaging math word problem for a ${ageGroup}-year-old.
Topic: ${topic}, Operation: ${operation}, Difficulty: ${level}.

Return ONLY valid JSON:
{
  "problem": "The word problem (max 40 words, uses real-world scenario kids love)",
  "answer": "The numeric answer",
  "hint": "A gentle hint that doesn't give away the answer"
}`;
      break;
    }

    case 'chemistry_problem': {
      const { topic, level, ageGroup } = context;
      prompt = `Generate a chemistry practice problem for a ${ageGroup}-year-old student at ${level} difficulty.
Topic: ${topic}.

Return ONLY valid JSON:
{
  "problem": "The problem statement (clear, specific, with all given values)",
  "equation": "The key chemical equation (e.g. 2H2 + O2 -> 2H2O)",
  "steps": ["Step 1: identify what is given", "Step 2: ...", "Step 3: final answer with units"],
  "answer": "The final numeric or text answer with units",
  "hint": "A hint that guides without revealing the answer"
}`;
      break;
    }

    case 'physics_problem': {
      const { topic, level, ageGroup } = context;
      prompt = `Generate a physics practice problem for a ${ageGroup}-year-old student at ${level} difficulty.
Topic: ${topic}.

Return ONLY valid JSON:
{
  "problem": "The problem statement with all given quantities and units",
  "formula": "The primary formula to use (e.g. F = ma)",
  "variables": { "F": "Force (N)", "m": "mass (kg)", "a": "acceleration (m/s2)" },
  "steps": ["Step 1: list given values", "Step 2: choose formula", "Step 3: substitute", "Step 4: solve with units"],
  "answer": "Numeric answer with units",
  "hint": "A conceptual hint"
}`;
      break;
    }

    case 'coding_exercise': {
      const { language, topic, level, ageGroup } = context;
      prompt = `Generate a coding exercise in ${language} for a ${ageGroup}-year-old at ${level} difficulty.
Topic: ${topic}.

Return ONLY valid JSON:
{
  "title": "Short descriptive title",
  "instructions": "What the student must write or fix (2-3 sentences)",
  "starter_code": "Starter code with blanks or a bug to fix (use \\n for newlines)",
  "solution_code": "Complete correct solution (use \\n for newlines)",
  "hint": "One useful hint without giving away the solution",
  "expected_output": "What running the solution should print or return"
}`;
      break;
    }

    default:
      return res.status(400).json({ error: `Unknown task: ${task}` });
  }

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      }),
    });

    if (!response.ok) throw new Error(`Gemini API ${response.status}`);

    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Parse JSON from response (strip markdown fences if present)
    let result = {};
    try {
      const s = raw.indexOf('{');
      const e = raw.lastIndexOf('}');
      if (s !== -1 && e !== -1) result = JSON.parse(raw.slice(s, e + 1));
    } catch {
      result = { raw };
    }

    res.setHeader('Cache-Control', 's-maxage=0');
    return res.json({ result, source: 'gemini' });

  } catch (err) {
    return res.json({ result: null, source: 'error', error: err.message });
  }
}
