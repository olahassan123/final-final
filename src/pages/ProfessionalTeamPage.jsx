import { motion } from "framer-motion";
import { Facebook, Instagram, MessageCircle, Sparkles } from "lucide-react";
import facialTreatment from "../assets/facialTreatment.jpg";
import slide2 from "../assets/slide2.jpg";
import spa from "../assets/spa.jpg";

const teamMembers = [
  {
    name: "ד''ר רנין רוחאנא",
    initials: "רר",
    accent: "#4A9BA8",
    text:
      "רופאה כללית המתמחה בטיפולי אסתטיקה לפנים ולגוף. מטפלת באמצעות חומרי מילוי איכותיים וטכנולוגיות מתקדמות לשמירה על איכות העור וליצירת מראה צעיר ורענן. בעלת מומחיות בטיפולי סקולפטרה, פיסול פנים, עיצוב ותיחום שפתיים.",
  },
  {
    name: "דנה קוטליאר",
    initials: "דק",
    accent: "#E8825A",
    text:
      "מאסטרית ומדריכת איפור קבוע בכל השיטות המובילות, זכתה במקום ראשון בכל הקטגוריות של איפור קבוע בארץ. מתמחה במיקרובליידינג, היפראליזם, הצללות פודרה, פיגמנט שפתיים, הדגשות קו ריסים, הרמת ריסים וגבות, עיצוב וסידור גבות בהתאמה למבנה פנים. בעלת עשרות תעודות הכשרה בכל תחום האיפור הקבוע. מתמחה באפילציה ובהסרות שיער ובכל מכשורי הלייזר והמזוטרפיה. מאפרת מקצועית בוגרת יוסי ביטון עם ניסיון של 10 שנים בתחום האיפור הקבוע ואיפורי יופי. מתמחה באיפורי כלות וערב. התאמה מלאה למבנה הפנים, תיקון ופיסול פנים.",
  },
  {
    name: "מרינה טימשצ'נקו",
    initials: "מט",
    accent: "#E8825A",
    text:
      "מעסה רפואית עם ניסיון רב בכל סוגי העיסויים, תעודות הכשרה ממכללת רידמן ומכללת וינגייט. מתמחה בעיסוי ספורטאים, טיפול בכוסות רוח ואבנים חמות.",
  },
  {
    name: "רגב שדה",
    initials: "רש",
    accent: "#4A9BA8",
    text:
      "מעצב שיער עם ניסיון של 15 שנה בתחום. רזומה מקצועי לצד שוקי זיקרי ועבודה במספרות יוקרה בכיכר המדינה ובמגדלי YOU. הכשרות מקצועיות: וידאל ששון בלונדון, אקדמיית Hi Friday לעיצוב שיער והכשרה באקדמיה של חברת לוריאל פרופסיונל. מתמחה בכל עולם הכימיה והגוונים.",
  },
];

function FlowerAvatar({ initials, accent }) {
  return (
    <div className="relative mx-auto h-24 w-24 shrink-0 md:mx-0" aria-hidden="true">
      {[0, 60, 120, 180, 240, 300].map((rotation) => (
        <span
          key={rotation}
          className="absolute left-1/2 top-1/2 h-14 w-14 origin-[0_0] rounded-full opacity-55"
          style={{
            background: accent,
            transform: `rotate(${rotation}deg) translate(13px, -7px)`,
          }}
        />
      ))}
      <span className="absolute inset-3 rounded-full bg-[#FAF7F2] shadow-inner" />
      <span
        className="absolute inset-0 flex items-center justify-center text-2xl font-black"
        style={{ color: accent }}
      >
        {initials}
      </span>
    </div>
  );
}

function TeamCard({ member, index }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay: index * 0.08 }}
      className="grid gap-5 text-center md:grid-cols-[auto_1fr] md:text-right"
    >
      <FlowerAvatar initials={member.initials} accent={member.accent} />
      <div>
        <h2 className="mb-3 text-3xl font-black leading-tight" style={{ color: member.accent }}>
          {member.name}
        </h2>
        <p className="text-xl leading-8 text-black md:text-[1.35rem] md:leading-9">
          {member.text}
        </p>
      </div>
    </motion.article>
  );
}

function ContactFooter() {
  return (
    <section className="relative overflow-hidden bg-[#F58C5B] px-6 py-16 text-black">
      <div className="pointer-events-none absolute -bottom-36 -right-12 h-[520px] w-[520px] rounded-full border-[28px] border-[#E87845]/35" />
      <div className="pointer-events-none absolute -bottom-16 right-56 h-[360px] w-[360px] rounded-full border-[22px] border-[#E87845]/30" />

      <div className="relative z-10 mx-auto grid max-w-6xl items-start gap-10 md:grid-cols-2">
        <div className="text-center">
          <div className="mb-5 flex items-center justify-center gap-3">
            <a
              href="https://wa.me/97248306544"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#06B45B] text-white shadow"
              aria-label="WhatsApp"
            >
              <MessageCircle size={22} />
            </a>
            <span className="h-6 w-px bg-black/35" />
            <a href="tel:*3691" className="text-2xl font-black">
              *3691
            </a>
          </div>

          <div className="space-y-1 text-xl leading-8">
            <p>ראשון-חמישי : 08:30-20:00</p>
            <p>שישי : 08:30-15:00</p>
            <p>שד. הנשיא 99, חיפה</p>
            <a href="mailto:Ranin.meday@gmail.com" className="block">
              Ranin.meday@gmail.com
            </a>
          </div>

          <div className="mt-8 flex justify-center gap-6 text-white">
            <a
              href="https://www.instagram.com/meday_beautycenter/?igsh=eTJjMjVxamh1bDlq"
              aria-label="Instagram"
              className="transition hover:scale-110"
            >
              <Instagram size={22} />
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61559205189105"
              aria-label="Facebook"
              className="transition hover:scale-110"
            >
              <Facebook size={22} />
            </a>
          </div>

          <p className="mt-16 text-lg">© כל הזכויות שמורות למיידיי</p>
        </div>

        <div className="mx-auto w-full max-w-[520px] overflow-hidden rounded-sm bg-white shadow-xl">
          <iframe
            title="MeDay Haifa map"
            src="https://www.google.com/maps?q=%D7%A9%D7%93%D7%A8%D7%95%D7%AA%20%D7%94%D7%A0%D7%A9%D7%99%D7%90%2099%20%D7%97%D7%99%D7%A4%D7%94&output=embed"
            className="h-56 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}

export default function ProfessionalTeamPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-[#F9D9C2] text-[#1A0E06]">
      <section className="relative min-h-[430px] overflow-hidden pt-24">
        <div className="absolute inset-0 grid grid-cols-3 opacity-35">
          {[slide2, facialTreatment, spa].map((image, index) => (
            <img
              key={image}
              src={image}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: index === 0 ? "left center" : "center" }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-white/68" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-[#F9D9C2]/25 to-[#F9D9C2]" />

        <div className="relative z-10 mx-auto flex min-h-[330px] max-w-6xl items-center justify-center px-6 text-center">
          <div>
            <div className="mb-2 flex items-center justify-center gap-2 text-[#F28A5B]">
              <Sparkles size={18} />
              <Sparkles size={28} />
              <Sparkles size={16} />
            </div>
            <p className="font-serif text-5xl uppercase tracking-[0.2em] text-[#F28A5B] md:text-7xl">
              Our Team
            </p>
            <h1 className="-mt-4 text-6xl font-black leading-none text-[#4A8F9B] md:text-8xl">
              צוות מקצועי
            </h1>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-6 py-14 md:py-16">
        <div className="pointer-events-none absolute -right-36 top-12 h-[420px] w-[420px] rounded-full border-[24px] border-white/20" />
        <div className="pointer-events-none absolute -left-20 bottom-20 h-[320px] w-[320px] rounded-full border-[22px] border-[#F28A5B]/15" />

        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="mb-12 h-5 rounded-sm bg-[#4A8F9B]" />

          <div className="grid gap-x-16 gap-y-20 md:grid-cols-2">
            {teamMembers.map((member, index) => (
              <TeamCard key={member.name} member={member} index={index} />
            ))}
          </div>
        </div>
      </section>

      <ContactFooter />
    </div>
  );
}
