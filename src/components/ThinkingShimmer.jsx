import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * ThinkingShimmer — Skeleton loading indicator for AI processing
 *
 * Replaces generic bouncing dots with a contextual loading state
 * that hints at the shape of the incoming response. Reduces perceived
 * latency by giving the user something meaningful to watch.
 *
 * Props:
 *   label — Optional context label ("Translating...", "Thinking...")
 *   accent — Brand accent color (default: periwinkle)
 */
export default function ThinkingShimmer({ label, accent = '#6B7FD8' }) {
  return (
    <div className="msg-in" style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: 'linear-gradient(135deg, rgba(107,127,216,0.065) 0%, rgba(255,255,255,0.97) 100%)',
        borderRadius: '18px 18px 18px 4px',
        padding: '14px 16px',
        boxShadow: '0 2px 14px rgba(107,127,216,0.10), 0 1px 4px rgba(0,0,0,0.05)',
        maxWidth: '80%',
      }}>
        {/* Mini coach avatar */}
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'calmPulse 2.5s ease-in-out infinite',
        }}>
          <Sparkles style={{ width: 13, height: 13, color: '#fff' }} />
        </div>
        {/* Shimmer skeleton lines */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 3, minWidth: 120 }}>
          <div className="shimmer-bar" style={{ width: '80%', height: 9, borderRadius: 4.5 }} />
          <div className="shimmer-bar" style={{ width: '58%', height: 9, borderRadius: 4.5, animationDelay: '0.2s' }} />
          {label && (
            <span className="thinking-label" style={{
              fontSize: 11, fontWeight: 500, color: '#8E8E93', marginTop: 3,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
