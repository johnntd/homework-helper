import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * CoachSay — Sunny AI coach message bubble.
 *
 * Speaking state: subtle, high-quality pulse on avatar + small dots indicator.
 * No fake mouth animation. The avatar glows softly to signal "coach is talking."
 */
export default function CoachSay({ message, isYoung = false, isSpeaking = false }) {
  if (!message) return null;

  return (
    <div className="coach-bubble coach-bubble-calm" role="region" aria-label="Coach message">
      <div className={`coach-avatar coach-avatar-calm${isSpeaking ? ' coach-avatar-speaking' : ''}`}>
        <div className="coach-avatar-content">
          <Sparkles style={{ width: 18, height: 18, color: '#fff' }} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: 'var(--accent)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
        }}>
          Sunny
          {isSpeaking && (
            <span className="coach-speaking-dots" aria-label="Speaking">
              <span /><span /><span />
            </span>
          )}
        </span>
        <p style={{
          color: '#1C1C1E',
          fontSize: isYoung ? 17 : 15,
          fontWeight: 500,
          lineHeight: 1.65,
          margin: 0,
        }}>
          {message}
        </p>
      </div>
    </div>
  );
}
