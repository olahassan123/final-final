# MeDay Chatbot - Quick Start

## 3-Step Setup (5 minutes)

### Step 1: Install Dependencies
```powershell
cd backend
pip install -r requirements.txt

cd ..
npm install
```

### Step 2: Start Backend (Terminal 1)
```powershell
cd backend
python main.py
```
✅ You should see: `INFO:     Uvicorn running on http://127.0.0.1:8000`

### Step 3: Start Frontend (Terminal 2)
```powershell
npm run dev
```
✅ You should see: `➜  Local:   http://localhost:5173/`

### Step 4: Test It
1. Open http://localhost:5173
2. Click the 💬 chat bubble (bottom left)
3. Type: "היי" or "עזרי לי"
4. You should get instant responses! ✅

---

## Mode Selection

### Currently Using: HARDCODED MODE (No setup needed)
- Instant responses
- Perfect for testing
- Limited responses

### Want Smart AI? Use OLLAMA (Free & Local)

1. **Install Ollama**:
   - Download from https://ollama.ai
   - Run installer
   - Done!

2. **Download AI Model** (first time - takes 10 min):
   ```powershell
   ollama pull mistral
   ```

3. **Switch Backend to Ollama Mode** (Terminal 1):
   ```powershell
   cd backend
   $env:CHAT_MODE = "ollama"
   python main.py
   ```

4. **Now chat gets smart! 🤖**
   - Responses take 2-3 seconds
   - Handles any question
   - Runs locally (your data stays private)

---

## Files & Code

### ✅ What's Done

**Backend** - `backend/main.py`
```python
CHAT_MODE = "hardcoded"  # Change this to: "ollama", "groq"

@app.post("/chat")  # Main endpoint
def chat(req: ChatRequest):
    # Returns ChatResponse with text reply
```

**Frontend** - `src/components/ChatWidget.jsx`
- Full chat UI with bubbles, input, loading state
- Calls `sendChat(message, context, selectedTreatment, history)`
- Displays bot responses and suggestions

**API Bridge** - `src/api/medayApi.js`
```javascript
export async function sendChat(message, context, selectedTreatment, history) {
  return await fetch("http://127.0.0.1:8000/chat", ...)
}
```

---

## Troubleshooting

**"Chat request failed"**
- Restart backend: `python main.py`
- Check it's running: http://127.0.0.1:8000/health

**Ollama responses slow**
- First response loads model (~10 sec)
- Subsequent responses ~2-3 sec (normal)

**"Module pandas not found"**
- Reinstall: `pip install -r requirements.txt`

---

## What's Connected

```
Frontend (React + Vite)
    ↓ sendChat(message)
    ↓ POST to http://127.0.0.1:8000/chat
Backend (FastAPI)
    ↓ returns ChatResponse
    ↓ with reply, suggestions, sources
Frontend
    ↓ displays in ChatWidget
User sees response! ✅
```

---

**That's it! Your MeDay chatbot is ready!** 🎉  
See `CHATBOT_SETUP.md` for detailed setup.
