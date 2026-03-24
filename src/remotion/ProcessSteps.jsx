import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';

/**
 * ProcessSteps — animated step-by-step process for professional/health tracks.
 *
 * Use for clinical workflows, accounting procedures, legal reasoning chains,
 * drug metabolism pathways, rehab protocols, etc.
 *
 * Duration = ProcessSteps.duration(steps)
 *   = INTRO(50) + steps.length * PER_STEP(55) + OUTRO(40)
 *
 * Props:
 *   title   string    — process name, e.g. "ADME Pathway"
 *   steps   string[]  — 2–5 steps, each one short phrase
 *   color   string    — accent color
 */

const INTRO_FRAMES = 50;
const PER_STEP = 55;
const OUTRO_FRAMES = 40;

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif';

export const ProcessSteps = ({
  title = '',
  steps = [],
  color = '#0A84FF',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title fades + slides in
  const titleOpacity = interpolate(frame, [0, Math.round(0.5 * fps)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const titleY = interpolate(frame, [0, Math.round(0.5 * fps)], [12, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Each step springs in sequentially
  const stepAnimations = steps.map((_, i) => {
    const start = INTRO_FRAMES + i * PER_STEP;
    const scaleFrame = Math.max(0, frame - start);
    const scale = spring({
      frame: scaleFrame,
      fps,
      config: { damping: 18, stiffness: 220 },
      durationInFrames: Math.round(0.9 * fps),
    });
    const opacity = interpolate(
      frame,
      [start, start + Math.round(0.3 * fps)],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    const translateY = interpolate(
      frame,
      [start, start + Math.round(0.4 * fps)],
      [14, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    // Connector line grows after the step appears
    const connStart = start + Math.round(0.5 * fps);
    const connProgress = interpolate(
      frame,
      [connStart, connStart + Math.round(0.4 * fps)],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    return { scale, opacity, translateY, connProgress };
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
      {/* Title */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontSize: 17,
          fontWeight: 700,
          color: '#1C1C1E',
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: `2.5px solid ${color}`,
          letterSpacing: '-0.2px',
        }}
      >
        {title}
      </div>

      {/* Steps */}
      {steps.map((step, i) => {
        const anim = stepAnimations[i];
        const isLast = i === steps.length - 1;
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            {/* Step row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                opacity: anim.opacity,
                transform: `translateY(${anim.translateY}px) scale(${anim.scale})`,
              }}
            >
              {/* Numbered badge */}
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: color,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                  flexShrink: 0,
                  boxShadow: `0 2px 8px ${color}44`,
                }}
              >
                {i + 1}
              </div>
              {/* Step text */}
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#1C1C1E',
                  lineHeight: 1.4,
                  background: '#fff',
                  borderRadius: 10,
                  padding: '8px 12px',
                  border: '1px solid #E5E5EA',
                  flex: 1,
                }}
              >
                {step}
              </div>
            </div>

            {/* Connecting line (not after last step) */}
            {!isLast && (
              <div
                style={{
                  width: 2,
                  marginLeft: 14,
                  height: Math.round(anim.connProgress * 14),
                  background: `linear-gradient(to bottom, ${color}88, ${color}22)`,
                  borderRadius: 2,
                  marginTop: 3,
                  marginBottom: 3,
                }}
              />
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

ProcessSteps.duration = (steps) =>
  INTRO_FRAMES + (steps?.length ?? 0) * PER_STEP + OUTRO_FRAMES;
