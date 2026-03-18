import React, { useState } from 'react';
import { auth } from '../firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';

const sysFont = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif';

const TOP_LANGUAGES = [
  { code: 'en', name: 'English',    flag: '🇺🇸' },
  { code: 'es', name: 'Spanish',    flag: '🇪🇸' },
  { code: 'zh', name: 'Mandarin',   flag: '🇨🇳' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'fr', name: 'French',     flag: '🇫🇷' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
];

const ALL_LANGUAGES = [
  ...TOP_LANGUAGES,
  { code: 'de', name: 'German',   flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean',   flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic',   flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi',    flag: '🇮🇳' },
  { code: 'ru', name: 'Russian',  flag: '🇷🇺' },
];

const AUDIENCES = [
  { key: 'little',   icon: '🧒', label: 'Little Learners', sub: 'Preschool – Grade 5', range: [4, 10],  defaultAge: 7,  color: '#F59E0B', grad: 'linear-gradient(135deg,#FEF3C7,#FDE68A)', border: 'rgba(245,158,11,0.35)' },
  { key: 'student',  icon: '🎒', label: 'Students',        sub: 'Grade 6 – 12',        range: [11, 17], defaultAge: 14, color: '#10B981', grad: 'linear-gradient(135deg,#D1FAE5,#A7F3D0)', border: 'rgba(16,185,129,0.35)'  },
  { key: 'college',  icon: '🎓', label: 'College',         sub: 'University level',    range: [18, 21], defaultAge: 19, color: '#06B6D4', grad: 'linear-gradient(135deg,#CFFAFE,#A5F3FC)', border: 'rgba(6,182,212,0.35)'   },
  { key: 'pro',      icon: '💼', label: 'Professional',    sub: 'Career & skills',     range: [22, 99], defaultAge: 28, color: '#7C3AED', grad: 'linear-gradient(135deg,#EDE9FE,#DDD6FE)', border: 'rgba(124,58,237,0.35)'  },
];

const HERO_FEATURES = [
  { icon: '🧠', text: 'Adaptive AI that learns with you' },
  { icon: '🌍', text: '12+ languages, any subject' },
  { icon: '🎤', text: 'Voice-enabled conversations' },
  { icon: '📈', text: 'Tracks mastery over time' },
];

export default function AuthScreen({ onAuthSuccess }) {
  const [selectedAudience, setSelectedAudience] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState('signin');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [language, setLanguage] = useState('en');
  const [wantsSecondLang, setWantsSecondLang] = useState(false);
  const [learningLanguage, setLearningLanguage] = useState('');
  const [showMoreLangs, setShowMoreLangs] = useState(false);
  const [langSearch, setLangSearch] = useState('');

  const openSheet = (audience) => {
    setSelectedAudience(audience);
    setAge(String(audience.defaultAge));
    setError('');
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setTimeout(() => setSelectedAudience(null), 300);
  };

  const friendlyError = (code) => {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential': return 'Email or password is incorrect.';
      case 'auth/email-already-in-use': return 'An account with this email already exists.';
      case 'auth/weak-password':        return 'Password must be at least 6 characters.';
      case 'auth/invalid-email':        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':    return 'Too many attempts. Please try again later.';
      default:                          return 'Something went wrong. Please try again.';
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

  const filteredLangs = ALL_LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(langSearch.toLowerCase())
  );

  const inputBase = {
    width: '100%', padding: '13px 16px', fontSize: 15,
    border: '1.5px solid #E5E5EA', borderRadius: 14,
    background: '#FAFAFA', color: '#1C1C1E', outline: 'none',
    fontFamily: sysFont, boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };
  const focusInput = (e) => {
    e.target.style.borderColor = '#7C3AED';
    e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.12)';
    e.target.style.background = '#fff';
  };
  const blurInput = (e) => {
    e.target.style.borderColor = '#E5E5EA';
    e.target.style.boxShadow = 'none';
    e.target.style.background = '#FAFAFA';
  };

  const accentColor = selectedAudience?.color || '#7C3AED';

  return (
    <div className="app-bg auth-landing-layout" style={{ fontFamily: sysFont }}>

      {/* ══════════════════════════════════════════
          LEFT HERO PANEL — desktop only (CSS-driven)
          ══════════════════════════════════════════ */}
      <div className="auth-hero-panel">
        {/* Decorative circle accent */}
        <div style={{
          position: 'absolute', top: '30%', right: -40,
          width: 160, height: 160, borderRadius: '50%',
          background: 'rgba(155,168,232,0.18)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: 'linear-gradient(135deg, #6B7FD8 0%, #9BA8E8 50%, #C8A55A 100%)',
          margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          boxShadow: '0 0 0 4px rgba(255,255,255,0.20), 0 0 40px rgba(107,127,216,0.45)',
          animation: 'float 3.5s ease-in-out infinite',
        }}>
          <div style={{
            position: 'absolute', inset: -6, borderRadius: '50%',
            background: 'conic-gradient(from 0deg, #6B7FD8, #9BA8E8, #C8D8F0, #C8A55A, #E8D4A0, #6B7FD8)',
            animation: 'spin 2.8s linear infinite',
            zIndex: 0, opacity: 0.65,
          }} />
          <div style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: 'rgba(61,82,176,0.5)', zIndex: 1 }} />
          <div style={{ position: 'relative', zIndex: 2, fontSize: 44, lineHeight: 1 }}>☀️</div>
        </div>

        {/* Brand name */}
        <h1 style={{
          fontSize: 48, fontWeight: 900, margin: '0 0 10px', letterSpacing: -1.5,
          color: '#fff', textAlign: 'center',
          textShadow: '0 2px 20px rgba(0,0,0,0.2)',
        }}>Sunny</h1>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.72)', margin: '0 0 40px', textAlign: 'center', letterSpacing: 0.1, lineHeight: 1.5 }}>
          Your AI tutor — any age, any subject
        </p>

        {/* Feature list */}
        <div style={{ width: '100%', maxWidth: 320 }}>
          {HERO_FEATURES.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              marginBottom: i < HERO_FEATURES.length - 1 ? 16 : 0,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}>{f.icon}</div>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.88)', lineHeight: 1.4, fontWeight: 500 }}>{f.text}</span>
            </div>
          ))}
        </div>

        {/* Trust line */}
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', margin: '40px 0 0', textAlign: 'center', letterSpacing: 0.3 }}>
          Powered by Claude AI · Free to start
        </p>
      </div>

      {/* ══════════════════════════════════════════
          RIGHT MAIN PANEL (all screen sizes)
          ══════════════════════════════════════════ */}
      <div className="auth-main-panel">

        {/* ── Logo + tagline (mobile only) ── */}
        <div className="auth-logo-mobile" style={{ textAlign: 'center', paddingTop: 48, marginBottom: 28 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6B7FD8 0%, #9BA8E8 50%, #C8A55A 100%)',
            margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
            boxShadow: '0 0 0 3px rgba(255,255,255,0.85), 0 0 32px rgba(107,127,216,0.30)',
            animation: 'float 3.5s ease-in-out infinite',
          }}>
            <div style={{
              position: 'absolute', inset: -5, borderRadius: '50%',
              background: 'conic-gradient(from 0deg, #6B7FD8, #9BA8E8, #C8D8F0, #C8A55A, #E8D4A0, #6B7FD8)',
              animation: 'spin 2.8s linear infinite',
              zIndex: 0, opacity: 0.70,
            }} />
            <div style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: '#F2F4FA', zIndex: 1 }} />
            <div style={{ position: 'relative', zIndex: 2, fontSize: 36, lineHeight: 1 }}>☀️</div>
          </div>
          <h1 style={{
            fontSize: 38, fontWeight: 800, margin: '0 0 6px', letterSpacing: -1.2,
            background: 'linear-gradient(135deg, #1A1F5C 0%, #6B7FD8 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>Sunny</h1>
          <p style={{ fontSize: 15, color: '#8E96C4', margin: 0, letterSpacing: 0.1 }}>
            Your AI tutor — any age, any subject
          </p>
        </div>

        {/* ── "Who are you?" label ── */}
        <p style={{ fontSize: 12, fontWeight: 700, color: '#8E8E93', letterSpacing: 0.7, textTransform: 'uppercase', margin: '0 0 14px', textAlign: 'center' }}>
          Who are you?
        </p>

        {/* ── 4 audience cards ── */}
        <div className="audience-grid">
          {AUDIENCES.map(a => (
            <button key={a.key}
              onClick={() => openSheet(a)}
              className="audience-card"
              style={{
                background: a.grad,
                border: `1.5px solid ${a.border}`,
                boxShadow: `0 4px 20px ${a.border}`,
                fontFamily: sysFont,
              }}
            >
              {/* Subtle inner glow */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 'inherit',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 60%)',
                pointerEvents: 'none',
              }} />
              <div style={{ fontSize: 30, marginBottom: 12, lineHeight: 1, position: 'relative' }}>{a.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1F5C', marginBottom: 4, position: 'relative' }}>{a.label}</div>
              <div style={{ fontSize: 11, color: '#6B6B80', lineHeight: 1.35, position: 'relative' }}>{a.sub}</div>
              {/* Arrow circle */}
              <div style={{
                position: 'absolute', bottom: 14, right: 14,
                width: 24, height: 24, borderRadius: '50%',
                background: `${a.color}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, color: a.color, fontWeight: 800,
              }}>›</div>
            </button>
          ))}
        </div>

        {/* ── Feature pills (mobile / when hero panel not showing) ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', maxWidth: 360, padding: '0 20px', marginBottom: 32 }}>
          {['🌍 12+ Languages', '🎤 Voice enabled', '📈 Tracks progress', '🤖 AI-powered'].map(pill => (
            <span key={pill} style={{
              padding: '5px 13px', borderRadius: 20, fontSize: 11.5, fontWeight: 500,
              background: 'rgba(107,127,216,0.08)', color: '#6B7FD8',
              border: '1px solid rgba(107,127,216,0.16)',
            }}>{pill}</span>
          ))}
        </div>

      </div>{/* end .auth-main-panel */}

      {/* ══════════════════════════════════════════
          BOTTOM SHEET — slides up on card tap
          ══════════════════════════════════════════ */}
      {/* Backdrop */}
      {sheetOpen && (
        <div
          onClick={closeSheet}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.45)',
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* Sheet */}
      <div
        className="auth-sheet"
        data-open={sheetOpen ? "true" : "false"}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201,
          background: '#fff',
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -8px 48px rgba(0,0,0,0.18)',
          maxHeight: '88vh',
          overflowY: 'auto',
          fontFamily: sysFont,
          transform: sheetOpen ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
          padding: '0 0 40px',
        }}>
        {/* Drag handle — hidden on desktop via CSS */}
        <div className="auth-sheet-handle" style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E5EA' }} />
        </div>

        {/* Audience badge header */}
        {selectedAudience && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            margin: '14px 24px 0',
            padding: '10px 14px',
            background: selectedAudience.grad,
            borderRadius: 14,
            border: `1px solid ${selectedAudience.border}`,
          }}>
            <span style={{ fontSize: 22 }}>{selectedAudience.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1F5C' }}>{selectedAudience.label}</div>
              <div style={{ fontSize: 11, color: '#6B6B80' }}>{selectedAudience.sub}</div>
            </div>
            <button onClick={closeSheet} style={{
              marginLeft: 'auto', background: 'rgba(0,0,0,0.06)', border: 'none',
              borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3C3C43',
            }}>✕</button>
          </div>
        )}

        <div style={{ padding: '20px 24px 0' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', background: '#F2F2F7', borderRadius: 12, padding: 3, marginBottom: 22 }}>
            {[['signin', 'Sign In'], ['register', 'Create Account']].map(([key, label]) => (
              <button key={key}
                onClick={() => { setTab(key); setError(''); }}
                style={{
                  flex: 1, padding: '9px 12px', border: 'none', cursor: 'pointer', borderRadius: 10,
                  fontSize: 14, fontWeight: 600, fontFamily: sysFont, transition: 'all 0.2s',
                  background: tab === key ? '#fff' : 'transparent',
                  color: tab === key ? '#1C1C1E' : '#8E8E93',
                  boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                }}>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={tab === 'signin' ? handleSignIn : handleRegister}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 18 }}>

              {tab === 'register' && (
                <>
                  <input type="text" placeholder="Your name"
                    value={name} onChange={e => setName(e.target.value)}
                    required autoComplete="name"
                    style={inputBase} onFocus={focusInput} onBlur={blurInput}
                  />

                  <input type="number" placeholder={`Age (${selectedAudience?.range[0]}–${selectedAudience?.range[1] > 50 ? '99' : selectedAudience?.range[1]})`}
                    value={age} onChange={e => setAge(e.target.value)}
                    min={4} max={99} required
                    style={inputBase} onFocus={focusInput} onBlur={blurInput}
                  />

                  {/* Primary language chips */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43', marginBottom: 8 }}>
                      My language
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
                      {TOP_LANGUAGES.map(lang => (
                        <button key={lang.code} type="button"
                          onClick={() => setLanguage(lang.code)}
                          style={{
                            padding: '9px 6px', borderRadius: 12, border: 'none', cursor: 'pointer',
                            background: language === lang.code ? '#EDE9FE' : '#F5F5F7',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                            outline: language === lang.code ? `2px solid ${accentColor}` : 'none',
                            fontFamily: sysFont, transition: 'all 0.15s',
                          }}>
                          <span style={{ fontSize: 20 }}>{lang.flag}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: language === lang.code ? accentColor : '#3C3C43' }}>
                            {lang.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Learn a second language toggle */}
                  <div style={{ background: '#F9F9F9', borderRadius: 14, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>Learn a language?</div>
                        <div style={{ fontSize: 11, color: '#8E8E93', marginTop: 1 }}>Optional — e.g. English for Spanish speakers</div>
                      </div>
                      <button type="button"
                        onClick={() => { setWantsSecondLang(!wantsSecondLang); if (wantsSecondLang) setLearningLanguage(''); }}
                        style={{
                          width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                          background: wantsSecondLang ? accentColor : '#E5E5EA',
                          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                        }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%', background: '#fff',
                          position: 'absolute', top: 2, transition: 'left 0.2s',
                          left: wantsSecondLang ? 20 : 2,
                          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                        }} />
                      </button>
                    </div>
                    {wantsSecondLang && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7, marginBottom: 7 }}>
                          {TOP_LANGUAGES.filter(l => l.code !== language).map(lang => (
                            <button key={lang.code} type="button"
                              onClick={() => setLearningLanguage(lang.code)}
                              style={{
                                padding: '9px 6px', borderRadius: 12, border: 'none', cursor: 'pointer',
                                background: learningLanguage === lang.code ? '#EDE9FE' : '#fff',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                                outline: learningLanguage === lang.code ? `2px solid ${accentColor}` : 'none',
                                fontFamily: sysFont, transition: 'all 0.15s',
                              }}>
                              <span style={{ fontSize: 20 }}>{lang.flag}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: learningLanguage === lang.code ? accentColor : '#3C3C43' }}>
                                {lang.name}
                              </span>
                            </button>
                          ))}
                        </div>
                        <button type="button"
                          onClick={() => setShowMoreLangs(true)}
                          style={{ background: 'none', border: 'none', color: accentColor, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: sysFont }}>
                          More languages...
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              <input type="email" placeholder="Email address"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email"
                style={inputBase} onFocus={focusInput} onBlur={blurInput}
              />
              <input type="password" placeholder="Password"
                value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                style={inputBase} onFocus={focusInput} onBlur={blurInput}
              />
              {tab === 'register' && (
                <input type="password" placeholder="Confirm password"
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  required autoComplete="new-password"
                  style={inputBase} onFocus={focusInput} onBlur={blurInput}
                />
              )}
            </div>

            {error && (
              <div style={{
                padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 10, color: '#B91C1C', fontSize: 13, marginBottom: 14,
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '15px', fontSize: 16, fontWeight: 700,
              background: loading ? '#C4B5FD' : `linear-gradient(135deg, ${accentColor}, #4F46E5)`,
              color: '#fff', border: 'none', borderRadius: 14,
              cursor: loading ? 'default' : 'pointer', fontFamily: sysFont,
              boxShadow: loading ? 'none' : `0 4px 20px ${accentColor}55`,
              transition: 'all 0.2s',
            }}>
              {loading
                ? (tab === 'signin' ? 'Signing in...' : 'Creating account...')
                : (tab === 'signin' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#8E8E93' }}>
            {tab === 'signin' ? (
              <>No account?{' '}
                <button onClick={() => { setTab('register'); setError(''); }}
                  style={{ background: 'none', border: 'none', color: accentColor, fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: sysFont }}>
                  Create one free
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => { setTab('signin'); setError(''); }}
                  style={{ background: 'none', border: 'none', color: accentColor, fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: sysFont }}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      {/* ── More languages modal ── */}
      {showMoreLangs && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', fontFamily: sysFont }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Choose Language</h4>
              <button onClick={() => setShowMoreLangs(false)}
                style={{ background: '#F2F2F7', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <input type="text" placeholder="Search..."
              value={langSearch} onChange={e => setLangSearch(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #E5E5EA', borderRadius: 10, fontSize: 15, fontFamily: sysFont, marginBottom: 12, outline: 'none' }}
            />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredLangs.filter(l => l.code !== language).map(lang => (
                <button key={lang.code}
                  onClick={() => { setLearningLanguage(lang.code); setShowMoreLangs(false); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px', border: 'none', background: learningLanguage === lang.code ? '#EDE9FE' : 'transparent', cursor: 'pointer', borderRadius: 10, fontFamily: sysFont }}>
                  <span style={{ fontSize: 24 }}>{lang.flag}</span>
                  <span style={{ fontSize: 15, color: '#1C1C1E' }}>{lang.name}</span>
                  {learningLanguage === lang.code && <span style={{ marginLeft: 'auto', color: accentColor }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
