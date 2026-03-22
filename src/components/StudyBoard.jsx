import React, { useRef, useState, useEffect } from 'react';
import TradingChart from './TradingChart';
import AgentPipeline from './AgentPipeline';
import MouthShape from './MouthShape';
import ConversationScene from './ConversationScene';

// Add this TraceDisplay component after the other display components
// Flashcard Display (for language learning)
// Audio Prompt Display (for spelling - audio only, no visual of answer)
const AudioPromptDisplay = ({ text, onRepeat }) => {
  const [pressed, setPressed] = useState(false);

  const handleRepeat = () => {
    setPressed(true);
    onRepeat?.();
    setTimeout(() => setPressed(false), 800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '28px 20px' }}>
      {/* Pulsing speaker */}
      <div style={{ fontSize: 72, lineHeight: 1 }} className="animate-pulse">🔊</div>

      <p style={{
        fontSize: 15, fontWeight: 600, color: '#3C3C43', textAlign: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif', margin: 0,
      }}>
        Listen carefully and spell the word you hear
      </p>

      {/* Tap to hear again button */}
      <button
        onClick={handleRepeat}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 24px', borderRadius: 50, border: 'none', cursor: 'pointer',
          background: pressed ? '#5B21B6' : 'linear-gradient(135deg, #7C3AED, #4F46E5)',
          color: '#fff', fontSize: 15, fontWeight: 600,
          fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
          transform: pressed ? 'scale(0.96)' : 'scale(1)',
          transition: 'transform 0.15s ease, background 0.15s',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ fontSize: 18 }}>🔁</span>
        Hear it again
      </button>
    </div>
  );
};


const FlashcardDisplay = ({ word, translation, language, subtext, onSpeak }) => {
  const [flipped, setFlipped] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const handleSpeak = (e) => {
    e.stopPropagation(); // don't flip the card
    setSpeaking(true);
    onSpeak?.();
    setTimeout(() => setSpeaking(false), 1200);
  };

  // Auto-size font and card height based on text length so sentences fit
  const maxLen = Math.max((word || '').length, (translation || '').length);
  const cardFontSize = maxLen > 40 ? 16 : maxLen > 28 ? 20 : maxLen > 18 ? 26 : maxLen > 10 ? 33 : 42;
  const cardHeight   = maxLen > 40 ? 210 : maxLen > 28 ? 190 : maxLen > 18 ? 170 : 150;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '16px 12px', width: '100%' }}>
      {/* Card container — sets up the 3D perspective */}
      <div
        onClick={() => setFlipped(f => !f)}
        style={{ width: '100%', maxWidth: 'min(380px, calc(100vw - 80px))', height: cardHeight, perspective: 1000, cursor: 'pointer' }}
      >
        {/* Inner card — rotates on click */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.5s ease',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}>
          {/* Front face */}
          <div style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: 18,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            background: 'linear-gradient(135deg, #cffafe, #bfdbfe)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 6, padding: '14px 18px',
          }}>
            <div style={{
              fontSize: cardFontSize, fontWeight: 700, color: '#1e3a5f',
              textAlign: 'center', lineHeight: 1.25,
              fontFamily: 'system-ui, sans-serif',
            }}>
              {word}
            </div>
            {subtext && (
              <div style={{
                fontSize: Math.min(15, cardFontSize - 4), color: '#2563eb', fontWeight: 500, opacity: 0.85,
                fontFamily: 'system-ui, sans-serif', textAlign: 'center',
              }}>
                {subtext}
              </div>
            )}
          </div>

          {/* Back face */}
          <div style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: 18,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            background: 'linear-gradient(135deg, #bfdbfe, #ddd6fe)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '14px 18px',
          }}>
            <div style={{
              fontSize: cardFontSize, fontWeight: 700, color: '#3b0764',
              textAlign: 'center', fontFamily: 'system-ui, sans-serif', lineHeight: 1.25,
            }}>
              {translation}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <p style={{ fontSize: 14, color: '#6b7280', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
          {flipped ? 'Tap to flip back' : 'Tap to reveal'} • {language}
        </p>
        {onSpeak && (
          <button
            onClick={handleSpeak}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: speaking ? '#0891B2' : 'linear-gradient(135deg, #06B6D4, #0891B2)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              fontFamily: 'system-ui, sans-serif',
              boxShadow: '0 2px 8px rgba(8,145,178,0.35)',
              transform: speaking ? 'scale(0.95)' : 'scale(1)',
              transition: 'transform 0.15s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 15 }}>{speaking ? '🔊' : '🔈'}</span>
            Hear it
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================
// PRONUNCIATION GUIDE — animated phoneme cards with mouth shapes
// ============================================
const PronunciationGuideDisplay = ({ data, onSpeak }) => {
  const { word, phonemes = [], ipa, translation } = data;
  const [activePhoneme, setActivePhoneme] = useState(-1);

  // Auto-advance through phonemes when playing
  useEffect(() => {
    if (activePhoneme >= 0 && activePhoneme < phonemes.length) {
      const t = setTimeout(() => setActivePhoneme(a => a + 1), 600);
      return () => clearTimeout(t);
    }
  }, [activePhoneme, phonemes.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '22px 16px', width: '100%' }}>
      {/* Word */}
      <div
        style={{
          fontSize: 34, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.02em',
          animation: 'wordReveal 0.5s ease-out',
          fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        }}
        aria-label={`Pronunciation word: ${word}`}
      >
        {word}
      </div>
      {ipa && (
        <div style={{ fontSize: 15, color: '#8E8E93', fontStyle: 'italic', marginTop: -10 }} aria-label={`IPA: ${ipa}`}>
          {ipa}
        </div>
      )}

      {/* Phoneme cards with SVG mouth shapes */}
      {phonemes.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }} role="list" aria-label="Phoneme breakdown">
          {phonemes.map((p, i) => {
            const phoneme = typeof p === 'string' ? { text: p, shape: 'open' } : p;
            const isActive = i === activePhoneme;
            return (
              <div
                key={i}
                role="listitem"
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '12px 16px', borderRadius: 14,
                  background: isActive ? 'rgba(107,127,216,0.10)' : '#F5F5F7',
                  border: isActive ? '2px solid #6B7FD8' : '2px solid transparent',
                  animation: `phonemeIn 0.35s ease-out ${i * 0.1}s both`,
                  transition: 'background 0.25s ease, border-color 0.25s ease',
                  minWidth: 62,
                }}
              >
                <span style={{ fontSize: 17, fontWeight: 600, color: isActive ? '#6B7FD8' : '#1C1C1E' }}>
                  {phoneme.text}
                </span>
                <MouthShape shape={phoneme.shape || 'open'} size={38} active={isActive} />
              </div>
            );
          })}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
        {onSpeak && (
          <button
            onClick={() => { onSpeak(); setActivePhoneme(0); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 50, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #6B7FD8, #9BA8E8)',
              color: '#fff', fontSize: 14, fontWeight: 600,
              fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
              boxShadow: '0 3px 12px rgba(107,127,216,0.30)',
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.15s ease',
            }}
          >
            <span style={{ fontSize: 16 }}>🔊</span> Listen & Watch
          </button>
        )}
      </div>

      {/* Translation */}
      {translation && (
        <div style={{ fontSize: 14, color: '#8E8E93', fontStyle: 'italic', padding: '5px 12px', borderRadius: 8, background: '#F5F5F7' }}>
          {translation}
        </div>
      )}
    </div>
  );
};

// ============================================
// VOCAB SCENE — animated vocabulary card with context
// ============================================
const VocabSceneDisplay = ({ data, onSpeak, isYoung }) => {
  const { word, definition, sentence, translation, category } = data;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Highlight the target word in the sentence
  const highlightSentence = (sent, target) => {
    if (!sent || !target) return sent;
    const regex = new RegExp(`(${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = sent.split(regex);
    return parts.map((part, i) =>
      regex.test(part)
        ? <strong key={i} style={{ color: '#6B7FD8', fontWeight: 700 }}>{part}</strong>
        : part
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '22px 16px', width: '100%' }}>
      {/* Category badge */}
      {category && (
        <span style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          color: '#6B7FD8', background: 'rgba(107,127,216,0.08)',
          padding: '3px 10px', borderRadius: 10,
        }}>
          {category}
        </span>
      )}

      {/* Word with animated entrance */}
      <div style={{
        fontSize: isYoung ? 36 : 30, fontWeight: 700, color: '#1C1C1E',
        letterSpacing: '-0.02em', animation: 'wordReveal 0.5s ease-out',
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}>
        {word}
      </div>

      {/* Definition with staggered reveal */}
      {definition && (
        <div style={{
          fontSize: isYoung ? 16 : 15, color: '#3C3C43', fontWeight: 500,
          textAlign: 'center', maxWidth: 320, lineHeight: 1.55,
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(8px)',
          transition: 'all 0.4s ease',
        }}>
          {definition}
        </div>
      )}

      {/* Example sentence */}
      {sentence && (
        <div style={{
          fontSize: 14, color: '#1C1C1E', lineHeight: 1.6,
          padding: '11px 15px', borderRadius: 12,
          background: '#F5F5F7', maxWidth: 340, textAlign: 'center',
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(8px)',
          transition: 'all 0.5s ease 0.15s',
          borderLeft: '3px solid #6B7FD8',
        }}>
          &ldquo;{highlightSentence(sentence, word)}&rdquo;
        </div>
      )}

      {/* Action buttons */}
      {onSpeak && (
        <button
          onClick={onSpeak}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 2,
            padding: '10px 20px', borderRadius: 50, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #6B7FD8, #9BA8E8)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            boxShadow: '0 3px 12px rgba(107,127,216,0.30)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: 16 }}>🔊</span> Hear it
        </button>
      )}

      {/* Translation */}
      {translation && (
        <div style={{
          fontSize: 14, color: '#8E8E93', fontStyle: 'italic',
          padding: '5px 12px', borderRadius: 8, background: 'rgba(107,127,216,0.04)',
          opacity: revealed ? 1 : 0,
          transition: 'opacity 0.4s ease 0.3s',
        }}>
          {translation}
        </div>
      )}
    </div>
  );
};

// Test Question Display
const TestQuestionDisplay = ({ question }) => {
  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-white rounded-2xl">
      <div className="text-2xl text-gray-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
        {question}
      </div>
    </div>
  );
};



// Multiplication Grid Display (for young kids)
const MultiplicationGridDisplay = ({ rows, cols, emoji }) => {
  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-3">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="text-6xl animate-bounce"
                style={{ animationDelay: `${(r * cols + c) * 0.1}s`, animationDuration: '1s' }}
              >
                {emoji}
              </div>
            ))}
          </div>
        ))}
      </div>
      
      <div className="text-5xl font-bold text-gray-700">
        {rows} × {cols} = ?
      </div>
    </div>
  );
};

// Multiplication Text Display (for older students)
const MultiplicationTextDisplay = ({ expression }) => {
  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <div className="text-9xl font-bold text-purple-600" style={{ fontFamily: 'Fredoka, sans-serif' }}>
        {expression}
      </div>
      <div className="text-6xl font-bold text-gray-400">= ?</div>
    </div>
  );
};

const TraceDisplay = ({ letter, onInteraction, onSubmit }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Canvas resolution stays at 500x500 for drawing quality.
  // CSS constrains it to fit the container (max-width: 100%).
  // Touch/mouse coordinates are scaled from CSS-pixels to canvas-pixels.
  const CANVAS_RES = 500;

  const drawLetterGuide = (ctx) => {
    ctx.save();
    ctx.fillStyle = '#E5E7EB';
    ctx.font = `bold ${CANVAS_RES * 0.64}px -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, CANVAS_RES / 2, CANVAS_RES / 2);
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawLetterGuide(ctx);
  }, [letter]);

  // Scale CSS-pixel coordinates to canvas-pixel coordinates
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    setHasDrawn(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_RES, CANVAS_RES);
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawLetterGuide(ctx);
    setHasDrawn(false);
  };

  const handleDone = () => {
    if (onSubmit) onSubmit(letter);
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Canvas: 500x500 resolution, CSS-scaled to fit container */}
      <canvas
        ref={canvasRef}
        width={CANVAS_RES}
        height={CANVAS_RES}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="border-4 border-dashed border-blue-300 rounded-2xl bg-white cursor-crosshair touch-none"
        style={{
          touchAction: 'none',
          width: '100%',
          maxWidth: CANVAS_RES,
          aspectRatio: '1 / 1',
        }}
      />

      <div className="flex gap-3">
        <button
          onClick={clearCanvas}
          className="px-6 py-3 bg-orange-500 text-white rounded-xl font-bold text-base hover:bg-orange-600 transition-colors"
        >
          Clear
        </button>
        <button
          onClick={handleDone}
          disabled={!hasDrawn}
          className="px-6 py-3 bg-green-500 text-white rounded-xl font-bold text-base hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Done
        </button>
      </div>

      <p className="text-sm text-gray-500 text-center" style={{ fontFamily: '-apple-system, system-ui, sans-serif' }}>
        Trace the letter with your finger, then tap Done
      </p>
    </div>
  );
};

// ============================================
// NEW ENHANCED VISUAL TYPES FOR ADAPTIVE TEACHING
// ============================================

// ANIMATED COUNTING (for math - shows objects being added/removed)
const AnimatedCountDisplay = ({ items, operation, count, label }) => {
  return (
    <div className="text-center p-4">
      <div className="flex gap-3 justify-center flex-wrap mb-4">
        {items.map((item, i) => {
          const isRemoved = operation === 'remove' && i >= items.length - count;
          const isAdded = operation === 'add' && i >= items.length - count;
          
          return (
            <span 
              key={i}
              className={`text-6xl transition-all duration-500 ${
                isRemoved ? 'line-through opacity-30 scale-75' : ''
              } ${
                isAdded ? 'animate-bounce' : ''
              }`}
            >
              {item}
            </span>
          );
        })}
      </div>
      {label && (
        <p className="mt-4 text-2xl font-bold text-gray-700" style={{ fontFamily: 'Fredoka, sans-serif' }}>
          {label}
        </p>
      )}
    </div>
  );
};

// ENHANCED NUMBER LINE (with highlighting and current position)
const EnhancedNumberLine = ({ start, end, highlight, current }) => {
  const numbers = Array.from(
    {length: end - start + 1}, 
    (_, i) => i + start
  );
  
  return (
    <div className="p-4">
      <div className="flex gap-1 justify-center items-center overflow-x-auto">
        {numbers.map(num => {
          const isHighlighted = highlight?.includes(num);
          const isCurrent = current === num;
          
          return (
            <div 
              key={num}
              className={`
                w-12 h-12 flex items-center justify-center 
                border-2 rounded-lg text-xl font-bold transition-all
                ${isHighlighted ? 'bg-yellow-300 border-yellow-600 scale-110' : 'border-gray-300'}
                ${isCurrent ? 'bg-blue-300 border-blue-600 ring-4 ring-blue-200' : ''}
              `}
            >
              {num}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// WORD BREAKDOWN (for spelling/reading - shows syllables in colors)
const WordPartsDisplay = ({ word, parts, colors, pronunciation }) => {
  return (
    <div className="text-center p-4">
      <div className="text-6xl font-bold mb-4 flex justify-center gap-1">
        {parts.map((part, i) => (
          <span 
            key={i} 
            style={{color: colors?.[i] || '#000'}}
            className="hover:scale-110 transition-transform"
          >
            {part}
          </span>
        ))}
      </div>
      <div className="text-3xl text-gray-600 font-semibold">
        {word}
      </div>
      {pronunciation && (
        <div className="text-xl text-gray-500 mt-2">
          /{pronunciation}/
        </div>
      )}
    </div>
  );
};

// FRACTION VISUAL (for math - shows visual representation)
const FractionDisplay = ({ numerator, denominator, visualShape }) => {
  const total = denominator;
  const filled = numerator;
  
  return (
    <div className="text-center p-4">
      <div className="flex gap-2 justify-center flex-wrap mb-4">
        {Array.from({length: total}, (_, i) => (
          <div 
            key={i}
            className={`
              w-16 h-16 rounded-full border-4 transition-all
              ${i < filled 
                ? 'bg-orange-400 border-orange-600' 
                : 'bg-gray-200 border-gray-400'}
            `}
          />
        ))}
      </div>
      <div className="text-4xl font-bold mt-4">
        <span className="text-orange-600">{filled}</span>
        <span className="text-gray-600">/</span>
        <span className="text-gray-600">{total}</span>
      </div>
    </div>
  );
};

// GROUPS DISPLAY (for multiplication/division - shows items in groups)
const GroupsDisplay = ({ groups, itemsPerGroup, emoji }) => {
  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <div className="flex gap-8 flex-wrap justify-center">
        {Array.from({ length: groups }).map((_, g) => (
          <div key={g} className="flex flex-col items-center gap-2">
            <div className="flex flex-wrap gap-2 p-4 border-4 border-dashed border-blue-300 rounded-xl bg-blue-50">
              {Array.from({ length: itemsPerGroup }).map((_, i) => (
                <span key={i} className="text-5xl">
                  {emoji}
                </span>
              ))}
            </div>
            <div className="text-xl font-bold text-gray-600">
              Group {g + 1}
            </div>
          </div>
        ))}
      </div>
      <div className="text-3xl font-bold text-gray-700 mt-4">
        {groups} groups × {itemsPerGroup} = ?
      </div>
    </div>
  );
};

// COMPARISON DISPLAY (for greater than/less than)
const ComparisonDisplay = ({ value1, value2, emoji }) => {
  return (
    <div className="flex items-center justify-center gap-8 p-8">
      {/* First group */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap gap-2 justify-center">
          {Array.from({ length: value1 }).map((_, i) => (
            <span key={i} className="text-6xl">
              {emoji || '🔵'}
            </span>
          ))}
        </div>
        <div className="text-4xl font-bold text-blue-600">
          {value1}
        </div>
      </div>
      
      {/* Comparison symbol */}
      <div className="text-8xl font-bold text-gray-400">
        ?
      </div>
      
      {/* Second group */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap gap-2 justify-center">
          {Array.from({ length: value2 }).map((_, i) => (
            <span key={i} className="text-6xl">
              {emoji || '🔵'}
            </span>
          ))}
        </div>
        <div className="text-4xl font-bold text-purple-600">
          {value2}
        </div>
      </div>
    </div>
  );
};

// TABLE DISPLAY (for reference tables — trig, grammar, periodic table, etc.)
const TableDisplay = ({ title, rows }) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const headers = rows[0];
  const bodyRows = rows.slice(1);
  return (
    <div className="w-full overflow-x-auto">
      {title && (
        <div className="text-center font-bold text-lg mb-3 text-gray-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
          {title}
        </div>
      )}
      <table className="w-full border-collapse text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-white text-center font-semibold"
                style={{ background: '#7C3AED', borderRight: i < headers.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? '#F5F0FF' : '#fff' }}>
              {Array.isArray(row) ? row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-center text-gray-800 border-b border-gray-100">
                  {cell}
                </td>
              )) : (
                <td className="px-3 py-2 text-gray-800">{String(row)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// STEPS DISPLAY — animated numbered steps for teaching how to solve problems
const StepsDisplay = ({ title, steps, highlight }) => {
  const [visible, setVisible] = useState(1);

  useEffect(() => {
    setVisible(1); // reset when steps change
  }, [JSON.stringify(steps)]);

  useEffect(() => {
    if (visible < (steps?.length || 0)) {
      const t = setTimeout(() => setVisible(v => v + 1), 700);
      return () => clearTimeout(t);
    }
  }, [visible, steps?.length]);

  if (!Array.isArray(steps) || steps.length === 0) return null;

  return (
    <div style={{ width: '100%' }}>
      {title && (
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 14, textAlign: 'center' }}>
          {title}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.slice(0, visible).map((step, i) => {
          const isKey = i === highlight;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, animation: 'msgIn 0.35s ease-out' }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: isKey ? '#7C3AED' : '#EDE9FE',
                color: isKey ? '#fff' : '#7C3AED',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14,
              }}>
                {i + 1}
              </div>
              <div style={{
                flex: 1, padding: '9px 13px', borderRadius: 10, fontSize: 14, lineHeight: 1.55, color: '#1C1C1E',
                background: isKey ? '#EDE9FE' : '#F5F5F7',
                border: isKey ? '1.5px solid #7C3AED' : '1.5px solid transparent',
              }}>
                {step}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// PATTERN DISPLAY (for logic/sequences)
const PatternDisplay = ({ pattern, missing }) => {
  return (
    <div className="flex items-center justify-center gap-4 p-8">
      {pattern.map((item, i) => (
        <div 
          key={i}
          className={`text-7xl font-bold ${
            missing === i 
              ? 'text-gray-300' 
              : 'text-purple-600'
          }`}
        >
          {missing === i ? '?' : item}
        </div>
      ))}
    </div>
  );
};

/**
 * StudyBoard Component
 * Visual, actionable workspace for learning activities
 * Displays different content based on visualType
 */
// Wrap in React.memo to prevent unnecessary re-renders
export default React.memo(function StudyBoard({ visual, visualType, visualColor, isYoung, wrongAnswer, onInteraction, onSubmit, onRepeat, onSpeak, onReplayAudio, isTransition = false }) {
  if (!visual || visualType === 'none') {
    return null;
  }

  const colorClasses = {
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-400',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    pink: 'bg-pink-500'
  };

  const bgColor = colorClasses[visualColor] || colorClasses.blue;

  return (
    <div className={`study-board-wrap ${isTransition ? 'animate-board-swap' : 'animate-board-in'}${wrongAnswer ? ' animate-shake' : ''}`}>
      <div className="flex flex-col items-center justify-center">
        {renderContent()}
      </div>
    </div>
  );

  function renderContent() {
    switch (visualType) {
      case 'letter':
        return <LetterDisplay letter={visual} />;
      
      case 'word':
        return <WordDisplay word={visual} />;
      
      case 'circles':
        return <CirclesDisplay count={visual} color={bgColor} />;
      
      case 'emoji':
        return <EmojiDisplay count={visual.count || visual} emoji={visual.emoji || '🔵'} />;
      
      case 'addition':
        return <AdditionDisplay expression={visual} color={bgColor} />;
      
      case 'addition-emoji':
        return <AdditionEmojiDisplay count1={visual.count1} count2={visual.count2} emoji={visual.emoji || '🍎'} />;

      case 'subtraction-emoji':
        return <SubtractionEmojiDisplay count1={visual.count1} count2={visual.count2} emoji={visual.emoji || '🍎'} />;

      case 'number-line':
        return <NumberLine value={visual} />;
      
      case 'choice':
        return <ChoiceButtons choices={visual} onSelect={onInteraction} isYoung={isYoung} />;
      
      case 'trace':
        return (
          <div className="p-3 sm:p-6 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50">
            <TraceDisplay
              letter={visual}
              onInteraction={onInteraction}
              onSubmit={onSubmit}
            />
          </div>
        );
        
      case 'audio-prompt':
        return (
          <div style={{ padding: '8px 0', width: '100%' }}>
            <AudioPromptDisplay text={visual} onRepeat={onRepeat} />
          </div>
        );

      case 'flashcard':
        return (
          <div className="p-3 sm:p-6 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50">
            <FlashcardDisplay
              word={visual.word}
              translation={visual.translation}
              language={visual.language}
              subtext={visual.subtext}
              onSpeak={onSpeak}
            />
          </div>
        );

      case 'test-question':
        return (
          <div className="p-3 sm:p-6 rounded-2xl bg-gradient-to-br from-red-50 to-orange-50">
            <TestQuestionDisplay question={visual} />
          </div>
        );

      case 'multiplication-grid':
        return (
          <div className="p-3 sm:p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50">
            <MultiplicationGridDisplay 
              rows={visual.rows} 
              cols={visual.cols} 
              emoji={visual.emoji || '⭐'} 
            />
          </div>
        );

      case 'multiplication-text':
        return (
          <div className="p-3 sm:p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50">
            <MultiplicationTextDisplay expression={visual} />
          </div>
        );

      // ============================================
      // NEW ENHANCED VISUAL TYPES
      // ============================================
      
      case 'animated-count':
        return (
          <div className="p-8 rounded-2xl bg-gradient-to-br from-yellow-50 to-orange-50">
            <AnimatedCountDisplay 
              items={visual.items}
              operation={visual.operation}
              count={visual.count}
              label={visual.label}
            />
          </div>
        );
      
      case 'enhanced-number-line':
        return (
          <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50">
            <EnhancedNumberLine 
              start={visual.start}
              end={visual.end}
              highlight={visual.highlight}
              current={visual.current}
            />
          </div>
        );
      
      case 'word-parts':
        return (
          <div className="p-8 rounded-2xl bg-gradient-to-br from-green-50 to-teal-50">
            <WordPartsDisplay 
              word={visual.word}
              parts={visual.parts}
              colors={visual.colors}
              pronunciation={visual.pronunciation}
            />
          </div>
        );
      
      case 'fraction':
        return (
          <div className="p-8 rounded-2xl bg-gradient-to-br from-orange-50 to-red-50">
            <FractionDisplay 
              numerator={visual.numerator}
              denominator={visual.denominator}
              visualShape={visual.visualShape}
            />
          </div>
        );
      
      case 'groups':
        return (
          <div className="p-3 sm:p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50">
            <GroupsDisplay 
              groups={visual.groups}
              itemsPerGroup={visual.itemsPerGroup}
              emoji={visual.emoji || '⭐'}
            />
          </div>
        );
      
      case 'comparison':
        return (
          <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50">
            <ComparisonDisplay 
              value1={visual.value1}
              value2={visual.value2}
              emoji={visual.emoji}
            />
          </div>
        );
      
      case 'pattern':
        return (
          <div className="p-8 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50">
            <PatternDisplay 
              pattern={visual.pattern}
              missing={visual.missing}
            />
          </div>
        );
      
      case 'steps':
        return (
          <div style={{ padding: '8px 0', width: '100%' }}>
            <StepsDisplay
              title={visual?.title}
              steps={visual?.steps}
              highlight={visual?.highlight}
            />
          </div>
        );

      case 'table':
        return (
          <div className="p-4 w-full">
            <TableDisplay
              title={visual?.title}
              rows={visual?.rows || (Array.isArray(visual) ? visual : [])}
            />
          </div>
        );

      case 'trading-chart': {
        const { symbol, interval, range, indicators, title, animate } = visual || {};
        return (
          <TradingChart
            symbol={symbol || 'AAPL'}
            interval={interval || '1d'}
            range={range || '3mo'}
            indicators={indicators || ['volume']}
            title={title}
            animate={animate !== false}
          />
        );
      }

      case 'agent-pipeline': {
        return (
          <AgentPipeline
            agentStates={visual?.agents || []}
            recommendation={visual?.recommendation || null}
            dataSource={visual?.dataSource || 'mock'}
            isRunning={visual?.isRunning || false}
            onSimulateTrade={() => onInteraction?.({ type: 'simulate-trade' })}
            onReset={() => onInteraction?.({ type: 'pipeline-reset' })}
            onClearPortfolio={() => onInteraction?.({ type: 'clear-portfolio' })}
            paperPortfolio={visual?.paperPortfolio || null}
          />
        );
      }

      case 'code-block': {
        const cb = typeof visual === 'string' ? { code: visual } : visual;
        return <CodeBlockDisplay data={cb} />;
      }

      case 'chemistry-equation': {
        const ce = typeof visual === 'string' ? { equation: visual } : visual;
        return <ChemistryEquationDisplay data={ce} />;
      }

      case 'formula': {
        const fm = typeof visual === 'string' ? { formula: visual } : visual;
        return <FormulaDisplay data={fm} />;
      }

      case 'coordinate-plane': {
        const cpData = typeof visual === 'string' ? {} : visual;
        return <CoordinatePlaneDisplay data={cpData} />;
      }

      case 'story': {
        const story = typeof visual === 'string' ? { passage: visual } : visual;
        return <StoryDisplay story={story} isYoung={isYoung} />;
      }

      case 'phonics-sentence': {
        const ps = typeof visual === 'string' ? { sentence: visual } : visual;
        return <PhonicsSentenceDisplay data={ps} isYoung={isYoung} />;
      }

      case 'text':
        return <TextDisplay text={visual} isYoung={isYoung} />;

      case 'list':
        return <ListDisplay items={Array.isArray(visual) ? visual : (visual.items || Object.values(visual).find(Array.isArray) || [])} title={visual.title} />;

      case 'memory-game': {
        const mgData = typeof visual === 'object' && visual !== null ? visual : {};
        return <MemoryGameDisplay data={mgData} onInteraction={onInteraction} />;
      }

      // ============================================
      // V3 ANIMATED TEACHING VISUAL TYPES
      // ============================================

      case 'pronunciation-guide': {
        const pg = typeof visual === 'object' && visual !== null ? visual : { word: String(visual || '') };
        return (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50">
            <PronunciationGuideDisplay data={pg} onSpeak={onSpeak} />
          </div>
        );
      }

      case 'vocab-scene': {
        const vs = typeof visual === 'object' && visual !== null ? visual : { word: String(visual || '') };
        return (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50">
            <VocabSceneDisplay data={vs} onSpeak={onSpeak} isYoung={isYoung} />
          </div>
        );
      }

      case 'conversation-scene': {
        const cs = typeof visual === 'object' && visual !== null ? visual : { type: 'image', src: '' };
        return (
          <div className="p-3 sm:p-4">
            <ConversationScene data={cs} />
          </div>
        );
      }

      case 'remotion-video': {
        const { type, ...videoProps } =
          typeof visual === 'object' && visual !== null ? visual : {};
        if (!type) return <TextDisplay text={String(visual || '')} isYoung={isYoung} />;
        const StudyVideo = React.lazy(() => import('./StudyVideo'));
        return (
          <React.Suspense
            fallback={
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8E8E93', fontSize: 14 }}>
                Loading...
              </div>
            }
          >
            <StudyVideo type={type} inputProps={videoProps} color={visualColor || '#0A84FF'} onReplayAudio={onReplayAudio} />
          </React.Suspense>
        );
      }

      default:
        // If visual is an array, render as a list
        if (Array.isArray(visual)) {
          return <ListDisplay items={visual} />;
        }
        // If visual is an object with an array property, render title + list
        if (visual && typeof visual === 'object') {
          const arrayProp = Object.values(visual).find(Array.isArray);
          if (arrayProp) return <ListDisplay items={arrayProp} title={visual.title} />;
        }
        return <TextDisplay text={typeof visual === 'object' ? visual : String(visual)} isYoung={isYoung} />;
    }
  }
}); // Close React.memo

// Letter Display Component
function LetterDisplay({ letter }) {
  return (
    <div className="text-9xl font-bold text-purple-600 animate-bounce-gentle">
      {letter}
    </div>
  );
}

// Word Display Component
function WordDisplay({ word }) {
  return (
    <div className="text-7xl font-bold text-blue-600 tracking-wider">
      {word}
    </div>
  );
}

// Circles Display Component (for counting)
function CirclesDisplay({ count, color }) {
  const circles = Array.from({ length: count }, (_, i) => i);
  
  return (
    <div className="flex flex-wrap gap-4 justify-center max-w-lg">
      {circles.map((i) => (
        <div
          key={i}
          className={`w-16 h-16 rounded-full ${color} shadow-lg animate-pop-in`}
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}

// Emoji Display Component (for counting with emojis)
function EmojiDisplay({ count, emoji }) {
  const items = Array.from({ length: count }, (_, i) => i);
  
  return (
    <div className="flex flex-wrap gap-4 justify-center max-w-lg">
      {items.map((i) => (
        <div
          key={i}
          className="text-6xl animate-pop-in"
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          {emoji}
        </div>
      ))}
    </div>
  );
}

// Addition Display Component
function AdditionDisplay({ expression, color }) {
  // Parse expression like "3+2"
  const parts = expression.split('+');
  const num1 = parseInt(parts[0]) || 0;
  const num2 = parseInt(parts[1]) || 0;
  
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 text-5xl font-bold">
        <CirclesDisplay count={num1} color={color} />
        <span className="text-6xl">+</span>
        <CirclesDisplay count={num2} color={color} />
        <span className="text-6xl">=</span>
        <span className="text-6xl text-gray-300">?</span>
      </div>
    </div>
  );
}

// Addition with Emojis Display Component
function AdditionEmojiDisplay({ count1, count2, emoji }) {
  const items1 = Array.from({ length: count1 }, (_, i) => i);
  const items2 = Array.from({ length: count2 }, (_, i) => i);
  
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-center gap-4">
        {/* First group */}
        <div className="flex flex-wrap gap-3">
          {items1.map((i) => (
            <div key={i} className="text-5xl animate-pop-in" style={{ animationDelay: `${i * 0.1}s` }}>
              {emoji}
            </div>
          ))}
        </div>
        
        {/* Plus sign */}
        <div className="text-6xl font-bold px-4">+</div>
        
        {/* Second group */}
        <div className="flex flex-wrap gap-3">
          {items2.map((i) => (
            <div key={i + count1} className="text-5xl animate-pop-in" style={{ animationDelay: `${(i + count1) * 0.1}s` }}>
              {emoji}
            </div>
          ))}
        </div>
        
        {/* Equals sign */}
        <div className="text-6xl font-bold px-4">=</div>
        
        {/* Question mark */}
        <div className="text-6xl font-bold text-gray-300">?</div>
      </div>
    </div>
  );
}

// Subtraction with Emojis Display Component
const SubtractionEmojiDisplay = ({ count1, count2, emoji }) => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 p-8">
      {/* First group - cross some out */}
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: count1 }).map((_, i) => (
          <div key={i} className="relative">
            <div className="text-7xl" style={{ 
              animationDelay: `${i * 0.1}s`,
              opacity: i < count2 ? 0.3 : 1,
              filter: i < count2 ? 'grayscale(1)' : 'none'
            }}>
              {emoji}
            </div>
            {i < count2 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-8xl text-red-500 font-bold">✗</div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Minus sign */}
      <div className="text-9xl font-bold text-gray-700">−</div>
      
      {/* Number to subtract */}
      <div className="text-9xl font-bold text-red-600">{count2}</div>
      
      {/* Equals sign */}
      <div className="text-9xl font-bold text-gray-700">=</div>
      
      {/* Question mark */}
      <div className="text-9xl font-bold text-gray-400">?</div>
    </div>
  );
};

// Number Line Component
function NumberLine({ value }) {
  const numbers = Array.from({ length: 21 }, (_, i) => i);
  
  return (
    <div className="w-full overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4" style={{ minWidth: 'min-content' }}>
        {numbers.map((num) => (
          <div key={num} className="flex flex-col items-center flex-shrink-0">
            <div
              className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-lg ${
                num === value
                  ? 'bg-green-500 text-white scale-110 ring-2 sm:ring-4 ring-green-300'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {num}
            </div>
            <div className={`w-0.5 h-2 sm:h-4 ${num === value ? 'bg-green-500' : 'bg-gray-300'}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Choice Buttons Component
// Bright gradient palettes for young kids' choice buttons
const CHOICE_GRADIENTS = [
  ['#FF6B6B','#FF8E53'],  // coral-orange
  ['#4ECDC4','#44A08D'],  // teal-green
  ['#A855F7','#6366F1'],  // purple-indigo
  ['#F59E0B','#F97316'],  // amber-orange
];

function ChoiceButtons({ choices, onSelect, isYoung }) {
  if (!Array.isArray(choices)) return null;

  return (
    <div className={`grid gap-4 w-full ${isYoung ? 'grid-cols-1 max-w-xs' : 'grid-cols-1 md:grid-cols-2 max-w-lg'}`}>
      {choices.map((choice, index) => {
        const [from, to] = CHOICE_GRADIENTS[index % CHOICE_GRADIENTS.length];
        return (
          <button
            key={index}
            onClick={() => onSelect?.(choice)}
            className="animate-pop-in"
            style={{
              background: `linear-gradient(135deg, ${from}, ${to})`,
              color: '#fff',
              border: 'none',
              borderRadius: isYoung ? 20 : 16,
              padding: isYoung ? '18px 24px' : '14px 20px',
              fontSize: isYoung ? 22 : 18,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: `0 6px 20px ${from}55`,
              transform: 'translateY(0)',
              transition: 'transform 0.15s, box-shadow 0.15s',
              animationDelay: `${index * 0.07}s`,
              fontFamily: isYoung ? 'Fredoka, system-ui, sans-serif' : 'system-ui, sans-serif',
              letterSpacing: isYoung ? '0.02em' : 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.04)'; e.currentTarget.style.boxShadow = `0 10px 28px ${from}77`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = `0 6px 20px ${from}55`; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'translateY(1px) scale(0.97)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.04)'; }}
          >
            {choice}
          </button>
        );
      })}
    </div>
  );
}

// Tracing Area Component
function TracingArea({ shape }) {
  return (
    <div className="border-4 border-dashed border-gray-300 rounded-xl p-8 bg-gray-50">
      <div className="text-8xl text-gray-300 font-bold">
        {shape}
      </div>
      <p className="text-sm text-gray-500 mt-4">Trace with your finger!</p>
    </div>
  );
}

// Text Display Component
function StoryDisplay({ story, isYoung }) {
  const [showQuestion, setShowQuestion] = useState(false);
  if (!story?.passage) return null;
  const fontSize = isYoung ? 17 : 14;
  const lineHeight = isYoung ? 1.8 : 1.65;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 2px' }}>
      {story.title && (
        <p style={{
          margin: 0, fontSize: isYoung ? 16 : 13, fontWeight: 800,
          color: '#0A84FF', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          letterSpacing: '0.02em',
        }}>{story.title}</p>
      )}
      <p style={{
        margin: 0, fontSize, lineHeight, color: '#1C1C1E',
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        fontWeight: 400,
      }}>
        {story.passage}
      </p>
      {story.question && (
        <div>
          {!showQuestion ? (
            <button
              onClick={() => setShowQuestion(true)}
              style={{
                padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)',
                color: '#fff', fontSize: 13, fontWeight: 700,
                fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
              }}>
              Show comprehension question →
            </button>
          ) : (
            <div style={{
              background: '#F2F2F7', borderRadius: 12, padding: '12px 14px',
              borderLeft: '4px solid #0A84FF',
            }}>
              <p style={{ margin: 0, fontSize: isYoung ? 15 : 13, fontWeight: 600, color: '#1C1C1E',
                fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                {story.question}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Phonics sentence display — shows each word broken into phoneme cards
function PhonicsSentenceDisplay({ data, isYoung }) {
  const [highlighted, setHighlighted] = useState(null);
  if (!data) return null;

  const words = data.words || (data.sentence ? data.sentence.split(' ') : []);
  const phonicsMap = data.phonics || {}; // { "cat": ["c","a","t"], "sat": ["s","a","t"] }
  const colors = ['#FF453A', '#FF9F0A', '#30D158', '#0A84FF', '#BF5AF2', '#FF6B6B'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
        {words.map((word, wi) => {
          const clean = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
          const parts = phonicsMap[clean] || [word];
          const isActive = highlighted === wi;
          return (
            <button
              key={wi}
              onClick={() => setHighlighted(isActive ? null : wi)}
              style={{
                background: isActive ? '#F2F2F7' : 'white',
                border: `2px solid ${isActive ? '#0A84FF' : '#E5E5EA'}`,
                borderRadius: 12, padding: '8px 12px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                transition: 'all 0.2s',
              }}>
              <span style={{
                fontSize: isYoung ? 22 : 18, fontWeight: 700, color: '#1C1C1E',
                fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
              }}>{word}</span>
              {isActive && (
                <div style={{ display: 'flex', gap: 3 }}>
                  {parts.map((ph, pi) => (
                    <span key={pi} style={{
                      fontSize: 13, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
                      background: colors[pi % colors.length] + '22',
                      color: colors[pi % colors.length],
                      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                    }}>{ph}</span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {highlighted === null && (
        <p style={{
          margin: 0, fontSize: 12, color: '#8E8E93', textAlign: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        }}>Tap any word to see its sounds</p>
      )}
    </div>
  );
}

function TextDisplay({ text, isYoung }) {
  // Handle object visual (e.g. {title, lines} from AI responses)
  if (text && typeof text === 'object') {
    return (
      <div
        className={`text-center px-4 ${isYoung ? 'text-2xl' : 'text-xl'} text-gray-800`}
        style={{ fontFamily: isYoung ? 'Fredoka, sans-serif' : 'Poppins, sans-serif' }}
      >
        {text.title && (
          <div className="font-bold mb-2">{text.title}</div>
        )}
        {Array.isArray(text.lines)
          ? text.lines.map((line, i) => <div key={i}>{line}</div>)
          : Object.values(text).map((v, i) => (
              <div key={i}>{typeof v === 'string' ? v : JSON.stringify(v)}</div>
            ))
        }
      </div>
    );
  }

  return (
    <div
      className={`text-center ${isYoung ? 'text-3xl' : 'text-2xl'} font-semibold text-gray-800 px-4`}
      style={{ fontFamily: isYoung ? 'Fredoka, sans-serif' : 'Poppins, sans-serif' }}
    >
      {text}
    </div>
  );
}

// List Display Component (for topic lists, assessment categories, etc.)
function ListDisplay({ items, title }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div style={{ width: '100%' }}>
      {title && (
        <div style={{
          fontSize: 15, fontWeight: 700, color: '#1C1C1E',
          marginBottom: 12, textAlign: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        }}>
          {title}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 13px', borderRadius: 10,
            background: '#F5F5F7',
            fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
            fontSize: 14, color: '#1C1C1E',
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: '#EDE9FE', color: '#7C3AED',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 12,
            }}>
              {i + 1}
            </div>
            <span>{typeof item === 'string' ? item : JSON.stringify(item)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Usage Examples:
 * 
 * // Existing types (unchanged):
 * <StudyBoard visual="A" visualType="letter" />
 * <StudyBoard visual="CAT" visualType="word" />
 * <StudyBoard visual={5} visualType="circles" visualColor="green" />
 * <StudyBoard visual="3+2" visualType="addition" visualColor="red" />
 * <StudyBoard visual={7} visualType="number-line" />
 * <StudyBoard visual={['Apple', 'Banana']} visualType="choice" onInteraction={(c) => console.log(c)} />
 * 
 * // NEW enhanced types:
 * 
 * // Animated counting (for visual subtraction/addition)
 * <StudyBoard 
 *   visualType="animated-count"
 *   visual={{
 *     items: ['🍎','🍎','🍎','🍎','🍎'],
 *     operation: 'remove',
 *     count: 2,
 *     label: '5 - 2 = ?'
 *   }}
 * />
 * 
 * // Enhanced number line (with highlighting)
 * <StudyBoard 
 *   visualType="enhanced-number-line"
 *   visual={{
 *     start: 0,
 *     end: 10,
 *     highlight: [3, 5, 7],
 *     current: 5
 *   }}
 * />
 * 
 * // Word breakdown (for spelling)
 * <StudyBoard 
 *   visualType="word-parts"
 *   visual={{
 *     word: 'beautiful',
 *     parts: ['beau', 'ti', 'ful'],
 *     colors: ['#3B82F6', '#EF4444', '#10B981'],
 *     pronunciation: 'BYOO-tih-ful'
 *   }}
 * />
 * 
 * // Fractions
 * <StudyBoard 
 *   visualType="fraction"
 *   visual={{
 *     numerator: 3,
 *     denominator: 4
 *   }}
 * />
 * 
 * // Groups (for multiplication)
 * <StudyBoard 
 *   visualType="groups"
 *   visual={{
 *     groups: 3,
 *     itemsPerGroup: 4,
 *     emoji: '⭐'
 *   }}
 * />
 * 
 * // Comparison (greater than/less than)
 * <StudyBoard 
 *   visualType="comparison"
 *   visual={{
 *     value1: 5,
 *     value2: 3,
 *     emoji: '🍎'
 *   }}
 * />
 *
 * // Pattern (for logic)
 * <StudyBoard
 *   visualType="pattern"
 *   visual={{
 *     pattern: ['🔵', '🔴', '🔵', '🔴', '?'],
 *     missing: 4
 *   }}
 * />
 */

// ── CodeBlockDisplay ─────────────────────────────────────────────────────────
function CodeBlockDisplay({ data }) {
  const [copied, setCopied] = useState(false);
  const { code = '', language = '', title = '', explanation = '' } = data || {};

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  // Simple keyword highlighter (covers Python, JS, Java, C++, SQL basics)
  const keywords = /\b(def|return|if|else|elif|for|while|in|import|from|class|self|True|False|None|and|or|not|function|const|let|var|=>|async|await|int|string|bool|void|public|private|static|new|null|undefined|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|JOIN|ON|AND|OR)\b/g;
  const strings = /(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g;
  const comments = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/g;
  const numbers = /\b(\d+\.?\d*)\b/g;

  const highlight = (raw) => {
    // We escape HTML first, then apply spans — keeps it safe
    const esc = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return esc
      .replace(comments, '<span style="color:#6B7280;font-style:italic">$1</span>')
      .replace(strings, '<span style="color:#10B981">$1$2$1</span>')
      .replace(keywords, '<span style="color:#60A5FA;font-weight:600">$1</span>')
      .replace(numbers, '<span style="color:#FBBF24">$1</span>');
  };

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #334155', background: '#0F172A', fontFamily: 'monospace' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#1E293B', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
          {(title || language) && <span style={{ marginLeft: 8, color: '#94A3B8', fontSize: 12 }}>{title || language}</span>}
        </div>
        <button
          onClick={handleCopy}
          style={{ background: 'none', border: '1px solid #475569', borderRadius: 6, color: '#94A3B8', padding: '2px 10px', fontSize: 12, cursor: 'pointer' }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      {/* Code body */}
      <pre style={{ margin: 0, padding: '16px 18px', overflowX: 'auto', fontSize: 14, lineHeight: 1.6, color: '#E2E8F0' }}>
        <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />
      </pre>
      {explanation && (
        <div style={{ padding: '10px 18px', background: '#1E293B', borderTop: '1px solid #334155', color: '#94A3B8', fontSize: 13, lineHeight: 1.5 }}>
          {explanation}
        </div>
      )}
    </div>
  );
}

// ── ChemistryEquationDisplay ──────────────────────────────────────────────────
function ChemistryEquationDisplay({ data }) {
  const { equation = '', reactants = '', products = '', type = '', steps = [], balanced = true } = data || {};

  // If we have a raw equation string, split on → or ->
  let leftSide = reactants;
  let rightSide = products;
  if (!leftSide && equation) {
    const parts = equation.split(/→|->|=>/);
    leftSide = parts[0]?.trim() || equation;
    rightSide = parts[1]?.trim() || '';
  }

  // Simple subscript formatter: H2O → H₂O
  const fmtSubscripts = (s) => s.replace(/(\d+)/g, (m) => m.split('').map(d => '₀₁₂₃₄₅₆₇₈₉'[parseInt(d)]).join(''));

  return (
    <div style={{ padding: '20px 18px', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
      {type && <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{type}</div>}

      {/* Main equation display */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap', padding: '16px 0' }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#1E40AF', fontFamily: 'monospace' }}>
          {fmtSubscripts(leftSide)}
        </span>
        <span style={{ fontSize: 26, color: '#6B7280' }}>→</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#065F46', fontFamily: 'monospace' }}>
          {fmtSubscripts(rightSide || '?')}
        </span>
        {balanced && (
          <span style={{ fontSize: 11, background: '#DCFCE7', color: '#15803D', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>
            BALANCED
          </span>
        )}
      </div>

      {/* Step-by-step solution */}
      {steps.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
              <span style={{ minWidth: 22, height: 22, borderRadius: '50%', background: '#DBEAFE', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── FormulaDisplay ────────────────────────────────────────────────────────────
function FormulaDisplay({ data }) {
  const { formula = '', variables = {}, example = '', title = '', unit = '' } = data || {};

  return (
    <div style={{ padding: '20px 18px', background: '#FAFAF9', borderRadius: 12, border: '1px solid #E7E5E4' }}>
      {title && <div style={{ fontSize: 13, fontWeight: 700, color: '#44403C', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>}

      {/* Big formula */}
      <div style={{ textAlign: 'center', padding: '16px 10px', background: '#F5F5F4', borderRadius: 8, border: '1px solid #D6D3D1', marginBottom: 14 }}>
        <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Georgia, serif', color: '#1C1917', letterSpacing: '0.04em' }}>
          {formula}
        </span>
        {unit && <span style={{ fontSize: 14, color: '#78716C', marginLeft: 8 }}>[{unit}]</span>}
      </div>

      {/* Variable legend */}
      {Object.keys(variables).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#78716C', marginBottom: 6, textTransform: 'uppercase' }}>Variables</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 6 }}>
            {Object.entries(variables).map(([sym, desc]) => (
              <div key={sym} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'Georgia, serif', fontWeight: 700, color: '#1C1917', minWidth: 24 }}>{sym}</span>
                <span style={{ fontSize: 13, color: '#57534E' }}>= {desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Worked example */}
      {example && (
        <div style={{ background: '#FEF9C3', borderRadius: 8, padding: '10px 14px', border: '1px solid #FDE047' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#713F12', marginBottom: 4 }}>EXAMPLE</div>
          <div style={{ fontSize: 14, color: '#451A03', lineHeight: 1.6, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{example}</div>
        </div>
      )}
    </div>
  );
}

// ── CoordinatePlaneDisplay ─────────────────────────────────────────────────────
function CoordinatePlaneDisplay({ data }) {
  const {
    points = [],
    line = null,
    xRange = [-5, 5],
    yRange = [-5, 5],
    title = '',
    xLabel = 'x',
    yLabel = 'y',
  } = data || {};

  const SIZE = 300;
  const PADDING = 36;
  const plotW = SIZE - PADDING * 2;
  const plotH = SIZE - PADDING * 2;

  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;

  const toSvgX = (x) => PADDING + ((x - xMin) / (xMax - xMin)) * plotW;
  const toSvgY = (y) => PADDING + ((yMax - y) / (yMax - yMin)) * plotH;

  // Grid lines every unit
  const xTicks = [];
  for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) xTicks.push(x);
  const yTicks = [];
  for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) yTicks.push(y);

  // Line path: plot from xMin to xMax
  let linePath = null;
  if (line && typeof line.slope === 'number' && typeof line.intercept === 'number') {
    const x1 = xMin, y1 = line.slope * xMin + line.intercept;
    const x2 = xMax, y2 = line.slope * xMax + line.intercept;
    linePath = `M ${toSvgX(x1)} ${toSvgY(y1)} L ${toSvgX(x2)} ${toSvgY(y2)}`;
  }

  const originX = toSvgX(0);
  const originY = toSvgY(0);

  return (
    <div style={{ background: '#F8F8FC', borderRadius: 12, padding: 12, border: '1px solid #E5E5EA', maxWidth: '100%', display: 'inline-block' }}>
      {title && (
        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#1C1C1E', marginBottom: 6 }}>{title}</div>
      )}
      <svg width={SIZE} height={SIZE} style={{ display: 'block', maxWidth: '100%' }}>
        {/* Grid lines */}
        {xTicks.map(x => (
          <line key={`gx${x}`} x1={toSvgX(x)} y1={PADDING} x2={toSvgX(x)} y2={SIZE - PADDING}
            stroke="#E5E5EA" strokeWidth="1" />
        ))}
        {yTicks.map(y => (
          <line key={`gy${y}`} x1={PADDING} y1={toSvgY(y)} x2={SIZE - PADDING} y2={toSvgY(y)}
            stroke="#E5E5EA" strokeWidth="1" />
        ))}

        {/* Axes */}
        <line x1={PADDING} y1={originY} x2={SIZE - PADDING + 8} y2={originY} stroke="#1C1C1E" strokeWidth="1.5" />
        <line x1={originX} y1={SIZE - PADDING} x2={originX} y2={PADDING - 8} stroke="#1C1C1E" strokeWidth="1.5" />

        {/* Arrow tips */}
        <polygon points={`${SIZE - PADDING + 8},${originY} ${SIZE - PADDING + 2},${originY - 4} ${SIZE - PADDING + 2},${originY + 4}`} fill="#1C1C1E" />
        <polygon points={`${originX},${PADDING - 8} ${originX - 4},${PADDING - 2} ${originX + 4},${PADDING - 2}`} fill="#1C1C1E" />

        {/* Axis labels */}
        <text x={SIZE - PADDING + 12} y={originY + 4} fontSize="12" fill="#1C1C1E" fontStyle="italic">{xLabel}</text>
        <text x={originX - 6} y={PADDING - 12} fontSize="12" fill="#1C1C1E" fontStyle="italic" textAnchor="middle">{yLabel}</text>

        {/* Tick marks and labels — every 2 units */}
        {xTicks.filter(x => x !== 0 && x % 2 === 0).map(x => (
          <g key={`tx${x}`}>
            <line x1={toSvgX(x)} y1={originY - 3} x2={toSvgX(x)} y2={originY + 3} stroke="#1C1C1E" strokeWidth="1" />
            <text x={toSvgX(x)} y={originY + 14} fontSize="10" fill="#8E8E93" textAnchor="middle">{x}</text>
          </g>
        ))}
        {yTicks.filter(y => y !== 0 && y % 2 === 0).map(y => (
          <g key={`ty${y}`}>
            <line x1={originX - 3} y1={toSvgY(y)} x2={originX + 3} y2={toSvgY(y)} stroke="#1C1C1E" strokeWidth="1" />
            <text x={originX - 8} y={toSvgY(y) + 4} fontSize="10" fill="#8E8E93" textAnchor="end">{y}</text>
          </g>
        ))}

        {/* Line */}
        {linePath && (
          <path d={linePath} stroke="#0A84FF" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}

        {/* Points */}
        {points.map((pt, i) => (
          <g key={i}>
            <circle cx={toSvgX(pt.x)} cy={toSvgY(pt.y)} r="5" fill="#FF3B30" stroke="white" strokeWidth="1.5" />
            {pt.label && (
              <text x={toSvgX(pt.x) + 8} y={toSvgY(pt.y) - 6} fontSize="11" fill="#FF3B30" fontWeight="600">
                {pt.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── MemoryGameDisplay ─────────────────────────────────────────────────────────
// Timed memory exercise: SHOW phase → countdown → RECALL phase.
// All timer logic is self-contained so the parent (StudyBoard / App.jsx) needs
// no changes — grading proceeds through the normal chat flow after items hide.
function MemoryGameDisplay({ data, onInteraction }) {
  const items = Array.isArray(data.items) ? data.items : [];
  const duration = typeof data.duration === 'number' ? Math.max(3, data.duration) : 5;
  const question = data.question || `What were the ${items.length} item${items.length !== 1 ? 's' : ''}?`;

  const [phase, setPhase] = useState('show'); // 'show' | 'recall'
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const countdownRef = useRef(null);
  const sysFont = '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, system-ui, sans-serif';

  // Reset whenever the game data changes (new round / replay)
  useEffect(() => {
    setPhase('show');
    setSecondsLeft(duration);
  }, [data, duration]);

  // Start / restart countdown when entering show phase
  useEffect(() => {
    if (phase !== 'show') return;
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [phase, data]); // re-run when data changes (reset guard)

  // Transition to recall when counter hits 0
  useEffect(() => {
    if (secondsLeft === 0 && phase === 'show') {
      setPhase('recall');
      onInteraction?.({ type: 'memory-items-hidden' });
    }
  }, [secondsLeft, phase, onInteraction]);

  // Cleanup on unmount
  useEffect(() => () => clearInterval(countdownRef.current), []);

  const pct = (secondsLeft / duration) * 100;
  const isUrgent = secondsLeft <= 2;

  /* ─── SHOW phase ─────────────────────────────────────────── */
  if (phase === 'show') {
    const cols = items.length <= 3 ? items.length : Math.min(3, items.length);
    return (
      <div style={{ width: '100%', fontFamily: sysFont, padding: '6px 4px' }}>
        {/* Timer bar */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              Memorize!
            </span>
            <span style={{
              fontSize: 13, fontWeight: 800,
              color: isUrgent ? '#EF4444' : '#7C3AED',
              transition: 'color 0.3s',
            }}>
              {secondsLeft}s
            </span>
          </div>
          <div style={{ height: 6, background: '#EEF0FB', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: isUrgent
                ? 'linear-gradient(90deg, #EF4444, #F97316)'
                : 'linear-gradient(90deg, #7C3AED, #4F46E5)',
              borderRadius: 3,
              transition: 'width 1s linear, background 0.3s ease',
            }} />
          </div>
        </div>

        {/* Items grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 10,
        }}>
          {items.map((item, i) => {
            const emoji = pickItemEmoji(item);
            const label = stripLeadingEmoji(item);
            return (
              <div key={i} style={{
                background: 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)',
                borderRadius: 14,
                padding: '14px 8px 12px',
                textAlign: 'center',
                border: '1.5px solid rgba(124,58,237,0.20)',
                boxShadow: '0 2px 10px rgba(124,58,237,0.10)',
                animation: 'boardPopIn 0.38s cubic-bezier(0.34,1.56,0.64,1) forwards',
                animationDelay: `${i * 0.07}s`,
                opacity: 0,
              }}>
                <div style={{ fontSize: 30, marginBottom: 5, lineHeight: 1 }}>{emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4C1D95', lineHeight: 1.3 }}>{label}</div>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 10, fontWeight: 500 }}>
          {isUrgent ? 'Almost gone!' : `Disappearing in ${secondsLeft} second${secondsLeft !== 1 ? 's' : ''}…`}
        </p>
      </div>
    );
  }

  /* ─── RECALL phase ───────────────────────────────────────── */
  return (
    <div style={{ width: '100%', fontFamily: sysFont, padding: '6px 4px' }}>
      {/* Ghost placeholders */}
      <div style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'center',
        marginBottom: 16,
        flexWrap: 'wrap',
      }}>
        {items.map((_, i) => (
          <div key={i} style={{
            width: 52, height: 52, borderRadius: 12,
            background: 'rgba(124,58,237,0.05)',
            border: '2px dashed rgba(124,58,237,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, color: 'rgba(124,58,237,0.28)',
            animation: 'boardPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
            animationDelay: `${i * 0.06}s`,
            opacity: 0,
          }}>?</div>
        ))}
      </div>

      {/* Recall prompt card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(79,70,229,0.03))',
        border: '1.5px solid rgba(124,58,237,0.16)',
        borderRadius: 16,
        padding: '16px 18px',
        textAlign: 'center',
        animation: 'boardPopIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
        opacity: 0,
      }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: '#7C3AED', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>
          Time to recall!
        </p>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0, lineHeight: 1.45 }}>
          {question}
        </p>
      </div>

      <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 10, fontWeight: 500 }}>
        Type your answer in the chat below
      </p>
    </div>
  );
}

// Maps common English item names to an emoji; falls back to 📌
const ITEM_EMOJI_MAP = {
  apple:'🍎', banana:'🍌', orange:'🍊', strawberry:'🍓', grape:'🍇', watermelon:'🍉',
  lemon:'🍋', mango:'🥭', cherry:'🍒', peach:'🍑',
  dog:'🐕', cat:'🐱', bird:'🐦', fish:'🐟', rabbit:'🐰', horse:'🐎', elephant:'🐘',
  lion:'🦁', tiger:'🐯', bear:'🐻', frog:'🐸', butterfly:'🦋', bee:'🐝', owl:'🦉',
  ball:'⚽', star:'⭐', heart:'❤️', flower:'🌸', tree:'🌳', sun:'☀️', moon:'🌙',
  cloud:'☁️', rain:'🌧️', snow:'❄️', fire:'🔥', rainbow:'🌈',
  car:'🚗', bus:'🚌', plane:'✈️', rocket:'🚀', ship:'🚢', train:'🚂', bike:'🚲',
  house:'🏠', book:'📚', pencil:'✏️', key:'🔑', phone:'📱', clock:'⏰', hat:'🎩',
  shoe:'👟', glasses:'👓', umbrella:'☂️', ball2:'🏀', balloon:'🎈',
  pizza:'🍕', cake:'🎂', cookie:'🍪', bread:'🍞', milk:'🥛', egg:'🥚', rice:'🍚',
  red:'🔴', blue:'🔵', green:'🟢', yellow:'🟡', purple:'🟣', orange2:'🟠',
  one:'1️⃣', two:'2️⃣', three:'3️⃣',
};

function pickItemEmoji(item) {
  if (!item) return '📌';
  // If the item string starts with an emoji character, use it
  const firstChar = [...item][0];
  if (firstChar && /\p{Emoji}/u.test(firstChar)) return firstChar;
  // Otherwise look up in map
  const lower = item.toLowerCase().trim();
  for (const [key, emoji] of Object.entries(ITEM_EMOJI_MAP)) {
    if (lower.includes(key)) return emoji;
  }
  return '📌';
}

function stripLeadingEmoji(item) {
  if (!item) return '';
  return item.replace(/^\p{Emoji}\s*/u, '').trim() || item;
}
