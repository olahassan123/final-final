import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Clock,
  CreditCard,
  HeartHandshake,
  MapPin,
  Sparkles,
} from "lucide-react";

const Motion = motion;

const pexelsPhoto = (id, width = 1800, height = 1200) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}&h=${height}`;

const heroSlides = [
  {
    src: pexelsPhoto("9718365", 2200, 1200),
    alt: "מניקור עדין עם לק שקוף",
    position: "object-left-center",
  },
  {
    src: pexelsPhoto("6593777", 2200, 1200),
    alt: "סטיילינג אישי וייעוץ תדמית",
    position: "object-center",
  },
  {
    src: pexelsPhoto("13965154", 2200, 1200),
    alt: "עיצוב שיער במרכז יופי",
    position: "object-left-center",
  },
  {
    src: pexelsPhoto("7446923", 2200, 1200),
    alt: "איפור קבוע לשפתיים",
    position: "object-left-center",
  },
  {
    src: pexelsPhoto("6663372", 2200, 1200),
    alt: "טיפול גוף ועיסוי",
    position: "object-left-center",
  },
  {
    src: pexelsPhoto("3993449", 2200, 1200),
    alt: "עיצוב שיער לגבר",
    position: "object-left-center",
  },
];

const treatmentTiles = [
  {
    title: "הסרת שיער",
    href: "/categories/hair-removal",
    image: pexelsPhoto("36930637", 900, 700),
    variant: "image",
  },
  {
    title: "טיפולי גוף",
    href: "/categories/body-treatments",
    image: pexelsPhoto("6663372", 900, 700),
    variant: "teal",
  },
  {
    title: "טיפולי קוסמטיקה",
    href: "/categories/cosmetology",
    image: pexelsPhoto("9335966", 900, 700),
    variant: "image",
  },
  {
    title: "עיצוב שיער",
    href: "/categories/hair-design",
    image: pexelsPhoto("18614264", 900, 700),
    variant: "peach",
  },
  {
    title: "מניקור ופדיקור",
    href: "/categories/manicure-pedicure",
    image: pexelsPhoto("9718365", 900, 700),
    variant: "image",
  },
  {
    title: "צילום תדמית",
    href: "/categories/personal-styling",
    image: pexelsPhoto("6593777", 900, 700),
    variant: "orange",
  },
  {
    title: "טיפולי אסתטיקה",
    href: "/categories/aesthetic-treatments",
    image: pexelsPhoto("22589552", 900, 700),
    variant: "image",
  },
  {
    title: "סטיילינג אישי",
    href: "/categories/personal-styling",
    image: pexelsPhoto("6593777", 900, 700),
    variant: "white",
  },
  {
    title: "איפור קבוע ועיצוב גבות",
    href: "/categories/permanent-makeup-brows",
    image: pexelsPhoto("7446923", 900, 700),
    variant: "image",
  },
  {
    title: "איפור מקצועי",
    href: "/categories/professional-makeup",
    image: pexelsPhoto("33580447", 900, 700),
    variant: "teal",
  },
];

const benefitItems = [
  {
    icon: Clock,
    title: "חסכון בזמן",
    text: "מידיי מציעה שירותים יעילים המאפשרים הנאה מטיפולי יופי מהשורה הראשונה מבלי להתפשר על הזמן היקר שלכם.",
  },
  {
    icon: MapPin,
    title: "הכל במקום אחד",
    text: "משיער וציפורניים ועד טיפולי פנים וטיפולי אסתטיקה, אנו מספקים מגוון מקיף של שירותים תחת קורת גג אחת, המבטיחים את כל צרכי הטיפוח שלך.",
  },
  {
    icon: CalendarDays,
    title: "זמינות גבוהה",
    text: "שעות הפעילות שלנו מורחבות וגמישות כולל ערבים וסופי שבוע.",
  },
  {
    icon: CreditCard,
    title: "זימון תורים אונליין",
    text: "מערכת תורים דיגיטלית נוחה וקלה לשימוש.",
  },
  {
    icon: Sparkles,
    title: "חווית טיפול מקצועי",
    text: "אנשי מקצוע מנוסים המספקים שירות יוצא דופן, תוך שימוש בטכניקות העדכניות ביותר ובמוצרי פרימיום כדי להבטיח שתקבלו את חווית היופי הטובה ביותר.",
  },
  {
    icon: HeartHandshake,
    title: "שירותיות",
    text: "המחויבות שלנו להתעלות על הציפיות שלך עם תשומת לב אישית וטיפול יוצא דופן.",
  },
];

function TreatmentTile({ tile, index, onClick }) {
  const isImageFirst = tile.variant === "image";
  const variantClass =
    tile.variant === "teal"
      ? "bg-[#4F8D96] text-[#111111]"
      : tile.variant === "orange"
        ? "bg-[#F48B5D] text-[#111111]"
        : tile.variant === "peach"
          ? "bg-[#F2D5BD] text-[#111111]"
          : tile.variant === "white"
            ? "bg-white text-[#111111]"
            : "bg-[#F3EDE3] text-white";

  return (
    <Motion.button
      type="button"
      onClick={() => onClick(tile.href)}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.5, delay: index * 0.04 }}
      className={`group relative h-[210px] overflow-hidden text-center md:h-[240px] ${variantClass}`}
    >
      <img
        src={tile.image}
        alt={tile.title}
        className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 group-hover:scale-105 ${
          isImageFirst ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        loading="lazy"
      />
      <div
        className={`absolute inset-0 transition-colors duration-500 ${
          isImageFirst
            ? "bg-black/18 group-hover:bg-black/34"
            : "bg-transparent group-hover:bg-black/34"
        }`}
      />
      <div className="relative z-10 flex h-full items-center justify-center px-5">
        <span
          className={`text-[clamp(1.55rem,2.3vw,2.35rem)] font-black leading-tight transition-colors duration-500 ${
            isImageFirst ? "text-white" : "text-[#111111] group-hover:text-white"
          }`}
        >
          {tile.title}
        </span>
      </div>
    </Motion.button>
  );
}

function HomePetalMark() {
  return (
    <div className="pointer-events-none absolute bottom-[-125px] right-[-55px] h-[620px] w-[760px] opacity-24 md:right-[35px]">
      {Array.from({ length: 6 }).map((_, index) => (
        <span
          key={index}
          className="absolute left-1/2 top-1/2 h-[360px] w-[360px] origin-bottom rounded-full border-[11px] border-[#F7B084]"
          style={{ transform: `translate(-50%, -92%) rotate(${index * 60}deg)` }}
        />
      ))}
      <span className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[11px] border-[#F7B084]" />
    </div>
  );
}

function BenefitItem({ item, index }) {
  const Icon = item.icon;

  return (
    <Motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.48, delay: index * 0.06 }}
      className="relative z-10 mx-auto max-w-[320px] text-center"
    >
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-[5px] border-[#FFD9C4] text-[#FFD9C4]">
        <Icon size={36} strokeWidth={1.8} />
      </div>
      <h3 className="mb-3 text-3xl font-medium leading-none text-black">{item.title}</h3>
      <p className="text-lg font-normal leading-7 text-black">{item.text}</p>
    </Motion.div>
  );
}

function FlowerImage({ src, alt }) {
  return (
    <div className="relative mx-auto h-[340px] w-[340px] md:h-[410px] md:w-[410px]">
      <div className="absolute left-1/2 top-0 h-[260px] w-[260px] -translate-x-1/2 overflow-hidden rounded-full md:h-[315px] md:w-[315px]">
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="absolute bottom-3 left-1/2 h-[170px] w-[170px] -translate-x-1/2 overflow-hidden rounded-full md:h-[205px] md:w-[205px]">
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="absolute bottom-20 left-4 h-[170px] w-[170px] overflow-hidden rounded-full md:bottom-24 md:h-[205px] md:w-[205px]">
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="absolute bottom-20 right-4 h-[170px] w-[170px] overflow-hidden rounded-full md:bottom-24 md:h-[205px] md:w-[205px]">
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [activeHero, setActiveHero] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveHero((index) => (index + 1) % heroSlides.length);
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAF6F1] text-[#211713]" dir="rtl">
      <section id="home" className="relative min-h-screen overflow-hidden bg-[#edf2f3] pt-[118px] lg:pt-[164px]">
        <AnimatePresence mode="wait">
          <Motion.img
            key={heroSlides[activeHero].src}
            src={heroSlides[activeHero].src}
            alt={heroSlides[activeHero].alt}
            className={`absolute inset-0 h-full w-full object-cover ${heroSlides[activeHero].position}`}
            initial={{ opacity: 0, scale: 1.045 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.025 }}
            transition={{ duration: 0.72, ease: "easeOut" }}
            loading={activeHero === 0 ? "eager" : "lazy"}
          />
        </AnimatePresence>

        <div className="absolute inset-0 bg-white/52" />
        <div className="absolute bottom-0 left-0 top-[118px] w-full bg-gradient-to-r from-transparent via-[#edf2f3]/76 to-white/96 lg:top-[164px]" />

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-118px)] max-w-7xl items-center justify-center px-5 pb-12 text-center lg:min-h-[calc(100vh-164px)] lg:px-14">
          <div className="mr-auto max-w-3xl lg:ml-12">
            <Motion.h1
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="font-serif text-[clamp(4.8rem,10vw,10rem)] font-black leading-[0.82] tracking-normal text-[#231713]"
            >
              MeDay
            </Motion.h1>
            <Motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.14 }}
              className="mt-6 text-3xl font-medium text-black md:text-4xl"
            >
              תעשי לך את היום
            </Motion.p>
            <Motion.button
              type="button"
              onClick={() => navigate("/categories")}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.26 }}
              className="mt-8 inline-flex items-center justify-center bg-[#4F8D96] px-12 py-3 text-3xl font-black leading-none text-white transition-all hover:-translate-y-0.5 hover:bg-[#3f7b84]"
              style={{ borderRadius: 3 }}
            >
              לתיאום תור
            </Motion.button>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-7 z-20 flex justify-center gap-2">
          {heroSlides.map((slide, index) => (
            <button
              key={slide.src}
              type="button"
              aria-label={`תמונת פתיחה ${index + 1}`}
              onClick={() => setActiveHero(index)}
              className="h-2 transition-all"
              style={{
                width: activeHero === index ? 34 : 10,
                borderRadius: 99,
                background: activeHero === index ? "#4F8D96" : "rgba(79,141,150,0.32)",
              }}
            />
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#dedede] py-16 md:py-20">
        <div className="pointer-events-none absolute left-[28%] top-5 hidden text-[#F48B5D] md:block">
          <span className="absolute text-xl">✦</span>
          <span className="absolute left-7 top-8 text-3xl">✦</span>
          <span className="absolute left-16 top-11 text-xl">✦</span>
          <span className="absolute left-4 top-16 text-2xl">✦</span>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-5 md:px-10 lg:px-14">
          <div className="mb-10 text-center">
            <p className="font-serif text-[clamp(4.3rem,7vw,6.7rem)] uppercase leading-[0.72] tracking-normal text-white">
              WHY CHOOSE US?
            </p>
            <h2 className="-mt-2 text-4xl font-black leading-none text-[#4F8D96] md:text-5xl">
              למה לבחור בנו?
            </h2>
          </div>

          <div className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
            <div className="mx-auto max-w-[620px] text-center text-black">
              <h3 className="mb-7 text-3xl font-medium leading-tight text-[#F48B5D]">
                מעצבים את חווית הטיפוח שלך מחדש
              </h3>
              <p className="mb-6 text-xl leading-8">
                המרכז הוקם מתוך חשיבה עמוקה ובשיתוף עם אנשי מקצוע
                מבריקים בתחום היופי בארץ ובעולם!
              </p>

              <div className="space-y-5 text-xl leading-7">
                {[
                  "אצלנו תנהלו את שגרת הטיפוח בקלות ובנעימים, לשירותכם טיפולים משולבים ב-4 ידיים, זמינות גבוהה של 14 שעות ביום כולל סופי שבוע!",
                  "אנשי מקצוע שנבחרו בקפידה ועברו הכשרות מקצועיות על ידי טובי המאסטרים המובילים בתחומם.",
                  "כל הטיפולים במרכז מבוצעים על פי פרוטוקול מקצועי קפדני.",
                  "במידיי תמצאו את הטרנדים הכי עדכניים בעולם, מכשור חדשני וחומרים איכותיים.",
                ].map((line) => (
                  <div key={line} className="flex items-start justify-center gap-3">
                    <span className="mt-1 text-[#F48B5D]">✦</span>
                    <p>{line}</p>
                  </div>
                ))}
              </div>

              <p className="mx-auto mt-7 max-w-[570px] text-xl font-black leading-7">
                מחכים לך במידיי, מרחב חם ומזמין של יופי ואסתטיקה, פינת אירוח מפנקת והכי חשוב,
                אנשי מקצוע עם חיוך שפשוט אוהבים אנשים!
              </p>
            </div>

            <FlowerImage
              src={pexelsPhoto("7705849", 760, 760)}
              alt="מניקור עדין עם לק שקוף"
            />
          </div>
        </div>
      </section>

      <section id="about" className="relative overflow-hidden bg-[#F48B5D] py-20 md:py-24">
        <HomePetalMark />
        <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 gap-x-14 gap-y-14 px-5 md:grid-cols-3 md:px-10 lg:px-14">
          {benefitItems.map((item, index) => (
            <BenefitItem key={item.title} item={item} index={index} />
          ))}
        </div>
        <div className="relative z-10 mt-14 text-center">
          <button
            type="button"
            onClick={() => navigate("/categories")}
            className="inline-flex items-center justify-center bg-[#4F8D96] px-12 py-3 text-3xl font-black leading-none text-white transition-all hover:-translate-y-0.5 hover:bg-[#3f7b84]"
            style={{ borderRadius: 3 }}
          >
            לתיאום תור
          </button>
        </div>
      </section>

      <section id="treatments" className="bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {treatmentTiles.map((tile, index) => (
            <TreatmentTile
              key={tile.title}
              tile={tile}
              index={index}
              onClick={(href) => navigate(href)}
            />
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#dedede]">
        <div className="mx-auto grid min-h-[400px] max-w-7xl items-end px-5 pt-12 md:grid-cols-[1fr_1.15fr] md:px-10 lg:px-14">
          <div className="relative order-2 flex h-[260px] items-end justify-center md:order-1 md:h-[390px]">
            <div className="absolute bottom-0 h-[330px] w-[520px] max-w-full overflow-hidden rounded-t-[48%] rounded-br-[46%] rounded-bl-[28%] md:h-[390px]">
              <img
                src={pexelsPhoto("7290669", 900, 760)}
                alt="מברשות איפור מקצועיות"
                className="h-full w-full object-cover grayscale"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-white/18" />
            </div>
          </div>

          <div className="relative order-1 pb-12 text-center md:order-2 md:pb-20">
            <div className="pointer-events-none absolute -top-10 left-12 hidden text-[#F48B5D] md:block">
              <span className="absolute text-3xl">✦</span>
              <span className="absolute left-8 top-9 text-4xl">✦</span>
              <span className="absolute left-20 top-14 text-2xl">✦</span>
              <span className="absolute left-4 top-20 text-3xl">✦</span>
            </div>
            <p className="font-serif text-[clamp(4.6rem,7vw,6.8rem)] uppercase leading-[0.72] tracking-normal text-white">
              OUR GOALS
            </p>
            <h2 className="-mt-2 text-4xl font-black leading-none text-[#4F8D96] md:text-5xl">
              המטרות שלנו
            </h2>
            <p className="mx-auto mt-9 max-w-[560px] text-lg font-medium leading-7 text-black">
              מידיי דוגלת ביצירת חוויה נעימה ומרגשת שבה תוכלו להתרגש ולהתפנק.
              חשוב לנו לייצר מקום שיענה בצורה הטובה ביותר לצרכים שלכם כאשר כל
              הטיפולים במקום אחד ולחסוך לכם זמן ומאמץ.
            </p>
            <button
              type="button"
              onClick={() => navigate("/categories")}
              className="mt-10 inline-flex items-center justify-center bg-[#4F8D96] px-12 py-3 text-3xl font-black leading-none text-white transition-all hover:-translate-y-0.5 hover:bg-[#3f7b84]"
              style={{ borderRadius: 3 }}
            >
              לתיאום תור
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
