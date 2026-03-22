import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';

/**
 * RecapScene — end-of-lesson recap card with animated checkpoints.
 *
 * Duration: RecapScene.durationInFrames = 270 (9s @ 30fps)
 *
 * Props:
 *   title  string    — header text, e.g. "Great work today!"
 *   points string[]  — 2–4 recap bullet points
 *   color  string    — accent color
 */

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif';
const POINT_STAGGER = 45; // frames between each point

export const RecapScene = ({
  title = 'Great work today!',
  points = [],
  color = '#0A84FF',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Star emoji — spring bounce at 0
  const starScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 240, mass: 0.7 },
    durationInFrames: Math.round(0.9 * fps),
  });
  const starOpacity = interpolate(frame, [0, Math.round(0.25 * fps)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // "Great work!" title — spring at 0.6s
  const titleScale = spring({
    frame: Math.max(frame - Math.round(0.6 * fps), 0),
    fps,
    config: { damping: 18, stiffness: 180 },
    durationInFrames: Math.round(0.8 * fps),
  });
  const titleOpacity = interpolate(
    frame,
    [Math.round(0.6 * fps), Math.round(1.0 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Divider — grows at 1.4s
  const lineProgress = interpolate(
    frame,
    [Math.round(1.4 * fps), Math.round(2.0 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // "Today you learned:" label — fades at 1.8s
  const labelOpacity = interpolate(
    frame,
    [Math.round(1.8 * fps), Math.round(2.3 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Each point starts at frame 75 + i * POINT_STAGGER
  const POINTS_START = 75;
  const pointAnimations = points.map((_, i) => {
    const start = POINTS_START + i * POINT_STAGGER;
    return {
      opacity: interpolate(frame, [start, start + 18], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      }),
      x: interpolate(frame, [start, start + 18], [-16, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      }),
      checkScale: spring({
        frame: Math.max(frame - start, 0),
        fps,
        config: { damping: 14, stiffness: 280 },
        durationInFrames: 20,
      }),
    };
  });

  // Encouragement tag — fades in after all points
  const encStart = POINTS_START + points.length * POINT_STAGGER + 30;
  const encOpacity = interpolate(
    frame,
    [encStart, encStart + Math.round(0.8 * fps)],
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
        justifyContent: 'center',
        padding: '28px 26px',
        fontFamily: FONT,
      }}
    >
      {/* Star + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div
          style={{
            opacity: starOpacity,
            transform: `scale(${starScale})`,
            fontSize: 34,
            lineHeight: 1,
          }}
        >
          🌟
        </div>
        <div
          style={{
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
            transformOrigin: 'left center',
            fontSize: 24,
            fontWeight: 800,
            color: '#1C1C1E',
            letterSpacing: -0.4,
            lineHeight: 1.2,
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
          background: `linear-gradient(to right, ${color}, ${color}25)`,
          borderRadius: 1,
          marginBottom: 14,
        }}
      />

      {/* "Today you learned:" */}
      <div
        style={{
          opacity: labelOpacity,
          fontSize: 12,
          fontWeight: 600,
          color: '#8E8E93',
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginBottom: 12,
        }}
      >
        Today you learned:
      </div>

      {/* Recap points */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        {points.map((point, i) => (
          <div
            key={i}
            style={{
              opacity: pointAnimations[i]?.opacity ?? 0,
              transform: `translateX(${pointAnimations[i]?.x ?? -16}px)`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            {/* Checkmark dot */}
            <div
              style={{
                flexShrink: 0,
                transform: `scale(${pointAnimations[i]?.checkScale ?? 0})`,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                marginTop: 2,
              }}
            >
              ✓
            </div>
            <div
              style={{
                fontSize: 14,
                color: '#1C1C1E',
                lineHeight: 1.5,
                fontWeight: 500,
                flex: 1,
              }}
            >
              {point}
            </div>
          </div>
        ))}
      </div>

      {/* Encouragement tag */}
      <div
        style={{
          opacity: encOpacity,
          marginTop: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: `${color}12`,
          borderRadius: 12,
          borderLeft: `3px solid ${color}50`,
          padding: '10px 14px',
          width: '100%',
        }}
      >
        <span style={{ fontSize: 16 }}>🚀</span>
        <span
          style={{
            fontSize: 13,
            color: '#48484A',
            fontStyle: 'italic',
            lineHeight: 1.4,
          }}
        >
          Keep it up — every lesson makes you smarter!
        </span>
      </div>
    </AbsoluteFill>
  );
};

RecapScene.durationInFrames = 270; // 9s @ 30fps
