import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import slide2 from "../assets/slide2.jpg";
import nails from "../assets/nails.jpg";
import facialTreatment from "../assets/facialTreatment.jpg";
import spa from "../assets/spa.jpg";
import eyebrows from "../assets/eyebrows.jpg";

const galleryImages = [
  { src: slide2, alt: "עיצוב שיער מקצועי" },
  { src: nails, alt: "מניקור ופדיקור" },
  { src: facialTreatment, alt: "טיפול פנים" },
  { src: spa, alt: "חוויית ספא" },
  { src: eyebrows, alt: "עיצוב גבות" },
];

export default function AboutPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-[#F9E0CE] text-[#2B1D17]">
      <section className="relative min-h-[440px] overflow-hidden pt-24">
        <img
          src={slide2}
          alt="מעצבת שיער ב-MeDay"
          className="absolute inset-0 h-full w-full object-cover object-left"
        />
        <div className="absolute inset-0 bg-white/72" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/45 to-[#F9E0CE]" />

        <div className="relative z-10 mx-auto flex min-h-[340px] max-w-6xl items-center justify-center px-6 text-center">
          <div>
            <div className="mb-2 flex items-center justify-center gap-3 text-[#F28A5B]">
              <span className="h-px w-16 bg-[#F28A5B]/45" />
              <Sparkles size={24} />
              <span className="h-px w-16 bg-[#F28A5B]/45" />
            </div>
            <p className="font-serif text-5xl uppercase tracking-[0.18em] text-[#F28A5B] md:text-7xl">
              About Us
            </p>
            <h1 className="-mt-3 text-5xl font-black leading-none text-[#4A8F9B] md:text-7xl">
              אודות
            </h1>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-6 py-16 md:py-20">
        <div
          className="pointer-events-none absolute -right-28 top-4 h-[430px] w-[430px] rounded-full border-[26px] border-[#F6B88E]/25"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-24 bottom-10 h-[300px] w-[300px] rounded-full border-[20px] border-white/25"
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h2 className="mb-5 text-3xl font-black text-[#F28A5B] md:text-4xl">
            המרכז לטיפוח ויופי היחיד מסוגו בארץ
          </h2>

          <div className="mx-auto space-y-8 text-lg leading-8 text-black md:text-xl md:leading-9">
            <p>
              אנו גאים להציע שירותים מעודכנים ואיכותיים, תוך דגש על טרנדים בינלאומיים
              והניסיון של מעצבי שיער מיומנים שהוכשרו באירופה. בואי ליהנות מאווירה
              יוקרתית ומקצועית, שבה כל פרט נחשב ונותן לך את המראה המושלם שתמיד חלמת עליו.
            </p>

            <div className="mx-auto h-4 w-4 rotate-45 bg-[#F28A5B]" aria-hidden="true" />

            <p>
              אנו מציעים מגוון טיפולי שיער המתבצעים בעזרת חומרים מובילים של חברת לוריאל.
              בין שירותינו תמצאו טיפולי צבע ללא אמוניה, טיפול “בליאש” המקדש את בריאות
              השיער וחוזקו, עיצוב שיער לאירועים, תספורות לנשים, ומחלקה ייחודית לתספורות
              גברים ועיצוב זקנים.
            </p>

            <div className="mx-auto h-4 w-4 rotate-45 bg-[#F28A5B]" aria-hidden="true" />

            <p>
              צוות המומחים שלנו כאן כדי לסייע לכם בבחירת העיצוב המושלם שיתאים בדיוק
              לצרכים ולרצונות שלכם. נשמח לייעץ לכם ולהעניק לכם חוויית טיפוח בלתי נשכחת!
            </p>

            <div className="mx-auto h-4 w-4 rotate-45 bg-[#F28A5B]" aria-hidden="true" />

            <p className="font-semibold">
              בואו לעשות לכם את היום בטלפון: <a href="tel:*3691" className="font-black">*3691</a>
            </p>
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/professional-team"
              className="rounded bg-[#4A8F9B] px-8 py-3 text-lg font-black text-white shadow-lg transition hover:bg-[#3A7E8A]"
            >
              בואו להכיר את הצוות שלנו
            </Link>
            <Link
              to="/categories"
              className="rounded border border-[#4A8F9B]/40 bg-white/45 px-8 py-3 text-lg font-bold text-[#3A7E8A] transition hover:bg-white"
            >
              לכל סוגי הטיפולים
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-5">
        {galleryImages.map((image) => (
          <div key={image.alt} className="h-52 overflow-hidden md:h-64">
            <img
              src={image.src}
              alt={image.alt}
              className="h-full w-full object-cover transition duration-700 hover:scale-110"
            />
          </div>
        ))}
      </section>
    </div>
  );
}
