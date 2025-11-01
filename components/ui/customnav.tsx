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
    <Link to="/home" className="flex items-center gap-3 text-slate-100">
      <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-[#1e293b] shadow-[0_10px_24px_-14px_rgba(15,23,42,0.65)] ring-1 ring-[#334155]">
        <img src="/logo.svg" alt="VOFMUN" className="h-full w-full object-contain" />
      </span>
      <div className="text-left leading-tight">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">VOFMUN</p>
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
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1f2937] text-xs font-semibold uppercase tracking-wide text-slate-200 shadow-[0_8px_22px_-14px_rgba(15,23,42,0.55)]">
          {getInitials()}
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-100">{getDisplayName()}</p>
        </div>
      </div>
    );
  };

  const userDetails = renderUserDetails();

  if (isMobile) {
    return (
      <nav className="relative z-40 border-b border-[#1f2937] bg-[#0b1120] text-slate-100">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          {brand}
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="rounded-full border border-[#1f2937] bg-[#111c2f] p-2 text-slate-200 transition hover:border-[#334155] hover:bg-[#16213b]"
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
              className="border-t border-[#1f2937] bg-[#0b1120] px-4 pb-6"
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
                          ? "border-[#334155] bg-white text-[#0b1120]"
                          : "border-transparent bg-[#111c2f] text-slate-200 hover:border-[#1f2937] hover:bg-[#16213b] hover:text-white"
                      }`}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          active
                            ? "bg-[#0b1120] text-white"
                            : "bg-[#1f2937] text-slate-200"
                        }`}
                      >
                        <Icon size={18} strokeWidth={1.75} />
                      </span>
                      <span className="flex-1 whitespace-nowrap">{item.name}</span>
                    </Link>
                  );
                })}

                <div className="space-y-3 border-t border-[#1f2937] pt-4">
                  {userDetails && (
                    <div className="rounded-xl border border-[#1f2937] bg-[#111c2f] px-4 py-3 text-slate-200">
                      {userDetails}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      logout();
                      setIsMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1f2937] bg-[#111c2f] px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-[#334155] hover:bg-[#16213b] hover:text-white"
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
    <nav className="relative z-40 border-b border-[#1f2937] bg-[#0b1120] text-slate-100">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-6 px-6">
        {brand}

        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="flex items-center gap-1.5 rounded-full border border-[#1f2937] bg-[#111c2f] px-3 py-1.5">
            {availableItems.map((item) => {
              const Icon = item.icon ?? Home;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.name}
                  to={item.to}
                  className={`group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-white text-[#0b1120] shadow-[0_18px_40px_-28px_rgba(15,23,42,0.55)]"
                      : "text-slate-300 hover:bg-[#1f2937] hover:text-white"
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
            <div className="rounded-full border border-[#1f2937] bg-[#111c2f] px-4 py-2 text-slate-200">
              {userDetails}
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-full border border-[#1f2937] bg-[#111c2f] px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-[#334155] hover:bg-[#16213b] hover:text-white"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>

        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="rounded-full border border-[#1f2937] bg-[#111c2f] p-2 text-slate-200 transition hover:border-[#334155] hover:bg-[#16213b] md:hidden"
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
            className="border-t border-[#1f2937] bg-[#0b1120] px-6 pb-6 md:hidden"
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
                        ? "border-[#334155] bg-white text-[#0b1120]"
                        : "border-transparent bg-[#111c2f] text-slate-200 hover:border-[#1f2937] hover:bg-[#16213b] hover:text-white"
                    }`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        active
                          ? "bg-[#0b1120] text-white"
                          : "bg-[#1f2937] text-slate-200"
                      }`}
                    >
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    <span className="flex-1 whitespace-nowrap">{item.name}</span>
                  </Link>
                );
              })}

              <div className="space-y-3 border-t border-[#1f2937] pt-4">
                {userDetails && (
                  <div className="rounded-xl border border-[#1f2937] bg-[#111c2f] px-4 py-3 text-slate-200">
                    {userDetails}
                  </div>
                )}
                <button
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1f2937] bg-[#111c2f] px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-[#334155] hover:bg-[#16213b] hover:text-white"
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
