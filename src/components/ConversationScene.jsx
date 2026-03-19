import React, { useRef, useEffect, useState, Suspense } from 'react';

/**
 * ConversationScene — Displays animated teaching content.
 *
 * Supports three content types:
 *   1. Lottie JSON (requires lottie-web installed — dynamic import)
 *   2. MP4/WebM video (native <video> element)
 *   3. Static image fallback
 *
 * Usage in StudyBoard visual data:
 *   { visualType: "conversation-scene", visual: {
 *       type: "video",                    // "lottie" | "video" | "image"
 *       src: "/scenes/greeting.mp4",      // URL to asset
 *       alt: "Two people greeting",       // Accessibility description
 *       autoplay: true,                   // Auto-start (default true)
 *       loop: false,                      // Loop playback (default false)
 *       caption: "Watch how they greet"   // Optional caption text
 *   }}
 *
 * Lottie support: If lottie-web is not installed, falls back to a
 * placeholder message. Install with: npm install lottie-web
 */
export default function ConversationScene({ data }) {
  const { type = 'image', src, alt = '', autoplay = true, loop = false, caption } = data || {};
  const containerRef = useRef(null);
  const [lottieError, setLottieError] = useState(false);

  // Lottie rendering via dynamic import
  useEffect(() => {
    if (type !== 'lottie' || !src || !containerRef.current) return;

    let anim = null;
    (async () => {
      try {
        // Dynamic import with variable to prevent Vite from resolving at build time.
        // lottie-web is optional — if not installed, falls back gracefully.
        const moduleName = 'lottie-web';
        const lottie = await import(/* @vite-ignore */ moduleName);
        if (!containerRef.current) return;
        anim = lottie.default.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: loop,
          autoplay: autoplay,
          path: src,
        });
      } catch {
        setLottieError(true);
      }
    })();

    return () => {
      if (anim) anim.destroy();
    };
  }, [type, src, autoplay, loop]);

  if (!src) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#8E8E93', fontSize: 14 }}>
        No scene content available
      </div>
    );
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {/* Lottie animation */}
      {type === 'lottie' && !lottieError && (
        <div
          ref={containerRef}
          style={{
            width: '100%',
            maxWidth: 320,
            aspectRatio: '4 / 3',
            borderRadius: 16,
            overflow: 'hidden',
            background: '#F5F5F7',
          }}
          role="img"
          aria-label={alt}
        />
      )}

      {/* Lottie fallback if lottie-web not installed */}
      {type === 'lottie' && lottieError && (
        <div style={{
          width: '100%', maxWidth: 320, aspectRatio: '4 / 3',
          borderRadius: 16, background: '#F5F5F7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#8E8E93', fontSize: 13, padding: 16, textAlign: 'center',
        }}>
          Animation requires lottie-web package.<br />
          <code style={{ fontSize: 11, marginTop: 4, display: 'block' }}>npm install lottie-web</code>
        </div>
      )}

      {/* Video playback */}
      {type === 'video' && (
        <video
          src={src}
          autoPlay={autoplay}
          loop={loop}
          muted
          playsInline
          controls={false}
          style={{
            width: '100%',
            maxWidth: 320,
            borderRadius: 16,
            background: '#000',
          }}
          aria-label={alt}
        >
          <track kind="descriptions" label={alt} />
        </video>
      )}

      {/* Static image */}
      {type === 'image' && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          style={{
            width: '100%',
            maxWidth: 320,
            borderRadius: 16,
            objectFit: 'cover',
          }}
        />
      )}

      {/* Caption */}
      {caption && (
        <p style={{
          fontSize: 13, color: '#6B7280', fontWeight: 500,
          textAlign: 'center', maxWidth: 300, lineHeight: 1.45,
          fontFamily: '-apple-system, system-ui, sans-serif',
        }}>
          {caption}
        </p>
      )}
    </div>
  );
}
