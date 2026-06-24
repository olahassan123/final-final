import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  UserRound,
  X,
} from "lucide-react";
import { serviceCatalog } from "../data/serviceCatalog";
import { useAuth } from "../context/useAuth";

const navLinks = [
  { label: "אודות", href: "#about" },
  { label: "סוגי טיפולים", href: "#treatments", isTreatmentsDropdown: true },
  { label: "גלריה", href: "#gallery" },
  { label: "דרושים", href: "/recruitment" },
  { label: "צור קשר", href: "#contact" },
];

const PROFESSIONAL_TEAM_PATH = "/professional-team";

const displayNavLinks = [
  {
    label: "אודות",
    href: "/about",
    dropdown: [{ label: "צוות מקצועי", href: PROFESSIONAL_TEAM_PATH }],
  },
  ...navLinks.slice(1),
];

const roleLabels = {
  admin: "Manager",
  secretary: "Secretary",
  customer: "Customer",
};

const APPOINTMENT_WHATSAPP_URL =
  "https://wa.me/97248306544?text=%D7%A9%D7%9C%D7%95%D7%9D%2C%20%D7%90%D7%A0%D7%99%20%D7%A8%D7%95%D7%A6%D7%94%20%D7%9C%D7%AA%D7%90%D7%9D%20%D7%AA%D7%95%D7%A8%20%D7%91-MeDay";

function dashboardPathForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "secretary") return "/secretary";
  if (role === "customer") return "/client";
  return "/";
}

function openChatbot() {
  window.dispatchEvent(new CustomEvent("openChatbot"));
}

function openAppointmentWhatsApp() {
  window.open(APPOINTMENT_WHATSAPP_URL, "_blank", "noopener,noreferrer");
}

function resetWindowScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function getTreatmentCategoryLinks() {
  return serviceCatalog.map((category) => ({
    label: category.name,
    href: `/categories/${category.slug}`,
  }));
}

function DropdownItemLink({ item, onClick, className }) {
  if (item.external) {
    return (
      <a href={item.href} onClick={onClick} className={className}>
        {item.label}
      </a>
    );
  }

  return (
    <Link to={item.href} onClick={onClick} className={className}>
      {item.label}
    </Link>
  );
}

function LogoMark() {
  return (
    <div style={{
      direction: 'ltr',
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      userSelect: 'none',
      gap: '0px',
    }}>

      {/* top ornament */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
        <div style={{ width: '22px', height: '0.5px', background: 'linear-gradient(to right, transparent, #C4795A)' }} />
        <svg width="7" height="7" viewBox="0 0 7 7" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="3.5,0 7,3.5 3.5,7 0,3.5" fill="#C4795A" opacity="0.75" />
          <polygon points="3.5,1.5 5.5,3.5 3.5,5.5 1.5,3.5" fill="#F5EDE3" />
        </svg>
        <div style={{ width: '22px', height: '0.5px', background: 'linear-gradient(to left, transparent, #C4795A)' }} />
      </div>

      {/* wordmark: italic copper "Me" + bold dark "Day" */}
      <div style={{ display: 'flex', alignItems: 'baseline', lineHeight: 1 }}>
        <span style={{
          fontFamily: '"Cormorant Garamond", Georgia, serif',
          fontSize: '2.35rem',
          fontWeight: 700,
          fontStyle: 'italic',
          color: '#C4795A',
          lineHeight: 1,
          letterSpacing: '-0.01em',
        }}>
          Me
        </span>
        <span style={{
          fontFamily: '"Abril Fatface", Georgia, serif',
          fontSize: '2.35rem',
          fontWeight: 400,
          color: '#3D2418',
          lineHeight: 1,
          letterSpacing: '0.01em',
        }}>
          Day
        </span>
      </div>

      {/* bottom rule + center diamond */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', marginBottom: '3px', width: '100%' }}>
        <div style={{ flex: 1, height: '0.5px', background: 'linear-gradient(to right, transparent, #C4795A)', opacity: 0.5 }} />
        <svg width="5" height="5" viewBox="0 0 5 5">
          <polygon points="2.5,0 5,2.5 2.5,5 0,2.5" fill="#C4795A" opacity="0.7" />
        </svg>
        <div style={{ flex: 1, height: '0.5px', background: 'linear-gradient(to left, transparent, #C4795A)', opacity: 0.5 }} />
      </div>

      {/* tagline */}
      <div style={{
        fontFamily: '"Cormorant Garamond", Georgia, serif',
        fontSize: '0.46rem',
        fontWeight: 300,
        color: '#3D2418',
        letterSpacing: '0.55em',
        opacity: 0.58,
        textTransform: 'uppercase',
      }}>
        beauty center
      </div>

    </div>
  );
}

export default function Navbar({ onLoginClick }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const closeTimerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isClientPage = location.pathname === "/client";
  const displayUserName = user?.fullName || user?.username;
  const treatmentCategories = useMemo(() => getTreatmentCategoryLinks(), []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsMobileMenuOpen(false);
      setActiveDropdown(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname]);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  const openDropdown = (index) => {
    window.clearTimeout(closeTimerRef.current);
    setActiveDropdown(index);
  };

  const scheduleDropdownClose = () => {
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setActiveDropdown(null);
    }, 180);
  };

  const closeMenus = () => {
    window.clearTimeout(closeTimerRef.current);
    setActiveDropdown(null);
    setIsMobileMenuOpen(false);
  };

  const handleNavClick = (href, event) => {
    if (href.startsWith("#")) {
      event.preventDefault();

      const target = document.querySelector(href);

      if (href === "#contact" && target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (location.pathname !== "/") {
        navigate({ pathname: "/", hash: href });
      } else {
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    navigate("/");
  };

  const handleCategoryNavigate = () => {
    closeMenus();
    resetWindowScroll();
  };

  return (
    <nav
      dir="rtl"
      className="fixed left-0 right-0 top-0 z-50 transition-all duration-500"
      style={{
        background: isScrolled
          ? 'rgba(245, 237, 227, 0.96)'
          : 'rgba(245, 237, 227, 0.88)',
        backdropFilter: 'blur(14px)',
        borderBottom: isScrolled ? '1px solid rgba(196,121,90,0.15)' : 'none',
        boxShadow: isScrolled ? '0 2px 20px rgba(196,121,90,0.10)' : 'none',
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <Link to="/" onClick={resetWindowScroll} className="flex items-center flex-shrink-0">
            <LogoMark />
          </Link>

          <div className="hidden items-center gap-x-8 lg:flex">
            {displayNavLinks.map((link, index) => {
              const isTreatmentsDropdown = link.isTreatmentsDropdown;
              const dropdownItems = isTreatmentsDropdown ? treatmentCategories : link.dropdown;
              const isAboutDropdown = link.href === "/about";

              return (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => dropdownItems && openDropdown(index)}
                  onMouseLeave={() => dropdownItems && scheduleDropdownClose()}
                >
                  {dropdownItems ? (
                    isAboutDropdown ? (
                      <Link
                        to={link.href}
                        onFocus={() => openDropdown(index)}
                        onClick={() => {
                          closeMenus();
                          resetWindowScroll();
                        }}
                        className={`flex items-center gap-1 font-semibold transition-colors ${
                          location.pathname === link.href
                            ? "text-primary"
                            : "text-gray-700 hover:text-primary-dark"
                        }`}
                      >
                        {link.label}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            activeDropdown === index ? "rotate-180" : ""
                          }`}
                        />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onFocus={() => openDropdown(index)}
                        onClick={() => {
                          window.clearTimeout(closeTimerRef.current);
                          setActiveDropdown((current) => (current === index ? null : index));
                        }}
                        className="flex items-center gap-1 font-medium text-gray-700 transition-colors hover:text-primary-dark"
                      >
                        {link.label}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            activeDropdown === index ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    )
                  ) : link.href.startsWith("#") ? (
                    <a
                      href={link.href}
                      onClick={(event) => handleNavClick(link.href, event)}
                      className="font-medium text-gray-700 transition-colors hover:text-primary-dark"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      to={link.href}
                      onClick={resetWindowScroll}
                      className="font-medium text-gray-700 transition-colors hover:text-primary-dark"
                    >
                      {link.label}
                    </Link>
                  )}

                  {dropdownItems && activeDropdown === index ? (
                    <div
                      className={`absolute right-0 top-full mt-3 overflow-hidden shadow-2xl shadow-[#9B5C38]/15 backdrop-blur-xl ${
                        isAboutDropdown
                          ? "w-44 rounded-none border-0 bg-[#F8DCC9]"
                          : "w-80 rounded-2xl border border-accent-light bg-white/95 p-2"
                      }`}
                      onMouseEnter={() => openDropdown(index)}
                      onMouseLeave={scheduleDropdownClose}
                    >
                      <div
                        className={`grid max-h-[70vh] grid-cols-1 overflow-y-auto ${
                          isAboutDropdown ? "gap-0" : "gap-1 sm:grid-cols-2"
                        }`}
                      >
                        {dropdownItems.map((item) => (
                          <DropdownItemLink
                            key={item.href + item.label}
                            onClick={handleCategoryNavigate}
                            item={item}
                            className={`block px-3 py-2.5 text-right text-sm font-semibold transition ${
                              isAboutDropdown
                                ? "text-[#3D2418] hover:bg-[#F1C7AB]"
                                : "rounded-xl text-gray-700 hover:bg-secondary hover:text-primary-dark"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="hidden items-center gap-4 lg:flex">
            {user ? (
              <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-white/50 px-3 py-2 text-sm text-primary-dark">
                <UserRound size={17} />
                <Link to={dashboardPathForRole(user.role)} className="font-semibold hover:text-primary">
                  <bdi dir="auto">{displayUserName}</bdi> · {roleLabels[user.role] ?? user.role}
                </Link>
                <Link to="/account-settings" className="rounded-full px-2 py-1 text-xs font-bold hover:bg-primary/10">
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full p-1 text-primary-dark transition hover:bg-primary/10"
                  aria-label="יציאה"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-primary/20 px-5 py-2 text-primary-dark transition-all hover:bg-primary/5"
                onClick={onLoginClick}
              >
                <LogIn size={18} />
                <span>כניסה</span>
              </button>
            )}

            {!isClientPage ? (
              <>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-primary/20 px-5 py-2 text-primary-dark transition-all hover:bg-primary/5"
                  onClick={openChatbot}
                >
                  <MessageSquare size={18} />
                  <span>ייעוץ AI</span>
                </button>

                <button
                  type="button"
                  onClick={openAppointmentWhatsApp}
                  className="rounded-full bg-primary px-8 py-2.5 font-medium text-white shadow-md transition-all hover:bg-primary-dark hover:shadow-primary/20"
                >
                  תיאום תור
                </button>
              </>
            ) : null}
          </div>

          <button
            type="button"
            className="p-2 text-gray-700 lg:hidden"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            aria-label="תפריט"
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div className="max-h-[calc(100vh-5rem)] space-y-4 overflow-y-auto border-t border-gray-100 bg-secondary p-6 shadow-xl animate-in slide-in-from-right duration-300 lg:hidden">
          <div className="flex justify-center pb-2">
            <LogoMark />
          </div>
          {displayNavLinks.map((link) => {
            const dropdownItems = link.isTreatmentsDropdown ? treatmentCategories : link.dropdown;
            const isAboutDropdown = link.href === "/about";

            return (
              <div key={link.label} className="border-b border-gray-50 pb-3">
                {dropdownItems ? (
                  <div className="space-y-2 py-2">
                    {isAboutDropdown ? (
                      <Link
                        to={link.href}
                        className="block text-base font-bold text-gray-800"
                        onClick={handleCategoryNavigate}
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <p className="text-base font-bold text-gray-800">{link.label}</p>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {dropdownItems.map((item) => (
                        <DropdownItemLink
                          key={item.href + item.label}
                          onClick={handleCategoryNavigate}
                          item={item}
                          className="block rounded-xl bg-primary/5 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-primary/10 hover:text-primary-dark"
                        />
                      ))}
                    </div>
                  </div>
                ) : link.href.startsWith("#") ? (
                  <a
                    href={link.href}
                    onClick={(event) => handleNavClick(link.href, event)}
                    className="block py-2 text-lg font-medium text-gray-800"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    to={link.href}
                    className="block py-2 text-lg font-medium text-gray-800"
                    onClick={handleCategoryNavigate}
                  >
                    {link.label}
                  </Link>
                )}
              </div>
            );
          })}

          {user ? (
            <div className="rounded-xl border border-primary/20 bg-white/60 p-3">
              <Link
                to={dashboardPathForRole(user.role)}
                className="mb-2 flex items-center justify-between text-sm font-bold text-primary-dark"
                onClick={handleCategoryNavigate}
              >
                <span>
                  <bdi dir="auto">{displayUserName}</bdi> · {roleLabels[user.role] ?? user.role}
                </span>
                <UserRound size={18} />
              </Link>
              <Link
                to="/account-settings"
                className="mb-2 flex w-full items-center justify-center rounded-xl border border-primary/20 py-3 font-bold text-primary-dark"
                onClick={handleCategoryNavigate}
              >
                Settings
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 py-3 font-bold text-primary-dark"
              >
                <LogOut size={18} />
                יציאה
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                closeMenus();
                onLoginClick?.();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 py-4 font-bold text-primary-dark"
            >
              <LogIn size={18} />
              כניסה
            </button>
          )}

          {!isClientPage ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  closeMenus();
                  openChatbot();
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-primary/20 py-4 font-bold text-primary-dark"
              >
                <MessageSquare size={18} />
                ייעוץ AI
              </button>
              <button
                type="button"
                onClick={() => {
                  closeMenus();
                  openAppointmentWhatsApp();
                }}
                className="rounded-xl bg-primary py-4 font-bold text-white"
              >
                תיאום תור מהיר
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
