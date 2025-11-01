import React, { useMemo, useState } from "react";
import { Link, useRouter } from "@/src/router";
import { useSession } from "@/app/context/sessionContext";
import { motion, AnimatePresence } from "framer-motion";
import { useMobile } from "@/hooks/use-mobile";
import {
  Home,
  FileText,
  MessageSquare,
  BookOpen,
  Menu,
  X,
  Bell,
  LogOut,
  LayoutGrid,
} from "lucide-react";

interface CustomNavProps {
  role?: "delegate" | "chair" | "admin";
  activeLink?: string;
}

interface NavItem {
  name: string;
  to: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

const CustomNav: React.FC<CustomNavProps> = () => {
  const { user: currentUser, logout } = useSession();
  const isMobile = useMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useRouter();

  const navigationItems: NavItem[] = useMemo(
    () => [
      { name: "Home", to: "/home", icon: Home },
      { name: "Live Updates", to: "/live-updates", icon: Bell },
      { name: "Glossary", to: "/glossary", icon: BookOpen },
      { name: "Resolutions", to: "/resolutions", icon: FileText },
      { name: "Speech Repository", to: "/speechrepo", icon: MessageSquare },
      { name: "Messages", to: "/messages", icon: MessageSquare },
    ],
    []
  );

  const adminItems: NavItem[] = useMemo(
    () => [{ name: "Admin Panel", to: "/admin", icon: LayoutGrid }],
    []
  );

  const chairItems: NavItem[] = useMemo(
    () => [{ name: "Chair Dashboard", to: "/chair", icon: LayoutGrid }],
    []
  );

  const availableItems = useMemo(() => {
    const items = [...navigationItems];

    if (currentUser && "adminID" in currentUser) {
      items.push(...adminItems);
    }

    if (currentUser && "chairID" in currentUser) {
      items.push(...chairItems);
    }

    return items;
  }, [adminItems, chairItems, currentUser, navigationItems]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const getDisplayName = () => {
    if (!currentUser) return "";
    return `${currentUser.firstname} ${currentUser.lastname}`;
  };

  const brand = (
    <Link to="/home" className="flex items-center gap-3 text-white">
      <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white/10 shadow-[0_10px_20px_-12px_rgba(12,12,12,0.55)] ring-1 ring-white/25 backdrop-blur">
        <img src="/logo.svg" alt="VOFMUN" className="h-full w-full object-contain" />
      </span>
      <div className="text-left leading-tight">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/70">VOFMUN</p>
        <p className="text-lg font-semibold text-white">Delegate Hub</p>
      </div>
    </Link>
  );

  const getInitials = () => {
    if (!currentUser) return "V";
    const first = currentUser.firstname?.[0] ?? "";
    const last = currentUser.lastname?.[0] ?? "";
    const initials = `${first}${last}`.trim();
    return initials ? initials.toUpperCase() : "V";
  };

  const renderUserDetails = () => {
    if (!currentUser) {
      return null;
    }

    return (
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-semibold uppercase tracking-wide text-white shadow-[0_6px_18px_-12px_rgba(0,0,0,0.45)]">
          {getInitials()}
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">{getDisplayName()}</p>
        </div>
      </div>
    );
  };

  const userDetails = renderUserDetails();

  if (isMobile) {
    return (
      <nav className="relative z-40 border-b border-white/15 bg-gradient-to-r from-deep-red via-dark-burgundy to-deep-red text-white shadow-[0_24px_60px_-28px_rgba(112,30,30,0.55)]">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          {brand}
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:border-white/30 hover:bg-white/20"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-white/15 bg-gradient-to-b from-deep-red via-dark-burgundy to-deep-red px-4 pb-6"
            >
              <div className="space-y-4 pt-4">
                {availableItems.map((item) => {
                  const Icon = item.icon ?? Home;
                  const active = isActive(item.to);
                  return (
                    <Link
                      key={item.name}
                      to={item.to}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                        active
                          ? "border-white/40 bg-white text-deep-red"
                          : "border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/15 hover:text-white"
                      }`}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          active
                            ? "bg-white/30 text-deep-red"
                            : "bg-white/15 text-white"
                        }`}
                      >
                        <Icon size={18} strokeWidth={1.75} />
                      </span>
                      <span className="flex-1 whitespace-nowrap">{item.name}</span>
                    </Link>
                  );
                })}

                <div className="space-y-3 border-t border-white/15 pt-4">
                  {userDetails && (
                    <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3">
                      {userDetails}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      logout();
                      setIsMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/20"
                  >
                    <LogOut size={18} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    );
  }

  return (
    <nav className="relative z-40 border-b border-white/15 bg-gradient-to-r from-deep-red via-dark-burgundy to-deep-red text-white shadow-[0_30px_70px_-32px_rgba(112,30,30,0.55)]">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-6 px-6">
        {brand}

        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur">
            {availableItems.map((item) => {
              const Icon = item.icon ?? Home;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.name}
                  to={item.to}
                  className={`group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-white text-deep-red shadow-[0_15px_25px_-20px_rgba(255,255,255,0.9)]"
                      : "text-white/80 hover:bg-white/15 hover:text-white"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  <span className="whitespace-nowrap">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {userDetails && (
            <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur">
              {userDetails}
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/25"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>

        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:border-white/30 hover:bg-white/20 md:hidden"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
        >
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-white/15 bg-gradient-to-b from-deep-red via-dark-burgundy to-deep-red px-6 pb-6 md:hidden"
          >
            <div className="space-y-4 pt-4">
              {availableItems.map((item) => {
                const Icon = item.icon ?? Home;
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.name}
                    to={item.to}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                      active
                        ? "border-white/40 bg-white text-deep-red"
                        : "border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/15 hover:text-white"
                    }`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        active
                          ? "bg-white/30 text-deep-red"
                          : "bg-white/15 text-white"
                      }`}
                    >
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    <span className="flex-1 whitespace-nowrap">{item.name}</span>
                  </Link>
                );
              })}

              <div className="space-y-3 border-t border-white/15 pt-4">
                {userDetails && (
                  <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3">
                    {userDetails}
                  </div>
                )}
                <button
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/20"
                >
                  <LogOut size={18} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default CustomNav;
