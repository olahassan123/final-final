import React from 'react';
import { Mail, Phone, MapPin, Instagram, Facebook, Clock, MessageCircle } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-primary-dark text-white py-16">
      <div className="container mx-auto px-6">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
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
