// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '../context/sessionContext';
import { ProtectedRoute } from '@/components/protectedroute';
import { BookOpen, MessagesSquare, Radio, ScrollText, UserRound } from 'lucide-react';
import supabase from '@/lib/supabase';

const Page = () => {
  const { user: currentUser } = useSession();
  const [committeeName, setCommitteeName] = useState<string | null>(null);

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

  const getUserRole = () => {
    if (!currentUser) return '';
    if (currentUser.role === 'admin') return 'Administrator';
    if (currentUser.role === 'chair') return 'Chair';
    if (currentUser.role === 'delegate') return 'Delegate';
    if (currentUser.role === 'secretariat') return 'Secretariat';
    return '';
  };

  const getDisplayName = () => {
    if (!currentUser) return '';
    return currentUser.full_name || `${currentUser.first_name} ${currentUser.last_name}`.trim();
  };

  const bodyFont = 'var(--font-manrope), Manrope, ui-sans-serif, system-ui, sans-serif';
  const headingFont = 'var(--font-newsreader), Newsreader, Georgia, serif';

  return (
    <ProtectedRoute>
      <div className="relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] min-h-screen w-screen bg-[#f9f9f9] text-[#1a1c1c]" style={{ fontFamily: bodyFont }}>
        <main className="mx-auto max-w-7xl px-8 pb-12">
          <section className="mb-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-lg bg-[#6E1D1B] p-9 text-white lg:col-span-2">
              <div className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.09)_0px,rgba(255,255,255,0.09)_1px,rgba(255,255,255,0)_1px,rgba(255,255,255,0)_56px)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(255,255,255,0.14),rgba(255,255,255,0)_42%),linear-gradient(145deg,rgba(80,6,8,0.22)_0%,rgba(32,10,13,0.46)_100%)]" />
              <div className="relative z-10">
                <span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-white/80">Dashboard</span>
                <h1 className="mb-4 text-5xl font-bold leading-tight" style={{ fontFamily: headingFont }}>
                  Welcome back, {getDisplayName() || 'Hon. Delegate'}.
                </h1>
                <p className="max-w-lg text-[#e2e2e2]">Move directly into notices, drafting, and speech preparation for your next session.</p>
              </div>
            </div>

            <div className="flex flex-col items-center rounded-lg bg-white p-8 text-center shadow-[0_8px_32px_rgba(26,28,28,0.06)]">
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-lg border-4 border-[#f4f3f3] bg-[#e8e8e8]"><UserRound className="h-10 w-10 text-[#500608]" /></div>
              <h2 className="mb-1 text-2xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>{getDisplayName() || 'Delegate'}</h2>
              <p className="mb-6 text-[11px] uppercase tracking-widest text-slate-500">{getUserRole() || 'Member'} Account</p>
              <div className="mb-6 grid w-full grid-cols-1 gap-4 border-t border-[#dcc0bd]/20 pt-6 text-left">
                <div><p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Country</p><p className="text-sm font-semibold text-[#500608]">{currentUser?.country || 'Not assigned'}</p></div>
                <div><p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Committee</p><p className="text-sm font-semibold text-[#500608]">{committeeName || (currentUser?.committee_id ? 'Committee assigned' : 'Not assigned')}</p></div>
              </div>
              <Link href="/resolutions" className="w-full rounded-lg bg-[#500608] py-3 text-xs font-semibold uppercase tracking-wider text-white hover:opacity-90">Continue Resolution Work</Link>
            </div>
          </section>

          <section className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            <Link href="/live-updates" className="rounded-lg border-l-4 border-[#6E1D1B] bg-[#FFF0E5] p-5 transition-colors hover:bg-[#f9e7d9]"><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Session</p><p className="mt-2 text-xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>Check Session Notices</p></Link>
            <Link href="/resolutions" className="rounded-lg border border-[#dcc0bd]/20 bg-white p-5 transition-colors hover:bg-[#f4f3f3]"><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Drafting</p><p className="mt-2 text-xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>Continue Resolution Work</p></Link>
            <Link href="/speechrepo" className="rounded-lg border border-[#dcc0bd]/20 bg-white p-5 transition-colors hover:bg-[#f4f3f3]"><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Preparation</p><p className="mt-2 text-xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>Prepare Speech</p></Link>
          </section>

          <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <h3 className="border-b border-[#dcc0bd]/20 pb-3 text-2xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>Dashboard Shortcuts</h3>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {[
                  { title: 'Live Updates', description: 'Open official conference and committee notices.', href: '/live-updates', icon: Radio },
                  { title: 'Resolutions', description: 'Return to your drafting workspace and documents.', href: '/resolutions', icon: ScrollText },
                  { title: 'Messaging', description: 'Coordinate with delegates and committee colleagues.', href: '/messages', icon: MessagesSquare },
                  { title: 'Glossary', description: 'Review procedure and terminology before debate.', href: '/glossary', icon: BookOpen },
                ].map((action) => {
                  const Icon = action.icon;
                  return <Link key={action.title} href={action.href} className="group block rounded-lg border border-[#dcc0bd]/10 bg-white p-5 shadow-sm transition-colors hover:bg-[#f4f3f3]"><div className="mb-3 flex items-center justify-between"><Icon className="h-5 w-5 text-[#500608]" /><span className="rounded bg-[#eee0d5] px-2 py-1 text-[9px] font-bold uppercase text-[#211a14]">Shortcut</span></div><h4 className="mb-1 text-lg font-bold text-[#500608]" style={{ fontFamily: headingFont }}>{action.title}</h4><p className="text-sm leading-relaxed text-slate-500">{action.description}</p></Link>;
                })}
              </div>
            </div>

            <div className="space-y-6 lg:col-span-4">
              <div className="rounded-lg bg-[#500608] p-6 text-white shadow-xl">
                <h4 className="mb-2 text-xl font-bold" style={{ fontFamily: headingFont }}>Need help?</h4>
                <p className="mb-4 text-sm text-[#f3eaea]">Use the navbar menu (three dots) to send a support request with your account details auto-filled.</p>
                <button onClick={() => window.dispatchEvent(new Event('open-support-request'))} className="w-full rounded-lg border border-white/30 bg-white/10 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white/20">Request support</button>
              </div>
              <div className="rounded-lg bg-[#f4f3f3] p-6">
                <h4 className="mb-3 font-bold text-[#500608]" style={{ fontFamily: headingFont }}>Notifications</h4>
                <p className="text-sm leading-relaxed text-slate-600">Use the bell in the navbar for notices. Notification counts are hidden until a live source is configured.</p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default Page;
