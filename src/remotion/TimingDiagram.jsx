import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';

/**
 * TimingDiagram — animated digital timing waveform for RTL/hardware topics.
 *
 * Use for: setup/hold timing, CDC synchronizer behavior, FSM state transitions,
 * AXI valid/ready handshaking, pipeline stage relationships.
 *
 * Duration = TimingDiagram.duration(signals)
 *   = INTRO(50) + signals.length * PER_SIGNAL(45) + ANNOTATION(35) + OUTRO(30)
 *
 * Props:
 *   title      string              — e.g. "Setup & Hold Timing"
 *   signals    {name, pattern}[]   — name is the signal label; pattern is a
 *                                    string of '0','1','X' chars (e.g. "00110011")
 *   annotation string              — short note shown below the diagram
 *   color      string              — accent color for active transitions
 */

const INTRO_FRAMES    = 50;
const PER_SIGNAL      = 45;
const ANNOTATION_IN   = 35;
const OUTRO_FRAMES    = 30;
const FPS             = 30;

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif';

// Hex to rgba helper
function rgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Draw a digital waveform as an SVG path from a pattern string.
// Each character occupies `cellW` pixels; total height = `h`.
function buildWaveformPath(pattern, cellW, h) {
  const mid = h / 2;
  const high = h * 0.12;
  const low = h * 0.88;
  let d = '';
  let prevY = pattern[0] === '1' ? high : low;
  d += `M 0 ${prevY}`;
  for (let i = 0; i < pattern.length; i++) {
    const x = i * cellW;
    const nextX = (i + 1) * cellW;
    const y = pattern[i] === '1' ? high : (pattern[i] === 'X' ? mid : low);
    if (i > 0) {
      const prevChar = pattern[i - 1];
      const curChar = pattern[i];
      if (prevChar !== curChar) {
        // Vertical transition
        d += ` L ${x} ${prevY} L ${x} ${y}`;
      }
    }
    prevY = y;
    d += ` L ${nextX} ${y}`;
  }
  return d;
}

function SignalRow({ name, pattern, rowIndex, frame, color, waveW, rowH }) {
  const startFrame = INTRO_FRAMES + rowIndex * PER_SIGNAL;
  const labelIn = interpolate(frame, [startFrame, startFrame + 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const waveReveal = interpolate(frame, [startFrame + 8, startFrame + PER_SIGNAL - 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const cellW = waveW / Math.max(pattern.length, 1);
  const waveformPath = buildWaveformPath(pattern, cellW, rowH - 8);
  const pathLen = waveW * 3; // overestimate for strokeDasharray

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: rowH, opacity: labelIn }}>
      {/* Signal name label */}
      <div style={{
        width: 72,
        textAlign: 'right',
        paddingRight: 10,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'monospace',
        color: '#1C1C1E',
        letterSpacing: '-0.2px',
        flexShrink: 0,
      }}>
        {name}
      </div>

      {/* Waveform */}
      <div style={{ flex: 1, position: 'relative', height: rowH }}>
        <svg
          width="100%"
          height={rowH}
          viewBox={`0 0 ${waveW} ${rowH}`}
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          {/* Background grid lines */}
          {Array.from({ length: pattern.length + 1 }).map((_, i) => (
            <line
              key={i}
              x1={i * cellW} y1={0}
              x2={i * cellW} y2={rowH}
              stroke="#E5E5EA"
              strokeWidth={0.5}
            />
          ))}
          {/* Waveform path — revealed left to right via dashoffset */}
          <path
            d={waveformPath}
            fill="none"
            stroke={pattern.includes('X') ? '#FF9500' : color}
            strokeWidth={2.5}
            strokeLinecap="square"
            strokeDasharray={pathLen}
            strokeDashoffset={(1 - waveReveal) * pathLen}
          />
          {/* Fill under waveform for '1' regions */}
          {Array.from({ length: pattern.length }).map((_, i) => {
            if (pattern[i] !== '1') return null;
            const x = i * cellW;
            return (
              <rect
                key={i}
                x={x}
                y={rowH * 0.12}
                width={cellW}
                height={rowH * 0.76}
                fill={rgba(color, 0.08)}
                style={{ clipPath: `inset(0 ${(1 - waveReveal) * waveW - x}px 0 0)` }}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export const TimingDiagram = ({
  title = 'Timing Diagram',
  signals = [],
  annotation = '',
  color = '#2563EB',
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const LABEL_W = 82;
  const waveW = width - LABEL_W - 32; // 16px padding each side
  const ROW_H = 44;
  const SEPARATOR_H = 1;

  // Title spring
  const titleY = spring({ frame, fps: FPS, from: 18, to: 0, config: { damping: 14, stiffness: 180 } });
  const titleOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // Annotation
  const annotStart = INTRO_FRAMES + signals.length * PER_SIGNAL;
  const annotOp = interpolate(frame, [annotStart, annotStart + ANNOTATION_IN], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const diagramH = signals.length * (ROW_H + SEPARATOR_H) + 4;

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
        width: interpolate(frame, [10, 35], [0, 120], { extrapolateRight: 'clamp' }),
        height: 3,
        background: color,
        borderRadius: 2,
        marginBottom: 14,
      }} />

      {/* Waveforms */}
      <div style={{
        background: '#F9F9FB',
        borderRadius: 10,
        border: '1px solid #E5E5EA',
        padding: '6px 8px',
        overflow: 'hidden',
        height: diagramH,
      }}>
        {signals.map((sig, i) => (
          <div key={i}>
            <SignalRow
              name={sig.name}
              pattern={sig.pattern || '00000000'}
              rowIndex={i}
              frame={frame}
              color={color}
              waveW={waveW}
              rowH={ROW_H}
            />
            {i < signals.length - 1 && (
              <div style={{ height: SEPARATOR_H, background: '#E5E5EA', margin: '0 0 0 82px' }} />
            )}
          </div>
        ))}
      </div>

      {/* Annotation */}
      {annotation ? (
        <div style={{
          marginTop: 10,
          fontSize: 12,
          color: '#636366',
          fontWeight: 500,
          opacity: annotOp,
          paddingLeft: 4,
          borderLeft: `3px solid ${color}`,
          paddingTop: 2,
          paddingBottom: 2,
        }}>
          {annotation}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

TimingDiagram.duration = (signals = []) =>
  INTRO_FRAMES + signals.length * PER_SIGNAL + ANNOTATION_IN + OUTRO_FRAMES;
