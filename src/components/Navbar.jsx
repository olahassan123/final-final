import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Facebook, Instagram, Menu, X, ChevronDown } from "lucide-react";
import { serviceCatalog } from "../data/serviceCatalog";

const navLinks = [
  { label: "אודות", href: "#about" },
  {
    label: "סוגי טיפולים",
    href: "#treatments",
    dropdown: serviceCatalog.map((category) => ({
      label: category.name,
      href: `/categories/${category.slug}`,
    })),
  },
  { label: "דרושים", href: "/recruitment" },
  { label: "צור קשר", href: "#contact" },
];

function LogoMark() {
  return (
    <img
      src="/logo-transparent.png"
      alt="MeDay beauty center"
      className="h-[72px] w-auto object-contain lg:h-[92px]"
    />
  );
}

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
          ? "border-b border-[#e9dfd8] bg-white/92 shadow-sm backdrop-blur-lg"
          : "bg-white/86 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto max-w-[1500px] px-5 sm:px-8 lg:px-14">
        <div className="flex h-[118px] items-center justify-between lg:h-[164px]">
          <Link to="/" className="flex items-center" aria-label="MeDay home">
            <LogoMark />
          </Link>

          <div className="hidden items-center gap-x-9 text-lg font-medium text-black lg:flex">
            {navLinks.map((link, index) => (
              <div
                key={link.label}
                className="relative group"
                onMouseEnter={() => link.dropdown && setActiveDropdown(index)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                {link.dropdown ? (
                  <button className="flex items-center gap-1 transition-colors hover:text-[#4F8D96]">
                    {link.label}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        activeDropdown === index ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                ) : link.href.startsWith("/") ? (
                  <Link
                    to={link.href}
                    className="transition-colors hover:text-[#4F8D96]"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    href={link.href}
                    onClick={(e) => handleNavClick(link.href, e)}
                    className="transition-colors hover:text-[#4F8D96]"
                  >
                    {link.label}
                  </a>
                )}

                {link.dropdown && activeDropdown === index ? (
                  <div
                    className="absolute right-1/2 top-full mt-3 w-52 translate-x-1/2 overflow-hidden border border-[#ead7c6]/80 bg-white/95 py-1 text-right shadow-[0_18px_45px_rgba(33,23,19,0.14)] backdrop-blur-md"
                    style={{ borderRadius: 8 }}
                  >
                    {link.dropdown.map((item, itemIndex) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={`block px-4 py-2.5 text-[15px] font-medium leading-5 text-[#211713] transition-colors hover:bg-[#FAF1E7] hover:text-[#C4795A] ${
                          itemIndex === 0 ? "text-[#C4795A]" : ""
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="hidden items-center gap-5 text-[#4F8D96] lg:flex">
            <a
              href="https://www.instagram.com/meday_beautycenter/?igsh=eTJjMjVxamh1bDlq"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="transition-colors hover:text-[#C4795A]"
            >
              <Instagram size={19} />
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61559205189105"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="transition-colors hover:text-[#C4795A]"
            >
              <Facebook size={18} className="fill-current" />
            </a>
            <a href="tel:*3691" className="text-xl font-black transition-colors hover:text-[#C4795A]">
              *3691
            </a>
            <button
              type="button"
              onClick={() => navigate("/categories")}
              className="border border-[#4F8D96] px-7 py-2 text-lg font-medium text-black transition-all hover:bg-[#4F8D96] hover:text-white"
              style={{ borderRadius: 3 }}
            >
              לתיאום תור
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
              ) : link.href.startsWith("/") ? (
                <Link
                  to={link.href}
                  className="block py-2 text-lg font-medium text-gray-800"
                >
                  {link.label}
                </Link>
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

          <button onClick={() => navigate("/categories")} className="w-full rounded-xl bg-[#4F8D96] py-4 font-bold text-white">
            תיאום תור מהיר
          </button>
        </div>
      ) : null}
    </nav>
  );
}
