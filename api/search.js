export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query } = req.body;
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) {
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
    return res.json({ results });
  } catch (err) {
    return res.json({ results: [] });
  }
}
