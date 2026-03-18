# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start        # Start both servers concurrently (recommended for dev)
npm run api      # Express server only (port 3001)
npm run dev      # Vite dev server only (port 5173)
npm run build    # Production build
```

There are no tests or linting configured.

## Environment

Requires `.env` with `ANTHROPIC_API_KEY`. Optional `BRAVE_SEARCH_API_KEY` for interview prep search. Vite proxies `/api` requests to `http://localhost:3001`.

## Architecture

**Sunny** is a React + Vite single-page app (Tailwind CSS) with an Express proxy server.

### Request flow
Frontend (5173) → Vite proxy → `server.js` (3001) → Anthropic API (`claude-sonnet-4-6`, 4000 max tokens)

### Key files
- **`src/App.jsx`** (~5,960 lines) — monolithic component containing all screens, state, and logic
- **`server.js`** — Express server with two endpoints: `POST /api/chat` (Anthropic proxy) and `POST /api/search` (Brave search)
- **`src/utils/sunnyPrompts.js`** — system prompts for AI tutor
- **`src/utils/translations.js`** — i18n strings for all supported languages
- **`src/hooks/useTurnLoop.js`** — turn-based learning loop logic
- **`src/firebase.js`** — Firebase Auth + Firestore (project: `ai-life-coach-694f9`)

### App screens (in `App.jsx`)
`welcome` → `assessment` → `dashboard` → `activity`

### State management
All state lives in `App.jsx`. Key state: `screen`, `currentUser`, `userProgress`, `selectedLanguage`, `recentUsers`.

Language source of truth priority: `userProgress?.language` > `currentUser?.language` > `selectedLanguage` (persisted to `localStorage` as `tutor:lastLanguage`).

### Grade & age system
- Grades: K, 1–12, college, adult — defined in `GRADES` constant
- Age groups: 4-6, 7-9, 10-13, 14-18, adult — determine AI difficulty
- Age boundaries: `AUTO_SUBMIT_MAX=6`, `TTS_MAX=13`, `TEEN_MIN=13`, `VERY_YOUNG_MAX=7`

### Firebase data
User profiles and progress are stored in Firestore. `loadUserProgress` runs migrations for existing users (e.g. setting `gradeLevel`, `readyForAdvancement`, `advancementStreak` fields).

### Language / speech
- `LANGUAGE_LOCALE_MAP` — maps language codes to BCP-47 strings for both TTS (`utterance.lang`) and `SpeechRecognition.lang`
- `isLearningForeignLanguage` — only applies VERBAL ONLY instructions when `subjectKey === 'languages' && topicId`

### Design conventions
- iOS/iPad-first aesthetic: `#0A84FF` blue, `#F2F2F7` bg, `#1C1C1E` text, `#E5E5EA` border, `#8E8E93` secondary
- System font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, system-ui, sans-serif`
- No decorative fonts (no Fredoka, Poppins), no purple/pink gradients
