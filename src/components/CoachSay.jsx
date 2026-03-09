import React from 'react';
import { Sparkles } from 'lucide-react';

export default function CoachSay({ message, isYoung = false }) {
  if (!message) return null;

  return (
    <div className="coach-bubble">
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {/* Sparkle star decorations */}
        <span style={{
          position: 'absolute', top: -9, right: -9, fontSize: 11,
          color: '#F59E0B', pointerEvents: 'none', display: 'block',
          animation: 'sparkle 2.1s ease-in-out infinite',
        }}>✦</span>
        <span style={{
          position: 'absolute', bottom: -7, left: -9, fontSize: 8,
          color: '#7C3AED', pointerEvents: 'none', display: 'block',
          animation: 'sparkle 2.6s ease-in-out 0.8s infinite',
        }}>✧</span>
        <div className="coach-avatar">
          <Sparkles style={{ width: 14, height: 14, color: '#fff' }} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 10, fontWeight: 800,
          background: 'linear-gradient(90deg, #7C3AED 0%, #4F46E5 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '0.1em', textTransform: 'uppercase',
          display: 'block', marginBottom: 3,
        }}>
          ✦ Sunny
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
