import React from 'react';
import { Sparkles } from 'lucide-react';

export default function CoachSay({ message, isYoung = false }) {
  if (!message) return null;

  return (
    <div className="coach-bubble">
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {/* Sparkle star decorations */}
        <span style={{
          position: 'absolute', top: -11, right: -11, fontSize: 12,
          color: '#F59E0B', pointerEvents: 'none', display: 'block',
          animation: 'sparkle 2.1s ease-in-out infinite',
        }}>✦</span>
        <span style={{
          position: 'absolute', bottom: -9, left: -11, fontSize: 9,
          color: '#7C3AED', pointerEvents: 'none', display: 'block',
          animation: 'sparkle 2.6s ease-in-out 0.8s infinite',
        }}>✧</span>
        <div className="coach-avatar">
          <div className="coach-avatar-ring" />
          <div className="coach-avatar-ring-inner" />
          <div className="coach-avatar-content">
            <Sparkles style={{ width: 18, height: 18, color: '#fff' }} />
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 11, fontWeight: 800,
          background: 'linear-gradient(90deg, #6B7FD8 0%, #C8A55A 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '0.1em', textTransform: 'uppercase',
          display: 'block', marginBottom: 5,
        }}>
          ✦ Sunny
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
