import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import makeupBrushes from "../assets/gallery/gallery-01-makeup-brushes.png";
import nails from "../assets/gallery/gallery-02-nails.png";
import treatmentDetail from "../assets/gallery/gallery-03-treatment-detail.png";
import reception from "../assets/gallery/gallery-04-reception.png";
import eyebrowsPmu from "../assets/gallery/gallery-05-eyebrows-pmu.png";
import lounge from "../assets/gallery/gallery-06-lounge.png";
import haircut from "../assets/gallery/gallery-07-haircut.png";
import laserHairRemoval from "../assets/gallery/gallery-08-laser-hair-removal.png";
import facialTreatment from "../assets/gallery/gallery-09-facial-treatment.png";
import storefront from "../assets/gallery/gallery-10-storefront.png";
import eyebrowsCloseup from "../assets/gallery/gallery-11-eyebrows-closeup.png";
import stylingArea from "../assets/gallery/gallery-12-styling-area.png";
import brandHallway from "../assets/gallery/gallery-13-brand-hallway.png";
import products from "../assets/gallery/gallery-14-products.png";
import giftBag from "../assets/gallery/gallery-15-gift-bag.png";
import aestheticInjection from "../assets/gallery/gallery-16-aesthetic-injection.png";

const GALLERY_PHOTOS = [
  { src: reception, alt: "המרכז שלנו" },
  { src: haircut, alt: "עיצוב שיער" },
  { src: eyebrowsPmu, alt: "איפור קבוע ועיצוב גבות" },
  { src: nails, alt: "מניקור ופדיקור" },
  { src: lounge, alt: "המרחב שלנו" },
  { src: laserHairRemoval, alt: "הסרת שיער" },
  { src: makeupBrushes, alt: "איפור מקצועי" },
  { src: treatmentDetail, alt: "מהטיפולים שלנו" },
  { src: facialTreatment, alt: "טיפולי פנים" },
  { src: storefront, alt: "המרכז שלנו מבחוץ" },
  { src: eyebrowsCloseup, alt: "עיצוב גבות" },
  { src: stylingArea, alt: "אזור עיצוב השיער" },
  { src: brandHallway, alt: "המותג שלנו" },
  { src: products, alt: "המוצרים שלנו" },
  { src: giftBag, alt: "מתנה בכל ביקור" },
  { src: aestheticInjection, alt: "טיפולי אסתטיקה" },
];

function Lightbox({ photos, index, onClose, onPrev, onNext }) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onNext();
      if (event.key === "ArrowRight") onPrev();
    };
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onNext, onPrev]);

  const photo = photos[index];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(10,6,3,0.92)" }}
      onClick={onClose}
    >
      {/* counter */}
      <span
        className="absolute top-6 left-6 font-bold text-white/70 tracking-wide select-none"
        style={{ fontSize: "0.95rem" }}
        dir="ltr"
      >
        {index + 1} / {photos.length}
      </span>

      {/* close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="סגירה"
        className="absolute top-5 right-5 flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <X size={26} />
      </button>

      {/* prev arrow */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        aria-label="הקודם"
        className="absolute left-4 md:left-8 flex h-12 w-12 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <ChevronLeft size={30} />
      </button>

      {/* next arrow */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        aria-label="הבא"
        className="absolute right-4 md:right-8 flex h-12 w-12 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <ChevronRight size={30} />
      </button>

      {/* image */}
      <div
        className="relative mx-16 max-h-[85vh] max-w-[85vw] md:mx-24"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photo.src}
          alt={photo.alt}
          className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl"
        />
        <p
          className="mt-3 text-center text-sm font-semibold text-white/70"
        >
          {photo.alt}
        </p>
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const [activeIndex, setActiveIndex] = useState(null);

  const closeLightbox = useCallback(() => setActiveIndex(null), []);
  const goNext = useCallback(
    () => setActiveIndex((i) => (i === null ? i : (i + 1) % GALLERY_PHOTOS.length)),
    []
  );
  const goPrev = useCallback(
    () => setActiveIndex((i) => (i === null ? i : (i - 1 + GALLERY_PHOTOS.length) % GALLERY_PHOTOS.length)),
    []
  );

  return (
    <div className="min-h-screen bg-secondary" dir="rtl">
      {/* hero */}
      <section
        className="relative overflow-hidden flex flex-col items-center justify-center text-center px-6"
        style={{ minHeight: "42vh", paddingTop: "6rem" }}
      >
        <img
          src={reception}
          alt="גלריית MeDay Beauty Center"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center 20%" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(22,11,4,0.62) 0%, rgba(22,11,4,0.42) 50%, rgba(22,11,4,0.72) 100%)",
          }}
        />
        <div className="relative z-10">
          <p
            className="font-bold tracking-[0.35em] uppercase mb-5 text-white/55"
            style={{ fontSize: "0.75rem" }}
          >
            ✦ MEDAY BEAUTY CENTER ✦
          </p>
          <h1
            className="font-black text-white leading-tight"
            style={{ fontSize: "clamp(2.6rem, 6vw, 4.5rem)", textShadow: "0 4px 24px rgba(0,0,0,0.35)" }}
          >
            גלריה
          </h1>
          <p className="mt-4 text-white/60" style={{ fontSize: "clamp(0.95rem, 1.2vw, 1.1rem)" }}>
            הצצה למרחב, לטיפולים ולרגעים שלנו
          </p>
        </div>
      </section>

      {/* masonry grid */}
      <section className="px-6 md:px-10 py-16 max-w-7xl mx-auto">
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
          {GALLERY_PHOTOS.map((photo, i) => (
            <button
              key={photo.src}
              type="button"
              onClick={() => setActiveIndex(i)}
              className="group mb-4 block w-full overflow-hidden rounded-2xl break-inside-avoid focus:outline-none"
              style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
            >
              <div className="relative">
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/20" />
                <span
                  className="absolute bottom-3 right-4 text-sm font-bold text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
                >
                  {photo.alt}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {activeIndex !== null && (
        <Lightbox
          photos={GALLERY_PHOTOS}
          index={activeIndex}
          onClose={closeLightbox}
          onPrev={goPrev}
          onNext={goNext}
        />
      )}
    </div>
  );
}
