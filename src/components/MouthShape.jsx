import React from 'react';

/**
 * MouthShape — SVG-based mouth position illustration for pronunciation teaching.
 *
 * Renders a recognizable mouth/lip shape for each phoneme category.
 * Designed for the pronunciation-guide visual type in StudyBoard.
 *
 * Shapes map to phoneme categories:
 *   open   — /a/, /ar/, /ah/  (jaw dropped, wide opening)
 *   round  — /o/, /oo/, /u/   (lips pursed into circle)
 *   wide   — /ee/, /eh/, /i/  (lips stretched horizontally)
 *   closed — /m/, /n/, /b/    (lips pressed together)
 *   teeth  — /f/, /v/, /th/   (top teeth on lower lip)
 *
 * Future: These shapes are the targets for a lip-sync engine.
 * A TTS onboundary event would fire shape transitions at phoneme timestamps.
 *
 * Performance: Pure SVG, no runtime computation. Transition on transform only.
 */
export default function MouthShape({ shape = 'closed', size = 44, active = false }) {
  const stroke = active ? '#E11D48' : '#9CA3AF';
  const lipFill = active ? '#FECDD3' : '#E5E7EB';
  const innerFill = active ? 'rgba(28,28,30,0.12)' : 'rgba(28,28,30,0.06)';
  const tongueFill = active ? 'rgba(248,113,113,0.35)' : 'rgba(248,113,113,0.1)';

  const shapes = {
    // Open mouth — jaw dropped, visible tongue
    open: (
      <svg viewBox="0 0 44 44" fill="none">
        <ellipse cx="22" cy="24" rx="16" ry="13" fill={lipFill} stroke={stroke} strokeWidth="1.8" />
        <ellipse cx="22" cy="25" rx="11" ry="9" fill={innerFill} />
        <ellipse cx="22" cy="30" rx="7" ry="4" fill={tongueFill} />
      </svg>
    ),
    // Round mouth — lips pursed, circular opening
    round: (
      <svg viewBox="0 0 44 44" fill="none">
        <ellipse cx="22" cy="23" rx="14" ry="14" fill={lipFill} stroke={stroke} strokeWidth="1.8" />
        <circle cx="22" cy="23" r="7" fill={innerFill} />
      </svg>
    ),
    // Wide mouth — stretched lips, narrow gap
    wide: (
      <svg viewBox="0 0 44 44" fill="none">
        <ellipse cx="22" cy="24" rx="17" ry="9" fill={lipFill} stroke={stroke} strokeWidth="1.8" />
        <ellipse cx="22" cy="24" rx="12" ry="4" fill={innerFill} />
      </svg>
    ),
    // Closed mouth — lips pressed together
    closed: (
      <svg viewBox="0 0 44 44" fill="none">
        <path d="M8 23 Q22 27 36 23" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        <path d="M10 23 Q22 19 34 23" fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.35" strokeLinecap="round" />
      </svg>
    ),
    // Teeth visible — top teeth on lower lip
    teeth: (
      <svg viewBox="0 0 44 44" fill="none">
        <ellipse cx="22" cy="25" rx="15" ry="11" fill={lipFill} stroke={stroke} strokeWidth="1.8" />
        {/* Teeth row */}
        <rect x="11" y="20" width="22" height="5" rx="1.5" fill="white" stroke={stroke} strokeWidth="0.8" opacity="0.9" />
        {/* Lower mouth opening */}
        <ellipse cx="22" cy="29" rx="10" ry="5" fill={innerFill} />
      </svg>
    ),
  };

  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.25s ease',
        transform: active ? 'scale(1.15)' : 'scale(1)',
      }}
      role="img"
      aria-label={`Mouth shape: ${shape}`}
    >
      {shapes[shape] || shapes.closed}
    </div>
  );
}
