import React from 'react';

/**
 * WaveformBars — Animated audio waveform visualization
 *
 * Uses staggered CSS animations on individual bars to simulate
 * real-time audio levels. Each bar has a unique delay and duration
 * to create organic, non-repetitive motion.
 *
 * Performance: Pure CSS animations on transform+opacity (GPU-accelerated).
 * No JS animation loop, no requestAnimationFrame.
 */
export default function WaveformBars({ color = '#6B7FD8', barCount = 16, height = 22, compact = false }) {
  const gap = compact ? 1.5 : 2;
  const barWidth = compact ? 2 : 2.5;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap,
        height,
      }}
      role="img"
      aria-label="Audio visualization"
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{
            width: barWidth,
            borderRadius: barWidth / 2,
            background: color,
            /* Stagger delays and durations for organic motion */
            animationDelay: `${-i * 0.07}s`,
            animationDuration: `${0.5 + (i % 7) * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}
