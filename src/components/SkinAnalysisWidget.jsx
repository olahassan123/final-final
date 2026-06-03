import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Camera, Upload, RefreshCw, ArrowLeft, X } from "lucide-react";
import { Link } from "react-router-dom";
import { analyzeSkin } from "../api/medayApi";

const SKIN_TYPE_CONFIG = {
  dry:         { label: "יבש",    emoji: "💧", color: "bg-blue-50 text-blue-700 border-blue-200" },
  oily:        { label: "שומני",  emoji: "✨", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  combination: { label: "מעורב",  emoji: "⚖️", color: "bg-purple-50 text-purple-700 border-purple-200" },
  normal:      { label: "נורמלי", emoji: "🌸", color: "bg-green-50 text-green-700 border-green-200" },
  sensitive:   { label: "רגיש",   emoji: "🌿", color: "bg-pink-50 text-pink-700 border-pink-200" },
};

const SEVERITY_STYLE = {
  mild:        "bg-green-50 text-green-700 border border-green-200",
  moderate:    "bg-amber-50 text-amber-700 border border-amber-200",
  significant: "bg-rose-50 text-rose-700 border border-rose-200",
};

const TREATMENT_IMAGES = {
  "classic-meday":   "/treatment-classic.jpg",
  "man-t":           "/treatment-classic.jpg",
  "face-sculpt":     "/treatment-pamper.jpg",
  "party":           "/treatment-pamper.jpg",
  "meso-pro":        "/meso-pro.jpg",
  "lifting-pro":     "/lifting-pro.jpg",
  "collagen-plus":   "/collagen-plus.jpg",
  "stop-acne":       "/stop-acne.jpg",
  "clear-skin-plus": "/clear-skin.jpg",
  "new-skin":        "/treatment-tech.jpg",
  "skin-booster":    "/treatment-tech.jpg",
};

function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 512;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      const base64 = canvas.toDataURL("image/jpeg", 0.82).split(",")[1];
      URL.revokeObjectURL(url);
      resolve(base64);
    };
    img.src = url;
  });
}

export default function SkinAnalysisWidget() {
  const [phase, setPhase] = useState("idle"); // idle | preview | loading | results | error
  const [previewUrl, setPreviewUrl] = useState(null);
  const [base64, setBase64] = useState(null);
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setPreviewUrl(URL.createObjectURL(file));
    setBase64(await compressImage(file));
    setPhase("preview");
  };

  const analyze = async () => {
    setPhase("loading");
    try {
      setResults(await analyzeSkin(base64));
      setPhase("results");
    } catch (e) {
      setErrorMsg(e.message || "שגיאה בניתוח התמונה. אנא נסי שוב.");
      setPhase("error");
    }
  };

  const reset = () => {
    setPhase("idle");
    setPreviewUrl(null);
    setBase64(null);
    setResults(null);
    setErrorMsg("");
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  return (
    <div className="rounded-[2rem] overflow-hidden border border-primary/20 shadow-card">
      {/* Header */}
      <div className="bg-gradient-to-l from-purple-50 via-primary/8 to-primary/5 px-8 py-5 flex items-center justify-between border-b border-primary/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-meday flex items-center justify-center shadow-glow-pink shrink-0">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">ניתוח עור חכם</h2>
            <p className="text-xs text-gray-500 mt-0.5">גלי את סוג העור שלך וקבלי המלצות טיפול מותאמות אישית</p>
          </div>
        </div>
        <span className="text-xs bg-gradient-meday text-white font-bold px-3 py-1 rounded-full shadow-sm shrink-0">
          AI
        </span>
      </div>

      {/* Body */}
      <div className="bg-white px-8 py-8">
        <AnimatePresence mode="wait">

          {/* ── IDLE ── */}
          {phase === "idle" && (
            <motion.div key="idle"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-6 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-purple-100 flex items-center justify-center">
                <Camera size={36} className="text-primary" />
              </div>

              <div>
                <h3 className="text-2xl font-bold text-gray-900">גלי את סוג העור שלך</h3>
                <p className="mt-2 text-sm text-gray-500 max-w-md leading-6">
                  צלמי תמונה ברורה של הפנים שלך. הבינה המלאכותית תנתח את העור ותמליץ על הטיפולים הקוסמטיים המתאימים ביותר עבורך.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-meday text-white font-bold py-3 px-6 shadow-glow-pink hover:opacity-90 transition"
                >
                  <Camera size={17} />
                  צלמי תמונה
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-primary text-primary font-bold py-3 px-6 hover:bg-primary/5 transition"
                >
                  <Upload size={17} />
                  העלי תמונה
                </button>
              </div>

              <p className="text-xs text-gray-400 flex items-center gap-1">
                <span>🔒</span>
                <span>התמונה לא נשמרת ומעובדת בפרטיות מלאה</span>
              </p>

              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleFile(e.target.files[0])} />
              <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden"
                onChange={(e) => handleFile(e.target.files[0])} />
            </motion.div>
          )}

          {/* ── PREVIEW ── */}
          {phase === "preview" && (
            <motion.div key="preview"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="relative">
                <img src={previewUrl} alt="preview"
                  className="w-44 h-44 object-cover rounded-3xl shadow-card border-4 border-white shadow-glow-pink" />
                <button onClick={reset}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition shadow-sm">
                  <X size={13} className="text-gray-600" />
                </button>
              </div>

              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900">התמונה מוכנה לניתוח</h3>
                <p className="text-sm text-gray-500 mt-1">לחצי על הכפתור להתחיל</p>
              </div>

              <button onClick={analyze}
                className="flex items-center gap-2 rounded-2xl bg-gradient-meday text-white font-bold py-3 px-8 shadow-glow-pink hover:opacity-90 transition text-base">
                <Sparkles size={18} />
                ניתחי את העור שלי
              </button>

              <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600 transition">
                החלפי תמונה
              </button>
            </motion.div>
          )}

          {/* ── LOADING ── */}
          {phase === "loading" && (
            <motion.div key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 py-2"
            >
              <div className="relative w-44 h-44">
                <img src={previewUrl} alt="scanning"
                  className="w-full h-full object-cover rounded-3xl" />
                {/* scanning sweep */}
                <div className="absolute inset-0 rounded-3xl overflow-hidden">
                  <motion.div
                    className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-primary/50 to-transparent"
                    animate={{ top: ["-33%", "120%"] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                  />
                </div>
                <div className="absolute inset-0 rounded-3xl border-2 border-primary/60 animate-pulse" />
              </div>

              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900">מנתחת את העור שלך...</h3>
                <p className="text-sm text-gray-400 mt-1">זה עשוי לקחת כמה שניות</p>
                <div className="flex gap-1.5 justify-center mt-4">
                  {[0, 1, 2].map((i) => (
                    <motion.div key={i} className="w-2 h-2 bg-primary rounded-full"
                      animate={{ scale: [1, 1.6, 1], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.22 }} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── RESULTS ── */}
          {phase === "results" && results && (
            <motion.div key="results"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-7"
            >
              {/* Skin type + summary row */}
              <div className="flex flex-col md:flex-row gap-5 items-start">
                {/* Photo + skin type badge */}
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <img src={previewUrl} alt="result"
                    className="w-28 h-28 object-cover rounded-2xl shadow-card border-2 border-white" />
                  {(() => {
                    const cfg = SKIN_TYPE_CONFIG[results.skin_type] || SKIN_TYPE_CONFIG.combination;
                    return (
                      <span className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm border ${cfg.color}`}>
                        <span>{cfg.emoji}</span>
                        <span>עור {results.skin_type_hebrew || cfg.label}</span>
                      </span>
                    );
                  })()}
                </div>

                {/* Summary + concerns */}
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1.5">תוצאות הניתוח</h3>
                    <p className="text-sm text-gray-600 leading-7">{results.summary}</p>
                  </div>

                  {results.concerns?.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {results.concerns.map((c, i) => (
                        <span key={i} className={`rounded-full px-3 py-1 text-xs font-semibold ${SEVERITY_STYLE[c.severity] || SEVERITY_STYLE.mild}`}>
                          {c.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recommended treatments */}
              {results.recommended_treatments?.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
                    <Sparkles size={15} className="text-primary" />
                    טיפולים מומלצים עבורך
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {results.recommended_treatments.slice(0, 4).map((t, i) => (
                      <Link key={i} to={`/categories/cosmetology/${t.slug}`}
                        className="group flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 hover:border-primary hover:bg-primary/10 transition-all"
                      >
                        {TREATMENT_IMAGES[t.slug] && (
                          <img src={TREATMENT_IMAGES[t.slug]} alt={t.name}
                            className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white shadow-sm" />
                        )}
                        <div className="flex-1 text-right min-w-0">
                          <p className="font-bold text-gray-900 text-sm group-hover:text-primary transition leading-snug">{t.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">{t.desc}</p>
                        </div>
                        <span className="w-8 h-8 shrink-0 rounded-xl bg-white border border-primary/20 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all">
                          <ArrowLeft size={13} className="text-primary group-hover:text-white transition" />
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center pt-1">
                <button onClick={reset}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-primary transition">
                  <RefreshCw size={14} />
                  ניסיון חדש
                </button>
              </div>
            </motion.div>
          )}

          {/* ── ERROR ── */}
          {phase === "error" && (
            <motion.div key="error"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 py-6 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center">
                <X size={28} className="text-rose-400" />
              </div>
              <p className="text-gray-600 max-w-sm">{errorMsg}</p>
              <button onClick={reset}
                className="flex items-center gap-2 rounded-2xl bg-primary text-white font-bold py-2.5 px-6 hover:bg-primary-dark transition">
                <RefreshCw size={15} />
                נסי שוב
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
