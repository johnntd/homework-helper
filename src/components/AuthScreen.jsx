import React, { useState } from 'react';
import { auth } from '../firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';

const sysFont = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif';

const TOP_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'zh', name: 'Mandarin', flag: '🇨🇳' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
];

const ALL_LANGUAGES = [
  ...TOP_LANGUAGES,
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
];

export default function AuthScreen({ onAuthSuccess }) {
  const [tab, setTab] = useState('signin'); // 'signin' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Registration profile fields
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [language, setLanguage] = useState('en');
  const [wantsSecondLang, setWantsSecondLang] = useState(false);
  const [learningLanguage, setLearningLanguage] = useState('');
  const [showMoreLangs, setShowMoreLangs] = useState(false);
  const [langSearch, setLangSearch] = useState('');

  const friendlyError = (code) => {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential': return 'Email or password is incorrect.';
      case 'auth/email-already-in-use': return 'An account with this email already exists.';
      case 'auth/weak-password': return 'Password must be at least 6 characters.';
      case 'auth/invalid-email': return 'Please enter a valid email address.';
      case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
      default: return 'Something went wrong. Please try again.';
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      onAuthSuccess(cred.user, null);
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Please enter your name.'); return; }
    const ageNum = parseInt(age);
    if (!age || ageNum < 4 || ageNum > 99) { setError('Please enter a valid age (4–99).'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      onAuthSuccess(cred.user, {
        name: name.trim(),
        age: ageNum,
        language,
        learningLanguage: wantsSecondLang ? learningLanguage : '',
      });
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 14px', fontSize: 16,
    border: '1.5px solid #E5E5EA', borderRadius: 12,
    background: '#F9F9F9', color: '#1C1C1E', outline: 'none',
    fontFamily: sysFont, boxSizing: 'border-box',
  };

  const filteredLangs = ALL_LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(langSearch.toLowerCase())
  );

  return (
    <div style={{ height: '100vh', display: 'flex', fontFamily: sysFont, background: '#F2F2F7', overflow: 'hidden' }}>
      {/* Left panel — branding */}
      <div style={{
        width: '38%', background: 'linear-gradient(160deg, #7C3AED 0%, #4F46E5 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '48px 40px', color: '#fff', flexShrink: 0,
      }}>
        <div style={{ fontSize: 72, marginBottom: 20 }}>☀️</div>
        <h1 style={{ fontSize: 38, fontWeight: 800, margin: '0 0 8px', letterSpacing: -0.5 }}>Sunny</h1>
        <p style={{ fontSize: 16, opacity: 0.85, margin: '0 0 48px', textAlign: 'center', lineHeight: 1.5 }}>
          AI learning coach for every child
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: '100%', maxWidth: 280 }}>
          {[
            { icon: '🎯', text: 'Adapts to your level' },
            { icon: '🌍', text: 'Supports 12+ languages' },
            { icon: '📈', text: 'Tracks progress over time' },
            { icon: '🤖', text: 'AI-powered personal tutor' },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>{f.icon}</span>
              <span style={{ fontSize: 14, opacity: 0.9 }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        padding: '40px 56px', background: '#fff', overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: '0 0 6px' }}>
            {tab === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p style={{ fontSize: 14, color: '#8E8E93', margin: '0 0 24px' }}>
            {tab === 'signin'
              ? 'Sign in to continue your learning journey.'
              : 'Set up your account to get started.'}
          </p>

          {/* Tabs */}
          <div style={{ display: 'flex', background: '#F2F2F7', borderRadius: 10, padding: 3, marginBottom: 24 }}>
            {[['signin', 'Sign In'], ['register', 'Create Account']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setTab(key); setError(''); }}
                style={{
                  flex: 1, padding: '8px 12px', border: 'none', cursor: 'pointer', borderRadius: 8,
                  fontSize: 14, fontWeight: 600, fontFamily: sysFont, transition: 'all 0.2s',
                  background: tab === key ? '#fff' : 'transparent',
                  color: tab === key ? '#1C1C1E' : '#8E8E93',
                  boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={tab === 'signin' ? handleSignIn : handleRegister}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>

              {/* Registration-only fields */}
              {tab === 'register' && (
                <>
                  {/* Name */}
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    autoComplete="name"
                    style={inputStyle}
                  />

                  {/* Age */}
                  <input
                    type="number"
                    placeholder="Your age (4–99)"
                    value={age}
                    onChange={e => setAge(e.target.value)}
                    min={4} max={99}
                    required
                    style={inputStyle}
                  />

                  {/* Primary Language */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43', marginBottom: 8 }}>
                      Primary language <span style={{ color: '#8E8E93', fontWeight: 400 }}>(Sunny will speak this)</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {TOP_LANGUAGES.map(lang => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => setLanguage(lang.code)}
                          style={{
                            padding: '10px 8px', borderRadius: 12, border: 'none', cursor: 'pointer',
                            background: language === lang.code ? '#EDE9FE' : '#F5F5F7',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                            outline: language === lang.code ? '2px solid #7C3AED' : 'none',
                            fontFamily: sysFont,
                          }}
                        >
                          <span style={{ fontSize: 22 }}>{lang.flag}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: language === lang.code ? '#7C3AED' : '#3C3C43' }}>
                            {lang.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Learning Language (optional) */}
                  <div style={{ background: '#F9F9F9', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>Learn a second language?</div>
                        <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>Optional — e.g. Spanish for English speakers</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setWantsSecondLang(!wantsSecondLang); if (wantsSecondLang) setLearningLanguage(''); }}
                        style={{
                          width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                          background: wantsSecondLang ? '#7C3AED' : '#E5E5EA',
                          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                        }}
                      >
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%', background: '#fff',
                          position: 'absolute', top: 2, transition: 'left 0.2s',
                          left: wantsSecondLang ? 20 : 2,
                          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                        }} />
                      </button>
                    </div>

                    {wantsSecondLang && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
                          {TOP_LANGUAGES.filter(l => l.code !== language).map(lang => (
                            <button
                              key={lang.code}
                              type="button"
                              onClick={() => setLearningLanguage(lang.code)}
                              style={{
                                padding: '10px 8px', borderRadius: 12, border: 'none', cursor: 'pointer',
                                background: learningLanguage === lang.code ? '#EDE9FE' : '#fff',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                                outline: learningLanguage === lang.code ? '2px solid #7C3AED' : 'none',
                                fontFamily: sysFont,
                              }}
                            >
                              <span style={{ fontSize: 22 }}>{lang.flag}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: learningLanguage === lang.code ? '#7C3AED' : '#3C3C43' }}>
                                {lang.name}
                              </span>
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowMoreLangs(true)}
                          style={{ background: 'none', border: 'none', color: '#7C3AED', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: sysFont }}
                        >
                          More languages...
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Email */}
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={inputStyle}
              />

              {/* Password */}
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                style={inputStyle}
              />
              {tab === 'register' && (
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  style={inputStyle}
                />
              )}
            </div>

            {error && (
              <div style={{
                padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 10, color: '#B91C1C', fontSize: 13, marginBottom: 16, fontFamily: sysFont,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px', fontSize: 16, fontWeight: 600,
                background: loading ? '#C4B5FD' : 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                color: '#fff', border: 'none', borderRadius: 14, cursor: loading ? 'default' : 'pointer',
                fontFamily: sysFont, boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
              }}
            >
              {loading
                ? (tab === 'signin' ? 'Signing in...' : 'Creating account...')
                : (tab === 'signin' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          {tab === 'signin' && (
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#8E8E93' }}>
              No account?{' '}
              <button
                onClick={() => { setTab('register'); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#7C3AED', fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: sysFont }}
              >
                Create one for free
              </button>
            </p>
          )}
        </div>
      </div>

      {/* More languages modal */}
      {showMoreLangs && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', fontFamily: sysFont }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Choose Language</h4>
              <button onClick={() => setShowMoreLangs(false)} style={{ background: '#F2F2F7', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={langSearch}
              onChange={e => setLangSearch(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #E5E5EA', borderRadius: 10, fontSize: 15, fontFamily: sysFont, marginBottom: 12, outline: 'none' }}
            />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredLangs.filter(l => l.code !== language).map(lang => (
                <button
                  key={lang.code}
                  onClick={() => { setLearningLanguage(lang.code); setShowMoreLangs(false); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px', border: 'none', background: learningLanguage === lang.code ? '#EDE9FE' : 'transparent', cursor: 'pointer', borderRadius: 10, fontFamily: sysFont }}
                >
                  <span style={{ fontSize: 24 }}>{lang.flag}</span>
                  <span style={{ fontSize: 15, color: '#1C1C1E' }}>{lang.name}</span>
                  {learningLanguage === lang.code && <span style={{ marginLeft: 'auto', color: '#7C3AED' }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
