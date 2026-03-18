import React, { useState } from 'react';

// Inject CSS keyframes once (idempotent)
if (typeof document !== 'undefined') {
  const styleId = 'agent-pipeline-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes pipelinePulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%       { opacity: 0.45; transform: scale(1.5); }
      }
      @keyframes pipelineProgress {
        0%   { width: 15%; margin-left: 0%; }
        50%  { width: 55%; margin-left: 25%; }
        100% { width: 15%; margin-left: 85%; }
      }
    `;
    document.head.appendChild(style);
  }
}

const AGENT_META = [
  { id: 'scanner',    name: 'Market Scanner',   abbr: 'SCAN', desc: 'Scans Polymarket for edge' },
  { id: 'sentiment',  name: 'Sentiment Agent',  abbr: 'SENT', desc: 'Reddit & news vs market odds' },
  { id: 'prediction', name: 'Prediction Agent', abbr: 'PRED', desc: 'XGBoost + LLM probability adj' },
  { id: 'risk',       name: 'Risk Agent',       abbr: 'RISK', desc: 'Kelly Criterion bet sizing' },
  { id: 'executor',   name: 'Execution Agent',  abbr: 'EXEC', desc: 'Simulated trade ticket' },
  { id: 'postmortem', name: 'Post-Mortem',      abbr: 'POST', desc: 'Outcome analysis & learning' },
];

const C = {
  bg:      '#0F172A',
  card:    '#1E293B',
  cardDim: '#141e30',
  border:  '#334155',
  accent:  '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  error:   '#EF4444',
  muted:   '#475569',
  text:    '#F1F5F9',
  sub:     '#94A3B8',
};

const STATUS = {
  waiting:  { color: C.muted,   label: 'Waiting',  pulse: false },
  running:  { color: C.accent,  label: 'Running',  pulse: true  },
  done:     { color: C.success, label: 'Done',      pulse: false },
  blocked:  { color: C.warning, label: 'Blocked',   pulse: false },
  error:    { color: C.error,   label: 'Error',     pulse: false },
};

function AgentCard({ agent, meta, isActive }) {
  const s = STATUS[agent.status] || STATUS.waiting;
  return (
    <div style={{
      background: isActive ? C.card : C.cardDim,
      border: `1.5px solid ${isActive ? C.accent : C.border}`,
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 6,
      transition: 'border-color 0.3s, background 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Abbr badge */}
        <div style={{
          width: 42, height: 42, borderRadius: 10, flexShrink: 0,
          background: isActive ? C.accent : C.border,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: '#fff',
          transition: 'background 0.3s',
        }}>
          {meta.abbr}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>{meta.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: C.sub }}>{meta.desc}</p>
        </div>
        {/* Status pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 20,
          background: `${s.color}22`, border: `1px solid ${s.color}44`,
        }}>
          {s.pulse && (
            <span style={{
              width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
              background: s.color, animation: 'pipelinePulse 1s ease-in-out infinite',
            }} />
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</span>
        </div>
      </div>

      {/* Shimmer progress bar while running */}
      {agent.status === 'running' && (
        <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 0, height: '100%', background: C.accent, borderRadius: 2,
            animation: 'pipelineProgress 1.8s ease-in-out infinite',
          }} />
        </div>
      )}

      {/* Summary line when done/error/blocked */}
      {agent.output && agent.status !== 'waiting' && (
        <p style={{
          margin: 0, fontSize: 12, lineHeight: 1.5,
          color: agent.status === 'error' ? C.error
               : agent.status === 'blocked' ? C.warning
               : C.sub,
        }}>
          {agent.output}
        </p>
      )}
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{
      flex: '1 1 80px', background: C.card,
      border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px',
    }}>
      <p style={{ margin: 0, fontSize: 10, color: C.sub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</p>
      <p style={{ margin: '3px 0 0', fontSize: 15, fontWeight: 800, color: color || C.text }}>{value}</p>
    </div>
  );
}

function RecommendationCard({ recommendation, onSimulateTrade, tradeSimulated, postmortemDone }) {
  if (!recommendation) return null;
  const isYes  = recommendation.action === 'BUY YES';
  const edgePct = Math.round((recommendation.edge || 0) * 100);
  const confPct  = Math.round((recommendation.confidence || 0) * 100);
  const entryCents = Math.round((recommendation.entryPrice || 0) * 100);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0a1f14, #091628)',
      border: `1.5px solid ${C.success}`,
      borderRadius: 16, padding: '16px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: C.success, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 800, color: '#fff',
        }}>R</div>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: C.success, letterSpacing: 0.5 }}>RECOMMENDATION</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: C.sub }}>Simulation only — no real money</p>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.55 }}>
        {recommendation.question}
      </p>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <StatPill label="Position"   value={recommendation.action}   color={isYes ? C.success : C.error} />
        <StatPill label="Entry"      value={`${entryCents}¢`}         color={C.text} />
        <StatPill label="Bet Size"   value={`$${(recommendation.betSize || 0).toFixed(0)}`} color={C.accent} />
        <StatPill label="Edge"       value={`+${edgePct}%`}           color={C.success} />
        <StatPill label="Confidence" value={`${confPct}%`}            color={C.warning} />
      </div>

      {recommendation.rationale && (
        <p style={{ margin: 0, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
          {recommendation.rationale}
        </p>
      )}

      {/* Polymarket link */}
      {recommendation.marketUrl ? (
        <a
          href={recommendation.marketUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 0', borderRadius: 10,
            background: `${C.accent}18`, border: `1px solid ${C.accent}44`,
            color: C.accent, fontSize: 12, fontWeight: 600, textDecoration: 'none',
          }}>
          View market on Polymarket →
        </a>
      ) : (
        <p style={{ margin: 0, fontSize: 11, color: C.muted, textAlign: 'center' }}>
          Search <strong style={{ color: C.sub }}>"polymarket.com"</strong> for: {recommendation.question?.slice(0, 60)}
        </p>
      )}

      {!tradeSimulated ? (
        <button
          onClick={onSimulateTrade}
          style={{
            padding: '13px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${C.success}, #059669)`,
            color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: 0.3,
          }}>
          Simulate Trade (Educational)
        </button>
      ) : postmortemDone ? (
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: `${C.success}18`, border: `1px solid ${C.success}44`,
          fontSize: 12, color: C.success, fontWeight: 600, textAlign: 'center',
        }}>
          Post-mortem complete — see analysis above
        </div>
      ) : (
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: `${C.warning}18`, border: `1px solid ${C.warning}44`,
          fontSize: 12, color: C.warning, fontWeight: 600, textAlign: 'center',
        }}>
          Post-mortem running in ~30 seconds...
        </div>
      )}
    </div>
  );
}

function PortfolioPanel({ portfolio, onClear }) {
  const [expanded, setExpanded] = useState(false);
  if (!portfolio) return null;
  const { startingBalance, balance, trades = [] } = portfolio;
  const totalPnl = parseFloat((balance - startingBalance).toFixed(2));
  const wins = trades.filter(t => t.won).length;
  const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;
  const pnlColor = totalPnl >= 0 ? C.success : C.error;
  const pnlStr = totalPnl >= 0 ? `+$${totalPnl.toFixed(2)}` : `-$${Math.abs(totalPnl).toFixed(2)}`;

  return (
    <div style={{
      background: C.card, border: `1.5px solid ${C.border}`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* Summary header — always visible */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', cursor: 'pointer',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: `${pnlColor}22`, border: `1.5px solid ${pnlColor}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15,
          }}>📊</div>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: C.text }}>Paper Portfolio</p>
            <p style={{ margin: '1px 0 0', fontSize: 11, color: C.sub }}>{trades.length} trade{trades.length !== 1 ? 's' : ''} · {winRate}% win rate</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: pnlColor }}>{pnlStr}</p>
            <p style={{ margin: 0, fontSize: 10, color: C.sub }}>${balance.toLocaleString()} balance</p>
          </div>
          <span style={{ color: C.muted, fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded trade history */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {trades.length === 0 ? (
            <p style={{ margin: 0, padding: '14px', fontSize: 12, color: C.muted, textAlign: 'center' }}>
              No trades yet. Simulate a trade to start tracking.
            </p>
          ) : (
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {trades.map((t, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  borderBottom: i < trades.length - 1 ? `1px solid ${C.border}` : 'none',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: t.won ? C.success : C.error,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 11, color: C.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.action} · {t.question}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: C.muted }}>
                      {t.date} · Entry {Math.round((t.entryPrice || 0) * 100)}¢ · Bet ${(t.betSize || 0).toFixed(0)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: t.won ? C.success : C.error }}>
                      {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: C.muted }}>{t.outcome}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: '8px 14px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={e => { e.stopPropagation(); onClear?.(); }}
              style={{
                padding: '5px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: 'transparent', color: C.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>
              Reset Portfolio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentPipeline({
  agentStates = [],
  recommendation = null,
  dataSource = 'mock',
  isRunning = false,
  onSimulateTrade,
  onReset,
  onClearPortfolio,
  paperPortfolio = null,
}) {
  const [tradeSimulated, setTradeSimulated] = useState(false);

  const handleSimulate = () => {
    setTradeSimulated(true);
    onSimulateTrade?.();
  };

  const doneCount = agentStates.filter(a => a.status === 'done' || a.status === 'blocked' || a.status === 'error').length;
  const totalCount = agentStates.length || 6;
  const progressPct = Math.round((doneCount / totalCount) * 100);
  const allDone = doneCount === totalCount && totalCount > 0;

  return (
    <div style={{
      background: C.bg, borderRadius: 18, padding: '16px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>Agent Pipeline</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: C.sub }}>
            {dataSource === 'live' ? 'Live Polymarket data' : 'Mock market data'}
            {isRunning && !allDone ? ` · ${progressPct}% complete` : allDone ? ' · Complete' : ''}
          </p>
        </div>
        {allDone && (
          <button
            onClick={onReset}
            style={{
              padding: '7px 14px', borderRadius: 10, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.sub, fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}>
            Run Again
          </button>
        )}
      </div>

      {/* Overall progress bar */}
      <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: `linear-gradient(90deg, ${C.accent}, ${C.success})`,
          width: `${progressPct}%`, transition: 'width 0.6s ease',
        }} />
      </div>

      {/* Agent cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {agentStates.map((agent, i) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            meta={AGENT_META[i] || { id: agent.id, name: agent.id, abbr: '??', desc: '' }}
            isActive={agent.status === 'running' || agent.status === 'done'}
          />
        ))}
      </div>

      {/* Recommendation */}
      <RecommendationCard
        recommendation={recommendation}
        onSimulateTrade={handleSimulate}
        tradeSimulated={tradeSimulated}
        postmortemDone={agentStates.find(a => a.id === 'postmortem')?.status === 'done'}
      />

      {/* Paper portfolio tracker */}
      <PortfolioPanel portfolio={paperPortfolio} onClear={onClearPortfolio} />
    </div>
  );
}
