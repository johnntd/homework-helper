import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';

/**
 * VocabReveal — animated vocabulary introduction
 *
 * Plays for 5 seconds (150 frames @ 30fps).
 * Reveals: word → phonetic → divider → part of speech → definition → example
 *
 * Props:
 *   word          string   — the vocabulary word
 *   phonetic      string   — optional phonetic spelling e.g. "/ˌfoʊtəˈsɪnθəsɪs/"
 *   partOfSpeech  string   — optional e.g. "noun", "verb"
 *   definition    string   — one sentence definition from curriculum source
 *   example       string   — optional usage in a sentence
 *   color         string   — accent color (matches Sunny's subject color)
 */
export const VocabReveal = ({
  word = '',
  phonetic = '',
  partOfSpeech = '',
  definition = '',
  example = '',
  color = '#0A84FF',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const FONT =
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif';

  // Word — snappy spring entrance
  const wordScale = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 180 },
    durationInFrames: Math.round(0.7 * fps),
  });
  const wordOpacity = interpolate(frame, [0, Math.round(0.25 * fps)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phonetic — fades in at 0.6s
  const phoneticOpacity = interpolate(
    frame,
    [Math.round(0.6 * fps), Math.round(0.9 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Divider — grows left-to-right at 0.9s
  const lineProgress = interpolate(
    frame,
    [Math.round(0.9 * fps), Math.round(1.4 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Part of speech — slides up at 1.3s
  const posOpacity = interpolate(
    frame,
    [Math.round(1.3 * fps), Math.round(1.6 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const posY = interpolate(
    frame,
    [Math.round(1.3 * fps), Math.round(1.6 * fps)],
    [8, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Definition — slides up at 1.7s
  const defOpacity = interpolate(
    frame,
    [Math.round(1.7 * fps), Math.round(2.2 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const defY = interpolate(
    frame,
    [Math.round(1.7 * fps), Math.round(2.2 * fps)],
    [12, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Example — slides up at 2.8s
  const exOpacity = interpolate(
    frame,
    [Math.round(2.8 * fps), Math.round(3.3 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const exY = interpolate(
    frame,
    [Math.round(2.8 * fps), Math.round(3.3 * fps)],
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
        padding: '28px 24px',
        fontFamily: FONT,
      }}
    >
      {/* Word */}
      <div
        style={{
          opacity: wordOpacity,
          transform: `scale(${wordScale})`,
          fontSize: 52,
          fontWeight: 700,
          color: '#1C1C1E',
          letterSpacing: -1,
          textAlign: 'center',
          marginBottom: phonetic ? 4 : 16,
          lineHeight: 1.1,
        }}
      >
        {word}
      </div>

      {/* Phonetic */}
      {phonetic ? (
        <div
          style={{
            opacity: phoneticOpacity,
            fontSize: 17,
            color: color,
            fontStyle: 'italic',
            fontWeight: 400,
            marginBottom: 16,
            letterSpacing: 0.3,
          }}
        >
          {phonetic}
        </div>
      ) : null}

      {/* Divider */}
      <div
        style={{
          width: `${lineProgress * 80}%`,
          height: 1.5,
          background: '#E5E5EA',
          borderRadius: 1,
          marginBottom: 16,
        }}
      />

      {/* Part of speech */}
      {partOfSpeech ? (
        <div
          style={{
            opacity: posOpacity,
            transform: `translateY(${posY}px)`,
            fontSize: 11,
            fontWeight: 600,
            color: '#8E8E93',
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            marginBottom: 12,
          }}
        >
          {partOfSpeech}
        </div>
      ) : null}

      {/* Definition */}
      <div
        style={{
          opacity: defOpacity,
          transform: `translateY(${defY}px)`,
          fontSize: 19,
          color: '#1C1C1E',
          textAlign: 'center',
          lineHeight: 1.5,
          fontWeight: 400,
          maxWidth: 340,
          marginBottom: example ? 20 : 0,
        }}
      >
        {definition}
      </div>

      {/* Example sentence */}
      {example ? (
        <div
          style={{
            opacity: exOpacity,
            transform: `translateY(${exY}px)`,
            fontSize: 14,
            color: '#48484A',
            textAlign: 'center',
            fontStyle: 'italic',
            lineHeight: 1.5,
            background: `${color}12`,
            padding: '10px 18px',
            borderRadius: 12,
            maxWidth: 340,
            borderLeft: `3px solid ${color}40`,
          }}
        >
          "{example}"
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
