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
    <Link to="/home" className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[0_4px_12px_-6px_rgba(112,30,30,0.35)] ring-1 ring-deep-red/15">
        <img src="/logo.svg" alt="VOFMUN" className="h-full w-full object-contain" />
      </span>
      <div className="text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-deep-red/70">VOFMUN</p>
        <p className="text-lg font-semibold text-deep-red">Delegate Hub</p>
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
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-deep-red text-xs font-semibold uppercase tracking-wide text-white">
          {getInitials()}
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-deep-red">{getDisplayName()}</p>
        </div>
      </div>
    );
  };

  const userDetails = renderUserDetails();

  if (isMobile) {
    return (
      <nav className="sticky top-0 z-50 border-b border-deep-red/10 bg-white text-deep-red shadow-[0_18px_42px_-32px_rgba(112,30,30,0.25)]">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          {brand}
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="rounded-full border border-deep-red/15 bg-white p-2 text-deep-red transition hover:border-deep-red/40 hover:bg-deep-red/5"
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
              className="border-t border-deep-red/10 bg-white px-4 pb-6"
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
                          ? "border-deep-red bg-deep-red/10 text-deep-red"
                          : "border-deep-red/10 bg-white text-deep-red/80 hover:border-deep-red/40 hover:bg-deep-red/5 hover:text-deep-red"
                      }`}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          active
                            ? "bg-deep-red/20 text-deep-red"
                            : "bg-deep-red/10 text-deep-red"
                        }`}
                      >
                        <Icon size={18} strokeWidth={1.75} />
                      </span>
                      <span className="flex-1 whitespace-nowrap">{item.name}</span>
                    </Link>
                  );
                })}

                <div className="space-y-3 border-t border-deep-red/10 pt-4">
                  {userDetails && (
                    <div className="rounded-xl border border-deep-red/15 bg-deep-red/5 px-4 py-3">
                      {userDetails}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      logout();
                      setIsMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-deep-red/20 bg-white px-4 py-2 text-sm font-medium text-deep-red transition-colors hover:border-deep-red/40 hover:bg-deep-red/5"
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
    <nav className="sticky top-0 z-50 border-b border-deep-red/10 bg-white text-deep-red shadow-[0_20px_55px_-32px_rgba(112,30,30,0.25)]">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-4 px-6">
        {brand}

        <div className="hidden flex-1 items-center justify-center overflow-x-auto md:flex">
          <div className="flex items-center gap-1.5 rounded-full border border-deep-red/10 bg-white/90 px-3 py-1.5">
            {availableItems.map((item) => {
              const Icon = item.icon ?? Home;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.name}
                  to={item.to}
                  className={`group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border border-deep-red bg-deep-red/10 text-deep-red"
                      : "text-deep-red/70 hover:bg-deep-red/5 hover:text-deep-red"
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
            <div className="rounded-full border border-deep-red/10 bg-deep-red/5 px-4 py-2">
              {userDetails}
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-full border border-deep-red/20 bg-deep-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-dark-burgundy"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>

        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="rounded-full border border-deep-red/15 bg-white p-2 text-deep-red transition hover:border-deep-red/40 hover:bg-deep-red/5 md:hidden"
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
            className="border-t border-deep-red/10 bg-white px-6 pb-6 md:hidden"
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
                        ? "border-deep-red bg-deep-red/10 text-deep-red"
                        : "border-deep-red/10 bg-white text-deep-red/80 hover:border-deep-red/40 hover:bg-deep-red/5 hover:text-deep-red"
                    }`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        active
                          ? "bg-deep-red/20 text-deep-red"
                          : "bg-deep-red/10 text-deep-red"
                      }`}
                    >
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    <span className="flex-1 whitespace-nowrap">{item.name}</span>
                  </Link>
                );
              })}

              <div className="space-y-3 border-t border-deep-red/10 pt-4">
                {userDetails && (
                  <div className="rounded-xl border border-deep-red/15 bg-deep-red/5 px-4 py-3">
                    {userDetails}
                  </div>
                )}
                <button
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-deep-red/20 bg-white px-4 py-2 text-sm font-medium text-deep-red transition-colors hover:border-deep-red/40 hover:bg-deep-red/5"
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
