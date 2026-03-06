import React, { useState } from 'react';
import { Plus, LogOut, ChevronRight, X, Check } from 'lucide-react';

const sysFont = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif';

const PROFILE_COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2'];

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

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function ProfileCard({ profile, color, onSelect }) {
  return (
    <button
      onClick={() => onSelect(profile)}
      style={{
        background: '#fff', borderRadius: 20, padding: '24px 20px',
        border: '1.5px solid #F0F0F0', cursor: 'pointer', display: 'flex',
        flexDirection: 'column', alignItems: 'center', gap: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        transition: 'transform 0.15s, box-shadow 0.15s',
        minWidth: 140, fontFamily: sysFont,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; }}
    >
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: `linear-gradient(135deg, ${color}, ${color}aa)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, fontWeight: 700, color: '#fff',
      }}>
        {getInitials(profile.name)}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E' }}>{profile.name}</div>
        <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>Age {profile.age}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: color, fontSize: 12, fontWeight: 500 }}>
        Start learning <ChevronRight style={{ width: 14, height: 14 }} />
      </div>
    </button>
  );
}

function AddProfileModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [language, setLanguage] = useState('en');
  const [learningLanguage, setLearningLanguage] = useState('');
  const [wantsSecondLang, setWantsSecondLang] = useState(false);
  const [showMoreLangs, setShowMoreLangs] = useState(false);
  const [langSearch, setLangSearch] = useState('');

  const canSave = name.trim() && age && parseInt(age) >= 4 && parseInt(age) <= 18;

  const filteredLangs = ALL_LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(langSearch.toLowerCase())
  );

  const inputStyle = {
    width: '100%', padding: '12px 14px', fontSize: 16,
    border: '1.5px solid #E5E5EA', borderRadius: 12,
    background: '#F9F9F9', color: '#1C1C1E', outline: 'none',
    fontFamily: sysFont, boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 520, background: '#fff',
        borderRadius: '24px 24px 0 0', padding: '28px 28px 40px',
        maxHeight: '90vh', overflowY: 'auto', fontFamily: sysFont,
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: '#E5E5EA', borderRadius: 2, margin: '0 auto 24px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Add Child Profile</h3>
          <button onClick={onClose} style={{ background: '#F2F2F7', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 16, height: 16, color: '#3C3C43' }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43', display: 'block', marginBottom: 6 }}>Child's Name</label>
            <input
              type="text"
              placeholder="e.g. Emma"
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
              autoFocus
            />
          </div>

          {/* Age */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43', display: 'block', marginBottom: 6 }}>Age</label>
            <input
              type="number"
              placeholder="4 – 18"
              value={age}
              onChange={e => setAge(e.target.value)}
              min={4} max={18}
              style={inputStyle}
            />
          </div>

          {/* Primary Language */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43', display: 'block', marginBottom: 8 }}>
              Primary Language <span style={{ color: '#8E8E93', fontWeight: 400 }}>(Sunny will speak this language)</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {TOP_LANGUAGES.map(lang => (
                <button
                  key={lang.code}
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
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>Learn a Second Language?</div>
                <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>Optional — e.g. Spanish for English speakers</div>
              </div>
              <button
                onClick={() => { setWantsSecondLang(!wantsSecondLang); if (wantsSecondLang) setLearningLanguage(''); }}
                style={{
                  width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: wantsSecondLang ? '#7C3AED' : '#E5E5EA',
                  position: 'relative', transition: 'background 0.2s',
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
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
                  {TOP_LANGUAGES.filter(l => l.code !== language).map(lang => (
                    <button
                      key={lang.code}
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
                  onClick={() => setShowMoreLangs(true)}
                  style={{ background: 'none', border: 'none', color: '#7C3AED', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: sysFont }}
                >
                  More languages...
                </button>
              </div>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={() => {
              if (!canSave) return;
              onSave({ name: name.trim(), age: parseInt(age), language, learningLanguage: wantsSecondLang ? learningLanguage : '' });
            }}
            disabled={!canSave}
            style={{
              width: '100%', padding: '14px', fontSize: 16, fontWeight: 600,
              background: canSave ? 'linear-gradient(135deg, #7C3AED, #4F46E5)' : '#E5E5EA',
              color: canSave ? '#fff' : '#8E8E93', border: 'none', borderRadius: 14,
              cursor: canSave ? 'pointer' : 'default', fontFamily: sysFont,
              boxShadow: canSave ? '0 4px 16px rgba(124,58,237,0.35)' : 'none',
            }}
          >
            Save Profile
          </button>
        </div>
      </div>

      {/* More languages modal */}
      {showMoreLangs && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 style={{ margin: 0, fontSize: 17, fontWeight: 600, fontFamily: sysFont }}>Choose Language</h4>
              <button onClick={() => setShowMoreLangs(false)} style={{ background: '#F2F2F7', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
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
                  {learningLanguage === lang.code && <Check style={{ width: 16, height: 16, color: '#7C3AED', marginLeft: 'auto' }} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfileSelect({ profiles, onSelectProfile, onAddProfile, onSignOut }) {
  const [showAddModal, setShowAddModal] = useState(profiles.length === 0);

  const handleSave = async (profileData) => {
    await onAddProfile(profileData);
    setShowAddModal(false);
  };

  return (
    <div style={{
      height: '100vh', background: '#F2F2F7', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', fontFamily: sysFont, padding: 24,
    }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>☀️</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E', margin: '0 0 6px', textAlign: 'center' }}>
        Who's learning today?
      </h1>
      <p style={{ fontSize: 15, color: '#8E8E93', margin: '0 0 40px', textAlign: 'center' }}>
        Tap your profile to start
      </p>

      {/* Profile grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginBottom: 32, maxWidth: 600 }}>
        {profiles.map((profile, i) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            color={PROFILE_COLORS[i % PROFILE_COLORS.length]}
            onSelect={onSelectProfile}
          />
        ))}

        {/* Add Profile button */}
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: '#fff', borderRadius: 20, padding: '24px 20px',
            border: '1.5px dashed #C7C7CC', cursor: 'pointer', display: 'flex',
            flexDirection: 'column', alignItems: 'center', gap: 12,
            minWidth: 140, fontFamily: sysFont, color: '#8E8E93',
          }}
        >
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus style={{ width: 28, height: 28, color: '#8E8E93' }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#8E8E93' }}>Add Profile</div>
        </button>
      </div>

      {/* Sign out */}
      <button
        onClick={onSignOut}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#8E8E93', fontSize: 14, fontFamily: sysFont }}
      >
        <LogOut style={{ width: 15, height: 15 }} /> Sign Out
      </button>

      {/* Add Profile modal */}
      {showAddModal && (
        <AddProfileModal
          onSave={handleSave}
          onClose={() => { if (profiles.length > 0) setShowAddModal(false); }}
        />
      )}
    </div>
  );
}
