import { useEffect, useRef, useState } from 'react';

// Approximate starting prices for common symbols
const SEED_PRICES = {
  'AAPL': 175, 'TSLA': 250, 'NVDA': 480, 'MSFT': 380, 'GOOGL': 140,
  'AMZN': 185, 'META': 480, 'NFLX': 620, 'AMD': 160, 'INTC': 35,
  'BTC-USD': 42000, 'ETH-USD': 2200, 'SOL-USD': 100, 'BNB-USD': 380,
  'EURUSD=X': 1.085, 'GBPUSD=X': 1.265, 'USDJPY=X': 148, 'AUDUSD=X': 0.655,
  'SPY': 480, 'QQQ': 410, 'IWM': 195, 'GLD': 185,
};

// Seeded PRNG — same symbol always produces the same chart shape
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function symbolSeed(symbol) {
  let h = 5381;
  for (let i = 0; i < symbol.length; i++) h = (h * 33 ^ symbol.charCodeAt(i)) >>> 0;
  return h;
}

function generateCandles(symbol = 'AAPL', days = 90) {
  const rand = mulberry32(symbolSeed(symbol));
  const startPrice = SEED_PRICES[symbol.toUpperCase()] || 100;
  const isCrypto = symbol.includes('-USD');
  const isForex = symbol.includes('=X');
  const volatility = isCrypto ? 0.028 : isForex ? 0.004 : 0.014;
  const drift = 0.0004;

  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  const candles = [];
  let price = startPrice;

  for (let i = days; i >= 0; i--) {
    const ts = now - i * DAY;
    if (!isCrypto) {
      const weekDay = new Date(ts * 1000).getDay();
      if (weekDay === 0 || weekDay === 6) continue;
    }
    const r = rand() - 0.48 + drift;
    const open = price;
    const close = Math.max(open * 0.5, open * (1 + volatility * r));
    const wickFactor = volatility * rand() * 0.6;
    const high = Math.max(open, close) * (1 + wickFactor);
    const low = Math.min(open, close) * (1 - wickFactor);
    const baseVol = isCrypto ? 2e9 : isForex ? 5e10 : startPrice < 50 ? 5e6 : 1e7;
    const volume = Math.floor(baseVol * (0.5 + rand()));
    candles.push({ time: ts, open, high, low, close, volume });
    price = close;
  }
  return candles;
}

function computeSMA(candles, period) {
  return candles.map((c, i) => {
    if (i < period - 1) return null;
    const avg = candles.slice(i - period + 1, i + 1).reduce((s, x) => s + x.close, 0) / period;
    return { time: c.time, value: parseFloat(avg.toFixed(4)) };
  }).filter(Boolean);
}

export default function TradingChart({ symbol, interval = '1d', range = '3mo', indicators = [], title, animate = true }) {
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const chartRef = useRef(null);
  const dimsRef = useRef({ width: 0, height: 0 });
  const [status, setStatus] = useState('loading');

  // Track container dimensions via ResizeObserver; update chart whenever container resizes
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (w === dimsRef.current.width && h === dimsRef.current.height) return;
      dimsRef.current = { width: w, height: h };
      if (chartRef.current && w > 0 && h > 0) {
        try { chartRef.current.applyOptions({ width: w, height: h }); } catch {}
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    // Destroy any existing chart before creating a new one
    if (chartRef.current) {
      try { chartRef.current.remove(); } catch {}
      chartRef.current = null;
    }

    // v5 API: destructure the new series constructors
    import('lightweight-charts').then(lc => {
      const { createChart, CandlestickSeries, HistogramSeries, LineSeries, ColorType } = lc;
      if (cancelled || !containerRef.current) return;

      // Use measured dims; fall back to container clientWidth/Height
      const initW = dimsRef.current.width || containerRef.current.clientWidth || 340;
      const initH = dimsRef.current.height || containerRef.current.clientHeight || 400;

      let chart;
      try {
        chart = createChart(containerRef.current, {
          width: initW,
          height: initH,
          layout: {
            background: { type: ColorType.Solid, color: '#0F172A' },
            textColor: '#94A3B8',
            fontSize: 11,
          },
          grid: {
            vertLines: { color: '#1E293B' },
            horzLines: { color: '#1E293B' },
          },
          rightPriceScale: {
            borderColor: '#334155',
            scaleMargins: { top: 0.1, bottom: indicators.includes('volume') ? 0.25 : 0.1 },
          },
          timeScale: { borderColor: '#334155', timeVisible: true, secondsVisible: false },
          crosshair: { vertLine: { color: '#475569' }, horzLine: { color: '#475569' } },
          handleScroll: { mouseWheel: true, pressedMouseMove: true },
          handleScale: { mouseWheel: true, pinch: true },
        });
      } catch (e) {
        if (!cancelled) setStatus('error');
        return;
      }
      chartRef.current = chart;

      // v5: addSeries(SeriesConstructor, options)
      let candleSeries;
      try {
        candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#22C55E', downColor: '#EF4444',
          borderUpColor: '#22C55E', borderDownColor: '#EF4444',
          wickUpColor: '#22C55E', wickDownColor: '#EF4444',
        });
      } catch (e) {
        if (!cancelled) setStatus('error');
        return;
      }

      let volumeSeries = null;
      if (indicators.includes('volume')) {
        try {
          volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'vol',
            color: '#334155',
          });
          chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
        } catch {}
      }

      const runAnimation = (candles) => {
        if (cancelled || !candles?.length) {
          if (!cancelled) setStatus('error');
          return;
        }

        const volData = candles.map(c => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? '#22C55E33' : '#EF444433',
        }));

        const finalize = () => {
          if (cancelled) return;
          try {
            if (indicators.includes('SMA20')) {
              const sma = computeSMA(candles, 20);
              if (sma.length) {
                const l = chart.addSeries(LineSeries, { color: '#3B82F6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
                l.setData(sma);
              }
            }
            if (indicators.includes('SMA50')) {
              const sma = computeSMA(candles, 50);
              if (sma.length) {
                const l = chart.addSeries(LineSeries, { color: '#F59E0B', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
                l.setData(sma);
              }
            }
            chart.timeScale().fitContent();
          } catch {}
          setStatus('ready');
        };

        if (animate && candles.length > 1) {
          const fastEnd = Math.max(0, candles.length - 15);
          let i = 0;
          const addNext = () => {
            if (cancelled) return;
            if (i >= candles.length) { finalize(); return; }
            try {
              candleSeries.setData(candles.slice(0, i + 1));
              if (volumeSeries) volumeSeries.setData(volData.slice(0, i + 1));
            } catch {}
            const delay = i < fastEnd ? 6 : 55;
            i++;
            setTimeout(addNext, delay);
          };
          addNext();
        } else {
          try {
            candleSeries.setData(candles);
            if (volumeSeries) volumeSeries.setData(volData);
          } catch {}
          finalize();
        }
      };

      // Try real data (5s timeout), fall back to synthetic
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}&interval=${interval}&range=${range}`, {
        signal: controller.signal,
      })
        .then(r => r.json())
        .then(({ candles }) => {
          clearTimeout(timeout);
          if (cancelled) return;
          runAnimation(candles?.length >= 10 ? candles : generateCandles(symbol));
        })
        .catch(() => {
          clearTimeout(timeout);
          if (!cancelled) runAnimation(generateCandles(symbol));
        });

      // Cleanup — runs when deps change or component unmounts
      return () => {
        cancelled = true;
        clearTimeout(timeout);
        try { chart.remove(); } catch {}
        chartRef.current = null;
      };
    }).catch(() => {
      if (!cancelled) setStatus('error');
    });

    return () => { cancelled = true; };
  }, [symbol, interval, range, indicators.join(','), animate]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={wrapperRef} style={{
      background: '#0F172A', borderRadius: 14, overflow: 'hidden',
      padding: '10px 10px 6px',
      height: 'clamp(340px, 58vh, 560px)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      {title && (
        <p style={{ color: '#64748B', fontSize: 11, fontWeight: 600, margin: '0 0 6px', flexShrink: 0, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'system-ui, sans-serif' }}>
          {symbol} · {title}
        </p>
      )}
      {/* Container always rendered so ResizeObserver measures it from the start */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
      {/* Loading/error overlays on top */}
      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#0F172A', borderRadius: 14 }}>
          <div style={{ width: 28, height: 28, border: '3px solid #1E293B', borderTopColor: '#22C55E', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: '#475569', fontSize: 12, margin: 0, fontFamily: 'system-ui, sans-serif' }}>Generating chart…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A', borderRadius: 14 }}>
          <p style={{ color: '#64748B', fontSize: 13, margin: 0, fontFamily: 'system-ui, sans-serif' }}>Chart unavailable for {symbol}</p>
        </div>
      )}
      {indicators.length > 0 && status === 'ready' && (
        <div style={{ display: 'flex', gap: 12, padding: '6px 2px 0', flexShrink: 0, flexWrap: 'wrap' }}>
          {indicators.includes('SMA20') && <span style={{ fontSize: 10, color: '#3B82F6', fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}>● SMA 20</span>}
          {indicators.includes('SMA50') && <span style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}>● SMA 50</span>}
          {indicators.includes('volume') && <span style={{ fontSize: 10, color: '#475569', fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}>▮ Volume</span>}
        </div>
      )}
    </div>
  );
}
