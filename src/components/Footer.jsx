import React from "react";
import { Facebook, Instagram, MessageCircle } from "lucide-react";

function PetalMark() {
  return (
    <div className="pointer-events-none absolute bottom-[-115px] right-[70px] hidden h-[430px] w-[520px] opacity-22 md:block">
      {Array.from({ length: 6 }).map((_, index) => (
        <span
          key={index}
          className="absolute left-1/2 top-1/2 h-[250px] w-[250px] origin-bottom rounded-full border-[10px] border-[#F7B084]"
          style={{ transform: `translate(-50%, -90%) rotate(${index * 60}deg)` }}
        />
      ))}
      <span className="absolute left-1/2 top-1/2 h-[250px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[10px] border-[#F7B084]" />
    </div>
  );
}

export default function Footer() {
  return (
    <footer id="contact" dir="rtl" className="relative overflow-hidden bg-[#F48B5D] text-black">
      <PetalMark />

      <div className="relative z-10 mx-auto grid min-h-[335px] max-w-7xl items-center gap-10 px-5 py-12 md:grid-cols-[1fr_1.08fr] md:px-10 lg:px-14">
        <div className="text-center text-[22px] font-bold leading-8 md:pr-20">
          <div className="mb-4 flex items-center justify-center gap-3">
            <a
              href="https://wa.me/97248306544"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#03B55B] text-white shadow-sm"
            >
              <MessageCircle size={23} className="fill-white" />
            </a>
            <span className="h-6 w-px bg-black" />
            <a href="tel:*3691" className="font-black tracking-wide">
              *3691
            </a>
          </div>

          <p>ראשון-חמישי: 08:30-20:00</p>
          <p>שישי : 08:30-15:00</p>
          <p>שד. הנשיא 99, חיפה</p>
          <a href="mailto:Ranin.meday@gmail.com" className="mt-4 block font-medium">
            Ranin.meday@gmail.com
          </a>

          <div className="mt-8 flex justify-center gap-7 text-white">
            <a
              href="https://www.instagram.com/meday_beautycenter/?igsh=eTJjMjVxamh1bDlq"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="transition-transform hover:-translate-y-0.5"
            >
              <Instagram size={22} />
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61559205189105"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="transition-transform hover:-translate-y-0.5"
            >
              <Facebook size={21} className="fill-white" />
            </a>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[520px]">
          <iframe
            title="MeDay location map"
            src="https://maps.google.com/maps?q=%D7%A9%D7%93%D7%A8%D7%95%D7%AA%20%D7%94%D7%A0%D7%A9%D7%99%D7%90%2099%20%D7%97%D7%99%D7%A4%D7%94&t=&z=15&ie=UTF8&iwloc=&output=embed"
            className="h-[190px] w-full border-0 bg-white shadow-sm"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>

      <div className="relative z-10 pb-7 text-center text-xl font-medium">
        © כל הזכויות שמורות למידיי
      </div>
    </footer>
  );
}
