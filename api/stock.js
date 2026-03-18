export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { symbol = 'AAPL', interval = '1d', range = '3mo' } = req.query;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });

    if (!response.ok) return res.json({ candles: [] });

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) return res.json({ candles: [] });

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};

    const candles = timestamps.map((t, i) => ({
      time: t,
      open: quote.open?.[i],
      high: quote.high?.[i],
      low: quote.low?.[i],
      close: quote.close?.[i],
      volume: quote.volume?.[i] || 0,
    })).filter(c => c.open != null && c.high != null && c.low != null && c.close != null);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.json({ symbol, candles });
  } catch (err) {
    return res.json({ candles: [] });
  }
}
