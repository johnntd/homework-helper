export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

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
      .map(m => {
        const slug = m.slug || m.marketSlug || m.market_slug || '';
        return {
          id:        m.id || m.conditionId || '',
          question:  m.question || '',
          yes_bid:   parseFloat(m.bestBid  || m.yes_bid  || 0),
          yes_ask:   parseFloat(m.bestAsk  || m.yes_ask  || 0),
          no_bid:    parseFloat(m.no_bid   || 0),
          volume:    parseFloat(m.volume   || 0),
          liquidity: parseFloat(m.liquidity || 0),
          endDate:   m.endDate || '',
          outcomes:  m.outcomes || ['Yes', 'No'],
          slug,
          marketUrl: slug ? `https://polymarket.com/event/${slug}` : '',
        };
      });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.json({ markets, source: 'live' });

  } catch (err) {
    return res.json({
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
}
