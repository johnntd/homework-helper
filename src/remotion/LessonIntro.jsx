import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';

/**
 * LessonIntro — 10-second animated title card that opens every daily lesson.
 *
 * Duration: LessonIntro.durationInFrames = 300 (10s @ 30fps)
 *
 * Props:
 *   title    string  — short lesson title
 *   subtitle string  — "Today we learn: ..." line
 *   emoji    string  — large subject emoji
 *   color    string  — accent color
 */

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif';

export const LessonIntro = ({
  title = 'Today\'s Lesson',
  subtitle = '',
  emoji = '📚',
  color = '#0A84FF',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background color wash
  const bgOpacity = interpolate(frame, [0, Math.round(0.4 * fps)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Top badge: "Today's Lesson" — slides down
  const badgeOpacity = interpolate(frame, [Math.round(0.2 * fps), Math.round(0.6 * fps)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const badgeY = interpolate(frame, [Math.round(0.2 * fps), Math.round(0.6 * fps)], [-16, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Emoji — spring bounce at 0.5s
  const emojiScale = spring({
    frame: Math.max(frame - Math.round(0.5 * fps), 0),
    fps,
    config: { damping: 12, stiffness: 220, mass: 0.8 },
    durationInFrames: Math.round(1.2 * fps),
  });
  const emojiOpacity = interpolate(
    frame,
    [Math.round(0.5 * fps), Math.round(0.8 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Title — spring up at 1.2s
  const titleScale = spring({
    frame: Math.max(frame - Math.round(1.2 * fps), 0),
    fps,
    config: { damping: 18, stiffness: 180 },
    durationInFrames: Math.round(0.9 * fps),
  });
  const titleY = interpolate(
    frame,
    [Math.round(1.2 * fps), Math.round(1.8 * fps)],
    [20, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const titleOpacity = interpolate(
    frame,
    [Math.round(1.2 * fps), Math.round(1.7 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Color bar — grows at 2.2s
  const barProgress = interpolate(
    frame,
    [Math.round(2.2 * fps), Math.round(2.9 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Subtitle — fades in at 3.0s
  const subOpacity = interpolate(
    frame,
    [Math.round(3.0 * fps), Math.round(3.7 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // "Let's go!" call-to-action — fades in at 6s, pulses gently
  const ctaOpacity = interpolate(
    frame,
    [Math.round(6.0 * fps), Math.round(6.8 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const ctaPulse = interpolate(
    frame,
    [Math.round(7 * fps), Math.round(7.5 * fps), Math.round(8 * fps), Math.round(8.5 * fps), Math.round(9 * fps), Math.round(9.5 * fps)],
    [1, 1.04, 1, 1.04, 1, 1.04],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
        overflow: 'hidden',
      }}
    >
      {/* Colored bottom accent bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 6,
          width: `${barProgress * 100}%`,
          background: `linear-gradient(to right, ${color}, ${color}99)`,
          borderRadius: '0 3px 0 0',
        }}
      />

      {/* Faint colored bg wash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `${color}08`,
          opacity: bgOpacity,
        }}
      />

      {/* Badge: "Today's Lesson" */}
      <div
        style={{
          opacity: badgeOpacity,
          transform: `translateY(${badgeY}px)`,
          fontSize: 11,
          fontWeight: 700,
          color: color,
          textTransform: 'uppercase',
          letterSpacing: 2.5,
          background: `${color}15`,
          padding: '5px 14px',
          borderRadius: 20,
          marginBottom: 20,
        }}
      >
        Today's Lesson
      </div>

      {/* Emoji */}
      <div
        style={{
          opacity: emojiOpacity,
          transform: `scale(${emojiScale})`,
          fontSize: 72,
          lineHeight: 1,
          marginBottom: 18,
        }}
      >
        {emoji}
      </div>

      {/* Title */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px) scale(${titleScale})`,
          fontSize: 30,
          fontWeight: 800,
          color: '#1C1C1E',
          textAlign: 'center',
          letterSpacing: -0.8,
          lineHeight: 1.15,
          padding: '0 28px',
          marginBottom: 16,
        }}
      >
        {title}
      </div>

      {/* Subtitle */}
      {subtitle ? (
        <div
          style={{
            opacity: subOpacity,
            fontSize: 15,
            color: '#6B6B6B',
            textAlign: 'center',
            lineHeight: 1.5,
            padding: '0 32px',
            maxWidth: 340,
          }}
        >
          {subtitle}
        </div>
      ) : null}

      {/* CTA */}
      <div
        style={{
          opacity: ctaOpacity,
          transform: `scale(${ctaPulse})`,
          marginTop: 28,
          padding: '10px 24px',
          background: color,
          borderRadius: 24,
          fontSize: 15,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: 0.3,
          boxShadow: `0 4px 16px ${color}40`,
        }}
      >
        Let's go! →
      </div>
    </AbsoluteFill>
  );
};

LessonIntro.durationInFrames = 300; // 10s @ 30fps
