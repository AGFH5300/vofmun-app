// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Dialog } from "@headlessui/react";
import { usePathname } from "next/navigation";
import { useSession } from "@/app/context/sessionContext";
import { useMobile } from "@/hooks/use-mobile";
import supabase from "@/lib/supabase";
import { withBrowserAuthHeaders } from "@/lib/auth/browserAuthFetch";
import { Bell, Ellipsis, LogOut, Menu, Send, X, Flag } from "lucide-react";

interface CustomNavProps {
  role?: "delegate" | "chair" | "admin";
  activeLink?: string;
  embedded?: boolean;
}

interface NavItem {
  name: string;
  to: string;
}

interface AppNotification {
  id: string;
  title: string;
  message: string;
  kind: 'announcement' | 'action' | 'warning';
  created_at: string;
  isRead: boolean;
}

const COUNTRY_CODE_MAP: Record<string, string> = {
  "united states": "us", "united states of america": "us", usa: "us", "united kingdom": "gb", uk: "gb", china: "cn", russia: "ru", "russian federation": "ru", france: "fr", germany: "de", japan: "jp", india: "in", brazil: "br", canada: "ca", australia: "au", italy: "it", spain: "es", netherlands: "nl", sweden: "se", norway: "no", denmark: "dk", finland: "fi", "south korea": "kr", "south africa": "za", mexico: "mx", argentina: "ar", chile: "cl", egypt: "eg", nigeria: "ng", kenya: "ke", turkey: "tr", "saudi arabia": "sa", iran: "ir", israel: "il", pakistan: "pk", bangladesh: "bd", indonesia: "id", thailand: "th", vietnam: "vn", philippines: "ph", malaysia: "my", singapore: "sg", "new zealand": "nz", poland: "pl", ukraine: "ua", "czech republic": "cz", greece: "gr", portugal: "pt", belgium: "be", austria: "at", switzerland: "ch", ireland: "ie", iceland: "is", luxembourg: "lu", malta: "mt", cyprus: "cy", estonia: "ee", latvia: "lv", lithuania: "lt", slovenia: "si", slovakia: "sk", croatia: "hr", bulgaria: "bg", romania: "ro", hungary: "hu", morocco: "ma", algeria: "dz", tunisia: "tn", libya: "ly", sudan: "sd", ethiopia: "et", ghana: "gh", senegal: "sn", "ivory coast": "ci", cameroon: "cm", zimbabwe: "zw", zambia: "zm", botswana: "bw", namibia: "na", madagascar: "mg", mauritius: "mu", seychelles: "sc", uae: "ae", "united arab emirates": "ae", qatar: "qa", kuwait: "kw", bahrain: "bh", oman: "om", yemen: "ye", jordan: "jo", lebanon: "lb", syria: "sy", iraq: "iq", afghanistan: "af", kazakhstan: "kz", uzbekistan: "uz", turkmenistan: "tm", kyrgyzstan: "kg", tajikistan: "tj", mongolia: "mn", nepal: "np", bhutan: "bt", "sri lanka": "lk", myanmar: "mm", cambodia: "kh", laos: "la", brunei: "bn", maldives: "mv", "papua new guinea": "pg", fiji: "fj", "solomon islands": "sb", vanuatu: "vu", samoa: "ws", tonga: "to", palau: "pw", micronesia: "fm", "marshall islands": "mh", kiribati: "ki", tuvalu: "tv", nauru: "nr", venezuela: "ve", colombia: "co", ecuador: "ec", peru: "pe", bolivia: "bo", paraguay: "py", uruguay: "uy", guyana: "gy", suriname: "sr", "french guiana": "gf", cuba: "cu", jamaica: "jm", haiti: "ht", "dominican republic": "do", "trinidad and tobago": "tt", barbados: "bb", bahamas: "bs", belize: "bz", guatemala: "gt", honduras: "hn", "el salvador": "sv", nicaragua: "ni", "costa rica": "cr", panama: "pa"
};

const resolveCountryCode = (country: string | null | undefined) => {
  if (!country) return null;
  const normalized = country.trim();
  if (/^[a-z]{2}$/i.test(normalized)) return normalized.toLowerCase();
  return COUNTRY_CODE_MAP[normalized.toLowerCase()] || null;
};

const CustomNav: React.FC<CustomNavProps> = ({ embedded = false }) => {
  const { user: currentUser, logout } = useSession();
  const isMobile = useMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUtilityMenuOpen, setIsUtilityMenuOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportState, setSupportState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [supportFeedback, setSupportFeedback] = useState("");
  const [committeeName, setCommitteeName] = useState<string | null>(null);
  const [messagesUnreadTotal, setMessagesUnreadTotal] = useState(0);
  const [messagesNotificationTotal, setMessagesNotificationTotal] = useState(0);
  const [seenNotificationCount, setSeenNotificationCount] = useState(0);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);
  const [appUnreadCount, setAppUnreadCount] = useState(0);
  const pathname = usePathname();
  const countryLabel = currentUser?.country?.trim() || null;

  const openSupportModal = useCallback(() => {
    setSupportMessage("");
    setSupportState("idle");
    setSupportFeedback("");
    setIsSupportOpen(true);
  }, []);

  const closeSupportModal = useCallback(() => {
    setIsSupportOpen(false);
    setSupportMessage("");
    setSupportState("idle");
    setSupportFeedback("");
  }, []);

  const countryCode = useMemo(() => resolveCountryCode(currentUser?.country), [currentUser?.country]);

  useEffect(() => {
    window.addEventListener('open-support-request', openSupportModal);
    return () => window.removeEventListener('open-support-request', openSupportModal);
  }, [openSupportModal]);

  useEffect(() => {
    const loadCommittee = async () => {
      if (!currentUser?.committee_id) {
        setCommitteeName(null);
        return;
      }
      const { data } = await supabase
        .from('Committee')
        .select('name, committeeCode')
        .eq('committeeID', currentUser.committee_id)
        .maybeSingle();
      setCommitteeName(data?.name || data?.committeeCode || null);
    };
    void loadCommittee();
  }, [currentUser?.committee_id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncCounts = () => {
      const unread = Number(window.localStorage.getItem("vofmun.messages.unreadTotal") || "0");
      const notifications = Number(window.localStorage.getItem("vofmun.messages.notificationTotal") || "0");
      setMessagesUnreadTotal(Number.isFinite(unread) ? Math.max(0, unread) : 0);
      setMessagesNotificationTotal(Number.isFinite(notifications) ? Math.max(0, notifications) : 0);
    };
    const seen = Number(window.localStorage.getItem("vofmun.messages.seenNotificationTotal") || "0");
    setSeenNotificationCount(Number.isFinite(seen) ? Math.max(0, seen) : 0);
    syncCounts();
    const onUnread = () => syncCounts();
    const onNotifications = () => syncCounts();
    window.addEventListener("vofmun:messages-unread-updated", onUnread as EventListener);
    window.addEventListener("vofmun:messages-notification-updated", onNotifications as EventListener);
    window.addEventListener("storage", syncCounts);
    return () => {
      window.removeEventListener("vofmun:messages-unread-updated", onUnread as EventListener);
      window.removeEventListener("vofmun:messages-notification-updated", onNotifications as EventListener);
      window.removeEventListener("storage", syncCounts);
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;

    let active = true;
    const loadNotifications = async () => {
      try {
        const response = await fetch('/api/notifications', await withBrowserAuthHeaders(undefined, 'navbar-notifications'));
        if (!response.ok) return;
        const body = (await response.json()) as { notifications?: AppNotification[]; unreadCount?: number };
        if (!active) return;
        setAppNotifications(body.notifications || []);
        setAppUnreadCount(Math.max(0, body.unreadCount || 0));
      } catch (error) {
        console.warn('[navbar notifications] load failed', {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [currentUser?.id]);

  const localNotificationCount = messagesUnreadTotal + messagesNotificationTotal;
  const navNotificationCount = localNotificationCount + appUnreadCount;
  const hasUnseenNotifications = localNotificationCount > seenNotificationCount || appUnreadCount > 0;

  const markNotificationsSeen = () => {
    if (typeof window === "undefined") return;
    setSeenNotificationCount(localNotificationCount);
    window.localStorage.setItem("vofmun.messages.seenNotificationTotal", String(localNotificationCount));

    if (appUnreadCount > 0) {
      setAppUnreadCount(0);
      setAppNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
      void (async () => {
        try {
          await fetch('/api/notifications', await withBrowserAuthHeaders({
            method: 'POST',
            body: JSON.stringify({ all: true }),
          }, 'navbar-notifications-read'));
        } catch (error) {
          console.warn('[navbar notifications] mark-read failed', {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      })();
    }
  };

  const notificationsModal = isNotificationsOpen ? (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-2xl font-semibold text-[#6E1D1B]">Notifications</h3>
          <button onClick={() => setIsNotificationsOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close notifications"><X size={16} /></button>
        </div>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {messagesUnreadTotal > 0 ? <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">New messages</p><p className="mt-1 text-sm text-slate-700">You have {messagesUnreadTotal} unread {messagesUnreadTotal === 1 ? 'message' : 'messages'}.</p></div> : null}
          {messagesNotificationTotal > 0 ? <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Request updates</p><p className="mt-1 text-sm text-slate-700">You have {messagesNotificationTotal} friend request {messagesNotificationTotal === 1 ? 'update' : 'updates'}.</p></div> : null}
          {appNotifications.map((notification) => <article key={notification.id} className={`rounded-lg border px-3 py-3 ${notification.isRead ? 'border-slate-200 bg-white' : 'border-[#dcc0bd] bg-[#fff8f2]'}`}><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-[#1a1c1c]">{notification.title}</p><span className="shrink-0 text-[10px] uppercase tracking-[0.1em] text-[#6E1D1B]/65">{notification.kind}</span></div><p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-700">{notification.message}</p><p className="mt-2 text-[11px] text-slate-500">{new Date(notification.created_at).toLocaleString()}</p></article>)}
          {navNotificationCount === 0 && appNotifications.length === 0 ? <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">No notifications right now.</p> : null}
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={() => setIsNotificationsOpen(false)} className="rounded-lg bg-[#6E1D1B] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">Close</button>
        </div>
      </div>
    </div>
  ) : null;

  const handleSupportSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = supportMessage.trim();
    if (!message || supportState === 'submitting') return;

    if (!currentUser?.id) {
      setSupportState('error');
      setSupportFeedback('Your session is still loading. Please try again in a moment.');
      return;
    }

    setSupportState('submitting');
    setSupportFeedback('');

    const payload = {
      user_id: currentUser.id,
      display_name: currentUser.full_name || `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || null,
      country: currentUser.country ?? null,
      committee_id: currentUser.committee_id ?? null,
      committee_name: committeeName,
      role: currentUser.role ?? null,
      message,
      source: 'delegate_nav_support',
    };

    try {
      const { error } = await supabase.from('support_requests').insert(payload);
      if (error) throw error;

      setSupportState('success');
      setSupportFeedback('Your request has been sent to the secretariat.');
      setSupportMessage('');
    } catch (error) {
      console.error('[support-request] submission failed', {
        userId: currentUser.id,
        message: error instanceof Error ? error.message : String(error),
      });
      setSupportState('error');
      setSupportFeedback('We could not submit your request. Please try again.');
    }
  };

  const primaryNavigationItems: NavItem[] = useMemo(
    () => [
      { name: "Home", to: "/home" },
      { name: "Live Updates", to: "/live-updates" },
      { name: "Glossary", to: "/glossary" },
      { name: "Resolutions", to: "/resolutions" },
      { name: "Messaging", to: "/messages" },
    ],
    [],
  );
  const secondaryItems: NavItem[] = useMemo(() => { const items: NavItem[] = [{ name: "Speech Repository", to: "/speechrepo" }, { name: "About", to: "/about" }]; if (currentUser?.role === "admin" || currentUser?.role === "secretariat") items.push({ name: "Admin", to: "/admin" }); if (currentUser?.role === "chair") items.push({ name: "Chair", to: "/chair" }); return items; }, [currentUser?.role]);
  const mobileItems = useMemo(() => [...primaryNavigationItems, ...secondaryItems], [primaryNavigationItems, secondaryItems]);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const supportModal = (
    <Dialog
      open={isSupportOpen}
      onClose={() => {
        if (supportState !== 'submitting') closeSupportModal();
      }}
      className="relative z-[110]"
      style={{ fontFamily: 'var(--font-manrope), Manrope, ui-sans-serif, system-ui' }}
    >
      <div className="fixed inset-0 bg-[rgba(26,28,28,0.4)] backdrop-blur-[4px]" aria-hidden="true" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
          <Dialog.Panel className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-[0_18px_60px_rgba(26,28,28,0.16)]">
            <div className="flex items-start justify-between gap-5 bg-[#f9f9f9] px-5 py-5 sm:px-6">
              <div className="min-w-0">
                <Dialog.Title
                  className="text-[28px] font-semibold leading-none text-[#6E1D1B] sm:text-[30px]"
                  style={{ fontFamily: 'var(--font-newsreader), Newsreader, Georgia, serif' }}
                >
                  Request Support
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-5 text-[#564240]/80">
                  Tell the secretariat what you need help with.
                </Dialog.Description>
              </div>
              <button
                type="button"
                onClick={closeSupportModal}
                disabled={supportState === 'submitting'}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#564240]/70 transition-colors hover:bg-[#e2e2e2] hover:text-[#6E1D1B] disabled:cursor-wait disabled:opacity-50"
                aria-label="Close support request"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSupportSubmit} className="px-5 py-5 sm:px-6 sm:py-6">
              <label htmlFor="support-request-message" className="text-sm font-semibold text-[#1a1c1c]">
                How can we help?
              </label>
              <textarea
                id="support-request-message"
                value={supportMessage}
                onChange={(event) => {
                  setSupportMessage(event.target.value);
                  if (supportState !== 'idle') {
                    setSupportState('idle');
                    setSupportFeedback('');
                  }
                }}
                required
                maxLength={4000}
                rows={5}
                disabled={supportState === 'submitting'}
                placeholder="Describe the issue, where it happened, and what you expected."
                className="mt-2 w-full resize-y rounded-xl border border-[#dcc0bd]/70 bg-[#f9f9f9] px-4 py-3 text-sm leading-6 text-[#1a1c1c] outline-none transition focus:border-[#6E1D1B] focus:bg-white focus:ring-2 focus:ring-[#6E1D1B]/10 disabled:cursor-wait disabled:opacity-70"
              />

              {supportFeedback ? (
                <p
                  className={`mt-3 rounded-lg px-3 py-2 text-sm ${supportState === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}
                  role={supportState === 'error' ? 'alert' : 'status'}
                >
                  {supportFeedback}
                </p>
              ) : null}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeSupportModal}
                  disabled={supportState === 'submitting'}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#564240] transition hover:bg-[#f4f3f3] disabled:cursor-wait disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={supportState === 'submitting' || !supportMessage.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6E1D1B] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#591715] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {supportState === 'submitting' ? 'Sending...' : 'Submit request'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );

  if (isMobile) return <><nav className={`${embedded ? "relative z-20 rounded-t-[26px]" : "fixed left-0 right-0 top-0 z-50"} bg-[#fff0e5cc] shadow-[0_8px_32px_rgba(26,28,28,0.06)] backdrop-blur-md`}>{/* unchanged mobile */}<div className="mx-auto flex h-[4.25rem] w-full max-w-[1440px] items-center justify-between px-4"><Link href="/home" className="flex min-w-0 items-baseline gap-1.5 [font-family:var(--font-newsreader),var(--font-serif)] font-semibold text-[#6E1D1B]">
  {countryLabel ? <><span className="max-w-[8rem] truncate text-[0.76rem] uppercase tracking-[0.08em] text-[#8f514d]">{countryLabel}</span><span aria-hidden="true" className="text-[#c89590]">—</span></> : null}
  <span className="whitespace-nowrap text-[0.98rem] tracking-[0.008em]">VOFMUN ONE</span>
</Link><button onClick={() => setIsMenuOpen((prev) => !prev)} className="rounded-md p-2 text-[#6E1D1B] transition hover:bg-[#f4f3f3]" aria-expanded={isMenuOpen} aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}>{isMenuOpen ? <X size={21} /> : <Menu size={21} />}</button></div>{isMenuOpen && <div className="bg-white px-4 pb-6"><div className="space-y-3.5 pt-4">{mobileItems.map((item) => { const active = isActive(item.to); return <Link key={item.name} href={item.to} className={`flex items-center justify-between rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${active ? "bg-[#f4f3f3] text-[#6E1D1B]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`} aria-current={active ? "page" : undefined} onClick={() => setIsMenuOpen(false)}><span className="flex-1 whitespace-nowrap">{item.name}</span></Link>; })}<button onClick={() => { openSupportModal(); setIsMenuOpen(false); }} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#dcc0bd]/70 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#6E1D1B] transition hover:bg-[#f4f3f3]"><Send size={15} /><span>Request Support</span></button><button onClick={() => { logout(); setIsMenuOpen(false); }} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#6E1D1B] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:opacity-95"><LogOut size={16} /><span>Log Out</span></button></div></div>}</nav>{notificationsModal}{supportModal}</>;

  const visibleSecondaryItems = embedded ? secondaryItems.filter((item) => isActive(item.to)) : secondaryItems;
  return <>{notificationsModal}{supportModal}<nav className={`${embedded ? "relative z-20 rounded-t-[28px]" : "fixed left-0 right-0 top-0 z-50"} bg-[#fff0e5cc] shadow-[0_8px_32px_rgba(26,28,28,0.06)] backdrop-blur-md`}><div className={`mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 ${embedded ? "h-[4.25rem] px-7" : "h-[4.6rem] px-8"}`}><div className={`flex items-center ${embedded ? "gap-5" : "gap-7"}`}><Link href="/home" className="flex min-w-0 items-baseline gap-2 whitespace-nowrap [font-family:var(--font-newsreader),var(--font-serif)] font-semibold text-[#6E1D1B]">
  {countryLabel ? <><span className="max-w-[9rem] truncate text-[0.72rem] uppercase tracking-[0.09em] text-[#8f514d]">{countryLabel}</span><span aria-hidden="true" className="text-[#c89590]">—</span></> : null}
  <span className="text-[1.18rem] tracking-[0.006em]">VOFMUN ONE</span>
</Link><div className={`hidden items-center md:flex ${embedded ? "gap-4" : "gap-5"}`}>{primaryNavigationItems.map((item) => { const active = isActive(item.to); return <Link key={item.name} href={item.to} className={`relative pb-1.5 pt-1 text-[11px] uppercase tracking-[0.12em] transition-colors ${active ? "font-bold text-[#6E1D1B] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:rounded-full after:bg-[#6E1D1B]" : "font-medium text-slate-500 hover:text-[#6E1D1B]"}`} aria-current={active ? "page" : undefined}>{item.name}</Link>; })}</div></div><div className="hidden items-center gap-3 md:flex">{visibleSecondaryItems.length > 0 ? <div className="mr-1 flex items-center gap-3">{visibleSecondaryItems.map((item) => { const active = isActive(item.to); return <Link key={item.name} href={item.to} className={`text-[10px] uppercase tracking-[0.12em] transition-colors ${active ? "font-semibold text-[#6E1D1B]" : "text-slate-500 hover:text-[#6E1D1B]"}`} aria-current={active ? "page" : undefined}>{item.name}</Link>; })}</div> : null}
            <button onClick={() => { markNotificationsSeen(); setIsNotificationsOpen(true); }} className="relative rounded-md p-1.5 text-slate-500 hover:bg-[#f4f3f3] hover:text-[#6E1D1B]" aria-label="Notifications">
              <Bell size={14} />
              {hasUnseenNotifications ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#b31312]" /> : null}
            </button>
            <div className="relative">
              <button onClick={() => setIsUtilityMenuOpen((prev) => !prev)} className="rounded-md p-1.5 text-slate-500 hover:bg-[#f4f3f3] hover:text-[#6E1D1B]" aria-label="Support menu"><Ellipsis size={14} /></button>
              {isUtilityMenuOpen ? <div className="absolute right-0 top-8 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"><button onClick={() => { openSupportModal(); setIsUtilityMenuOpen(false); }} className="block w-full rounded-md px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100">Request support</button></div> : null}
            </div>
          <div className="flex items-center gap-2">{countryCode ? <img src={`https://flagcdn.com/${countryCode}.svg`} alt={`${currentUser?.country || 'Country'} flag`} className="h-3.5 w-5 rounded-[2px] border border-[#dcc0bd]/70 object-cover" /> : <Flag className="h-3.5 w-3.5 text-[#6E1D1B]" />}<span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">{currentUser?.country || "Country"}</span></div><div className="h-5 w-px bg-[#dcc0bd]/65" /><button onClick={logout} className="flex items-center gap-1.5 rounded-xl bg-[#6E1D1B] px-5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white transition hover:opacity-95"><LogOut size={13} /><span>Log Out</span></button></div><button onClick={() => setIsMenuOpen((prev) => !prev)} className="rounded-md p-2 text-[#6E1D1B] transition hover:bg-[#f4f3f3] md:hidden" aria-expanded={isMenuOpen} aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}>{isMenuOpen ? <X size={22} /> : <Menu size={22} />}</button></div></nav></>;
};

export default CustomNav;
