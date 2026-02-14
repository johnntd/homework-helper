# 🚀 Quick Start Guide - UPDATED

## ⚠️ Important: API Server Setup

The app now requires **TWO terminals** to run locally:
1. **API Server** (handles Claude AI requests)
2. **Frontend** (the React app)

## 🎯 Instant Start (2 Options)

### Option 1: One Command (Recommended) ⭐

```bash
# 1. Install dependencies
npm install

# 2. Create .env file with your API key
echo "ANTHROPIC_API_KEY=your_key_here" > .env

# 3. Start everything at once!
npm start
```

This runs both the API server AND the frontend automatically!

### Option 2: Manual (Two Terminals)

**Terminal 1 - API Server:**
```bash
npm install
npm run api
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

Then open http://localhost:5173

## 📝 Step-by-Step Setup

### 1. Extract & Navigate
```bash
# Extract the zip file
# Then:
cd homework-helper-react-upgraded
```

### 2. Install Dependencies
```bash
npm install
```

This installs:
- React & Vite (frontend)
- Express (API server)
- Anthropic SDK dependencies

### 3. Create .env File

Create a file named `.env` in the project root:

```bash
# Mac/Linux:
echo "ANTHROPIC_API_KEY=your_actual_key_here" > .env

# Windows:
type nul > .env
# Then edit .env and add: ANTHROPIC_API_KEY=your_actual_key_here
```

**Get your API key:**
1. Go to https://console.anthropic.com
2. Sign up/login
3. Navigate to "API Keys"
4. Create a new key
5. Copy and paste it into `.env`

### 4. Start the App

**Easiest way (one command):**
```bash
npm start
```

You'll see:
```
[0] ✅ API server running on http://localhost:3001
[0] 📡 Ready to handle requests from http://localhost:5173
[1] VITE v4.x.x ready in xxx ms
[1] ➜  Local:   http://localhost:5173/
```

**Or manually (two terminals):**

Terminal 1:
```bash
npm run api
```

Terminal 2:
```bash
npm run dev
```

### 5. Open Browser

Go to: http://localhost:5173

🎉 **You're ready!**

## 🧪 Quick Test

1. Create a user (age 6)
2. Click "Math" or "Reading"
3. You should see questions appear
4. If you get an error, check:
   - Is the API server running? (should see green ✅)
   - Is your .env file correct?
   - Check Terminal 1 for API errors

## 🐛 Common Issues

### "Cannot find module 'express'"
**Fix:** Run `npm install`

### "ANTHROPIC_API_KEY not found"
**Fix:** 
1. Make sure `.env` exists
2. Make sure it has your actual API key
3. Restart both servers

### "POST http://localhost:5173/api/chat 404"
**Fix:** API server not running
```bash
# Stop everything (Ctrl+C)
# Then:
npm start
```

### "Error: connect ECONNREFUSED"
**Fix:** Frontend started before API server
```bash
# Restart in correct order:
# 1. Start API first: npm run api
# 2. Then start frontend: npm run dev
# OR just use: npm start (starts both)
```

### Port already in use
**Fix:** 
- Port 5173: Close other Vite apps
- Port 3001: Close other Node servers
- Or change port in `server.js`

## 📁 What Got Added

New files for local development:
- `server.js` - Local API server
- Updated `package.json` - New dependencies
- Updated `vite.config.js` - API proxy

## 🚀 For Production (Vercel/Netlify)

Don't worry! The `api/chat.js` file still works for deployment.

Vercel/Netlify will use:
- `api/chat.js` (serverless function)

Local development uses:
- `server.js` (Express server)

Both do the same thing!

## 💡 Understanding the Setup

### Why Two Servers?

**Before:**
- Just frontend (no API calls worked locally)

**Now:**
- Frontend: http://localhost:5173 (React app)
- API: http://localhost:3001 (handles /api/chat)

### How It Works:

1. You click "Reading"
2. Frontend sends request to `/api/chat`
3. Vite proxies it to http://localhost:3001/api/chat
4. Express server calls Anthropic API
5. Response comes back to frontend
6. Question appears!

## ✅ Success Checklist

- [ ] Extracted zip file
- [ ] Ran `npm install`
- [ ] Created `.env` with API key
- [ ] Ran `npm start` OR ran both servers manually
- [ ] Saw "✅ API server running" message
- [ ] Saw "VITE ready" message
- [ ] Opened http://localhost:5173
- [ ] Created a user
- [ ] Clicked a subject (Math/Reading)
- [ ] Saw questions appear (not 404 error)

## 🎓 Commands Reference

```bash
# Install dependencies
npm install

# Start both API + Frontend (easiest!)
npm start

# OR start them separately:
npm run api      # Start API server only
npm run dev      # Start frontend only

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🔥 Pro Tips

1. **Always use `npm start`** - It's the easiest way
2. **Check both terminal outputs** - Look for errors in both
3. **API server shows requests** - You'll see POST logs when it works
4. **Restart when changing .env** - Environment changes need restart

## 📞 Need Help?

Check what you see in the terminals:

**Good (API Server):**
```
✅ API server running on http://localhost:3001
📡 Ready to handle requests
```

**Good (Frontend):**
```
VITE ready in 523 ms
➜  Local:   http://localhost:5173/
```

**Bad:**
```
Error: Cannot find module 'express'
→ Run: npm install

Error: ANTHROPIC_API_KEY not found
→ Check your .env file

ECONNREFUSED
→ Start API server first
```

---

**Ready?** Run `npm start` and go! 🚀
