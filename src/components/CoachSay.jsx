import React from 'react';
import { Sparkles } from 'lucide-react';

const sysFont = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif';

export default function CoachSay({ message, isYoung = false }) {
  if (!message) return null;

  return (
    <div style={{
      width: '100%', background: '#fff', borderRadius: 14,
      borderLeft: '4px solid #7C3AED',
      padding: '12px 14px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      fontFamily: sysFont,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%', background: '#EDE9FE', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Sparkles style={{ width: 13, height: 13, color: '#7C3AED' }} />
      </div>
      <p style={{
        color: '#1C1C1E', fontSize: isYoung ? 16 : 14, fontWeight: 500,
        lineHeight: 1.55, margin: 0,
      }}>
        {message}
      </p>
    </div>
  );
}
