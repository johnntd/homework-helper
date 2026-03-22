// Simple local server to handle API requests during development
// Run this with: node server.js (in a separate terminal)
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();

// Rate limiting — prevents API cost abuse
const chatLimit = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
const searchLimit = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });
const geminiLimit = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });
const PORT = 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
}));
app.use(express.json({ limit: '10mb' }));

app.post('/api/chat', chatLimit, async (req, res) => {
  try {
    const { system, messages, maxTokens } = req.body;

    console.log(`[/api/chat] messages=${messages?.length || 0} system_len=${system?.length || 0}`);

    // Validate messages format
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('Invalid messages format');
      return res.status(400).json({ error: 'Messages must be a non-empty array' });
    }
    
    // Check each message
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg.role || !msg.content) {
        return res.status(400).json({ error: `Message ${i} is invalid` });
      }
    }
    
    // Create request for Anthropic
    const requestBody = {
      model: 'claude-sonnet-4-6',
      max_tokens: Math.min(maxTokens || 4000, 8000),
      system: system,
      messages: messages
    };
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error(`[/api/chat] Anthropic error ${response.status}`);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('[/api/chat] server error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Web search endpoint for Interview Prep — uses Brave Search API
// Add BRAVE_SEARCH_API_KEY to .env (free tier: 2000 queries/month at search.brave.com/app)
app.post('/api/search', searchLimit, async (req, res) => {
  try {
    const { query } = req.body;
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) {
      console.log('No BRAVE_SEARCH_API_KEY set — returning empty results');
      return res.json({ results: [] });
    }
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&text_decorations=false`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey }
    });
    const data = await response.json();
    const results = (data.web?.results || []).slice(0, 5).map(r => ({
      title: r.title,
      description: r.description,
      url: r.url,
    }));
    console.log(`Search "${query}" → ${results.length} results`);
    res.json({ results });
  } catch (err) {
    console.error('Search error:', err.message);
    res.json({ results: [] }); // graceful degradation
  }
});

// Stock market data endpoint — proxies Yahoo Finance (free, no API key needed)
app.get('/api/stock', async (req, res) => {
  const { symbol = 'AAPL', interval = '1d', range = '3mo' } = req.query;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });
    if (!response.ok) return res.json({ candles: [] });
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) return res.json({ candles: [] });
    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const candles = timestamps.map((t, i) => ({
      time: t, open: quote.open?.[i], high: quote.high?.[i],
      low: quote.low?.[i], close: quote.close?.[i], volume: quote.volume?.[i] || 0,
    })).filter(c => c.open != null && c.high != null && c.low != null && c.close != null);
    console.log(`Stock ${symbol}: ${candles.length} candles`);
    res.json({ symbol, candles });
  } catch (err) {
    console.error('Stock error:', err.message);
    res.json({ candles: [] });
  }
});

// Prediction market data — proxies Polymarket Gamma API (public, no auth needed)
app.get('/api/polymarket', async (req, res) => {
  const GAMMA_URL = 'https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume&ascending=false&limit=50';
  try {
    const response = await fetch(GAMMA_URL, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    if (!response.ok) throw new Error(`Gamma API ${response.status}`);
    const raw = await response.json();
    const markets = (Array.isArray(raw) ? raw : raw.markets || [])
      .filter(m =>
        parseFloat(m.volume || 0) > 5000 &&
        parseFloat(m.liquidity || 0) > 1000 &&
        m.endDate && (new Date(m.endDate) - Date.now()) < 30 * 24 * 60 * 60 * 1000
      )
      .slice(0, 10)
      .map(m => ({
        id:        m.id || m.conditionId || '',
        question:  m.question || '',
        yes_bid:   parseFloat(m.bestBid  || m.yes_bid  || 0),
        yes_ask:   parseFloat(m.bestAsk  || m.yes_ask  || 0),
        no_bid:    parseFloat(m.no_bid   || 0),
        volume:    parseFloat(m.volume   || 0),
        liquidity: parseFloat(m.liquidity || 0),
        endDate:   m.endDate || '',
        outcomes:  m.outcomes || ['Yes', 'No'],
      }));
    console.log(`Polymarket: ${markets.length} markets returned (live)`);
    res.json({ markets, source: 'live' });
  } catch (err) {
    console.error('Polymarket error:', err.message, '— using mock data');
    res.json({
      source: 'mock',
      markets: [
        { id: 'mock-1', question: 'Will the Fed cut rates before June 2025?', yes_bid: 0.62, yes_ask: 0.64, no_bid: 0.36, volume: 182000, liquidity: 45000, endDate: new Date(Date.now() + 18 * 86400000).toISOString(), outcomes: ['Yes', 'No'] },
        { id: 'mock-2', question: 'Will BTC exceed $100k by end of Q2 2025?', yes_bid: 0.41, yes_ask: 0.43, no_bid: 0.57, volume: 97000, liquidity: 28000, endDate: new Date(Date.now() + 25 * 86400000).toISOString(), outcomes: ['Yes', 'No'] },
        { id: 'mock-3', question: 'Will the S&P 500 close above 5800 this week?', yes_bid: 0.55, yes_ask: 0.57, no_bid: 0.43, volume: 54000, liquidity: 12000, endDate: new Date(Date.now() + 5 * 86400000).toISOString(), outcomes: ['Yes', 'No'] },
        { id: 'mock-4', question: 'Will NVDA stock close above $900 this month?', yes_bid: 0.48, yes_ask: 0.50, no_bid: 0.50, volume: 67000, liquidity: 18000, endDate: new Date(Date.now() + 12 * 86400000).toISOString(), outcomes: ['Yes', 'No'] },
        { id: 'mock-5', question: 'Will ETH exceed $4000 before April 2025?', yes_bid: 0.33, yes_ask: 0.35, no_bid: 0.65, volume: 45000, liquidity: 11000, endDate: new Date(Date.now() + 20 * 86400000).toISOString(), outcomes: ['Yes', 'No'] },
      ]
    });
  }
});

// Gemini API proxy — supporting content generation (stories, grammar feedback, math hints)
app.post('/api/gemini', geminiLimit, async (req, res) => {
  const { task, context } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.json({ result: null, source: 'unavailable' });

  const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  const prompts = {
    generate_story: ({ topic, ageGroup, level, subject }) => {
      const wordCount = ageGroup === '4-6' ? '60-80' : ageGroup === '7-9' ? '100-130' : '150-200';
      return `Write a SHORT engaging reading story (${wordCount} words) for a ${ageGroup}-year-old about "${topic}" related to ${subject}. Requirements: age-appropriate vocabulary, simple clear sentences, one clear main idea, engaging warm tone, end with ONE comprehension question. Return ONLY valid JSON: {"title":"Story title (max 6 words)","passage":"The full story text...","question":"One comprehension question","answer_hint":"Key words for a correct answer"}`;
    },
    explain_concept: ({ concept, ageGroup, subject }) =>
      `Explain "${concept}" to a ${ageGroup}-year-old studying ${subject}. Use simple analogies, max 3 sentences, concrete visual language, end with a "try this" hook. Return ONLY valid JSON: {"explanation":"...","analogy":"...","hook":"..."}`,
    grammar_feedback: ({ text, ageGroup }) =>
      `A ${ageGroup}-year-old wrote: "${text}". Analyze grammar, give encouraging feedback. Return ONLY valid JSON: {"corrected":"...","errors":["..."],"rule":"Main grammar rule to teach (one sentence)","praise":"One specific thing they did well","encouragement":"Warm brief encouragement (max 15 words)"}`,
    math_hint: ({ problem, attempt, ageGroup }) =>
      `A ${ageGroup}-year-old is solving: "${problem}". Their attempt: "${attempt}". Give a Socratic hint WITHOUT revealing the answer. Return ONLY valid JSON: {"hint":"Hint that guides without revealing (max 25 words)","visual_suggestion":"Brief description of a helpful visual","next_step":"The very next small step to think about"}`,
    pronunciation_guide: ({ word, language }) =>
      `Break down the pronunciation of "${word}" in ${language} for a language learner. Return ONLY valid JSON: {"syllables":["syl","la","bles"],"phonetic":"Simple phonetic spelling","tip":"One pronunciation tip (max 15 words)","sounds_like":"English word it sounds similar to (if applicable)"}`,
    word_problem: ({ topic, operation, level, ageGroup }) =>
      `Create a fun math word problem for a ${ageGroup}-year-old. Topic: ${topic}, Operation: ${operation}, Difficulty: ${level}. Return ONLY valid JSON: {"problem":"Word problem (max 40 words, real-world scenario kids love)","answer":"The numeric answer","hint":"A gentle hint that doesn't give away the answer"}`,
    chemistry_problem: ({ topic, level, ageGroup }) =>
      `Generate a chemistry practice problem for a ${ageGroup}-year-old at ${level} difficulty. Topic: ${topic}. Return ONLY valid JSON: {"problem":"Problem statement with all given values","equation":"Key chemical equation","steps":["Step 1","Step 2","Step 3"],"answer":"Final answer with units","hint":"Hint without revealing answer"}`,
    physics_problem: ({ topic, level, ageGroup }) =>
      `Generate a physics practice problem for a ${ageGroup}-year-old at ${level} difficulty. Topic: ${topic}. Return ONLY valid JSON: {"problem":"Problem with all given quantities and units","formula":"Primary formula (e.g. F = ma)","variables":{"F":"Force (N)"},"steps":["Step 1","Step 2","Step 3","Step 4"],"answer":"Numeric answer with units","hint":"Conceptual hint"}`,
    coding_exercise: ({ language, topic, level, ageGroup }) =>
      `Generate a coding exercise in ${language} for a ${ageGroup}-year-old at ${level} difficulty. Topic: ${topic}. Return ONLY valid JSON: {"title":"Short title","instructions":"What the student must write or fix","starter_code":"Starter code with blanks or bug","solution_code":"Complete correct solution","hint":"One useful hint","expected_output":"What running the solution should produce"}`,
  };

  const promptFn = prompts[task];
  if (!promptFn) return res.status(400).json({ error: `Unknown task: ${task}` });

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFn(context || {}) }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      }),
    });
    if (!response.ok) throw new Error(`Gemini API ${response.status}`);
    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let result = {};
    try {
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s !== -1 && e !== -1) result = JSON.parse(raw.slice(s, e + 1));
    } catch { result = { raw }; }
    res.setHeader('Cache-Control', 's-maxage=0');
    return res.json({ result, source: 'gemini' });
  } catch (err) {
    return res.json({ result: null, source: 'error', error: err.message });
  }
});

// Lesson extraction — turns raw source text into structured teaching content
const extractLimit = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });
app.post('/api/extract-lesson', extractLimit, async (req, res) => {
  try {
    const { text, subject = '', gradeLevel = '' } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < 50) {
      return res.status(400).json({ error: 'text must be at least 50 characters' });
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

    console.log(`[/api/extract-lesson] ${text.length} chars, subject=${subject}`);

    const prompt = `You are a curriculum designer extracting structured teaching content from source material for a child AI tutor.

Source material${subject ? ` (${subject}${gradeLevel ? `, grade ${gradeLevel}` : ''})` : ''}:
<source>
${text.slice(0, 6000)}
</source>

Extract the most teachable content from this source. Return ONLY valid JSON with no extra text:
{
  "title": "Short descriptive title for this lesson (5-8 words)",
  "explanation": "2-3 sentence plain-language explanation a child could understand. No jargon.",
  "vocabulary": [
    { "word": "key term", "definition": "one clear sentence", "example": "use it in a sentence" }
  ],
  "questions": [
    { "question": "question to test understanding", "hint": "one-word or short hint", "sampleAnswer": "the ideal short answer" }
  ]
}
Rules:
- vocabulary: 3-6 words maximum, pick only the most important terms
- questions: 4-6 questions maximum, ordered easy to hard
- sampleAnswer: keep to 1-2 sentences, child-friendly language
- All content must come directly from the source — do not add outside facts`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'API error' });

    const raw = data?.content?.[0]?.text || '{}';
    const s = raw.indexOf('{');
    const e = raw.lastIndexOf('}');
    const lesson = s !== -1 ? JSON.parse(raw.slice(s, e + 1)) : null;
    if (!lesson?.title) return res.status(500).json({ error: 'Failed to parse lesson' });

    res.json(lesson);
  } catch (err) {
    console.error('[/api/extract-lesson]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Lesson plan generator — produces full 6-scene daily lesson from topic + optional source text
const planLimit = rateLimit({ windowMs: 60_000, max: 15, standardHeaders: true, legacyHeaders: false });
const SUBJECT_COLORS_SERVER = {
  reading: '#3B82F6', writing: '#10B981', math: '#8B5CF6',
  spelling: '#F59E0B', social: '#EC4899', logic: '#6366F1',
  languages: '#06B6D4', science: '#22C55E', history: '#F97316',
};
app.post('/api/lesson-plan', planLimit, async (req, res) => {
  try {
    const { topic, subject = '', gradeLevel = '', language = 'English', sourceText = '' } = req.body;
    if (!topic || typeof topic !== 'string' || topic.trim().length < 2) {
      return res.status(400).json({ error: 'topic is required' });
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

    const color = SUBJECT_COLORS_SERVER[subject] || '#0A84FF';
    const gradeInfo = gradeLevel ? ` (grade ${gradeLevel})` : '';
    const langInfo = subject === 'languages' ? ` Target language: ${language}.` : '';
    const sourceBlock = sourceText?.trim().length > 50
      ? `\n\nUse this source material as the primary content:\n<source>\n${sourceText.slice(0, 5000)}\n</source>`
      : '';

    console.log(`[/api/lesson-plan] topic="${topic}" subject=${subject} grade=${gradeLevel}`);

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
    { "title": "Scene 1 topic", "emoji": "single emoji", "facts": ["fact 1 (max 15 words)", "fact 2", "fact 3"], "analogy": "Think of it like... or empty string" },
    { "title": "Scene 2 topic", "emoji": "single emoji", "facts": ["fact 1", "fact 2", "fact 3"], "analogy": "" },
    { "title": "Scene 3 topic", "emoji": "single emoji", "facts": ["fact 1", "fact 2"], "analogy": "Think of it like... or empty string" }
  ],
  "pronunciationScene": {
    "phrase": "key word or phrase",
    "phonetic": "pronunciation guide (e.g. /foh-toh-SIN-thuh-sis/)",
    "translation": "plain English meaning",
    "language": "${subject === 'languages' ? language : 'English'}",
    "example": "example sentence",
    "exampleTranslation": "translation if non-English else empty string"
  },
  "practicePrompt": { "question": "open-ended thinking question", "hint": "short hint" },
  "recap": { "title": "Great work today!", "points": ["key takeaway 1 (max 12 words)", "key takeaway 2", "key takeaway 3"] }
}
Rules: facts max 15 words each; recap points max 12 words; content age-appropriate for grade ${gradeLevel || 'K-8'}.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'API error' });
    const raw = data?.content?.[0]?.text || '{}';
    const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
    const plan = s !== -1 ? JSON.parse(raw.slice(s, e + 1)) : null;
    if (!plan?.title) return res.status(500).json({ error: 'Failed to parse lesson plan' });
    res.json({ ...plan, color });
  } catch (err) {
    console.error('[/api/lesson-plan]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ API server running on http://localhost:${PORT}`);
  console.log(`📡 Ready to handle requests from http://localhost:5173`);
  console.log(`\n🔑 Make sure your .env file has ANTHROPIC_API_KEY set!\n`);
});
