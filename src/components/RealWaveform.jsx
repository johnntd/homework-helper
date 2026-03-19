import React, { useRef, useEffect, useState, useCallback } from 'react';
import WaveformBars from './WaveformBars';

/**
 * RealWaveform — Canvas-based real-time audio visualization.
 *
 * When active, captures mic audio via getUserMedia and renders
 * frequency data to a <canvas>. Falls back to CSS WaveformBars
 * if mic access is unavailable (iOS SpeechRecognition conflict,
 * permission denied, or missing API).
 *
 * Architecture for future lip-sync integration:
 *   1. This component owns the AudioContext + AnalyserNode
 *   2. A future LipSyncEngine could read from the same AnalyserNode
 *   3. Or: TTS onboundary events drive MouthShape transitions
 *      while this component visualizes the output audio
 *
 * Performance:
 *   - fftSize: 64 (32 bins) — minimal CPU for frequency analysis
 *   - smoothingTimeConstant: 0.72 — reduces jitter without lag
 *   - Single rAF loop, canvas is its own GPU layer
 *   - Cleanup: stream tracks stopped, AudioContext closed on unmount
 *
 * iOS note: getUserMedia may conflict with active SpeechRecognition.
 * The component gracefully falls back to CSS animation in this case.
 */
export default function RealWaveform({
  active,
  color = '#6B7FD8',
  width = 120,
  height = 24,
  fallbackBarCount = 12,
}) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null); // { audioContext, analyser, stream }
  const rafRef = useRef(null);
  const [useFallback, setUseFallback] = useState(false);

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioRef.current) {
      const { stream, audioContext } = audioRef.current;
      stream?.getTracks().forEach(t => t.stop());
      audioContext?.close().catch(() => {});
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) {
      cleanup();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setUseFallback(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // On browsers that support it, check if mic permission is pre-granted
        // to avoid showing a prompt just for visualization
        if (navigator.permissions?.query) {
          try {
            const perm = await navigator.permissions.query({ name: 'microphone' });
            if (perm.state === 'denied') {
              if (!cancelled) setUseFallback(true);
              return;
            }
          } catch {
            // permissions API doesn't support 'microphone' (Safari) — proceed
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.72;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        // Do NOT connect to destination — no playback, analysis only

        audioRef.current = { audioContext, analyser, stream, source };
        setUseFallback(false);
        startDrawing();
      } catch {
        if (!cancelled) setUseFallback(true);
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [active, cleanup]);

  function startDrawing() {
    const canvas = canvasRef.current;
    if (!canvas || !audioRef.current) return;

    const ctx = canvas.getContext('2d');
    const { analyser } = audioRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function frame() {
      if (!audioRef.current || !canvasRef.current) return;

      analyser.getByteFrequencyData(dataArray);

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const barCount = Math.min(bufferLength, 20);
      const gap = 2;
      const barW = (width - (barCount - 1) * gap) / barCount;
      const maxH = height - 2;

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i] / 255;
        const barH = Math.max(2, value * maxH);
        const x = i * (barW + gap);
        const y = (height - barH) / 2;

        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, barW / 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.25 + value * 0.65;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    frame();
  }

  if (!active) return null;

  if (useFallback) {
    return <WaveformBars color={color} barCount={fallbackBarCount} height={height} compact />;
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, display: 'block' }}
      role="img"
      aria-label="Real-time audio level"
    />
  );
}
