import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // נוסיף ניווט לטיפולים
import { sendChat } from "../api/medayApi";
import { MessageCircle, X, Send, RotateCcw, Sparkles, User, Bot } from "lucide-react";
import { cn } from "../lib/utils"; // שימוש בפונקציית העזר שיצרנו

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  const [profile, setProfile] = useState({ goal: null, sensitive: null, pregnant: null });
  const [pending, setPending] = useState(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      from: "bot",
      text: "היי! אני העוזרת האישית של MeDay 💬\nספרי לי מה המטרה שלך היום? (לחות, זוהר, אקנה, אנטי-אייג'ינג...)",
    },
  ]);

  // גלילה אוטומטית להודעה האחרונה
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // פונקציות העזר שלך (normalize, isYes, וכו') נשארות אותו דבר
  function normalize(s) { return (s || "").toString().toLowerCase().replace(/[?؟!.,:;()"'’“”]/g, "").trim(); }
  function isYes(text) { const ans = normalize(text); return ["yes", "כן", "y", "ok", "sure", "בטח"].some((w) => ans === normalize(w)); }
  function isNo(text) { const ans = normalize(text); return ["no", "לא", "n"].some((w) => ans === normalize(w)); }

  function addMessage(from, text, recs = null) {
    setMessages((m) => [...m, { from, text, recs }]);
  }

  async function handleUserText(text) {
    if (!text.trim()) return;
    addMessage("user", text);
    setLoading(true);

    try {
      // כאן נכנסת הלוגיקה שלך לחיבור ל-FastAPI
      const resp = await sendChat(text, profile);
      
      if (resp?.reply) {
        addMessage("bot", resp.reply, resp.suggested_treatments);
      }
    } catch (e) {
      addMessage("bot", "מצטערת, יש לי תקלה קטנה בחיבור. נסי שוב מאוחר יותר.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 left-6 z-[100] font-sans" dir="rtl">
      {/* כפתור הפתיחה */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-110",
          open ? "bg-gray-100 text-gray-600 rotate-90" : "bg-primary text-white"
        )}
      >
        {open ? <X size={28} /> : <MessageCircle size={28} />}
      </button>

      {/* חלון הצ'אט */}
      {open && (
        <div className="absolute bottom-20 left-0 w-[380px] max-w-[90vw] h-[600px] bg-white rounded-3xl shadow-2xl border border-pink-50 overflow-hidden flex flex-col animate-in slide-in-from-bottom-5">
          
          {/* Header */}
          <div className="bg-gradient-to-l from-primary to-pink-300 p-6 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xl flex items-center gap-2">
                  <Sparkles size={18} />
                  MeDay AI
                </h3>
                <p className="text-pink-50 text-xs opacity-90 mt-1">ייעוץ חכם בהתאמה אישית</p>
              </div>
              <button onClick={() => setProfile({ goal: null, sensitive: null, pregnant: null })} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <RotateCcw size={18} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 bg-gray-50/50 space-y-4">
            {messages.map((m, idx) => (
              <div key={idx} className={cn("flex flex-col", m.from === "user" ? "items-end" : "items-start")}>
                <div className={cn(
                  "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed",
                  m.from === "user" 
                    ? "bg-primary text-white rounded-tl-none shadow-md" 
                    : "bg-white text-gray-800 border border-pink-100 rounded-tr-none shadow-sm"
                )}>
                  {m.text}
                </div>

                {/* המלצות על טיפולים - כפתורים מעוצבים */}
                {m.recs && (
                  <div className="mt-3 w-full space-y-2">
                    {m.recs.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => navigate(`/treatments/${r.id}`)}
                        className="w-full bg-white hover:bg-pink-50 border border-pink-200 p-3 rounded-xl text-right text-sm font-medium text-primary transition-all flex justify-between items-center group"
                      >
                        <span>טיפול מומלץ: {r.name}</span>
                        <Sparkles size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-1 items-center p-2 text-gray-400">
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-100">
            <ChatInput onSend={handleUserText} disabled={loading} />
          </div>
        </div>
      )}
    </div>
  );
}

function ChatInput({ onSend, disabled }) {
  const [val, setVal] = useState("");

  const submit = () => {
    if (!val.trim() || disabled) return;
    onSend(val);
    setVal("");
  };

  return (
    <div className="relative flex items-center">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="כתבי לנו כאן..."
        disabled={disabled}
        className="w-full bg-gray-100 border-none rounded-2xl py-3 pr-4 pl-12 focus:ring-2 focus:ring-primary/20 text-sm"
      />
      <button
        onClick={submit}
        disabled={disabled || !val.trim()}
        className="absolute left-2 p-2 text-primary hover:text-pink-600 disabled:text-gray-300 transition-colors"
      >
        <Send size={20} className="rotate-180" />
      </button>
    </div>
  );
}