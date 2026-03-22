import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';

/**
 * MathStepper — step-by-step math problem solver animation
 *
 * Duration (frames) = 60 + steps.length * 45 + 40
 * Use MathStepper.duration(steps) to compute durationInFrames for the Player.
 *
 * Props:
 *   problem   string    — the full problem statement
 *   steps     string[]  — each step of the solution (2–6 steps ideal)
 *   answer    string    — the final answer e.g. "x = 4" or "3/4"
 *   color     string    — accent color
 */

const FRAMES_PER_STEP = 45; // 1.5s @ 30fps
const INTRO_FRAMES = 60;    // 2s for problem to appear before steps start
const OUTRO_FRAMES = 40;    // 1.3s hold after answer

export const MathStepper = ({
  problem = '',
  steps = [],
  answer = '',
  color = '#0A84FF',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const FONT =
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif';

  // Problem slides in
  const probOpacity = interpolate(frame, [0, Math.round(0.4 * fps)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const probY = interpolate(frame, [0, Math.round(0.4 * fps)], [10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Answer appears after all steps with a spring pop
  const answerStart = INTRO_FRAMES + steps.length * FRAMES_PER_STEP;
  const answerOpacity = interpolate(
    frame,
    [answerStart, answerStart + Math.round(0.4 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const answerScale = spring({
    frame: Math.max(0, frame - answerStart),
    fps,
    config: { damping: 14, stiffness: 200 },
  });

  return (
    <AbsoluteFill
      style={{
        background: '#F2F2F7',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 20px',
        fontFamily: FONT,
        overflowY: 'hidden',
      }}
    >
      {/* Problem */}
      <div
        style={{
          opacity: probOpacity,
          transform: `translateY(${probY}px)`,
          fontSize: 17,
          fontWeight: 600,
          color: '#1C1C1E',
          lineHeight: 1.45,
          marginBottom: 16,
          padding: '13px 16px',
          background: '#fff',
          borderRadius: 13,
          border: '1px solid #E5E5EA',
        }}
      >
        {problem}
      </div>

      {/* Steps */}
      {steps.map((step, i) => {
        const stepStart = INTRO_FRAMES + i * FRAMES_PER_STEP;
        const opacity = interpolate(
          frame,
          [stepStart, stepStart + Math.round(0.35 * fps)],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );
        const translateY = interpolate(
          frame,
          [stepStart, stepStart + Math.round(0.35 * fps)],
          [10, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        return (
          <div
            key={i}
            style={{
              opacity,
              transform: `translateY(${translateY}px)`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              marginBottom: 10,
              padding: '10px 14px',
              background: '#fff',
              borderRadius: 11,
              border: '1px solid #E5E5EA',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                background: color,
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              {i + 1}
            </div>
            <div style={{ fontSize: 14, color: '#1C1C1E', lineHeight: 1.5 }}>
              {step}
            </div>
          </div>
        );
      })}

      {/* Answer */}
      {answer ? (
        <div
          style={{
            opacity: answerOpacity,
            transform: `scale(${answerScale})`,
            marginTop: 6,
            padding: '13px 16px',
            background: `${color}14`,
            border: `2px solid ${color}`,
            borderRadius: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E' }}>
            {answer}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Compute total frames needed for a given steps array */
MathStepper.duration = (steps = []) =>
  INTRO_FRAMES + steps.length * FRAMES_PER_STEP + OUTRO_FRAMES;
