# MeDay Chatbot Setup Guide

This guide shows you how to run the complete chatbot system with 3 different modes:
1. **Hardcoded** (fastest, no setup needed)
2. **Ollama** (local free AI, best for development)
3. **Groq** (cloud AI, needs API key)

---

## 📋 Prerequisites

Make sure you have:
- Node.js installed (for frontend)
- Python 3.8+ installed (for backend)
- VS Code open in the `c:\Users\User1\final-project` folder

---

## 🚀 Quick Start (5 minutes)

### Step 1: Start the Backend

Open a terminal in VS Code and run:

```powershell
# Navigate to backend folder
cd backend

# Install dependencies (if not already done)
pip install -r requirements.txt

# Start the FastAPI server in HARDCODED mode (default)
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Step 2: Start the Frontend

Open a **new terminal** and run:

```powershell
# Navigate to project root
cd ..

# Install dependencies (if not already done)
npm install

# Start Vite dev server
npm run dev
```

You should see:
```
  VITE v4.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

### Step 3: Test the Chatbot

1. Open http://localhost:5173/ in your browser
2. Click the chat bubble (bottom-left corner)
3. Type something like "היי" or "מה תוכלי להמליץ"
4. You should get instant hardcoded responses ✅

---

## 🤖 Modes Explained

### Mode 1: Hardcoded (Current)

**✅ Pros:**
- No setup needed
- Instant responses
- Perfect for testing UI

**❌ Cons:**
- Limited responses
- Not real AI

**To use:** Backend runs in this mode by default!

---

### Mode 2: Ollama (Recommended for Development)

Free, local AI running on your computer. No API keys needed!

#### Setup Ollama:

1. **Download Ollama**: https://ollama.ai
2. **Install** it on your computer
3. **Start Ollama server**:
   ```powershell
   # Ollama will run automatically as a background service
   # Or open the Ollama app
   ```
4. **Pull the model** (first time only):
   ```powershell
   ollama pull mistral
   ```
   This downloads the AI model (~5GB, takes 5-10 minutes)

#### Switch Backend to Ollama Mode:

In VS Code terminal (backend folder):
```powershell
# Set environment variable
$env:CHAT_MODE = "ollama"

# Restart the server
python main.py
```

Or on macOS/Linux:
```bash
export CHAT_MODE=ollama
python main.py
```

#### Verify it works:

1. Backend should show:
   ```
   INFO:     Uvicorn running on http://127.0.0.1:8000
   ```
2. Ollama should be running (check: http://localhost:11434)
3. Chat in the app - you'll get smart AI responses!

**First response takes ~10 seconds (model loading), then ~2-3 seconds per message**

---

### Mode 3: Groq (Cloud AI - Optional)

For production or faster responses with powerful AI.

#### Setup:

1. Get API key from https://console.groq.com/
2. Create `.env` file in backend folder:
   ```
   GROQ_API_KEY=your_api_key_here
   ```
3. Restart backend with:
   ```powershell
   $env:CHAT_MODE = "groq"
   python main.py
   ```

---

## 📁 Project Structure

```
final-project/
├── backend/
│   ├── main.py              ← FastAPI app with /chat endpoint
│   ├── requirements.txt      ← Python dependencies
│   ├── models.py            ← (existing)
│   ├── db.py                ← (existing)
│   ├── Treatments.xlsx      ← Treatment data
│   └── questions.xlsx       ← FAQ data
│
├── src/
│   ├── components/
│   │   └── ChatWidget.jsx   ← Chat UI component
│   ├── api/
│   │   └── medayApi.js      ← sendChat() function
│   ├── App.jsx
│   └── main.jsx
│
├── package.json
├── vite.config.js
└── tailwind.config.js
```

---

## 🔗 How Frontend Connects to Backend

**Frontend Code** (`src/api/medayApi.js`):
```javascript
export async function sendChat(message, context, selectedTreatment, history) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      context,
      selected_treatment_id: selectedTreatment?.id || null,
      history,
    }),
  });
  return res.json();
}
```

**Backend receives** in `/chat` endpoint:
- `message`: User message text
- `context`: User profile (goal, sensitive skin, pregnant)
- `selected_treatment_id`: Which treatment they're viewing
- `history`: Previous messages

**Backend returns** (ChatResponse):
```json
{
  "reply": "Response text",
  "suggested_treatments": [...],
  "sources": null
}
```

---

## 🧪 Testing

### Test 1: Backend is Working
```powershell
curl http://127.0.0.1:8000/health
# Should return: {"ok":true}
```

### Test 2: Chat Endpoint
```powershell
curl -X POST http://127.0.0.1:8000/chat `
  -H "Content-Type: application/json" `
  -d '{"message":"היי"}'
```

### Test 3: In Browser
Go to http://localhost:5173 and click the chat bubble

---

## 🐛 Troubleshooting

### "Connection refused" error in chat
- ❌ Backend not running
- ✅ Make sure backend server is running on http://127.0.0.1:8000

### No response from backend
- ❌ Check CHAT_MODE environment variable
- ✅ Run `echo $env:CHAT_MODE` to verify

### Ollama responses are slow
- ❌ Ollama model not fully loaded
- ✅ First response is slower; send message again

### "Module not found: pandas"
- ❌ Dependencies not installed
- ✅ Run `pip install -r requirements.txt` in backend folder

### Frontend shows "Chat request failed"
- Check browser console (F12) for errors
- Verify backend is running and accessible
- Check CORS settings in `main.py`

---

## 📝 Custom Hardcoded Responses

Want to add more responses? Edit `backend/main.py`:

```python
HARDCODED_RESPONSES = {
    "היי": "Your response here",
    "another question": "Another response",
    "אקנה": "Acne recommendations...",
}
```

Then restart the backend!

---

## 🎯 Next Steps

1. ✅ Test hardcoded mode (should work now)
2. 🔄 Set up Ollama for smart AI responses
3. 📊 Customize hardcoded responses for your clinic
4. 🚀 Deploy when ready

---

## 📞 Quick Reference

| Command | What it does |
|---------|------------|
| `python main.py` | Start backend (hardcoded mode) |
| `$env:CHAT_MODE="ollama"; python main.py` | Start backend (Ollama mode) |
| `npm run dev` | Start frontend |
| `ollama pull mistral` | Download Ollama model |
| `curl http://127.0.0.1:8000/health` | Test backend |

---

**You're all set! 🎉**
