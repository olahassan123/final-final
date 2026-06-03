import React, { useState } from 'react';
import { Mail, Phone, MapPin, Instagram, Facebook, Clock, MessageCircle, Send } from 'lucide-react';
import { saveContactInquiry } from '../api/contactApi';

export default function Footer() {
  const [form, setForm] = useState({ fullName: '', phone: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const updateField = (field, value) => {
    setSubmitted(false);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const fullName = form.fullName.trim();
    const phone = form.phone.trim();
    const message = form.message.trim();

    if (!fullName || !phone || !message) return;

    saveContactInquiry({ fullName, phone, message });
    setForm({ fullName: '', phone: '', message: '' });
    setSubmitted(true);
  };

  return (
    <footer id="contact" className="bg-primary-dark text-white py-16">
      <div className="container mx-auto px-6">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 mb-12">
          {/* Contact Info */}
          <div className="text-center md:text-right">
            <h3 className="text-2xl font-bold mb-6 text-accent-light">צור קשר</h3>
            
            <div className="space-y-4">
              {/* WhatsApp */}
              <div className="flex items-center justify-center md:justify-start gap-3 hover:text-accent-light transition-colors">
                <a href="https://wa.me/97248306544" className="w-10 h-10 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110">
                  <MessageCircle size={20} />
                </a>
                <span className="font-semibold">WhatsApp</span>
              </div>

              {/* Phone */}
              <div className="flex items-center justify-center md:justify-start gap-3 hover:text-accent-light transition-colors">
                <a href="tel:*6931" className="w-10 h-10 bg-accent-light/20 hover:bg-accent-light hover:text-primary-dark text-white rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110">
                  <Phone size={20} />
                </a>
                <span className="font-semibold">טלפון</span>
              </div>

              {/* Email */}
              <div className="flex items-center justify-center md:justify-start gap-3 hover:text-accent-light transition-colors">
                <Mail size={20} />
                <a href="mailto:Ranin.meday@gmail.com" className="font-semibold">
                  Ranin.meday@gmail.com
                </a>
              </div>

              {/* Address */}
              <div className="flex items-start justify-center md:justify-start gap-3 hover:text-accent-light transition-colors">
                <MapPin size={20} className="flex-shrink-0 mt-1" />
                <div className="font-semibold">
                  <p>שד. הנשיא 99, חיפה</p>
                  <p className="text-sm text-accent-light/80">קרוב לבן גוריון</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur-md">
              <h3 className="mb-2 text-center text-2xl font-bold text-accent-light md:text-right">
                השאירו פרטים
              </h3>
              <p className="mb-5 text-center text-sm leading-6 text-accent-light/75 md:text-right">
                כתבו לנו איך נוכל לעזור ונחזור אליכן בהקדם.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3" dir="rtl">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-right">
                    <span className="mb-1 block text-xs font-bold text-accent-light/90">שם מלא</span>
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={(event) => updateField('fullName', event.target.value)}
                      className="w-full rounded-2xl border border-white/15 bg-white/90 px-4 py-3 text-right text-sm text-primary-dark outline-none transition focus:border-accent-light focus:ring-2 focus:ring-accent-light/25"
                      required
                    />
                  </label>

                  <label className="block text-right">
                    <span className="mb-1 block text-xs font-bold text-accent-light/90">טלפון</span>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) => updateField('phone', event.target.value)}
                      className="w-full rounded-2xl border border-white/15 bg-white/90 px-4 py-3 text-right text-sm text-primary-dark outline-none transition focus:border-accent-light focus:ring-2 focus:ring-accent-light/25"
                      required
                    />
                  </label>
                </div>

                <label className="block text-right">
                  <span className="mb-1 block text-xs font-bold text-accent-light/90">איך נוכל לעזור?</span>
                  <textarea
                    rows={4}
                    value={form.message}
                    onChange={(event) => updateField('message', event.target.value)}
                    className="w-full resize-none rounded-2xl border border-white/15 bg-white/90 px-4 py-3 text-right text-sm text-primary-dark outline-none transition focus:border-accent-light focus:ring-2 focus:ring-accent-light/25"
                    required
                  />
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-light px-6 py-3 text-sm font-bold text-primary-dark shadow-lg transition hover:bg-white"
                  >
                    <Send size={16} />
                    שליחה
                  </button>
                  {submitted ? (
                    <p className="text-center text-xs font-bold text-accent-light sm:text-right">
                      הפנייה נשמרה בהצלחה ונציגת MeDay תחזור אלייך.
                    </p>
                  ) : null}
                </div>
              </form>
            </div>
          </div>

          {/* Hours */}
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-6 text-accent-light">שעות פתיחה</h3>
            
            <div className="space-y-3 inline-block">
              <div className="flex items-center gap-2">
                <Clock size={18} />
                <span className="font-semibold">ראשון - חמישי:</span>
              </div>
              <p className="text-accent-light/90 ml-7">08:30 - 20:00</p>

              <div className="flex items-center gap-2 mt-4">
                <Clock size={18} />
                <span className="font-semibold">שישי:</span>
              </div>
              <p className="text-accent-light/90 ml-7">08:30 - 15:00</p>

              <div className="flex items-center gap-2 mt-4">
                <Clock size={18} />
                <span className="font-semibold">שבת:</span>
              </div>
              <p className="text-accent-light/90 ml-7">סגור</p>
            </div>
          </div>

          {/* Social & Branding */}
          <div className="text-center md:text-left">
            <h3 className="text-2xl font-bold mb-6 text-accent-light">עקבי אחרינו</h3>
            
            <div className="flex justify-center md:justify-start gap-6 mb-8">
              <a
                href="https://www.instagram.com/meday_beautycenter/?igsh=eTJjMjVxamh1bDlq"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 bg-accent-light/20 hover:bg-accent-light hover:text-primary-dark text-white rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110"
              >
                <Instagram size={24} />
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61559205189105"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 bg-accent-light/20 hover:bg-accent-light hover:text-primary-dark text-white rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110"
              >
                <Facebook size={24} />
              </a>
            </div>

            <p className="text-accent-light/90 font-light">
              MeDay Beauty Center
            </p>
            <p className="text-accent-light/70 text-sm">
              הנכם בטוחות בידיים המקצועיות ביותר
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-accent-light/20 pt-8"></div>

        {/* Copyright */}
        <div className="text-center">
          <p className="text-accent-light/80 font-light">
            © כל הזכויות שמורות למידיי
          </p>
        </div>
      </div>
    </footer>
  );
}
