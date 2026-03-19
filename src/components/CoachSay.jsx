import React from 'react';
import { Sparkles } from 'lucide-react';

export default function CoachSay({ message, isYoung = false }) {
  if (!message) return null;

  return (
    <div className="coach-bubble coach-bubble-calm">
      <div className="coach-avatar coach-avatar-calm">
        <div className="coach-avatar-content">
          <Sparkles style={{ width: 18, height: 18, color: '#fff' }} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: 'var(--accent)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          display: 'block', marginBottom: 4,
        }}>
          Sunny
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
