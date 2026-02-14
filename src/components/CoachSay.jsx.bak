import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * CoachSay Component
 * Displays Sunny's short, motivating messages (≤140 chars)
 * Always shown at top of learning interface
 */
export default function CoachSay({ message, isYoung = false, color = 'from-purple-400 to-purple-600' }) {
  if (!message) return null;

  return (
    <div className={`w-full bg-gradient-to-r ${color} rounded-2xl p-4 shadow-lg mb-4 animate-slide-down`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 bg-white/20 rounded-full p-2">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p 
            className={`text-white font-semibold leading-relaxed ${isYoung ? 'text-xl' : 'text-lg'}`}
            style={{ fontFamily: isYoung ? 'Fredoka, sans-serif' : 'Poppins, sans-serif' }}
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Usage:
 * <CoachSay 
 *   message="Great job! Now try adding 7+8" 
 *   isYoung={true}
 *   color="from-blue-400 to-blue-600"
 * />
 */
