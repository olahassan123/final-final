import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown, MessageSquare } from 'lucide-react';

const navLinks = [
  { label: 'אודות', href: '#about' },
  {
    label: 'סוגי טיפולים',
    href: '#treatments',
    dropdown: [
      { label: 'טיפולי קוסמטיקה', href: '/treatments/cosmetology' },
      { label: 'טיפולי פנים', href: '/treatments/facial' },
      { label: 'טיפולי גוף', href: '/treatments/body' },
      { label: 'טיפולי לייזר', href: '/treatments/laser' },
    ],
  },
  { label: 'גלריה', href: '#gallery' },
  { label: 'דרושים', href: '#careers' },
  { label: 'צור קשר', href: '#contact' },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setActiveDropdown(null);
  }, [location]);

  const handleNavClick = (href, e) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      if (location.pathname !== '/') {
        navigate('/' + href);
      } else {
        const element = document.querySelector(href);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <nav
      dir="rtl" // Setting Right-to-Left for Hebrew
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? 'bg-white/80 backdrop-blur-lg border-b border-pink-100 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo */}
          <Link to="/" className="text-2xl font-serif font-bold text-primary tracking-tight">
            MeDay
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-x-8">
            {navLinks.map((link, index) => (
              <div
                key={index}
                className="relative group"
                onMouseEnter={() => link.dropdown && setActiveDropdown(index)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                {link.dropdown ? (
                  <button className="flex items-center gap-1 text-gray-700 hover:text-primary transition-colors font-medium">
                    {link.label}
                    <ChevronDown className={`w-4 h-4 transition-transform ${activeDropdown === index ? 'rotate-180' : ''}`} />
                  </button>
                ) : (
                  <a
                    href={link.href}
                    onClick={(e) => handleNavClick(link.href, e)}
                    className="text-gray-700 hover:text-primary transition-colors font-medium"
                  >
                    {link.label}
                  </a>
                )}

                {/* Dropdown Menu */}
                {link.dropdown && activeDropdown === index && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-pink-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {link.dropdown.map((item, i) => (
                      <Link
                        key={i}
                        to={item.href}
                        className="block px-6 py-3 text-gray-600 hover:bg-pink-50 hover:text-primary transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="hidden lg:flex items-center gap-4">
            <button 
              className="flex items-center gap-2 text-primary border border-primary/20 px-5 py-2 rounded-full hover:bg-primary/5 transition-all"
              onClick={() => {/* Toggle Chatbot State Here */}}
            >
              <MessageSquare size={18} />
              <span>ייעוץ AI</span>
            </button>
            <button className="bg-primary text-white px-8 py-2.5 rounded-full font-medium hover:bg-primary/90 shadow-md hover:shadow-primary/20 transition-all">
              תיאום תור
            </button>
          </div>

          {/* Mobile Toggle */}
          <button
            className="lg:hidden p-2 text-gray-700"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 p-6 space-y-4 shadow-xl animate-in slide-in-from-right duration-300">
          {navLinks.map((link, index) => (
             <div key={index} className="border-b border-gray-50 pb-2">
                {/* Mobile links logic... */}
                <a href={link.href} className="text-lg font-medium text-gray-800 block py-2">{link.label}</a>
             </div>
          ))}
          <button className="w-full bg-primary text-white py-4 rounded-xl font-bold">תיאום תור מהיר</button>
        </div>
      )}
    </nav>
  );
}