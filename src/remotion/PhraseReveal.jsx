import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';

/**
 * PhraseReveal — animated language learning card
 *
 * Plays for 6 seconds (180 frames @ 30fps).
 * Reveals: language badge → phrase → phonetic → divider → translation → example
 *
 * Props:
 *   phrase             string  — word or phrase in target language
 *   phonetic           string  — optional pronunciation guide
 *   translation        string  — meaning in the learner's language
 *   language           string  — e.g. "French", "Spanish", "Japanese"
 *   example            string  — optional example sentence in target language
 *   exampleTranslation string  — optional translation of the example
 *   color              string  — accent color
 */
export const PhraseReveal = ({
  phrase = '',
  phonetic = '',
  translation = '',
  language = '',
  example = '',
  exampleTranslation = '',
  color = '#0A84FF',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const FONT =
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif';

  // Language badge — slides down from top
  const badgeOpacity = interpolate(frame, [0, Math.round(0.3 * fps)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const badgeY = interpolate(frame, [0, Math.round(0.3 * fps)], [-12, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Phrase — spring pop at 0.3s
  const phraseScale = spring({
    frame: Math.max(frame - Math.round(0.3 * fps), 0),
    fps,
    config: { damping: 18, stiffness: 200 },
    durationInFrames: Math.round(0.8 * fps),
  });
  const phraseOpacity = interpolate(
    frame,
    [Math.round(0.3 * fps), Math.round(0.55 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Phonetic — fades in at 1.1s
  const phoneticOpacity = interpolate(
    frame,
    [Math.round(1.1 * fps), Math.round(1.5 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Divider — grows at 1.5s
  const lineProgress = interpolate(
    frame,
    [Math.round(1.5 * fps), Math.round(2.0 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Translation — slides up at 2.0s (this is the hero reveal)
  const transScale = spring({
    frame: Math.max(frame - Math.round(2.0 * fps), 0),
    fps,
    config: { damping: 20, stiffness: 160 },
    durationInFrames: Math.round(0.6 * fps),
  });
  const transOpacity = interpolate(
    frame,
    [Math.round(2.0 * fps), Math.round(2.4 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Example block — slides up at 3.2s
  const exOpacity = interpolate(
    frame,
    [Math.round(3.2 * fps), Math.round(3.8 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const exY = interpolate(
    frame,
    [Math.round(3.2 * fps), Math.round(3.8 * fps)],
    [10, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill
      style={{
        background: '#F2F2F7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '24px 24px',
        fontFamily: FONT,
        gap: 0,
      }}
    >
      {/* Language badge */}
      {language ? (
        <div
          style={{
            opacity: badgeOpacity,
            transform: `translateY(${badgeY}px)`,
            fontSize: 11,
            fontWeight: 700,
            color: color,
            textTransform: 'uppercase',
            letterSpacing: 2,
            background: `${color}18`,
            padding: '4px 12px',
            borderRadius: 20,
            marginBottom: 16,
          }}
        >
          {language}
        </div>
      ) : null}

      {/* Phrase in target language */}
      <div
        style={{
          opacity: phraseOpacity,
          transform: `scale(${phraseScale})`,
          fontSize: 54,
          fontWeight: 800,
          color: '#1C1C1E',
          letterSpacing: -1.5,
          textAlign: 'center',
          lineHeight: 1.1,
          marginBottom: phonetic ? 6 : 14,
        }}
      >
        {phrase}
      </div>

      {/* Phonetic */}
      {phonetic ? (
        <div
          style={{
            opacity: phoneticOpacity,
            fontSize: 16,
            color: color,
            fontStyle: 'italic',
            fontWeight: 400,
            marginBottom: 14,
            letterSpacing: 0.2,
          }}
        >
          {phonetic}
        </div>
      ) : null}

      {/* Divider */}
      <div
        style={{
          width: `${lineProgress * 75}%`,
          height: 1.5,
          background: '#E5E5EA',
          borderRadius: 1,
          marginBottom: 14,
        }}
      />

      {/* Translation — the big reveal */}
      {translation ? (
        <div
          style={{
            opacity: transOpacity,
            transform: `scale(${transScale})`,
            fontSize: 26,
            fontWeight: 600,
            color: color,
            textAlign: 'center',
            letterSpacing: -0.3,
            marginBottom: example ? 18 : 0,
          }}
        >
          {translation}
        </div>
      ) : null}

      {/* Example sentence */}
      {example ? (
        <div
          style={{
            opacity: exOpacity,
            transform: `translateY(${exY}px)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            background: `${color}10`,
            padding: '10px 18px',
            borderRadius: 12,
            maxWidth: 340,
            borderLeft: `3px solid ${color}40`,
          }}
        >
          <div style={{ fontSize: 14, color: '#1C1C1E', fontStyle: 'italic', textAlign: 'center', lineHeight: 1.5 }}>
            "{example}"
          </div>
          {exampleTranslation ? (
            <div style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center' }}>
              {exampleTranslation}
            </div>
          ) : null}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

PhraseReveal.durationInFrames = 180; // 6s @ 30fps
