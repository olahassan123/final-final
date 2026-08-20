import { useRef, useState, useEffect, forwardRef } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { sendChat, getChatCategories, clearChatSession } from "../api/medayApi";
import { MessageCircle, X, Send, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import { openAppointmentWhatsApp } from "../lib/booking";

const SESSION_KEY = "meday_chat_session_id";
const MAX_MESSAGE_CHARS = 1000;
const LONG_MESSAGE_TEXT = "ההודעה ארוכה מדי. נסי לקצר אותה.";
const RATE_LIMIT_TEXT = "נשלחו יותר מדי הודעות בזמן קצר. נסי שוב בעוד רגע.";
const CONNECTION_ERROR_TEXT = "מצטערת, יש כרגע תקלה בחיבור. אפשר לנסות שוב בעוד רגע.";
const DISCLAIMER_TEXT = "המידע בצ׳אט נועד להכוונה כללית בלבד ואינו מחליף ייעוץ מקצועי מהקליניקה.";

function getOrCreateSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// Category options shown on the welcome screen. Clicking one sends the category
// name → the bot replies with that category's description. Mirrors the
// Categories sheet; kept in sync dynamically on open (see fetch in the widget).
const WELCOME_CATEGORIES = [
  "מניקור ופדיקור",
  "עיצוב שיער",
  "טיפולי קוסמטיקה",
  "טיפולי גוף",
  "הסרת שיער",
  "איפור מקצועי",
  "איפור קבוע ועיצוב גבות",
  "סטיילינג אישי",
  "טיפולי אסתטיקה",
];

const WELCOME_MSG = {
  from: "bot",
  text: "היי, אני העוזרת האישית של MeDay ✨\nאשמח לעזור לך למצוא את הטיפול שהכי מתאים למה שאת/ה מחפש/ת.",
  suggestions: WELCOME_CATEGORIES,
};

export default function ChatWidget() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(getOrCreateSessionId);
  const [selectedTreatment, setSelectedTreatment] = useState(null);
  const selectedTreatmentRef = useRef(null);
  const inFlightRequestRef = useRef(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    selectedTreatmentRef.current = selectedTreatment;
  }, [selectedTreatment]);

  useEffect(() => {
    if (window.__medaySelectedTreatment) {
      setSelectedTreatment(window.__medaySelectedTreatment);
      selectedTreatmentRef.current = window.__medaySelectedTreatment;
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // Sync welcome category chips with the backend (falls back to hardcoded list)
  useEffect(() => {
    getChatCategories()
      .then((cats) => {
        if (cats?.length) {
          setMessages((m) =>
            m.length && m[0].from === "bot"
              ? [{ ...m[0], suggestions: cats }, ...m.slice(1)]
              : m
          );
        }
      })
      .catch(() => {});
  }, []);

  // Listen for external "open chat" events (from treatment pages etc.)
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    const handleTreatmentSelected = (e) => {
      if (!e.detail) return;
      setSelectedTreatment({
        id: e.detail.id || null,
        name: e.detail.name || null,
      });
      selectedTreatmentRef.current = {
        id: e.detail.id || null,
        name: e.detail.name || null,
      };
    };
    const handleOpenWithQuestion = (e) => {
      setOpen(true);
      if (e.detail) _send(e.detail, null, null);
    };
    window.addEventListener("openChatbot", handleOpen);
    window.addEventListener("treatmentSelected", handleTreatmentSelected);
    window.addEventListener("openChatWithQuestion", handleOpenWithQuestion);
    return () => {
      window.removeEventListener("openChatbot", handleOpen);
      window.removeEventListener("treatmentSelected", handleTreatmentSelected);
      window.removeEventListener("openChatWithQuestion", handleOpenWithQuestion);
    };
  }, []);

  async function _send(message, buttonValue, questionId, selectedTreatmentOverride = null) {
    if (loading || inFlightRequestRef.current) return;
    if (!message && !buttonValue) return;
    if (message && message.length > MAX_MESSAGE_CHARS) {
      setMessages((m) => [...m, { from: "bot", text: LONG_MESSAGE_TEXT }]);
      return;
    }

    if (message) {
      setMessages((m) => [...m, { from: "user", text: message }]);
    }
    inFlightRequestRef.current = true;
    setLoading(true);

    try {
      const resp = await sendChat(
        sessionId,
        message,
        buttonValue,
        questionId,
        selectedTreatmentOverride || selectedTreatmentRef.current
      );
      if (!resp?.reply) return;

      const botMsg = {
        from: "bot",
        text: resp.reply,
        buttons: resp.buttons || null,
        suggestions: resp.suggestions || null,
        treatments: resp.treatments || null,
        offerContinue: resp.offer_continue || null,
        questionProgress: resp.question_progress || null,
        mode: resp.mode,
      };
      setMessages((m) => [...m, botMsg]);
    } catch (error) {
      setMessages((m) => [
        ...m,
        {
          from: "bot",
          text:
            error?.status === 429
              ? RATE_LIMIT_TEXT
              : error?.status === 413
                ? LONG_MESSAGE_TEXT
                : CONNECTION_ERROR_TEXT,
        },
      ]);
    } finally {
      inFlightRequestRef.current = false;
      setLoading(false);
    }
  }

  function handleTextSend(text) {
    if (!text.trim() || loading) return;
    _send(text.trim(), null, null);
  }

  function handleButton(btn) {
    if (loading) return;
    if (btn.action === "open_booking_whatsapp" || btn.value === "__open_booking_whatsapp__") {
      openAppointmentWhatsApp();
      return;
    }
    if (btn.action === "open_contact" || btn.value === "__open_contact__") {
      setOpen(false);
      navigate("/#contact");
      return;
    }
    if (btn.action === "call_clinic" || btn.value === "__call_clinic__") {
      window.location.href = "tel:*3691";
      return;
    }
    setMessages((m) => [...m, { from: "user", text: btn.label }]);
    _send(null, btn.value, btn.question_id || null);
  }

  function handleTreatmentQuestion(treatment) {
    if (loading || !treatment?.id || !treatment?.name) return;
    const context = { id: treatment.id, name: treatment.name };
    setSelectedTreatment(context);
    selectedTreatmentRef.current = context;
    window.__medaySelectedTreatment = context;
    setMessages((m) => [...m, { from: "user", text: `יש לי שאלה על טיפול ${treatment.name}` }]);
    _send(null, `__ask_treatment__:${treatment.id}`, null, context);
  }

  // "לפרטי הטיפול" answers inline, in the chat — it never navigates away.
  // The backend returns a short, data-only card (name + description + who
  // it's for) built straight from the clinic's records, never generated text.
  function handleTreatmentInfo(treatment) {
    if (loading || !treatment?.id || !treatment?.name) return;
    const context = { id: treatment.id, name: treatment.name };
    setSelectedTreatment(context);
    selectedTreatmentRef.current = context;
    window.__medaySelectedTreatment = context;
    setMessages((m) => [...m, { from: "user", text: `לפרטים על טיפול ${treatment.name}` }]);
    _send(null, `__treatment_info__:${treatment.id}`, null, context);
  }

  function handleContinue(catId) {
    _send(null, "__continue__", null);
  }

  function handleNotNow() {
    _send(null, "__not_now__", null);
  }

  function handleRestart(catId) {
    _send(null, "__restart__", null);
  }

  async function resetChat() {
    const oldSessionId = sessionId;
    localStorage.removeItem(SESSION_KEY);
    const newId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, newId);
    setSessionId(newId);
    setSelectedTreatment(null);
    selectedTreatmentRef.current = null;
    inFlightRequestRef.current = false;
    window.__medaySelectedTreatment = null;
    setMessages([WELCOME_MSG]);
    setLoading(false);
    await clearChatSession(oldSessionId);
  }

  return (
    <div className="fixed bottom-6 left-6 z-[140] font-sans" dir="rtl">
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "סגירת הצ׳אט" : "פתיחת הצ׳אט"}
        className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-110",
          open ? "bg-gray-100 text-gray-600" : "bg-primary text-white"
        )}
      >
        {open ? <X size={28} /> : <MessageCircle size={28} />}
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-24 left-4 right-4 h-[min(640px,calc(100vh-8rem))] max-h-[calc(100vh-8rem)] overflow-hidden rounded-3xl border border-pink-50 bg-white shadow-2xl flex flex-col animate-in slide-in-from-bottom-5 sm:left-6 sm:right-auto sm:w-[400px]">

          {/* Header */}
          <div className="bg-gradient-to-l from-primary to-pink-300 p-5 text-white flex justify-between items-center">
            <div>
              <h3 className="font-bold text-xl flex items-center gap-2">
                <Sparkles size={18} />
                MeDay AI
              </h3>
              <p className="text-pink-50 text-xs opacity-90 mt-0.5">ייעוץ חכם בהתאמה אישית</p>
            </div>
            <button
              onClick={resetChat}
              aria-label="שיחה חדשה"
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              title="שיחה חדשה"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 bg-gray-50/50 space-y-4">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={cn("flex flex-col", m.from === "user" ? "items-end" : "items-start")}
              >
                {/* Bubble */}
                <div
                  className={cn(
                    "max-w-[88%] p-4 rounded-2xl text-sm leading-relaxed",
                    m.from === "user"
                      ? "bg-primary text-white rounded-tl-none shadow-md"
                      : "bg-white text-gray-800 border border-pink-100 rounded-tr-none shadow-sm prose prose-sm max-w-none"
                  )}
                >
                  {m.from === "bot" ? <ReactMarkdown>{m.text}</ReactMarkdown> : m.text}
                </div>

                {/* Progress dots for recommendation flow */}
                {m.from === "bot" && m.questionProgress && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex gap-1">
                      {Array.from({ length: m.questionProgress.total }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-2 h-2 rounded-full transition-all duration-300",
                            i < m.questionProgress.current ? "bg-primary" : "bg-gray-200"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-gray-400">
                      שאלה {m.questionProgress.current} מתוך {m.questionProgress.total}
                    </span>
                  </div>
                )}

                {/* Recommendation flow buttons */}
                {m.from === "bot" && m.buttons && idx === messages.length - 1 && (
                  <div className="mt-2 flex flex-wrap gap-2 max-w-[88%]">
                    {m.buttons.map((btn) => (
                      <button
                        key={btn.value}
                        onClick={() => handleButton(btn)}
                        disabled={loading}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                          "border-primary/40 text-primary bg-pink-50 hover:bg-primary hover:text-white",
                          loading && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Soft suggestion chips — send free text, non-binding guidance */}
                {m.from === "bot" && m.suggestions && idx === messages.length - 1 && (
                  <div className="mt-2 flex flex-wrap gap-2 max-w-[88%]">
                    {m.suggestions.map((text) => (
                      <button
                        key={text}
                        onClick={() => handleTextSend(text)}
                        disabled={loading}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border border-dashed transition-all",
                          "border-gray-300 text-gray-500 bg-white hover:border-primary/50 hover:text-primary hover:bg-pink-50/60",
                          loading && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                )}

                {m.from === "bot" && m.treatments && idx === messages.length - 1 && (
                  <div className="mt-3 grid w-full max-w-[88%] gap-2">
                    {m.treatments
                      .slice(0, 3)
                      .map((treatment) => (
                        <div
                          key={`${treatment.id}-${treatment.name}`}
                          className="rounded-2xl border border-pink-100 bg-white p-3 text-right shadow-sm"
                        >
                          <p className="text-sm font-bold text-gray-800">{treatment.name}</p>
                          {treatment.reason && (
                            <p className="mt-1 text-xs leading-relaxed text-gray-600">{treatment.reason}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {treatment.id && !treatment.info_shown && (
                              <button
                                type="button"
                                onClick={() => handleTreatmentInfo(treatment)}
                                disabled={loading}
                                className="px-3 py-1.5 rounded-full text-xs font-medium border border-primary/40 text-primary bg-white hover:bg-pink-50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40"
                              >
                                לפרטי הטיפול
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleTreatmentQuestion(treatment)}
                              disabled={loading}
                              className="px-3 py-1.5 rounded-full text-xs font-medium border border-gray-300 text-gray-500 bg-white hover:border-primary/50 hover:text-primary hover:bg-pink-50/60 transition-all disabled:opacity-40"
                            >
                              יש לי שאלה
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Continue / Restart / Not now offer */}
                {m.from === "bot" && m.offerContinue && idx === messages.length - 1 && (
                  <div className="mt-3 max-w-[88%] bg-pink-50 border border-pink-200 rounded-2xl p-3 space-y-2">
                    <p className="text-xs text-gray-600 font-medium">
                      יש לי שאלון שהתחלת עבור{" "}
                      <span className="text-primary">{m.offerContinue.category_name}</span>
                      {m.offerContinue.questions_answered > 0 &&
                        ` (${m.offerContinue.questions_answered} שאלות ענית)`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleContinue(m.offerContinue.category_id)}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-white hover:bg-pink-700 transition-all disabled:opacity-40"
                      >
                        המשך שאלון
                      </button>
                      <button
                        onClick={() => handleRestart(m.offerContinue.category_id)}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border border-primary/40 text-primary hover:bg-pink-100 transition-all disabled:opacity-40"
                      >
                        התחל מחדש
                      </button>
                      <button
                        onClick={handleNotNow}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border border-gray-300 text-gray-500 hover:bg-gray-100 transition-all disabled:opacity-40"
                      >
                        לא עכשיו
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-1 items-center p-2 text-gray-400">
                <span className="w-2 h-2 bg-pink-300 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-pink-300 rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-2 h-2 bg-pink-300 rounded-full animate-bounce [animation-delay:0.3s]" />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-gray-100">
            <p className="mb-2 text-[11px] leading-relaxed text-gray-500">
              {DISCLAIMER_TEXT}
            </p>
            <ChatInput ref={inputRef} onSend={handleTextSend} disabled={loading} />
          </div>
        </div>
      )}
    </div>
  );
}

const ChatInput = forwardRef(function ChatInput({ onSend, disabled }, ref) {
  const [val, setVal] = useState("");

  const submit = () => {
    if (!val.trim() || disabled) return;
    onSend(val);
    setVal("");
  };

  return (
    <div className="relative flex items-center">
      <textarea
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="כתבי לנו כאן..."
        disabled={disabled}
        rows={1}
        aria-label="כתיבת הודעה לצ׳אט"
        className="min-h-[46px] max-h-28 w-full resize-none bg-gray-100 border-none rounded-2xl py-3 pr-4 pl-12 focus:ring-2 focus:ring-primary/20 focus:outline-none text-sm"
      />
      <button
        onClick={submit}
        disabled={disabled || !val.trim()}
        aria-label="שליחת הודעה"
        className="absolute left-2 p-2 text-primary hover:text-pink-600 disabled:text-gray-300 transition-colors"
      >
        <Send size={20} className="rotate-180" />
      </button>
    </div>
  );
});
