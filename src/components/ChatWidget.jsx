import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { sendChat } from "../api/medayApi";
import {
  MessageCircle,
  X,
  Send,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { cn } from "../lib/utils";

// ── Initial greeting + quick-start chips ─────────────────────
const INITIAL_BOT_MSG =
  "היי! אני העוזרת האישית של MeDay 💬\nאיך אני יכולה לעזור לך היום?";

const INITIAL_CHIPS = [
  "טיפולי קוסמטיקה",
  "מניקור ופדיקור",
  "עיצוב שיער",
  "טיפולי גוף",
  "הסרת שיער",
  "איפור מקצועי",
  "איפור קבוע ועיצוב גבות",
  "סטיילינג אישי",
  "טיפולי אסתטיקה",
  "שאלה כללית",
];

// ── Flow state shape ──────────────────────────────────────────
const DEFAULT_FLOW = {
  profile: {},
  mode: "idle",
  category: null,
  currentField: null,
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const [flowState, setFlowState] = useState(DEFAULT_FLOW);
  const [selectedTreatment, setSelectedTreatment] = useState(null);
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState([
    {
      from: "bot",
      text: INITIAL_BOT_MSG,
      chips: INITIAL_CHIPS,
      chipField: null, // null = initial chips, not tied to a specific field
    },
  ]);

  // ── Sync treatment context from treatment pages ───────────────
  useEffect(() => {
    const handleTreatmentSelection = (e) => setSelectedTreatment(e.detail);
    const handleOpenWithQuestion = (e) => {
      setOpen(true);
      handleSend(e.detail, {}, {});
    };
    window.addEventListener("treatmentSelected", handleTreatmentSelection);
    window.addEventListener("openChatWithQuestion", handleOpenWithQuestion);
    return () => {
      window.removeEventListener("treatmentSelected", handleTreatmentSelection);
      window.removeEventListener("openChatWithQuestion", handleOpenWithQuestion);
    };
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // ── Focus input when chat opens ───────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // ── Core send function ────────────────────────────────────────
  async function handleSend(text, chipData = {}, overrideFlowState = null) {
    if (!text.trim() || loading) return;

    const currentFlow = overrideFlowState ?? flowState;

    // Add user message to UI
    setMessages((m) => [...m, { from: "user", text }]);
    setLoading(true);

    try {
      const resp = await sendChat(
        text,
        currentFlow,
        chipData,
        selectedTreatment?.id ?? null,
        messages
      );

      if (!resp?.reply) return;

      // Update flow state from response
      const updatedFlow = {
        profile: resp.profile ?? {},
        mode: resp.mode ?? "idle",
        category: resp.category ?? null,
        currentField: resp.current_field ?? null,
      };
      setFlowState(updatedFlow);

      // Build bot message with chips if returned
      const botMsg = {
        from: "bot",
        text: resp.reply,
        chips: resp.quick_replies ?? null,
        chipField: resp.current_field ?? null,
        recs: resp.suggested_treatments ?? null,
        questionNumber: resp.question_number ?? null,
        totalQuestions: resp.total_questions ?? null,
      };
      setMessages((m) => [...m, botMsg]);
    } catch {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "מצטערת, יש לי תקלה קטנה בחיבור. נסי שוב מאוחר יותר." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // ── Chip tap handler ──────────────────────────────────────────
  function handleChipTap(chipLabel, chipField) {
    if (loading) return;

    const isDontKnow = chipLabel === "לא יודעת";

    // If it's an initial chip (chipField is null), send as plain text
    if (chipField === null) {
      handleSend(chipLabel, {}, flowState);
      return;
    }

    const chipData = {
      chip_field: chipField,
      chip_value: isDontKnow ? "dont_know" : chipLabel,
    };

    handleSend(chipLabel, chipData, flowState);
  }

  // ── Reset ─────────────────────────────────────────────────────
  function resetChat() {
    setFlowState(DEFAULT_FLOW);
    setSelectedTreatment(null);
    setMessages([
      {
        from: "bot",
        text: INITIAL_BOT_MSG,
        chips: INITIAL_CHIPS,
        chipField: null,
      },
    ]);
  }

  // ── Mode badge ────────────────────────────────────────────────
  const modeBadge = {
    questioning: "ממצאת את הטיפול המתאים לך ✨",
    sub_discovery: "בואי נבין ביחד 🔍",
    recommending: "ההמלצות שלי עבורך 💛",
  }[flowState.mode];

  return (
    <div className="fixed bottom-6 left-6 z-[100] font-sans" dir="rtl">
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-110",
          open ? "bg-gray-100 text-gray-600 rotate-90" : "bg-primary text-white"
        )}
      >
        {open ? <X size={28} /> : <MessageCircle size={28} />}
      </button>

      {/* Chat window */}
      {open && (
        <div className="absolute bottom-20 left-0 w-[400px] max-w-[92vw] h-[620px] bg-white rounded-3xl shadow-2xl border border-pink-50 overflow-hidden flex flex-col animate-in slide-in-from-bottom-5">

          {/* Header */}
          <div className="bg-gradient-to-l from-primary to-pink-300 p-5 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xl flex items-center gap-2">
                  <Sparkles size={18} />
                  MeDay AI
                </h3>
                <p className="text-pink-50 text-xs opacity-90 mt-0.5">
                  {modeBadge ?? "ייעוץ חכם בהתאמה אישית"}
                </p>

                {selectedTreatment?.name && (
                  <p className="text-pink-50 text-[11px] font-medium bg-white/10 rounded-full px-2 py-0.5 mt-1.5 inline-block">
                    הקשר: {selectedTreatment.name}
                  </p>
                )}
              </div>

              <button
                onClick={resetChat}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                title="התחלה מחדש"
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 bg-gray-50/50 space-y-4"
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex flex-col",
                  m.from === "user" ? "items-end" : "items-start"
                )}
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
                  {m.from === "bot" ? (
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  ) : (
                    m.text
                  )}
                </div>

                {/* Progress indicator */}
                {m.questionNumber && m.totalQuestions && m.from === "bot" && (
                  <div className="mt-2 flex items-center gap-2 max-w-[88%]">
                    <div className="flex gap-1">
                      {Array.from({ length: m.totalQuestions }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-2 h-2 rounded-full transition-all duration-300",
                            i < m.questionNumber
                              ? "bg-primary"
                              : "bg-gray-200"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-gray-400">
                      שאלה {m.questionNumber} מתוך {m.totalQuestions}
                    </span>
                  </div>
                )}

                {/* Quick-reply chips */}
                {m.chips && m.from === "bot" && (
                  <div className="mt-2 flex flex-wrap gap-2 max-w-[88%]">
                    {m.chips.map((chip) => (
                      <button
                        key={chip}
                        onClick={() => handleChipTap(chip, m.chipField)}
                        disabled={loading || idx !== messages.length - 1}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                          chip === "לא יודעת"
                            ? "border-gray-300 text-gray-500 hover:bg-gray-100"
                            : "border-primary/40 text-primary bg-pink-50 hover:bg-primary hover:text-white",
                          (loading || idx !== messages.length - 1) &&
                            "opacity-40 cursor-not-allowed"
                        )}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}

                {/* Treatment recommendation buttons */}
                {m.recs && (
                  <div className="mt-3 w-full space-y-2">
                    {m.recs.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setSelectedTreatment({ id: r.id, name: r.name });
                          navigate(`/treatments/${r.id}`);
                        }}
                        className="w-full bg-white hover:bg-pink-50 border border-pink-200 p-3 rounded-xl text-right text-sm font-medium text-primary transition-all flex justify-between items-center group shadow-sm"
                      >
                        <span>💆 {r.name}</span>
                        <Sparkles
                          size={14}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </button>
                    ))}
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
            <ChatInput
              ref={inputRef}
              onSend={(text) => handleSend(text, {}, flowState)}
              disabled={loading}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Input component ───────────────────────────────────────────
import { forwardRef } from "react";

const ChatInput = forwardRef(function ChatInput({ onSend, disabled }, ref) {
  const [val, setVal] = useState("");

  const submit = () => {
    if (!val.trim() || disabled) return;
    onSend(val);
    setVal("");
  };

  return (
    <div className="relative flex items-center">
      <input
        ref={ref}
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
});
