// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/app/context/sessionContext";
import { useMobile } from "@/hooks/use-mobile";
import { Menu, X, LogOut, Flag } from "lucide-react";

interface CustomNavProps {
  role?: "delegate" | "chair" | "admin";
  activeLink?: string;
  embedded?: boolean;
}

interface NavItem {
  name: string;
  to: string;
}

const CustomNav: React.FC<CustomNavProps> = ({ embedded = false }) => {
  const { user: currentUser, logout } = useSession();
  const isMobile = useMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const primaryNavigationItems: NavItem[] = useMemo(
    () => [
      { name: "Dashboard", to: "/home" },
      { name: "Live Updates", to: "/live-updates" },
      { name: "Glossary", to: "/glossary" },
      { name: "Resolutions", to: "/resolutions" },
      { name: "Messaging", to: "/messages" },
    ],
    [],
  );

  const secondaryItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [{ name: "Speech Repository", to: "/speechrepo" }];

    if (currentUser?.role === "admin" || currentUser?.role === "secretariat") {
      items.push({ name: "Admin", to: "/admin" });
    }

    if (currentUser?.role === "chair") {
      items.push({ name: "Chair", to: "/chair" });
    }

    return items;
  }, [currentUser?.role]);

  const mobileItems = useMemo(() => [...primaryNavigationItems, ...secondaryItems], [primaryNavigationItems, secondaryItems]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  if (isMobile) {
    return (
      <nav className={`${embedded ? "relative z-20 rounded-t-[26px]" : "fixed left-0 right-0 top-0 z-50"} bg-[#fff0e5cc] shadow-[0_8px_32px_rgba(26,28,28,0.06)] backdrop-blur-md`}>
        <div className="mx-auto flex h-[4.25rem] w-full max-w-[1440px] items-center justify-between px-4">
          <Link href="/home" className="[font-family:var(--font-newsreader),var(--font-serif)] text-[0.98rem] font-semibold tracking-[0.008em] text-[#6E1D1B]">
            VOFMUN ONE
          </Link>
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="rounded-md p-2 text-[#6E1D1B] transition hover:bg-[#f4f3f3]"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
          >
            {isMenuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="bg-white px-4 pb-6">
            <div className="space-y-3.5 pt-4">
              {mobileItems.map((item) => {
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.name}
                    href={item.to}
                    className={`flex items-center justify-between rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[#f4f3f3] text-[#6E1D1B]"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span className="flex-1 whitespace-nowrap">{item.name}</span>
                  </Link>
                );
              })}

              <button
                onClick={() => {
                  logout();
                  setIsMenuOpen(false);
                }}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#6E1D1B] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:opacity-95"
              >
                <LogOut size={16} />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        )}
      </nav>
    );
  }

  const visibleSecondaryItems = embedded ? secondaryItems.filter((item) => isActive(item.to)) : secondaryItems;

  return (
    <nav className={`${embedded ? "relative z-20 rounded-t-[28px]" : "fixed left-0 right-0 top-0 z-50"} bg-[#fff0e5cc] shadow-[0_8px_32px_rgba(26,28,28,0.06)] backdrop-blur-md`}>
      <div className={`mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 ${embedded ? "h-[4.25rem] px-7" : "h-[4.6rem] px-8"}`}>
        <div className={`flex items-center ${embedded ? "gap-5" : "gap-7"}`}>
          <Link href="/home" className="[font-family:var(--font-newsreader),var(--font-serif)] text-[1.22rem] font-semibold tracking-[0.006em] text-[#6E1D1B]">
            VOFMUN ONE
          </Link>
          <div className={`hidden items-center md:flex ${embedded ? "gap-4" : "gap-5"}`}>
            {primaryNavigationItems.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.name}
                  href={item.to}
                  className={`relative pb-1.5 pt-1 text-[11px] uppercase tracking-[0.12em] transition-colors ${
                    active
                      ? "font-bold text-[#6E1D1B] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:rounded-full after:bg-[#6E1D1B]"
                      : "font-medium text-slate-500 hover:text-[#6E1D1B]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {visibleSecondaryItems.length > 0 ? (
            <div className="mr-1 flex items-center gap-3">
              {visibleSecondaryItems.map((item) => {
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.name}
                    href={item.to}
                    className={`text-[10px] uppercase tracking-[0.12em] transition-colors ${
                      active ? "font-semibold text-[#6E1D1B]" : "text-slate-500 hover:text-[#6E1D1B]"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Flag className="h-3.5 w-3.5 text-[#6E1D1B]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">
              {currentUser?.country || "Country"}
            </span>
          </div>
          <div className="h-5 w-px bg-[#dcc0bd]/65" />
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-xl bg-[#6E1D1B] px-5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white transition hover:opacity-95"
          >
            <LogOut size={13} />
            <span>Log Out</span>
          </button>
        </div>

        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="rounded-md p-2 text-[#6E1D1B] transition hover:bg-[#f4f3f3] md:hidden"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
        >
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </nav>
  );
};

export default CustomNav;
