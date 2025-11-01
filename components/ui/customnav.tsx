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
      { name: "Speech Repository", to: "/speechrepo", icon: MessageSquare },
      { name: "Resolutions", to: "/resolutions", icon: FileText },
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

  const getUserRole = () => {
    if (!currentUser) return "";
    if ("adminID" in currentUser) return "Administrator";
    if ("chairID" in currentUser) return "Chair";
    if ("delegateID" in currentUser) return "Delegate";
    return "";
  };

  const getDisplayName = () => {
    if (!currentUser) return "";
    return `${currentUser.firstname} ${currentUser.lastname}`;
  };

  const brand = (
    <Link to="/home" className="flex items-center space-x-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-deep-red text-white font-semibold shadow-inner">
        V
      </div>
      <div className="text-left">
        <p className="text-xs uppercase tracking-[0.42em] text-deep-red/70">VOFMUN</p>
        <p className="text-lg font-semibold text-deep-red">Delegate Hub</p>
      </div>
    </Link>
  );

  if (isMobile) {
    return (
      <nav className="sticky top-0 z-50 border-b border-deep-red/10 bg-off-white/95 text-deep-red shadow-[0_18px_42px_-28px_rgba(112,30,30,0.45)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          {brand}
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="rounded-full border border-deep-red/15 bg-white/60 p-2 text-deep-red transition hover:border-deep-red/40 hover:bg-white"
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
              className="border-t border-deep-red/10 bg-off-white px-4 pb-6"
            >
              <div className="space-y-3 pt-4">
                {availableItems.map((item) => {
                  const Icon = item.icon ?? Home;
                  const active = isActive(item.to);
                  return (
                    <Link
                      key={item.name}
                      to={item.to}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-all ${
                        active
                          ? "border-transparent bg-deep-red text-white shadow-[0_20px_40px_-28px_rgba(112,30,30,0.75)]"
                          : "border-deep-red/10 bg-white/70 text-deep-red/80 hover:bg-white hover:text-deep-red"
                      }`}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          active
                            ? "bg-white/20 text-white"
                            : "bg-deep-red/10 text-deep-red"
                        }`}
                      >
                        <Icon size={18} strokeWidth={1.75} />
                      </span>
                      <span className="flex-1 whitespace-nowrap">{item.name}</span>
                    </Link>
                  );
                })}

                <div className="border-t border-deep-red/10 pt-4">
                  <div className="px-1 pb-3">
                    <p className="text-sm font-semibold text-deep-red">Hello {getDisplayName()}</p>
                    <p className="text-xs uppercase tracking-[0.28em] text-deep-red/60">{getUserRole()}</p>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setIsMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-deep-red px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-dark-burgundy"
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
    <nav className="sticky top-0 z-50 border-b border-deep-red/10 bg-off-white/90 text-deep-red shadow-[0_24px_55px_-30px_rgba(112,30,30,0.5)] backdrop-blur">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-6 px-6">
        {brand}

        <div className="hidden flex-1 md:flex items-center justify-center">
          <div className="flex items-center gap-1.5 rounded-full border border-deep-red/10 bg-white/70 px-3 py-1.5 shadow-[0_12px_32px_-24px_rgba(112,30,30,0.45)]">
            {availableItems.map((item) => {
              const Icon = item.icon ?? Home;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.name}
                  to={item.to}
                  className={`group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    active
                      ? "bg-deep-red text-white shadow-[0_18px_36px_-22px_rgba(112,30,30,0.65)]"
                      : "text-deep-red/75 hover:bg-deep-red/10 hover:text-deep-red"
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

        <div className="hidden items-center gap-4 md:flex">
          <div className="text-right">
            <p className="text-sm font-semibold text-deep-red">{getDisplayName()}</p>
            <p className="text-xs uppercase tracking-[0.26em] text-deep-red/60">{getUserRole()}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-full bg-deep-red px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-dark-burgundy"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>

        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="md:hidden rounded-full border border-deep-red/15 bg-white/60 p-2 text-deep-red transition hover:border-deep-red/40 hover:bg-white"
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
            className="border-t border-deep-red/10 bg-off-white px-6 pb-6 md:hidden"
          >
            <div className="space-y-3 pt-4">
              {availableItems.map((item) => {
                const Icon = item.icon ?? Home;
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.name}
                    to={item.to}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-all ${
                      active
                        ? "border-transparent bg-deep-red text-white shadow-[0_20px_40px_-28px_rgba(112,30,30,0.75)]"
                        : "border-deep-red/10 bg-white/70 text-deep-red/80 hover:bg-white hover:text-deep-red"
                    }`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        active
                          ? "bg-white/20 text-white"
                          : "bg-deep-red/10 text-deep-red"
                      }`}
                    >
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    <span className="flex-1 whitespace-nowrap">{item.name}</span>
                  </Link>
                );
              })}

              <div className="border-t border-deep-red/10 pt-4">
                <div className="px-1 pb-3">
                  <p className="text-sm font-semibold text-deep-red">Hello {getDisplayName()}</p>
                  <p className="text-xs uppercase tracking-[0.28em] text-deep-red/60">{getUserRole()}</p>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-deep-red px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-dark-burgundy"
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
