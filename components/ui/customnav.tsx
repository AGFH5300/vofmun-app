// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/app/context/sessionContext";
import { useMobile } from "@/hooks/use-mobile";
import supabase from "@/lib/supabase";
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
  const pathname = usePathname();

  const countryCode = useMemo(() => resolveCountryCode(currentUser?.country), [currentUser?.country]);

  useEffect(() => {
    const openSupport = () => setIsSupportOpen(true);
    window.addEventListener('open-support-request', openSupport);
    return () => window.removeEventListener('open-support-request', openSupport);
  }, []);

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

  const navNotificationCount = messagesUnreadTotal + messagesNotificationTotal;
  const hasUnseenNotifications = navNotificationCount > seenNotificationCount;

  const markNotificationsSeen = () => {
    if (typeof window === "undefined") return;
    const nextSeenCount = messagesUnreadTotal + messagesNotificationTotal;
    setSeenNotificationCount(nextSeenCount);
    window.localStorage.setItem("vofmun.messages.seenNotificationTotal", String(nextSeenCount));
  };

  const notificationsModal = isNotificationsOpen ? (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#6E1D1B]">Notifications</h3>
          <button onClick={() => setIsNotificationsOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="space-y-2">
          {messagesUnreadTotal > 0 ? <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">New messages</p><p className="mt-1 text-sm text-slate-700">You have {messagesUnreadTotal} unread {messagesUnreadTotal === 1 ? 'message' : 'messages'}.</p></div> : null}
          {messagesNotificationTotal > 0 ? <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Request updates</p><p className="mt-1 text-sm text-slate-700">You have {messagesNotificationTotal} friend request {messagesNotificationTotal === 1 ? 'update' : 'updates'}.</p></div> : null}
          {navNotificationCount === 0 ? <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">No new notifications right now.</p> : null}
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={() => setIsNotificationsOpen(false)} className="rounded-lg bg-[#6E1D1B] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">Close</button>
        </div>
      </div>
    </div>
  ) : null;

  const handleSupportSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supportMessage.trim()) return;
    setSupportState('submitting');
    setSupportFeedback('');

    const payload = {
      user_id: currentUser?.id ?? null,
      display_name: currentUser?.full_name || `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || null,
      country: currentUser?.country ?? null,
      committee_id: currentUser?.committee_id ?? null,
      committee_name: committeeName,
      role: currentUser?.role ?? null,
      message: supportMessage.trim(),
      source: 'delegate_nav_support',
    };

    const { error } = await supabase.from('support_requests').insert(payload);
    if (error) {
      setSupportState('error');
      setSupportFeedback('Support request storage is not configured yet.');
      return;
    }

    setSupportState('success');
    setSupportFeedback('Support request submitted.');
    setSupportMessage('');
  };

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
  const secondaryItems: NavItem[] = useMemo(() => { const items: NavItem[] = [{ name: "Speech Repository", to: "/speechrepo" }]; if (currentUser?.role === "admin" || currentUser?.role === "secretariat") items.push({ name: "Admin", to: "/admin" }); if (currentUser?.role === "chair") items.push({ name: "Chair", to: "/chair" }); return items; }, [currentUser?.role]);
  const mobileItems = useMemo(() => [...primaryNavigationItems, ...secondaryItems], [primaryNavigationItems, secondaryItems]);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const supportModal = isSupportOpen ? (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#6E1D1B]">Request support</h3>
          <button onClick={() => setIsSupportOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSupportSubmit} className="space-y-3">
          <textarea value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} required rows={4} placeholder="Describe your issue or request." className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-700 outline-none focus:border-[#6E1D1B]" />
          {supportFeedback ? <p className={`text-xs ${supportState === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{supportFeedback}</p> : null}
          <button type="submit" disabled={supportState === 'submitting'} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#6E1D1B] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-60">
            <Send size={14} />
            {supportState === 'submitting' ? 'Sending...' : 'Submit request'}
          </button>
        </form>
      </div>
    </div>
  ) : null;

  if (isMobile) return <><nav className={`${embedded ? "relative z-20 rounded-t-[26px]" : "fixed left-0 right-0 top-0 z-50"} bg-[#fff0e5cc] shadow-[0_8px_32px_rgba(26,28,28,0.06)] backdrop-blur-md`}>{/* unchanged mobile */}<div className="mx-auto flex h-[4.25rem] w-full max-w-[1440px] items-center justify-between px-4"><Link href="/home" className="[font-family:var(--font-newsreader),var(--font-serif)] text-[0.98rem] font-semibold tracking-[0.008em] text-[#6E1D1B]">VOFMUN ONE</Link><button onClick={() => setIsMenuOpen((prev) => !prev)} className="rounded-md p-2 text-[#6E1D1B] transition hover:bg-[#f4f3f3]" aria-expanded={isMenuOpen} aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}>{isMenuOpen ? <X size={21} /> : <Menu size={21} />}</button></div>{isMenuOpen && <div className="bg-white px-4 pb-6"><div className="space-y-3.5 pt-4">{mobileItems.map((item) => { const active = isActive(item.to); return <Link key={item.name} href={item.to} className={`flex items-center justify-between rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${active ? "bg-[#f4f3f3] text-[#6E1D1B]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`} aria-current={active ? "page" : undefined} onClick={() => setIsMenuOpen(false)}><span className="flex-1 whitespace-nowrap">{item.name}</span></Link>; })}<button onClick={() => { logout(); setIsMenuOpen(false); }} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#6E1D1B] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:opacity-95"><LogOut size={16} /><span>Log Out</span></button></div></div>}</nav>{notificationsModal}{supportModal}</>;

  const visibleSecondaryItems = embedded ? secondaryItems.filter((item) => isActive(item.to)) : secondaryItems;
  return <>{notificationsModal}{supportModal}<nav className={`${embedded ? "relative z-20 rounded-t-[28px]" : "fixed left-0 right-0 top-0 z-50"} bg-[#fff0e5cc] shadow-[0_8px_32px_rgba(26,28,28,0.06)] backdrop-blur-md`}><div className={`mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 ${embedded ? "h-[4.25rem] px-7" : "h-[4.6rem] px-8"}`}><div className={`flex items-center ${embedded ? "gap-5" : "gap-7"}`}><Link href="/home" className="[font-family:var(--font-newsreader),var(--font-serif)] text-[1.22rem] font-semibold tracking-[0.006em] text-[#6E1D1B]">VOFMUN ONE</Link><div className={`hidden items-center md:flex ${embedded ? "gap-4" : "gap-5"}`}>{primaryNavigationItems.map((item) => { const active = isActive(item.to); return <Link key={item.name} href={item.to} className={`relative pb-1.5 pt-1 text-[11px] uppercase tracking-[0.12em] transition-colors ${active ? "font-bold text-[#6E1D1B] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:rounded-full after:bg-[#6E1D1B]" : "font-medium text-slate-500 hover:text-[#6E1D1B]"}`} aria-current={active ? "page" : undefined}>{item.name}</Link>; })}</div></div><div className="hidden items-center gap-3 md:flex">{visibleSecondaryItems.length > 0 ? <div className="mr-1 flex items-center gap-3">{visibleSecondaryItems.map((item) => { const active = isActive(item.to); return <Link key={item.name} href={item.to} className={`text-[10px] uppercase tracking-[0.12em] transition-colors ${active ? "font-semibold text-[#6E1D1B]" : "text-slate-500 hover:text-[#6E1D1B]"}`} aria-current={active ? "page" : undefined}>{item.name}</Link>; })}</div> : null}
            <button onClick={() => { markNotificationsSeen(); setIsNotificationsOpen(true); }} className="relative rounded-md p-1.5 text-slate-500 hover:bg-[#f4f3f3] hover:text-[#6E1D1B]" aria-label="Notifications">
              <Bell size={14} />
              {hasUnseenNotifications ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#b31312]" /> : null}
            </button>
            <div className="relative">
              <button onClick={() => setIsUtilityMenuOpen((prev) => !prev)} className="rounded-md p-1.5 text-slate-500 hover:bg-[#f4f3f3] hover:text-[#6E1D1B]" aria-label="Support menu"><Ellipsis size={14} /></button>
              {isUtilityMenuOpen ? <div className="absolute right-0 top-8 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"><button onClick={() => { setIsSupportOpen(true); setIsUtilityMenuOpen(false); }} className="block w-full rounded-md px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100">Request support</button></div> : null}
            </div>
          <div className="flex items-center gap-2">{countryCode ? <img src={`https://flagcdn.com/${countryCode}.svg`} alt={`${currentUser?.country || 'Country'} flag`} className="h-3.5 w-5 rounded-[2px] border border-[#dcc0bd]/70 object-cover" /> : <Flag className="h-3.5 w-3.5 text-[#6E1D1B]" />}<span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">{currentUser?.country || "Country"}</span></div><div className="h-5 w-px bg-[#dcc0bd]/65" /><button onClick={logout} className="flex items-center gap-1.5 rounded-xl bg-[#6E1D1B] px-5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white transition hover:opacity-95"><LogOut size={13} /><span>Log Out</span></button></div><button onClick={() => setIsMenuOpen((prev) => !prev)} className="rounded-md p-2 text-[#6E1D1B] transition hover:bg-[#f4f3f3] md:hidden" aria-expanded={isMenuOpen} aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}>{isMenuOpen ? <X size={22} /> : <Menu size={22} />}</button></div></nav></>;
};

export default CustomNav;
