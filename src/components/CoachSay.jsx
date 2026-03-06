import React from 'react';
import { Sparkles } from 'lucide-react';

export default function CoachSay({ message, isYoung = false }) {
  if (!message) return null;

  return (
    <div className="coach-bubble">
      <div className="coach-avatar">
        <Sparkles style={{ width: 14, height: 14, color: '#fff' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#7C3AED',
          letterSpacing: '0.07em', textTransform: 'uppercase',
          display: 'block', marginBottom: 3,
        }}>
          Sunny
        </span>
        <p style={{
          color: '#1C1C1E',
          fontSize: isYoung ? 16 : 14,
          fontWeight: 500,
          lineHeight: 1.6,
          margin: 0,
        }}>
          {message}
        </p>
      </div>
    </div>
  );
}
