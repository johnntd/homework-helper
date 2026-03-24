import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';

/**
 * RTLFlowDiagram — animated RTL-to-GDS pipeline flow for physical design topics.
 *
 * Use for: RTL-to-GDS flow overview, synthesis handoff, P&R stage walkthroughs,
 * signoff flow, ECO flow, any multi-stage EDA pipeline.
 *
 * Duration = RTLFlowDiagram.duration(stages)
 *   = INTRO(50) + stages.length * PER_STAGE(40) + OUTRO(40)
 *
 * Props:
 *   title     string    — e.g. "RTL-to-GDS Flow"
 *   stages    string[]  — stage names, e.g. ["RTL","Synthesis","Floorplan","Place & Route","Signoff","GDS"]
 *   highlight string    — stage name to highlight (the one being taught), or ''
 *   color     string    — accent color
 */

const INTRO_FRAMES = 50;
const PER_STAGE    = 40;
const OUTRO_FRAMES = 40;
const FPS          = 30;

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif';

function StageBox({ label, isHighlight, index, frame, color, totalStages }) {
  const startFrame = INTRO_FRAMES + index * PER_STAGE;

  const sc = spring({
    frame: Math.max(0, frame - startFrame),
    fps: FPS,
    from: 0.6,
    to: 1,
    config: { damping: 15, stiffness: 200 },
  });
  const op = interpolate(frame, [startFrame, startFrame + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const bg = isHighlight ? color : '#F2F2F7';
  const textColor = isHighlight ? '#FFFFFF' : '#1C1C1E';
  const borderColor = isHighlight ? color : '#D1D1D6';
  const shadowColor = isHighlight ? `${color}44` : 'transparent';

  return (
    <div style={{
      transform: `scale(${sc})`,
      opacity: op,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <div style={{
        padding: '8px 10px',
        background: bg,
        border: `2px solid ${borderColor}`,
        borderRadius: 10,
        fontSize: totalStages > 5 ? 10 : 12,
        fontWeight: 700,
        fontFamily: FONT,
        color: textColor,
        textAlign: 'center',
        minWidth: 52,
        boxShadow: `0 3px 10px ${shadowColor}`,
        letterSpacing: '-0.2px',
        lineHeight: 1.25,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
    </div>
  );
}

function Arrow({ index, frame, color, totalStages }) {
  const startFrame = INTRO_FRAMES + index * PER_STAGE + PER_STAGE * 0.6;
  const reveal = interpolate(frame, [startFrame, startFrame + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      opacity: reveal,
      flexShrink: 0,
      margin: '0 2px',
    }}>
      <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
        <line x1="0" y1="8" x2="14" y2="8" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <polygon points="12,4 20,8 12,12" fill={color} />
      </svg>
    </div>
  );
}

export const RTLFlowDiagram = ({
  title = 'RTL-to-GDS Flow',
  stages = ['RTL', 'Synthesis', 'Floorplan', 'Place & Route', 'Signoff', 'GDS'],
  highlight = '',
  color = '#047857',
}) => {
  const frame = useCurrentFrame();

  // Title
  const titleY = spring({ frame, fps: FPS, from: 16, to: 0, config: { damping: 14, stiffness: 180 } });
  const titleOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // Legend: show after all stages are in
  const legendStart = INTRO_FRAMES + stages.length * PER_STAGE;
  const legendOp = interpolate(frame, [legendStart, legendStart + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const needsWrap = stages.length > 4;

  return (
    <AbsoluteFill style={{ background: '#FFFFFF', fontFamily: FONT, padding: '18px 16px 14px' }}>
      {/* Title */}
      <div style={{
        fontSize: 17,
        fontWeight: 700,
        color: '#1C1C1E',
        transform: `translateY(${titleY}px)`,
        opacity: titleOp,
        marginBottom: 4,
        letterSpacing: '-0.4px',
      }}>
        {title}
      </div>

      {/* Accent underline */}
      <div style={{
        width: interpolate(frame, [10, 35], [0, 100], { extrapolateRight: 'clamp' }),
        height: 3,
        background: color,
        borderRadius: 2,
        marginBottom: 18,
      }} />

      {/* Flow stages */}
      {needsWrap ? (
        // Two-row layout for 5+ stages
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          {/* Row 1: first half */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'nowrap' }}>
            {stages.slice(0, Math.ceil(stages.length / 2)).map((stage, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <StageBox
                  label={stage}
                  isHighlight={highlight && stage.toLowerCase() === highlight.toLowerCase()}
                  index={i}
                  frame={frame}
                  color={color}
                  totalStages={stages.length}
                />
                {i < Math.ceil(stages.length / 2) - 1 && (
                  <Arrow index={i} frame={frame} color={color} totalStages={stages.length} />
                )}
              </div>
            ))}
          </div>
          {/* Down arrow between rows */}
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none"
            style={{ opacity: interpolate(frame, [INTRO_FRAMES + Math.ceil(stages.length / 2) * PER_STAGE, INTRO_FRAMES + Math.ceil(stages.length / 2) * PER_STAGE + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
            <line x1="8" y1="0" x2="8" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <polygon points="4,12 8,20 12,12" fill={color} />
          </svg>
          {/* Row 2: second half */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'nowrap', flexDirection: 'row-reverse' }}>
            {stages.slice(Math.ceil(stages.length / 2)).reverse().map((stage, i, arr) => {
              const globalIdx = stages.length - 1 - i;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                  <StageBox
                    label={stage}
                    isHighlight={highlight && stage.toLowerCase() === highlight.toLowerCase()}
                    index={globalIdx}
                    frame={frame}
                    color={color}
                    totalStages={stages.length}
                  />
                  {i < arr.length - 1 && (
                    <div style={{ transform: 'scaleX(-1)' }}>
                      <Arrow index={globalIdx} frame={frame} color={color} totalStages={stages.length} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // Single row for <= 4 stages
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
          {stages.map((stage, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <StageBox
                label={stage}
                isHighlight={highlight && stage.toLowerCase() === highlight.toLowerCase()}
                index={i}
                frame={frame}
                color={color}
                totalStages={stages.length}
              />
              {i < stages.length - 1 && (
                <Arrow index={i} frame={frame} color={color} totalStages={stages.length} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Legend for highlighted stage */}
      {highlight ? (
        <div style={{
          marginTop: 14,
          fontSize: 12,
          color: '#636366',
          fontWeight: 500,
          opacity: legendOp,
          paddingLeft: 8,
          borderLeft: `3px solid ${color}`,
          paddingTop: 2,
          paddingBottom: 2,
        }}>
          Currently studying: <strong style={{ color: '#1C1C1E' }}>{highlight}</strong>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

RTLFlowDiagram.duration = (stages = []) =>
  INTRO_FRAMES + stages.length * PER_STAGE + OUTRO_FRAMES;
