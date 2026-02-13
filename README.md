# Smart Learning - Adaptive AI Tutor

A comprehensive adaptive learning platform for ages 4-18 with personalized progress tracking.

## Features

### 🎓 **5 Core Subjects**
- **Reading** 📚 - From ABC letters to advanced literary analysis
- **Writing** ✍️ - Letter tracing to academic essays
- **Spelling** 🔤 - Simple words to complex vocabulary
- **Social Skills** 🤝 - Feelings and sharing to emotional intelligence
- **Logic & Problem Solving** 🧩 - Patterns to advanced reasoning

### 🚀 **Adaptive Learning**
- **Age-Based Curriculum**: 4 age groups (4-6, 7-9, 10-13, 14-18)
- **Progress Tracking**: Monitors performance and adjusts difficulty
- **Level Advancement**: Auto-levels up based on accuracy and streaks
- **Persistent Storage**: Saves progress across sessions

### 💡 **Smart Features**
- 🎤 **Voice Input**: Speech-to-text for young learners
- 📸 **Camera Support**: Take photos of homework
- 📤 **File Upload**: Submit work via images/PDFs
- 🎯 **Real-time Feedback**: AI evaluates answers and provides guidance
- ⭐ **Points & Rewards**: Gamified learning experience
- 📊 **Progress Dashboard**: Track points, activities, and levels

## Deploy to Vercel

### 1. Get Your Anthropic API Key
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (you'll need it in step 3)

### 2. Install Vercel CLI (if you haven't already)
```bash
npm install -g vercel
```

### 3. Deploy with API Key
```bash
# Navigate to project folder
cd homework-helper-react

# Deploy and set environment variable
vercel

# When prompted, follow the setup
# Then add your API key as an environment variable:
vercel env add ANTHROPIC_API_KEY

# Paste your API key when prompted
# Choose "Production" environment

# Deploy to production
vercel --prod
```

### 4. Add API Key via Vercel Dashboard (Alternative)
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to Settings → Environment Variables
4. Add new variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: Your Anthropic API key
   - Environment: Production
5. Redeploy your app

## Deploy to Netlify

1. Go to [netlify.com](https://netlify.com)
2. Sign in with GitHub
3. Click "Add new site" → "Import an existing project"
4. Connect your GitHub repository
5. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Click "Deploy"

## Local Development

```bash
npm install
npm run dev
```

Then open http://localhost:5173
