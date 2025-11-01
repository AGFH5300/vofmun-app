import React, { useMemo, useState } from "react";
import { Link, useRouter } from "@/src/router";
import { useSession } from "@/app/context/sessionContext";
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
    <Link to="/home" className="flex items-center gap-3 text-slate-900">
      <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 shadow-[0_12px_20px_-16px_rgba(15,23,42,0.45)] ring-1 ring-slate-200">
        <img src="/logo.svg" alt="VOFMUN" className="h-full w-full object-contain" />
      </span>
      <div className="text-left leading-tight">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">VOFMUN</p>
        <p className="text-lg font-semibold text-slate-900">Delegate Hub</p>
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
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-[0_8px_18px_-14px_rgba(15,23,42,0.25)]">
          {getInitials()}
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">{getDisplayName()}</p>
        </div>
      </div>
    );
  };

  const userDetails = renderUserDetails();

  if (isMobile) {
    return (
      <nav className="relative z-40 border-b border-slate-200 bg-white text-slate-900 shadow-[0_10px_30px_-25px_rgba(15,23,42,0.25)]">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          {brand}
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="rounded-md border border-slate-200 bg-slate-100 p-2 text-slate-900 transition hover:border-slate-300 hover:bg-slate-200"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 pb-6">
            <div className="space-y-4 pt-4">
              {availableItems.map((item) => {
                const Icon = item.icon ?? Home;
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.name}
                    to={item.to}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      active
                        ? "border-slate-300 bg-slate-900 text-white"
                        : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-md ${
                        active
                          ? "bg-slate-800 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    <span className="flex-1 whitespace-nowrap">{item.name}</span>
                  </Link>
                );
              })}

              <div className="space-y-3 border-t border-slate-200 pt-4">
                {userDetails && (
                  <div className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-slate-900">
                    {userDetails}
                  </div>
                )}
                <button
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  <LogOut size={18} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>
    );
  }

  return (
    <nav className="relative z-40 border-b border-slate-200 bg-white text-slate-900 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.2)]">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-6 px-6">
        {brand}

        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5">
            {availableItems.map((item) => {
              const Icon = item.icon ?? Home;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.name}
                  to={item.to}
                  className={`group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-slate-900 text-white shadow-[0_16px_32px_-28px_rgba(15,23,42,0.35)]"
                      : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
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
            <div className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-slate-900">
              {userDetails}
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>

        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="rounded-md border border-slate-200 bg-slate-100 p-2 text-slate-900 transition hover:border-slate-300 hover:bg-slate-200 md:hidden"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
        >
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-6 pb-6 md:hidden">
          <div className="space-y-4 pt-4">
            {availableItems.map((item) => {
              const Icon = item.icon ?? Home;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.name}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "border-slate-300 bg-slate-900 text-white"
                      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-md ${
                      active
                        ? "bg-slate-800 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <span className="flex-1 whitespace-nowrap">{item.name}</span>
                </Link>
              );
            })}

            <div className="space-y-3 border-t border-slate-200 pt-4">
              {userDetails && (
                <div className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-slate-900">
                  {userDetails}
                </div>
              )}
              <button
                onClick={() => {
                  logout();
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default CustomNav;
