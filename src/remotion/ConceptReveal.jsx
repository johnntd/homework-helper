import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';

/**
 * ConceptReveal — animated multi-fact teaching clip for science, history, geography, etc.
 *
 * Use for explaining a PROCESS or SYSTEM (water cycle, gravity, photosynthesis process,
 * how the heart works) — NOT for single-word definitions (use VocabReveal for those).
 *
 * Duration is dynamic: ConceptReveal.duration(facts)
 *   = INTRO(60) + facts.length * PER_FACT(45) + OUTRO(50)
 *
 * Props:
 *   title    string    — concept name, e.g. "The Water Cycle"
 *   facts    string[]  — 2–4 key facts, each one sentence
 *   analogy  string    — optional "Think of it like..." closing line
 *   emoji    string    — optional subject emoji shown beside title
 *   color    string    — accent color
 */

const INTRO_FRAMES = 60;
const PER_FACT = 45;
const OUTRO_FRAMES = 50;

export const ConceptReveal = ({
  title = '',
  facts = [],
  analogy = '',
  emoji = '',
  color = '#0A84FF',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const FONT =
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif';

  // Title — spring pop
  const titleScale = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 180 },
    durationInFrames: Math.round(0.8 * fps),
  });
  const titleOpacity = interpolate(frame, [0, Math.round(0.3 * fps)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Divider grows at 1.2s
  const lineProgress = interpolate(
    frame,
    [Math.round(1.2 * fps), Math.round(1.7 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Each fact starts at INTRO + index * PER_FACT frames
  const factAnimations = facts.map((_, i) => {
    const start = INTRO_FRAMES + i * PER_FACT;
    const end = start + Math.round(0.6 * fps);
    return {
      opacity: interpolate(frame, [start, end], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      }),
      y: interpolate(frame, [start, end], [14, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      }),
    };
  });

  // Analogy — fades in after all facts
  const analogyStart = INTRO_FRAMES + facts.length * PER_FACT;
  const analogyOpacity = interpolate(
    frame,
    [analogyStart, analogyStart + Math.round(0.7 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill
      style={{
        background: '#F2F2F7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        padding: '28px 26px',
        fontFamily: FONT,
      }}
    >
      {/* Title row */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          transformOrigin: 'left center',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
        }}
      >
        {emoji ? (
          <span style={{ fontSize: 32, lineHeight: 1 }}>{emoji}</span>
        ) : null}
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: '#1C1C1E',
            letterSpacing: -0.5,
            lineHeight: 1.15,
          }}
        >
          {title}
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          width: `${lineProgress * 100}%`,
          height: 2,
          background: `linear-gradient(to right, ${color}, ${color}30)`,
          borderRadius: 1,
          marginBottom: 16,
        }}
      />

      {/* Facts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        {facts.map((fact, i) => (
          <div
            key={i}
            style={{
              opacity: factAnimations[i]?.opacity ?? 0,
              transform: `translateY(${factAnimations[i]?.y ?? 14}px)`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            {/* Numbered dot */}
            <div
              style={{
                flexShrink: 0,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
                marginTop: 2,
              }}
            >
              {i + 1}
            </div>
            <div
              style={{
                fontSize: 15,
                color: '#1C1C1E',
                lineHeight: 1.5,
                fontWeight: 400,
                flex: 1,
              }}
            >
              {fact}
            </div>
          </div>
        ))}
      </div>

      {/* Analogy */}
      {analogy ? (
        <div
          style={{
            opacity: analogyOpacity,
            marginTop: 16,
            padding: '10px 14px',
            background: `${color}12`,
            borderRadius: 12,
            borderLeft: `3px solid ${color}50`,
            fontSize: 13,
            color: '#48484A',
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}
        >
          💡 {analogy}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

ConceptReveal.duration = (facts = []) =>
  INTRO_FRAMES + facts.length * PER_FACT + OUTRO_FRAMES;
