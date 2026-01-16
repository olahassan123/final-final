import { useMemo, useRef, useState } from "react";
import { sendChat } from "../api/medayApi";

function normalize(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/[?؟!.,:;()"'’“”]/g, "")
    .trim();
}

function isYes(text) {
  const ans = normalize(text);
  return ["yes", "כן", "y", "ok", "sure"].some((w) => ans === normalize(w));
}

function isNo(text) {
  const ans = normalize(text);
  return ["no", "לא", "n"].some((w) => ans === normalize(w));
}

export default function ChatWidget({ onOpenTreatment }) {
  const [open, setOpen] = useState(false);

  // Conversation memory (frontend context we send to backend)
  const [profile, setProfile] = useState({
    goal: null,       // hydration/glow/acne/antiaging/calm
    sensitive: null,  // true/false
    pregnant: null,   // true/false
  });

  const [pending, setPending] = useState(null);
  // pending = { type: "sensitive" | "pregnant", prompt: "...", after: "chat" }

  const [messages, setMessages] = useState([
    {
      from: "bot",
      text:
        "Hi! I’m MeDay Assistant 💬\nNow I answer using the real backend (DB imported from Excel).\nTell me your goal (לחות / זוהר / אקנה / אנטי אייג׳ינג) 🙂",
    },
  ]);

  const [loading, setLoading] = useState(false);
  const lastSuggestionsRef = useRef([]); // to keep last suggestions list if needed

  function addMessage(from, text) {
    setMessages((m) => [...m, { from, text }]);
  }

  function addRecs(recs) {
    lastSuggestionsRef.current = recs || [];
    setMessages((m) => [
      ...m,
      {
        from: "recs",
        recs: (recs || []).map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
        })),
      },
    ]);
  }

  function setFollowup(type) {
    if (type === "sensitive") {
      setPending({
        type: "sensitive",
        prompt: "Do you have sensitive skin? (Yes/No) / هل بشرتك حساسة؟",
        after: "chat",
      });
      addMessage("bot", "Before we continue: Do you have sensitive skin? (Yes/No)");
    } else if (type === "pregnant") {
      setPending({
        type: "pregnant",
        prompt: "Are you pregnant or breastfeeding? (Yes/No) / هل في حمل أو رضاعة؟",
        after: "chat",
      });
      addMessage("bot", "Quick safety check: Are you pregnant or breastfeeding? (Yes/No)");
    }
  }

  function detectGoal(text) {
    const t = normalize(text);
    if (t.includes("לחות") || t.includes("hydration") || t.includes("hydrate")) return "hydration";
    if (t.includes("זוהר") || t.includes("glow") || t.includes("radiant")) return "glow";
    if (t.includes("אקנה") || t.includes("acne") || t.includes("pimples")) return "acne";
    if (t.includes("אנטי") || t.includes("aging") || t.includes("קמטים") || t.includes("lifting") || t.includes("מיצוק"))
      return "antiaging";
    if (t.includes("הרגעה") || t.includes("calm") || t.includes("אדמומיות") || t.includes("רגיש"))
      return "calm";
    return null;
  }

  async function callBackendChat(userText, nextProfile) {
    setLoading(true);
    try {
      const context = {
        goal: nextProfile.goal || null,
        sensitive: typeof nextProfile.sensitive === "boolean" ? nextProfile.sensitive : null,
        pregnant: typeof nextProfile.pregnant === "boolean" ? nextProfile.pregnant : null,
      };

      const resp = await sendChat(userText, context);

      if (resp?.reply) addMessage("bot", resp.reply);

      if (resp?.suggested_treatments && Array.isArray(resp.suggested_treatments)) {
        addRecs(resp.suggested_treatments);
      }

      // follow_up format: { type: "yesno", question: "..." }
      if (resp?.follow_up?.type === "yesno") {
        // Decide which field this yes/no is about.
        // If pregnancy not answered -> ask pregnancy; else if sensitive not answered -> ask sensitive
        if (nextProfile.pregnant === null) {
          setFollowup("pregnant");
        } else if (nextProfile.sensitive === null) {
          setFollowup("sensitive");
        } else {
          // if both are already answered, just show the question text (no pending)
          addMessage("bot", resp.follow_up.question || "Yes/No?");
        }
      }
    } catch (e) {
      addMessage("bot", `Backend error: ${e?.message || "Chat failed"}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleUserText(text) {
    const q = text.trim();
    if (!q) return;

    addMessage("user", q);

    // 1) If we are waiting for Yes/No
    if (pending) {
      if (!isYes(q) && !isNo(q)) {
        addMessage("bot", "Please answer Yes or No 🙂");
        return;
      }

      const yes = isYes(q);
      const updated = { ...profile, [pending.type]: yes };
      setProfile(updated);
      setPending(null);

      addMessage("bot", `Got it. ${pending.type} = ${yes ? "Yes" : "No"}.`);

      // After we collect follow-up, call backend with a short message
      // (backend will use context)
      await callBackendChat("continue", updated);
      return;
    }

    // 2) Update goal if detected (keeps UX similar)
    const goal = detectGoal(q);
    let updated = profile;
    if (goal) {
      updated = { ...profile, goal };
      setProfile(updated);
      addMessage("bot", `Goal set to: ${goal}.`);
      // Ask follow-ups locally (so UX stays consistent)
      if (updated.sensitive === null) {
        setFollowup("sensitive");
        return;
      }
      if (updated.pregnant === null) {
        setFollowup("pregnant");
        return;
      }
    }

    // 3) Call backend chat
    await callBackendChat(q, updated);
  }

  const quickGoals = useMemo(() => ["לחות", "זוהר", "אקנה", "אנטי אייג׳ינג"], []);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed",
          right: "18px",
          bottom: "18px",
          borderRadius: "999px",
          padding: "12px 14px",
          border: "1px solid #ddd",
          background: "white",
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        }}
      >
        {open ? "Close ✖" : "Ask MeDay 💬"}
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            right: "18px",
            bottom: "70px",
            width: "360px",
            maxWidth: "92vw",
            height: "520px",
            border: "1px solid #ddd",
            borderRadius: "16px",
            background: "white",
            boxShadow: "0 10px 28px rgba(0,0,0,0.14)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px", borderBottom: "1px solid #eee" }}>
            <div style={{ fontWeight: 700 }}>MeDay Assistant</div>
            <div style={{ fontSize: "12px", opacity: 0.75 }}>
              Real backend chat (FastAPI + SQLite) + context questions
            </div>

            <div style={{ marginTop: "8px", fontSize: "12px", opacity: 0.75 }}>
              Current context:{" "}
              <strong>
                goal={profile.goal ?? "—"}, sensitive={profile.sensitive ?? "—"}, pregnancy={profile.pregnant ?? "—"}
              </strong>
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
              {quickGoals.map((g) => (
                <button
                  key={g}
                  onClick={() => handleUserText(g)}
                  style={{
                    border: "1px solid #eee",
                    background: "#fafafa",
                    borderRadius: "999px",
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  {g}
                </button>
              ))}

              <button
                onClick={() => {
                  setProfile({ goal: null, sensitive: null, pregnant: null });
                  setPending(null);
                  setMessages((m) => [
                    ...m,
                    { from: "bot", text: "Profile cleared. Tell me your goal again 🙂" },
                  ]);
                }}
                style={{
                  border: "1px solid #eee",
                  background: "white",
                  borderRadius: "999px",
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <div
            style={{
              padding: "12px",
              flex: 1,
              overflowY: "auto",
              display: "grid",
              gap: "10px",
              background: "#fcfcfc",
            }}
          >
            {messages.map((m, idx) => {
              if (m.from === "recs") {
                return (
                  <div key={idx} style={{ display: "grid", gap: "8px" }}>
                    {m.recs.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => onOpenTreatment?.(r.id)}
                        style={{
                          textAlign: "left",
                          border: "1px solid #eee",
                          borderRadius: "12px",
                          padding: "10px",
                          background: "white",
                          cursor: "pointer",
                        }}
                      >
                        Open: {r.name}
                        <div style={{ fontSize: "12px", opacity: 0.7 }}>
                          {r.category || "—"}
                        </div>
                      </button>
                    ))}
                  </div>
                );
              }

              const isUser = m.from === "user";
              return (
                <div
                  key={idx}
                  style={{
                    justifySelf: isUser ? "end" : "start",
                    maxWidth: "85%",
                    whiteSpace: "pre-wrap",
                    background: "white",
                    border: "1px solid #eee",
                    borderRadius: "14px",
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontSize: "12px", opacity: 0.7, marginBottom: "4px" }}>
                    {isUser ? "You" : "Bot"}
                  </div>
                  <div>{m.text}</div>
                </div>
              );
            })}

            {loading && (
              <div
                style={{
                  justifySelf: "start",
                  maxWidth: "85%",
                  background: "white",
                  border: "1px solid #eee",
                  borderRadius: "14px",
                  padding: "10px 12px",
                  opacity: 0.8,
                }}
              >
                Bot is typing…
              </div>
            )}
          </div>

          <ChatInput pending={pending} disabled={loading} onSend={handleUserText} />
        </div>
      )}
    </>
  );
}

function ChatInput({ pending, disabled, onSend }) {
  const [value, setValue] = useState("");

  return (
    <div style={{ padding: "10px", borderTop: "1px solid #eee", display: "flex", gap: "8px" }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={pending ? pending.prompt : "Type your goal or question…"}
        style={{ flex: 1, padding: "10px", borderRadius: "12px", border: "1px solid #ddd" }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const text = value;
            setValue("");
            onSend(text);
          }
        }}
        disabled={disabled}
      />
      <button
        onClick={() => {
          const text = value;
          setValue("");
          onSend(text);
        }}
        disabled={disabled}
        style={{
          padding: "10px 12px",
          borderRadius: "12px",
          border: "1px solid #ddd",
          background: "white",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        Send
      </button>
    </div>
  );
}
