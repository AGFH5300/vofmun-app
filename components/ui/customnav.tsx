// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/app/context/sessionContext";
import { useMobile } from "@/hooks/use-mobile";
import {
  Menu,
  X,
  LogOut,
  Flag,
} from "lucide-react";

interface CustomNavProps {
  role?: "delegate" | "chair" | "admin";
  activeLink?: string;
}

interface NavItem {
  name: string;
  to: string;
}

const CustomNav: React.FC<CustomNavProps> = () => {
  const { user: currentUser, logout } = useSession();
  const isMobile = useMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const readUnread = () => {
      const raw = window.localStorage.getItem("vofmun.messages.unreadTotal");
      const parsed = Number(raw || "0");
      const count = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
      setMessageUnreadCount(count);
      console.debug("[CustomNavDebug] messages_unread_sync", { count, raw });
    };

    const onUnreadUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ totalUnreadCount?: number }>;
      const fromEvent = Number(customEvent.detail?.totalUnreadCount ?? NaN);
      if (Number.isFinite(fromEvent)) {
        const count = Math.max(0, Math.floor(fromEvent));
        setMessageUnreadCount(count);
        console.debug("[CustomNavDebug] messages_unread_event", { count });
        return;
      }
      readUnread();
    };

    readUnread();
    window.addEventListener("vofmun:messages-unread-updated", onUnreadUpdated as EventListener);
    window.addEventListener("storage", readUnread);
    return () => {
      window.removeEventListener("vofmun:messages-unread-updated", onUnreadUpdated as EventListener);
      window.removeEventListener("storage", readUnread);
    };
  }, []);

  const navigationItems: NavItem[] = useMemo(
    () => [
      { name: "Dashboard", to: "/home" },
      { name: "Live Updates", to: "/live-updates" },
      { name: "Glossary", to: "/glossary" },
      { name: "Resolutions", to: "/resolutions" },
      { name: "Messaging", to: "/messages" },
      { name: "Speech Repo", to: "/speechrepo" },
    ],
    []
  );

  const adminItems: NavItem[] = useMemo(
    () => [{ name: "Admin", to: "/admin" }],
    []
  );

  const chairItems: NavItem[] = useMemo(
    () => [{ name: "Chair", to: "/chair" }],
    []
  );

  const availableItems = useMemo(() => {
    const items = [...navigationItems];

    if (currentUser?.role === "admin" || currentUser?.role === "secretariat") {
      items.push(...adminItems);
    }

    if (currentUser?.role === "chair") {
      items.push(...chairItems);
    }

    return items;
  }, [adminItems, chairItems, currentUser, navigationItems]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const renderBadge = (name: string) => {
    if (name !== "Messaging" || messageUnreadCount <= 0) return null;
    return (
      <span className="absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
        {messageUnreadCount > 99 ? "99+" : messageUnreadCount}
      </span>
    );
  };

  if (isMobile) {
    return (
      <nav className="fixed left-0 right-0 top-0 z-50 bg-[#fff0e5cc] shadow-[0_8px_32px_rgba(26,28,28,0.06)] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-4">
          <Link href="/home" className="[font-family:var(--font-newsreader),var(--font-serif)] text-lg font-bold text-[#6E1D1B]">
            VOFMUN ONE
          </Link>
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="rounded-md p-2 text-[#6E1D1B] transition hover:bg-[#f4f3f3]"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="bg-white px-4 pb-6">
            <div className="space-y-4 pt-4">
              {availableItems.map((item) => {
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.name}
                    href={item.to}
                    className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[#f4f3f3] text-[#6E1D1B]"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span className="flex-1 whitespace-nowrap">{item.name}</span>
                    {renderBadge(item.name)}
                  </Link>
                );
              })}

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#6E1D1B] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-95"
                >
                  <LogOut size={18} />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>
    );
  }

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 bg-[#fff0e5cc] shadow-[0_8px_32px_rgba(26,28,28,0.06)] backdrop-blur-md">
      <div className="mx-auto flex h-20 w-full max-w-[1440px] items-center justify-between gap-6 px-8">
        <div className="flex items-center gap-8">
          <Link href="/home" className="[font-family:var(--font-newsreader),var(--font-serif)] text-xl font-bold text-[#6E1D1B]">
            VOFMUN ONE
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            {availableItems.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.name}
                  href={item.to}
                  className={`relative py-1 text-xs uppercase tracking-[0.2em] transition-colors ${
                    active
                      ? "border-b-2 border-[#6E1D1B] font-bold text-[#6E1D1B]"
                      : "font-medium text-slate-500 hover:text-[#6E1D1B]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.name}
                  {renderBadge(item.name)}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-[#6E1D1B]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {currentUser?.country || "Country"}
            </span>
          </div>
          <div className="h-6 w-px bg-[#dcc0bd]/60" />
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-lg bg-[#6E1D1B] px-6 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:opacity-95"
          >
            <LogOut size={14} />
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

      {isMenuOpen && (
        <div className="bg-white px-6 pb-6 md:hidden">
          <div className="space-y-4 pt-4">
            {availableItems.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.name}
                  href={item.to}
                  className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#f4f3f3] text-[#6E1D1B]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="flex-1 whitespace-nowrap">{item.name}</span>
                  {renderBadge(item.name)}
                </Link>
              );
            })}

            <div className="space-y-3 pt-2">
              <button
                onClick={() => {
                  logout();
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#6E1D1B] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-95"
              >
                <LogOut size={18} />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default CustomNav;
