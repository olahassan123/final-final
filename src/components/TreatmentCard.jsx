import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function TreatmentCard({ t }) {
  const [open, setOpen] = useState(false);

  const shownLines = useMemo(() => {
    if (!t?.lines?.length) return [];
    return open ? t.lines : t.lines.slice(0, 2);
  }, [t, open]);

  const hasMore = (t?.lines?.length || 0) > 2;

  return (
    <article className="rounded-3xl bg-white border border-black/5 shadow-sm hover:shadow-lg transition-shadow p-7 text-center">
      <h3 className="text-2xl font-extrabold text-[#1f6f73] leading-tight">
        {t.name}
      </h3>

      <div className="mt-4 text-gray-700 leading-7">
        <ul className="space-y-2">
          {shownLines.map((line, idx) => (
            <li key={idx} className="text-[15px]">
              {line}
            </li>
          ))}
        </ul>
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-gray-900"
        >
          {open ? "לסגור" : "לקרוא עוד"}
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      )}
    </article>
  );
}

