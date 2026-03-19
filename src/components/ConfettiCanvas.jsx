import React, { useRef, useEffect } from 'react';

/**
 * ConfettiCanvas — Canvas-based particle celebration system.
 *
 * Replaces DOM emoji animations with a single <canvas> element
 * and requestAnimationFrame loop. Typical burst: 50 particles, ~1.5s.
 *
 * Performance: Zero DOM nodes per particle. Single composite layer.
 * GPU-friendly: canvas is its own compositor layer (position:fixed).
 * Cleanup: rAF cancelled on unmount, canvas removed from DOM.
 *
 * Usage:
 *   <ConfettiCanvas trigger={celebrationKey} />
 *   Increment celebrationKey to fire a new burst.
 */
export default function ConfettiCanvas({
  trigger,
  duration = 1400,
  particleCount = 50,
  colors,
}) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  const palette = colors || [
    '#6B7FD8', '#9BA8E8', '#C8A55A',
    '#22C55E', '#F59E0B', '#EC4899',
    '#3B82F6', '#EF4444',
  ];

  useEffect(() => {
    if (!trigger || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    // Spawn particles with radial burst from center
    const particles = Array.from({ length: particleCount }, (_, i) => {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.6;
      const speed = 3 + Math.random() * 9;
      return {
        x: W / 2 + (Math.random() - 0.5) * 80,
        y: H * 0.45 + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        size: 3 + Math.random() * 5,
        color: palette[Math.floor(Math.random() * palette.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 14,
        shape: Math.random() > 0.4 ? 'rect' : 'circle',
      };
    });

    const t0 = performance.now();

    function frame(now) {
      const elapsed = now - t0;
      const progress = Math.min(elapsed / duration, 1);

      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        p.x += p.vx;
        p.vy += 0.18; // gravity
        p.y += p.vy;
        p.vx *= 0.99; // drag
        p.rotation += p.rotSpeed;
        const alpha = Math.max(0, 1 - progress * 1.3);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(frame);
      }
    }

    animRef.current = requestAnimationFrame(frame);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [trigger]);

  if (!trigger) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9998,
      }}
      aria-hidden="true"
    />
  );
}
