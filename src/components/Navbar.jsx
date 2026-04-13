import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, ChevronDown, MessageSquare } from "lucide-react";

const navLinks = [
  { label: "אודות", href: "#about" },
  {
    label: "סוגי טיפולים",
    href: "#treatments",
    dropdown: [
      { label: "טיפולי קוסמטיקה", href: "/categories/cosmetology" },
      { label: "טיפולי פנים", href: "/categories/cosmetology" },
      { label: "טיפולי גוף", href: "/categories/body-treatments" },
      { label: "טיפולי לייזר", href: "/categories/hair-removal" },
    ],
  },
  { label: "גלריה", href: "#gallery" },
  { label: "דרושים", href: "#careers" },
  { label: "צור קשר", href: "#contact" },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setActiveDropdown(null);
  }, [location]);

  const handleNavClick = (href, e) => {
    if (href.startsWith("#")) {
      e.preventDefault();

      if (location.pathname !== "/") {
        navigate("/" + href);
      } else {
        const element = document.querySelector(href);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }
    }

    setIsMobileMenuOpen(false);
  };

  return (
    <nav
      dir="rtl"
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "border-b border-pink-100 bg-white/80 shadow-sm backdrop-blur-lg"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <Link to="/" className="text-2xl font-serif font-bold tracking-tight text-primary">
            MeDay
          </Link>

          <div className="hidden items-center gap-x-8 lg:flex">
            {navLinks.map((link, index) => (
              <div
                key={link.label}
                className="relative group"
                onMouseEnter={() => link.dropdown && setActiveDropdown(index)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                {link.dropdown ? (
                  <button className="flex items-center gap-1 font-medium text-gray-700 transition-colors hover:text-primary">
                    {link.label}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        activeDropdown === index ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                ) : (
                  <a
                    href={link.href}
                    onClick={(e) => handleNavClick(link.href, e)}
                    className="font-medium text-gray-700 transition-colors hover:text-primary"
                  >
                    {link.label}
                  </a>
                )}

                {link.dropdown && activeDropdown === index ? (
                  <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-pink-50 bg-white shadow-xl">
                    {link.dropdown.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className="block px-6 py-3 text-gray-600 transition-colors hover:bg-pink-50 hover:text-primary"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="hidden items-center gap-4 lg:flex">
            <button
              className="flex items-center gap-2 rounded-full border border-primary/20 px-5 py-2 text-primary transition-all hover:bg-primary/5"
              onClick={() => {}}
            >
              <MessageSquare size={18} />
              <span>ייעוץ AI</span>
            </button>

            <button className="rounded-full bg-primary px-8 py-2.5 font-medium text-white shadow-md transition-all hover:bg-primary/90 hover:shadow-primary/20">
              תיאום תור
            </button>
          </div>

          <button
            className="p-2 text-gray-700 lg:hidden"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div className="space-y-4 border-t border-gray-100 bg-white p-6 shadow-xl animate-in slide-in-from-right duration-300 lg:hidden">
          {navLinks.map((link) => (
            <div key={link.label} className="border-b border-gray-50 pb-2">
              {link.dropdown ? (
                <div className="space-y-2 py-2">
                  <p className="text-lg font-medium text-gray-800">{link.label}</p>
                  {link.dropdown.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className="block py-1 text-sm text-gray-500 transition-colors hover:text-primary"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <a
                  href={link.href}
                  onClick={(e) => handleNavClick(link.href, e)}
                  className="block py-2 text-lg font-medium text-gray-800"
                >
                  {link.label}
                </a>
              )}
            </div>
          ))}

          <button className="w-full rounded-xl bg-primary py-4 font-bold text-white">
            תיאום תור מהיר
          </button>
        </div>
      ) : null}
    </nav>
  );
}
