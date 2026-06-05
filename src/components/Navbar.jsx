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

const roleLabels = {
  admin: "מנהל",
  employee: "עובד",
  client: "לקוח",
};

const APPOINTMENT_WHATSAPP_URL =
  "https://wa.me/97248306544?text=%D7%A9%D7%9C%D7%95%D7%9D%2C%20%D7%90%D7%A0%D7%99%20%D7%A8%D7%95%D7%A6%D7%94%20%D7%9C%D7%AA%D7%90%D7%9D%20%D7%AA%D7%95%D7%A8%20%D7%91-MeDay";

function dashboardPathForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "employee") return "/secretary";
  if (role === "client") return "/client";
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

function LogoMark() {
  const brown = '#3D2418';
  const font   = '"Abril Fatface", Georgia, serif';
  const sz     = '2.2rem';

  const letter = { fontFamily: font, fontSize: sz, fontWeight: 400, color: brown, lineHeight: 1 };

  const raised = {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
    marginBottom: '-11px',
  };

  return (
    <div style={{ direction: 'ltr', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none' }}>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0px' }}>

        <span style={letter}>M</span>

        <span style={raised}>
          <span style={letter}>E</span>
          <span style={{ fontSize: '0.5rem', color: brown, lineHeight: 1 }}>✦</span>
        </span>

        <span style={letter}>D</span>

        <span style={raised}>
          <span style={letter}>A</span>
          <span style={{ fontSize: '0.5rem', color: brown, lineHeight: 1 }}>✦</span>
        </span>

        <span style={letter}>Y</span>

      </div>

      {/* beauty center */}
      <div style={{
        fontFamily: '"Cormorant Garamond", Georgia, serif',
        fontSize: '0.55rem',
        fontWeight: 400,
        color: brown,
        letterSpacing: '0.40em',
        marginTop: '14px',
        opacity: 0.70,
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

      if (location.pathname !== "/") {
        navigate(`/${href}`);
      } else {
        document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
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
            {navLinks.map((link, index) => {
              const isTreatmentsDropdown = link.isTreatmentsDropdown;
              const dropdownItems = isTreatmentsDropdown ? treatmentCategories : link.dropdown;

              return (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => dropdownItems && openDropdown(index)}
                  onMouseLeave={() => dropdownItems && scheduleDropdownClose()}
                >
                  {dropdownItems ? (
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
                      className="absolute right-0 top-full mt-3 w-80 overflow-hidden rounded-2xl border border-accent-light bg-white/95 p-2 shadow-2xl shadow-[#9B5C38]/15 backdrop-blur-xl"
                      onMouseEnter={() => openDropdown(index)}
                      onMouseLeave={scheduleDropdownClose}
                    >
                      <div className="grid max-h-[70vh] grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                        {dropdownItems.map((item) => (
                          <Link
                            key={item.href + item.label}
                            to={item.href}
                            onClick={handleCategoryNavigate}
                            className="block rounded-xl px-3 py-2.5 text-right text-sm font-semibold text-gray-700 transition hover:bg-secondary hover:text-primary-dark"
                          >
                            {item.label}
                          </Link>
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
          {navLinks.map((link) => {
            const dropdownItems = link.isTreatmentsDropdown ? treatmentCategories : link.dropdown;

            return (
              <div key={link.label} className="border-b border-gray-50 pb-3">
                {dropdownItems ? (
                  <div className="space-y-2 py-2">
                    <p className="text-base font-bold text-gray-800">{link.label}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {dropdownItems.map((item) => (
                        <Link
                          key={item.href + item.label}
                          to={item.href}
                          onClick={handleCategoryNavigate}
                          className="block rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-primary/5 hover:text-primary-dark"
                        >
                          {item.label}
                        </Link>
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
