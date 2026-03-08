import React, { useRef, useState, useEffect } from 'react';

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 24 }}>
      {/* Card container — sets up the 3D perspective */}
      <div
        onClick={() => setFlipped(f => !f)}
        style={{ width: 320, height: 200, perspective: 1000, cursor: 'pointer' }}
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
            gap: 6, padding: '16px 20px',
          }}>
            <div style={{
              fontSize: 44, fontWeight: 700, color: '#1e3a5f',
              textAlign: 'center', lineHeight: 1.2,
              fontFamily: 'system-ui, sans-serif',
            }}>
              {word}
            </div>
            {subtext && (
              <div style={{
                fontSize: 17, color: '#2563eb', fontWeight: 500, opacity: 0.85,
                fontFamily: 'system-ui, sans-serif',
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
            padding: '16px 20px',
          }}>
            <div style={{
              fontSize: 44, fontWeight: 700, color: '#3b0764',
              textAlign: 'center', fontFamily: 'system-ui, sans-serif',
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
  
  // Draw the letter on the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set up drawing context for user strokes
    ctx.strokeStyle = '#3B82F6'; // Blue color for user's drawing
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw the letter to trace (light gray, behind user strokes)
    ctx.save();
    ctx.fillStyle = '#E5E7EB'; // Light gray
    ctx.font = 'bold 320px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }, [letter]);
  
  const startDrawing = (e) => {
    setIsDrawing(true);
    setHasDrawn(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  
  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  
  const stopDrawing = () => {
    setIsDrawing(false);
  };
  
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear everything
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw the letter
    ctx.save();
    ctx.fillStyle = '#E5E7EB'; // Light gray
    ctx.font = 'bold 320px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, canvas.width / 2, canvas.height / 2);
    ctx.restore();
    
    setHasDrawn(false);
  };


  
const handleDone = () => {
  // Submit the letter directly
  if (onSubmit) {
    onSubmit(letter);
  }
};
  
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      {/* Canvas for tracing - letter is drawn directly on canvas */}
      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="border-4 border-dashed border-blue-300 rounded-2xl bg-white cursor-crosshair touch-none"
        style={{ touchAction: 'none' }}
      />
      
      {/* Buttons */}
      <div className="flex gap-4">
        <button
          onClick={clearCanvas}
          className="px-8 py-4 bg-orange-500 text-white rounded-xl font-bold text-xl hover:bg-orange-600 transition-colors"
          style={{ fontFamily: 'Fredoka, sans-serif' }}
        >
          Clear ↺
        </button>
        
        <button
          onClick={handleDone}
          disabled={!hasDrawn}
          className="px-8 py-4 bg-green-500 text-white rounded-xl font-bold text-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontFamily: 'Fredoka, sans-serif' }}
        >
          Done! ✓
        </button>
      </div>
      
      <p className="text-xl text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
        ✏️ Trace the letter with your finger, then click Done!
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
export default React.memo(function StudyBoard({ visual, visualType, visualColor, isYoung, onInteraction, onSubmit, onRepeat, onSpeak }) {
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
    <div className="study-board-wrap">
      <div className="flex flex-col items-center justify-center min-h-[180px]">
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
          <div className="p-8 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50">
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
          <div className="p-8 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50">
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
          <div className="p-8 rounded-2xl bg-gradient-to-br from-red-50 to-orange-50">
            <TestQuestionDisplay question={visual} />
          </div>
        );

      case 'multiplication-grid':
        return (
          <div className="p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50">
            <MultiplicationGridDisplay 
              rows={visual.rows} 
              cols={visual.cols} 
              emoji={visual.emoji || '⭐'} 
            />
          </div>
        );

      case 'multiplication-text':
        return (
          <div className="p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50">
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
          <div className="p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50">
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

      case 'text':
        return <TextDisplay text={visual} isYoung={isYoung} />;

      case 'list':
        return <ListDisplay items={Array.isArray(visual) ? visual : (visual.items || Object.values(visual).find(Array.isArray) || [])} title={visual.title} />;

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
    <div className="w-full overflow-x-auto">
      <div className="flex items-center gap-2 min-w-max px-4">
        {numbers.map((num) => (
          <div key={num} className="flex flex-col items-center">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                num === value 
                  ? 'bg-green-500 text-white scale-125 ring-4 ring-green-300' 
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {num}
            </div>
            <div className={`w-0.5 h-4 ${num === value ? 'bg-green-500' : 'bg-gray-300'}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Choice Buttons Component
function ChoiceButtons({ choices, onSelect, isYoung }) {
  if (!Array.isArray(choices)) return null;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
      {choices.map((choice, index) => (
        <button
          key={index}
          onClick={() => onSelect?.(choice)}
          className={`bg-gradient-to-r from-purple-400 to-purple-600 text-white rounded-2xl p-6 font-bold ${
            isYoung ? 'text-2xl' : 'text-xl'
          } hover:scale-105 transition-all shadow-lg`}
          style={{ fontFamily: isYoung ? 'Fredoka, sans-serif' : 'Poppins, sans-serif' }}
        >
          {choice}
        </button>
      ))}
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
