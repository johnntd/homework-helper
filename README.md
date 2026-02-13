# AI Homework Helper

An interactive AI-powered tutoring app for kids with two modes:
- **Little Learner** (Ages 4-7): Fun, simple explanations
- **Teen Scholar** (Ages 10-15): In-depth, mature help

## Features
- 📸 Camera capture for homework
- 📤 File upload (images/PDFs)
- 🤖 AI tutoring that guides without giving answers
- 💬 Conversation history

## Deploy to Vercel

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Navigate to project folder:
```bash
cd homework-helper-react
```

3. Install dependencies:
```bash
npm install
```

4. Deploy:
```bash
vercel
```

Follow the prompts, and your app will be live!

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
