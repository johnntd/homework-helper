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

  const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent';

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

    // ── Professional & Health Track Tasks ──────────────────────────────────────
    case 'professional_concept': {
      const { concept, field, subject } = context;
      prompt = `Generate a structured educational explanation of "${concept}" for a ${field || subject || 'professional'} student. Return ONLY valid JSON: {"title":"Concept name (max 6 words)","keyPoints":["Key point 1 (1 sentence)","Key point 2","Key point 3"],"analogy":"Concrete real-world analogy that makes this click","clinicalTip":"Practical application or clinical pearl (omit if not a health field)","disclaimer":"Brief educational disclaimer if this is medical or legal content, else empty string"}`;
      break;
    }

    case 'practice_question': {
      const { subject: pSubject, topic: pTopic, difficulty } = context;
      prompt = `Generate a ${difficulty || 'medium'}-difficulty practice question for a student studying ${pTopic || pSubject}. If this is a health or licensing exam topic (NCLEX, CPA, pharmacy board), use a realistic exam-style format. Return ONLY valid JSON: {"question":"Full question stem (1-3 sentences with clinical context if applicable)","options":["A) Option text","B) Option text","C) Option text","D) Option text"],"correctAnswer":"A","explanation":"Why the correct answer is right (2-3 sentences)","wrongExplanations":{"B":"Why B is wrong","C":"Why C is wrong","D":"Why D is wrong"},"difficulty":"${difficulty || 'medium'}","topic":"${pTopic || pSubject}"}`;
      break;
    }

    case 'clinical_scenario': {
      const { subject: cSubject, topic: cTopic } = context;
      prompt = `Generate a realistic clinical case scenario for a ${cSubject} student studying ${cTopic || cSubject}. The scenario should be educational and clearly fictional. Return ONLY valid JSON: {"patientAge":42,"patientSex":"female","chiefComplaint":"Chief complaint in patient's own words","historyOfPresentIllness":"2-3 sentence HPI narrative","relevantHistory":"Key PMH, medications, allergies relevant to this case","vitalSigns":{"BP":"120/80","HR":72,"RR":16,"Temp":"98.6F","SpO2":"98%"},"physicalExam":"Key positive and negative physical exam findings","labResults":"Key lab values if relevant, else empty string","questions":["What is your leading diagnosis?","What are the top 3 items on your differential?","What is your initial management plan?"],"teachingPoint":"The key educational takeaway from this case"}`;
      break;
    }

    case 'case_study': {
      const { subject: csSubject, topic: csTopic } = context;
      prompt = `Generate a realistic ${csSubject} case study scenario for a student studying ${csTopic || csSubject}. Return ONLY valid JSON: {"title":"Case title (5-8 words)","scenario":"Business, legal, or professional situation (3-4 sentences, realistic and specific)","facts":["Key fact 1","Key fact 2","Key fact 3","Key fact 4"],"questions":["Discussion question 1","Discussion question 2","Analysis question 3"],"keyTakeaway":"The core concept this case illustrates (1-2 sentences)","difficulty":"intermediate"}`;
      break;
    }

    case 'flashcard_set': {
      const { subject: fSubject, topic: fTopic } = context;
      prompt = `Generate 6 high-yield flashcards for a student studying ${fTopic || fSubject}. Return ONLY valid JSON: {"topic":"${fTopic || fSubject}","cards":[{"front":"Term, concept, or question (max 15 words)","back":"Clear, concise answer or definition (1-2 sentences)","mnemonic":"Optional memory trick — omit key if none"},{"front":"...","back":"..."},{"front":"...","back":"..."},{"front":"...","back":"..."},{"front":"...","back":"..."},{"front":"...","back":"..."}]}`;
      break;
    }

    // ── Engineering Track Tasks ────────────────────────────────────────────
    case 'engineering_exercise': {
      const { subject: eeSubject, topic: eeTopic, level: eeLevel, language: eeLang } = context;
      prompt = `Generate a targeted engineering practice exercise for a student studying ${eeTopic || eeSubject} in ${eeSubject}.
Language/tool context: ${eeLang || 'SystemVerilog/Verilog'}.
Difficulty: ${eeLevel || 'intermediate'}.

Return ONLY valid JSON:
{
  "title": "Short exercise title (max 8 words)",
  "context": "1-2 sentences of background or scenario setup",
  "task": "What the student must write, fix, or analyze (2-3 sentences, specific)",
  "starter": "Starter code, signal list, or constraint snippet (use \\n for newlines, empty string if not applicable)",
  "hints": ["Hint 1 without giving away the answer", "Hint 2"],
  "solution_outline": "Key points of the correct solution (not full code — guide, not spoil)",
  "follow_up": "One follow-up question that deepens understanding"
}`;
      break;
    }

    case 'engineering_debug_scenario': {
      const { subject: edSubject, topic: edTopic, level: edLevel } = context;
      prompt = `Generate a realistic hardware/EDA debug scenario for a student studying ${edTopic || edSubject} in ${edSubject}.
Difficulty: ${edLevel || 'intermediate'}.

Return ONLY valid JSON:
{
  "title": "Debug scenario title (max 8 words)",
  "setup": "What the engineer is trying to do (1-2 sentences)",
  "symptom": "What unexpected behavior or failure is observed (1-2 sentences, specific and realistic)",
  "available_info": ["Piece of available information 1 (measurement, log line, waveform description)", "Piece 2", "Piece 3"],
  "red_herrings": ["One plausible-but-wrong hypothesis to test and rule out"],
  "root_cause": "The actual root cause",
  "fix": "The correct fix (1-2 sentences)",
  "teaching_point": "The key lesson this scenario teaches (1 sentence)"
}`;
      break;
    }

    case 'pd_drill': {
      const { topic: pdTopic, level: pdLevel } = context;
      prompt = `Generate a physical design drill question for a student studying ${pdTopic || 'timing closure'}.
Difficulty: ${pdLevel || 'intermediate'}.

Return ONLY valid JSON:
{
  "question": "The drill question — may include a snippet of a timing report, congestion map description, or SDC excerpt (2-4 sentences)",
  "context_snippet": "A realistic timing report excerpt, SDC snippet, or tool output (use \\n for newlines, empty string if not applicable)",
  "options": ["A) Option text", "B) Option text", "C) Option text", "D) Option text"],
  "correct_answer": "A",
  "explanation": "Why the correct answer is right (2-3 sentences with PD reasoning)",
  "wrong_explanations": {"B": "Why B is wrong", "C": "Why C is wrong", "D": "Why D is wrong"},
  "tool_tip": "Relevant tool command or workflow hint"
}`;
      break;
    }

    case 'lab_scenario': {
      const { topic: lsTopic, level: lsLevel } = context;
      prompt = `Generate a realistic hardware lab debug scenario for a student learning ${lsTopic || 'oscilloscope'}.
Difficulty: ${lsLevel || 'beginner'}.

Return ONLY valid JSON:
{
  "setup": "What circuit or board the student is working with (1 sentence)",
  "symptom": "What they observe on the instrument or board (1-2 sentences, specific: include numbers like V/div, frequency, etc.)",
  "instrument_state": "Current instrument settings described",
  "questions": ["What should the student check first?", "What measurement would confirm the hypothesis?"],
  "root_cause": "The actual issue",
  "fix": "The correct action to take (1-2 sentences)",
  "safety_note": "Any relevant safety reminder, or empty string if not applicable"
}`;
      break;
    }

    case 'extract_visual_data': {
      const { aiResponseText, subject: evSubject, topic: evTopic, accentColor, icon } = context;
      const text = (aiResponseText || '').slice(0, 2000);
      const isEngineering = ['rtl-design', 'physical-design', 'lab-debug'].includes(evSubject);
      prompt = `You are a visual content extractor. Analyze this teaching response and determine if it contains content suitable for a short animated teaching video.

Teaching response:
"${text}"

Subject: ${evSubject}, Topic: ${evTopic}

Rules:
- If the response describes a PROCESS, SEQUENCE OF STEPS, or WORKFLOW, extract as process-steps (max 5 steps).
- If the response explains a CONCEPT with distinct key points or sections, extract as professional-concept (max 3 sections).
${isEngineering ? `- If the response discusses TIMING WAVEFORMS, SETUP/HOLD, clock signals, or signal timing relationships, extract as timing-diagram (max 4 signals).
- If the response discusses the RTL-TO-GDS FLOW or a multi-stage EDA pipeline, extract as rtl-flow (max 6 stages).` : ''}
- If purely conversational or a simple Q&A answer, return type "none".
- Keep all text extremely concise — this is for animated display.

Return ONLY valid JSON in one of these formats:

For a process: {"type":"process-steps","props":{"title":"Short process name (max 5 words)","steps":["Step 1 (max 8 words)","Step 2","Step 3"],"color":"${accentColor || '#0A84FF'}"}}

For a concept: {"type":"professional-concept","props":{"title":"Concept name (max 5 words)","sections":[{"heading":"Section heading (max 4 words)","content":"Key content (max 15 words)"}],"accent":"${accentColor || '#0A84FF'}","icon":"${icon || ''}"}}
${isEngineering ? `
For a timing diagram: {"type":"timing-diagram","props":{"title":"Signal timing title (max 5 words)","signals":[{"name":"CLK","pattern":"10101010"},{"name":"DATA","pattern":"00111100"}],"annotation":"Key timing note (max 12 words)","color":"${accentColor || '#2563EB'}"}}

For an RTL flow: {"type":"rtl-flow","props":{"title":"Flow name (max 5 words)","stages":["RTL","Synthesis","Floorplan","Place & Route","Signoff","GDS"],"highlight":"Stage name to highlight or empty string","color":"${accentColor || '#047857'}"}}` : ''}

If not suitable: {"type":"none"}`;
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
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
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
