// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from '../context/sessionContext';
import { ProtectedRoute } from '@/components/protectedroute';
import { Bell, BookOpen, MessagesSquare, Radio, ScrollText, UserRound } from 'lucide-react';

const Page = () => {
  const { user: currentUser } = useSession();

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

  const quickActions = [
    {
      title: 'Live Updates',
      description: 'View the latest committee and conference announcements.',
      href: '/live-updates',
      icon: Radio,
      cta: 'View Live Updates'
    },
    {
      title: 'Resolutions',
      description: 'Open your resolution workspace and continue drafting.',
      href: '/resolutions',
      icon: ScrollText,
      cta: 'Open Resolutions'
    },
    {
      title: 'Messaging',
      description: 'Go to delegate messaging and committee communications.',
      href: '/messages',
      icon: MessagesSquare,
      cta: 'Go to Messaging'
    },
    {
      title: 'Glossary',
      description: 'Review procedural terms before your next speaking block.',
      href: '/glossary',
      icon: BookOpen,
      cta: 'Open Glossary'
    },
    {
      title: 'Speech Repository',
      description: 'Access speech references and prepare your interventions.',
      href: '/speechrepo',
      icon: Bell,
      cta: 'Open Speech Repository'
    }
  ];

  return (
    <ProtectedRoute>
      <div
        className="relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen min-h-screen bg-[#f9f9f9] text-[#1a1c1c]"
        style={{ fontFamily: bodyFont }}
      >
        <main className="mx-auto max-w-7xl px-8 pb-12">
          <section className="grid grid-cols-1 gap-8 mb-12 lg:grid-cols-3">
            <div className="lg:col-span-2 relative overflow-hidden bg-[#6E1D1B] rounded-lg p-10 flex flex-col justify-end min-h-[320px] text-white">
              <div className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.09)_0px,rgba(255,255,255,0.09)_1px,rgba(255,255,255,0)_1px,rgba(255,255,255,0)_56px)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(255,255,255,0.14),rgba(255,255,255,0)_42%),linear-gradient(145deg,rgba(80,6,8,0.22)_0%,rgba(32,10,13,0.46)_100%)]" />
              <div className="relative z-10">
                <span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-white/80">Dashboard</span>
                <h1 className="mb-4 text-5xl font-bold leading-tight" style={{ fontFamily: headingFont }}>
                  Welcome back, {getDisplayName() || 'Hon. Delegate'}.
                </h1>
                <p className="max-w-lg text-[#e2e2e2]">
                  Use your dashboard to move directly into live updates, resolutions, messaging, and speech prep.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg p-8 shadow-[0_8px_32px_rgba(26,28,28,0.06)] flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-lg border-4 border-[#f4f3f3] mb-6 flex items-center justify-center bg-[#e8e8e8]">
                <UserRound className="h-10 w-10 text-[#500608]" />
              </div>
              <h2 className="mb-1 text-2xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>{getDisplayName() || 'Delegate'}</h2>
              <p className="mb-6 text-[11px] uppercase tracking-widest text-slate-500">{getUserRole() || 'Member'} Account</p>
              <div className="w-full grid grid-cols-1 gap-4 pt-6 border-t border-[#dcc0bd]/20 mb-6 text-left">
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Country</p>
                  <p className="text-sm font-semibold text-[#500608]">{currentUser?.country || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Committee ID</p>
                  <p className="text-sm font-semibold text-[#500608]">{currentUser?.committee_id || 'Not assigned'}</p>
                </div>
              </div>
              <Link href="/resolutions" className="w-full rounded-lg bg-[#500608] py-3 text-xs font-semibold uppercase tracking-wider text-white hover:opacity-90">
                Open Resolutions
              </Link>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <Link href="/live-updates" className="rounded-lg bg-[#FFF0E5] p-6 border-l-4 border-[#6E1D1B] hover:bg-[#f9e7d9] transition-colors">
              <p className="text-xs uppercase tracking-widest font-semibold text-slate-500">Conference Prep</p>
              <p className="mt-2 text-2xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>Check Session Notices</p>
            </Link>
            <Link href="/messages" className="rounded-lg bg-white p-6 border border-[#dcc0bd]/20 hover:bg-[#f4f3f3] transition-colors">
              <p className="text-xs uppercase tracking-widest font-semibold text-slate-500">Communications</p>
              <p className="mt-2 text-2xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>Open Messaging</p>
            </Link>
            <Link href="/speechrepo" className="rounded-lg bg-white p-6 border border-[#dcc0bd]/20 hover:bg-[#f4f3f3] transition-colors">
              <p className="text-xs uppercase tracking-widest font-semibold text-slate-500">Preparation</p>
              <p className="mt-2 text-2xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>Review Speeches</p>
            </Link>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 space-y-8">
              <h3 className="pb-4 border-b border-[#dcc0bd]/20 text-2xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>Dashboard Shortcuts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link key={action.title} href={action.href} className="group block rounded-lg border border-[#dcc0bd]/10 bg-white p-6 shadow-sm hover:bg-[#f4f3f3] transition-colors">
                      <div className="mb-4 flex items-center justify-between">
                        <Icon className="h-5 w-5 text-[#500608]" />
                        <span className="rounded bg-[#eee0d5] px-2 py-1 text-[9px] font-bold uppercase text-[#211a14]">Route</span>
                      </div>
                      <h4 className="mb-2 text-lg font-bold text-[#500608]" style={{ fontFamily: headingFont }}>{action.title}</h4>
                      <p className="mb-4 text-sm leading-relaxed text-slate-500">{action.description}</p>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E1D1B]">{action.cta}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-8">
              <div className="relative overflow-hidden rounded-lg bg-[#500608] p-8 text-white shadow-xl">
                <span className="mb-4 inline-block rounded bg-white px-2 py-1 text-[9px] font-bold uppercase text-[#500608]">Live Updates</span>
                <h3 className="mb-4 text-2xl font-bold leading-snug" style={{ fontFamily: headingFont }}>Track committee announcements in real time</h3>
                <p className="mb-6 text-sm leading-relaxed text-[#e2e2e2]">Open the live updates page for official notices, schedule changes, and conference communication.</p>
                <Link href="/live-updates" className="block w-full rounded-lg border border-white/20 bg-white/10 py-3 text-center text-[10px] font-bold uppercase tracking-widest hover:bg-white/20">Open Live Updates</Link>
              </div>

              <div className="rounded-lg bg-[#f4f3f3] p-6">
                <h4 className="mb-4 font-bold text-[#500608]" style={{ fontFamily: headingFont }}>Messaging</h4>
                <p className="mb-5 text-sm leading-relaxed text-slate-600">Use messaging for direct delegate communication and coordination.</p>
                <Link href="/messages" className="block w-full rounded-lg border border-[#dcc0bd]/20 bg-white py-3 text-center text-[10px] font-bold uppercase tracking-widest text-[#500608] hover:bg-[#e8e8e8]">Go to Messaging</Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default Page;
