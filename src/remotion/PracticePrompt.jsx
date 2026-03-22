import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';

/**
 * PracticePrompt — animated practice question card.
 *
 * Shows a question, grows a "think time" progress bar, then reveals the hint.
 * Duration: PracticePrompt.durationInFrames = 210 (7s @ 30fps)
 *
 * Props:
 *   question string  — the question to answer
 *   hint     string  — short hint shown after thinking time
 *   color    string  — accent color
 */

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif';

// Think-bar: grows from frame 90 → 180 (3s to 6s)
const THINK_START = 90;
const THINK_END = 180;

export const PracticePrompt = ({
  question = 'What did you learn today?',
  hint = 'Think carefully!',
  color = '#0A84FF',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Header "Your Turn!" — spring in at 0
  const headerScale = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 200 },
    durationInFrames: Math.round(0.7 * fps),
  });
  const headerOpacity = interpolate(frame, [0, Math.round(0.3 * fps)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Question card — slides up at 0.8s
  const qOpacity = interpolate(
    frame,
    [Math.round(0.8 * fps), Math.round(1.4 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const qY = interpolate(
    frame,
    [Math.round(0.8 * fps), Math.round(1.4 * fps)],
    [18, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Think label fades at 2.5s (before think bar starts)
  const thinkLabelOpacity = interpolate(
    frame,
    [Math.round(2.5 * fps), Math.round(3.0 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Think bar progress — grows from 3s to 6s
  const thinkProgress = interpolate(frame, [THINK_START, THINK_END], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Hint — pops in at 6s
  const hintScale = spring({
    frame: Math.max(frame - Math.round(6.0 * fps), 0),
    fps,
    config: { damping: 14, stiffness: 240 },
    durationInFrames: Math.round(0.5 * fps),
  });
  const hintOpacity = interpolate(
    frame,
    [Math.round(6.0 * fps), Math.round(6.3 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill
      style={{
        background: '#F2F2F7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '28px 24px',
        fontFamily: FONT,
        gap: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          opacity: headerOpacity,
          transform: `scale(${headerScale})`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 20,
        }}
      >
        <span style={{ fontSize: 26 }}>🎯</span>
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: color,
            letterSpacing: -0.4,
          }}
        >
          Your Turn!
        </span>
      </div>

      {/* Question card */}
      <div
        style={{
          opacity: qOpacity,
          transform: `translateY(${qY}px)`,
          background: '#ffffff',
          borderRadius: 18,
          padding: '20px 22px',
          width: '100%',
          boxShadow: `0 4px 24px rgba(0,0,0,0.08), 0 0 0 1.5px ${color}25`,
          marginBottom: 22,
        }}
      >
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: '#1C1C1E',
            lineHeight: 1.55,
            textAlign: 'center',
          }}
        >
          {question}
        </div>
      </div>

      {/* Think label */}
      <div
        style={{
          opacity: thinkLabelOpacity,
          fontSize: 12,
          fontWeight: 600,
          color: '#8E8E93',
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          marginBottom: 8,
        }}
      >
        Think time...
      </div>

      {/* Think bar */}
      <div
        style={{
          width: '100%',
          height: 8,
          background: '#E5E5EA',
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 18,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${thinkProgress * 100}%`,
            background: `linear-gradient(to right, ${color}, ${color}99)`,
            borderRadius: 4,
            transition: 'none',
          }}
        />
      </div>

      {/* Hint */}
      <div
        style={{
          opacity: hintOpacity,
          transform: `scale(${hintScale})`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: `${color}15`,
          borderRadius: 12,
          padding: '10px 18px',
          border: `1.5px solid ${color}30`,
        }}
      >
        <span style={{ fontSize: 16 }}>💡</span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: color,
          }}
        >
          Hint: {hint}
        </span>
      </div>
    </AbsoluteFill>
  );
};

PracticePrompt.durationInFrames = 210; // 7s @ 30fps
