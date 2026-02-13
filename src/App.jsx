import React, { useState, useRef } from 'react';
import { Camera, Upload, Send, Sparkles, BookOpen, Trash2, Home } from 'lucide-react';

export default function TutorApp() {
  const [mode, setMode] = useState(null); // 'young' or 'teen'
  const [uploadedImage, setUploadedImage] = useState(null);
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setUploadedImage(null);
  };

  const sendToAI = async () => {
    if (!uploadedImage && !question.trim()) return;

    setIsLoading(true);
    
    const userMessage = {
      role: 'user',
      content: question || 'Can you help me with this homework?',
      image: uploadedImage
    };

    setConversation([...conversation, userMessage]);

    try {
      const messages = [];
      
      if (uploadedImage) {
        const base64Data = uploadedImage.split(',')[1];
        const mediaType = uploadedImage.split(';')[0].split(':')[1];
        
        messages.push({
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data
              }
            },
            {
              type: 'text',
              text: question.trim() || 'Can you help me understand this homework? Please explain it in a way that\'s easy to understand.'
            }
          ]
        });
      } else {
        messages.push({
          role: 'user',
          content: question.trim()
        });
      }

      const systemPrompt = mode === 'young' 
        ? 'You are a friendly, patient tutor for a 5-year-old child. Use simple words, short sentences, and lots of encouragement. Make learning fun with examples they can relate to like toys, animals, and games. Never show the actual homework answers - instead guide them to discover answers themselves through questions and hints.'
        : 'You are a helpful tutor for a 13-year-old student. Be clear and encouraging, but treat them maturely. Break down complex concepts step-by-step. Never just give answers - ask guiding questions to help them think through problems. Use analogies and real-world examples when helpful.';

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: messages
        })
      });

      const data = await response.json();
      
      const aiResponse = {
        role: 'assistant',
        content: data.content[0].text
      };

      setConversation(prev => [...prev, aiResponse]);
      setQuestion('');
      setUploadedImage(null);
      
    } catch (error) {
      console.error('Error:', error);
      const errorResponse = {
        role: 'assistant',
        content: 'Oops! Something went wrong. Please try again!'
      };
      setConversation(prev => [...prev, errorResponse]);
    }
    
    setIsLoading(false);
  };

  const resetChat = () => {
    setConversation([]);
    setUploadedImage(null);
    setQuestion('');
  };

  const goHome = () => {
    setMode(null);
    resetChat();
  };

  if (!mode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center p-6">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap');
          
          .young-card {
            background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%);
            transition: all 0.3s ease;
          }
          .young-card:hover {
            transform: translateY(-8px) scale(1.02);
            box-shadow: 0 20px 40px rgba(255, 107, 107, 0.3);
          }
          
          .teen-card {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            transition: all 0.3s ease;
          }
          .teen-card:hover {
            transform: translateY(-8px) scale(1.02);
            box-shadow: 0 20px 40px rgba(79, 172, 254, 0.3);
          }
          
          .bounce {
            animation: bounce 2s infinite;
          }
          
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
        `}</style>
        
        <div className="text-center max-w-4xl">
          <div className="bounce mb-8">
            <BookOpen className="w-20 h-20 text-orange-500 mx-auto" />
          </div>
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent" style={{ fontFamily: 'Fredoka, sans-serif' }}>
            AI Homework Helper
          </h1>
          <p className="text-xl text-gray-600 mb-12" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Choose your learning mode
          </p>
          
          <div className="grid md:grid-cols-2 gap-8">
            <button
              onClick={() => setMode('young')}
              className="young-card rounded-3xl p-12 text-white shadow-xl"
            >
              <div className="text-7xl mb-4">🎨</div>
              <h2 className="text-4xl font-bold mb-3" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                Little Learner
              </h2>
              <p className="text-xl opacity-90" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Ages 4-7 • Fun & Simple
              </p>
            </button>
            
            <button
              onClick={() => setMode('teen')}
              className="teen-card rounded-3xl p-12 text-white shadow-xl"
            >
              <div className="text-7xl mb-4">🚀</div>
              <h2 className="text-4xl font-bold mb-3" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                Teen Scholar
              </h2>
              <p className="text-xl opacity-90" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Ages 10-15 • In-Depth Help
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isYoung = mode === 'young';
  const themeColors = isYoung 
    ? { primary: 'from-red-400 to-orange-400', bg: 'from-red-50 via-orange-50 to-yellow-50', button: 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600' }
    : { primary: 'from-blue-400 to-cyan-400', bg: 'from-blue-50 via-cyan-50 to-teal-50', button: 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600' };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${themeColors.bg} p-4`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap');
        
        .message-slide-in {
          animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .pulse-button {
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
          }
        }
      `}</style>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className={`w-8 h-8 bg-gradient-to-r ${themeColors.primary} bg-clip-text text-transparent`} />
              <h1 className={`text-3xl font-bold bg-gradient-to-r ${themeColors.primary} bg-clip-text text-transparent`} style={{ fontFamily: 'Fredoka, sans-serif' }}>
                {isYoung ? '🎨 My Helper Friend' : '🚀 Homework Tutor'}
              </h1>
            </div>
            <button
              onClick={goHome}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <Home className="w-5 h-5" />
              <span style={{ fontFamily: 'Poppins, sans-serif' }}>Home</span>
            </button>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Fredoka, sans-serif' }}>
            {isYoung ? '📸 Show Me Your Work!' : '📤 Upload Your Homework'}
          </h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className={`${themeColors.button} text-white rounded-xl p-6 flex flex-col items-center gap-3 transition-all hover:scale-105`}
            >
              <Camera className="w-10 h-10" />
              <span className="font-semibold text-lg" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {isYoung ? 'Take Photo' : 'Camera'}
              </span>
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCameraCapture}
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`${themeColors.button} text-white rounded-xl p-6 flex flex-col items-center gap-3 transition-all hover:scale-105`}
            >
              <Upload className="w-10 h-10" />
              <span className="font-semibold text-lg" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {isYoung ? 'Choose Photo' : 'Upload File'}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {uploadedImage && (
            <div className="relative mb-4 message-slide-in">
              <img 
                src={uploadedImage} 
                alt="Homework" 
                className="w-full rounded-xl border-4 border-gray-200"
              />
              <button
                onClick={clearImage}
                className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          )}

          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={isYoung ? "What do you want to ask? 🤔" : "Ask a question about your homework..."}
            className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none mb-4 text-lg"
            style={{ fontFamily: 'Poppins, sans-serif' }}
            rows="3"
          />

          <button
            onClick={sendToAI}
            disabled={isLoading || (!uploadedImage && !question.trim())}
            className={`w-full ${themeColors.button} text-white rounded-xl p-4 flex items-center justify-center gap-3 font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${!isLoading && (uploadedImage || question.trim()) ? 'pulse-button' : ''}`}
            style={{ fontFamily: 'Fredoka, sans-serif' }}
          >
            {isLoading ? (
              <>
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                Thinking...
              </>
            ) : (
              <>
                <Send className="w-6 h-6" />
                {isYoung ? 'Get Help!' : 'Ask Tutor'}
              </>
            )}
          </button>
        </div>

        {/* Conversation */}
        {conversation.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                {isYoung ? '💬 Our Chat' : '📝 Conversation'}
              </h2>
              <button
                onClick={resetChat}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Clear Chat
              </button>
            </div>
            
            <div className="space-y-4">
              {conversation.map((msg, idx) => (
                <div
                  key={idx}
                  className={`message-slide-in p-4 rounded-xl ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r ' + themeColors.primary + ' text-white ml-8'
                      : 'bg-gray-100 mr-8'
                  }`}
                >
                  {msg.image && (
                    <img src={msg.image} alt="Homework" className="w-32 h-32 object-cover rounded-lg mb-2" />
                  )}
                  <p className="whitespace-pre-wrap" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {msg.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
