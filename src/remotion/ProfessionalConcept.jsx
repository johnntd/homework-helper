import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';

/**
 * ProfessionalConcept — multi-section concept card for adult professional/health tracks.
 *
 * Use for medical concepts, legal principles, accounting standards, clinical conditions,
 * drug class overviews, professional frameworks, etc.
 *
 * Duration = ProfessionalConcept.duration(sections)
 *   = INTRO(50) + sections.length * PER_SECTION(65) + OUTRO(30)
 *
 * Props:
 *   title     string    — concept name, e.g. "CYP450 Inhibition"
 *   sections  Array<{ heading: string, content: string }>  — 1–3 sections
 *   accent    string    — accent color (matches subject card gradient)
 *   icon      string    — emoji icon shown beside title (optional)
 */

const INTRO_FRAMES = 50;
const PER_SECTION = 65;
const OUTRO_FRAMES = 30;

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif';

export const ProfessionalConcept = ({
  title = '',
  sections = [],
  accent = '#0A84FF',
  icon = '',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title + icon fade in with spring
  const titleScale = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 180 },
    durationInFrames: Math.round(0.8 * fps),
  });
  const titleOpacity = interpolate(frame, [0, Math.round(0.35 * fps)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Accent underline grows at 1s
  const lineProgress = interpolate(
    frame,
    [Math.round(1.0 * fps), Math.round(1.5 * fps)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Each section card slides up with stagger
  const sectionAnimations = sections.map((_, i) => {
    const start = INTRO_FRAMES + i * PER_SECTION;
    const opacity = interpolate(
      frame,
      [start, start + Math.round(0.4 * fps)],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    const translateY = interpolate(
      frame,
      [start, start + Math.round(0.5 * fps)],
      [18, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    return { opacity, translateY };
  });

  return (
    <AbsoluteFill
      style={{
        background: '#F2F2F7',
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 18px',
        fontFamily: FONT,
        overflowY: 'hidden',
      }}
    >
      {/* Title row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          transformOrigin: 'left center',
          marginBottom: 4,
        }}
      >
        {icon && (
          <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
        )}
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#1C1C1E',
            letterSpacing: '-0.3px',
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
      </div>

      {/* Accent underline */}
      <div
        style={{
          height: 2.5,
          width: `${lineProgress * 100}%`,
          background: accent,
          borderRadius: 2,
          marginBottom: 14,
        }}
      />

      {/* Section cards */}
      {sections.map((section, i) => {
        const anim = sectionAnimations[i];
        return (
          <div
            key={i}
            style={{
              opacity: anim.opacity,
              transform: `translateY(${anim.translateY}px)`,
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #E5E5EA',
              padding: '10px 14px',
              marginBottom: 10,
              borderLeft: `3px solid ${accent}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: accent,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 4,
              }}
            >
              {section.heading}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 400,
                color: '#3C3C43',
                lineHeight: 1.45,
              }}
            >
              {section.content}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

ProfessionalConcept.duration = (sections) =>
  INTRO_FRAMES + (sections?.length ?? 0) * PER_SECTION + OUTRO_FRAMES;
