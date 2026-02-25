import React, { useRef, useState, useEffect } from 'react';

// Add this TraceDisplay component after the other display components
// Flashcard Display (for language learning)
// Audio Prompt Display (for spelling - audio only, no visual of answer)
const AudioPromptDisplay = ({ text }) => {
  return (
    <div className="flex flex-col items-center gap-6 p-12">
      <div className="text-9xl animate-pulse">🔊</div>
      <div className="text-4xl font-bold text-purple-600 text-center" style={{ fontFamily: 'Fredoka, sans-serif' }}>
        {text}
      </div>
      <div className="text-xl text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
        Listen carefully and spell what you hear!
      </div>
    </div>
  );
};


const FlashcardDisplay = ({ word, translation, language }) => {
  const [flipped, setFlipped] = useState(false);
  
  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <div 
        className="w-80 h-48 cursor-pointer perspective-1000"
        onClick={() => setFlipped(!flipped)}
      >
        <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${flipped ? 'rotate-y-180' : ''}`}>
          {/* Front of card */}
          <div className="absolute w-full h-full bg-gradient-to-br from-cyan-100 to-blue-100 rounded-2xl shadow-xl flex items-center justify-center backface-hidden">
            <div className="text-5xl font-bold text-blue-900" style={{ fontFamily: 'Fredoka, sans-serif' }}>
              {word}
            </div>
          </div>
          
          {/* Back of card */}
          <div className="absolute w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl shadow-xl flex items-center justify-center backface-hidden rotate-y-180">
            <div className="text-5xl font-bold text-purple-900" style={{ fontFamily: 'Fredoka, sans-serif' }}>
              {translation}
            </div>
          </div>
        </div>
      </div>
      
      <p className="text-xl text-gray-600" style={{ fontFamily: 'Poppins, sans-serif' }}>
        👆 Click to flip • {language}
      </p>
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
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#3B82F6'; // Blue color
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);
  
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
      {/* Letter to trace */}
      <div className="text-9xl font-bold text-gray-300 mb-4" style={{ fontFamily: 'Fredoka, sans-serif' }}>
        {letter}
      </div>
      
      {/* Canvas for tracing */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
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
        
        {/* Instructions */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-6xl font-bold text-gray-200" style={{ fontFamily: 'Fredoka, sans-serif' }}>
            {letter}
          </div>
        </div>
      </div>
      
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
        ✏️ Trace the letter, then click Done!
      </p>
    </div>
  );
};

/**
 * StudyBoard Component
 * Visual, actionable workspace for learning activities
 * Displays different content based on visualType
 */
export default function StudyBoard({ visual, visualType, visualColor, isYoung, onInteraction, onSubmit }) {
  if (!visual || visualType === 'none') return null;

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
    <div className="w-full bg-white rounded-2xl border-4 border-gray-200 p-6 mb-4">
      <div className="flex flex-col items-center justify-center min-h-[200px]">
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
        // Add to switch statement:
case 'audio-prompt':
  return (
    <div className="p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50">
      <AudioPromptDisplay text={visual} />
    </div>
  );

case 'flashcard':
  return (
    <div className="p-8 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50">
      <FlashcardDisplay 
        word={visual.word} 
        translation={visual.translation} 
        language={visual.language} 
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
      
      case 'text':
        return <TextDisplay text={visual} isYoung={isYoung} />;
      
      default:
        return <TextDisplay text={String(visual)} isYoung={isYoung} />;
    }
  }
}

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

// Add this after the AdditionEmojiDisplay component

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
  return (
    <div 
      className={`text-center ${isYoung ? 'text-3xl' : 'text-2xl'} font-semibold text-gray-800 px-4`}
      style={{ fontFamily: isYoung ? 'Fredoka, sans-serif' : 'Poppins, sans-serif' }}
    >
      {text}
    </div>
  );
}

/**
 * Usage Examples:
 * 
 * // Letter
 * <StudyBoard visual="A" visualType="letter" />
 * 
 * // Word
 * <StudyBoard visual="CAT" visualType="word" />
 * 
 * // Counting circles
 * <StudyBoard visual={5} visualType="circles" visualColor="green" />
 * 
 * // Addition
 * <StudyBoard visual="3+2" visualType="addition" visualColor="red" />
 * 
 * // Number line
 * <StudyBoard visual={7} visualType="number-line" />
 * 
 * // Multiple choice
 * <StudyBoard 
 *   visual={['Apple', 'Banana', 'Orange']} 
 *   visualType="choice"
 *   onInteraction={(choice) => console.log(choice)}
 * />
 */
