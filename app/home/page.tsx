// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from '../context/sessionContext';
import { ProtectedRoute } from '@/components/protectedroute';
import { BookOpen, Scale, ScrollText, Globe, UserRound } from 'lucide-react';

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

  const bodyFont = "var(--font-manrope), Manrope, ui-sans-serif, system-ui, sans-serif";
  const headingFont = "var(--font-newsreader), Newsreader, Georgia, serif";

  const resources = [
    {
      title: 'Delegate Handbook',
      description: 'Comprehensive guide on committee procedures, protocol, and the VOFMUN code of conduct.',
      href: '/live-updates',
      icon: BookOpen,
      tag: 'Official'
    },
    {
      title: 'Committee Rules & Procedure',
      description: 'The parliamentary rules governing DISEC debates, motions, and voting blocks.',
      href: '/resolutions',
      icon: Scale,
      tag: 'PDF'
    },
    {
      title: 'Position Paper Guidelines',
      description: 'Standard formatting and content requirements for all delegate submissions.',
      href: '/speechrepo',
      icon: ScrollText,
      tag: 'Template'
    },
    {
      title: 'Country Briefing Library',
      description: 'Access historical voting data and economic indicators for all member nations.',
      href: '/glossary',
      icon: Globe,
      tag: 'Global'
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
            <div className="lg:col-span-2 relative overflow-hidden bg-[#6E1D1B] rounded-lg p-10 flex flex-col justify-end min-h-[350px] text-white">
              <div className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.09)_0px,rgba(255,255,255,0.09)_1px,rgba(255,255,255,0)_1px,rgba(255,255,255,0)_56px)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(255,255,255,0.14),rgba(255,255,255,0)_42%),linear-gradient(145deg,rgba(80,6,8,0.22)_0%,rgba(32,10,13,0.46)_100%)]" />
              <div className="relative z-10">
                <span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-white/80">General Assembly Session IV</span>
                <h1 className="mb-4 text-5xl italic font-bold leading-tight" style={{ fontFamily: headingFont }}>
                  Welcome back, {getDisplayName() || 'Hon. Delegate'}.
                </h1>
                <p className="max-w-lg text-[#e2e2e2]">
                  Your country&apos;s position on the Disarmament and International Security agenda is currently under review by the rapporteur.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg p-8 shadow-[0_8px_32px_rgba(26,28,28,0.06)] flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-lg border-4 border-[#f4f3f3] mb-6 flex items-center justify-center bg-[#e8e8e8]">
                <UserRound className="h-10 w-10 text-[#500608]" />
              </div>
              <h2 className="mb-1 text-2xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>{getDisplayName() || 'Delegate'}</h2>
              <p className="mb-6 text-[11px] uppercase tracking-widest text-slate-500">Representative of {getUserRole() || 'Member State'}</p>
              <div className="w-full grid grid-cols-2 gap-4 pt-6 border-t border-[#dcc0bd]/20 mb-6">
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Committee</p>
                  <p className="text-sm font-semibold text-[#500608]">DISEC</p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Status</p>
                  <p className="text-sm font-semibold text-[#500608]">Present</p>
                </div>
              </div>
              <Link href="/resolutions" className="w-full rounded-lg bg-[#500608] py-3 text-xs font-semibold uppercase tracking-wider text-white hover:opacity-90">
                Submit Resolution
              </Link>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="md:col-span-2 bg-[#FFF0E5] rounded-lg p-8 flex flex-col justify-between">
              <div>
                <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[#500608]">Next Session Commences In</h3>
                <div className="flex gap-4">
                  <div className="flex flex-col"><span className="text-4xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>02</span><span className="text-[9px] uppercase text-slate-500">Days</span></div>
                  <span className="text-4xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>:</span>
                  <div className="flex flex-col"><span className="text-4xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>14</span><span className="text-[9px] uppercase text-slate-500">Hours</span></div>
                  <span className="text-4xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>:</span>
                  <div className="flex flex-col"><span className="text-4xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>45</span><span className="text-[9px] uppercase text-slate-500">Mins</span></div>
                </div>
              </div>
              <div className="mt-8">
                <span className="text-xs font-semibold italic text-slate-600" style={{ fontFamily: headingFont }}>Agenda: Cyber Warfare Sovereignty</span>
              </div>
            </div>

            <div className="rounded-lg bg-[#f4f3f3] border-l-4 border-[#6E1D1B] p-8 flex flex-col justify-center">
              <p className="text-3xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>3</p>
              <p className="text-xs uppercase tracking-widest font-semibold text-slate-500">Draft Resolutions</p>
            </div>
            <div className="rounded-lg bg-[#f4f3f3] border-l-4 border-[#6E1D1B] p-8 flex flex-col justify-center">
              <p className="text-3xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>2</p>
              <p className="text-xs uppercase tracking-widest font-semibold text-slate-500">Unread Messages</p>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 space-y-8">
              <h3 className="pb-4 border-b border-[#dcc0bd]/20 text-2xl font-bold text-[#500608]" style={{ fontFamily: headingFont }}>Essential Delegate Resources</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {resources.map((resource) => {
                  const Icon = resource.icon;
                  return (
                    <Link key={resource.title} href={resource.href} className="group block rounded-lg border border-[#dcc0bd]/10 bg-white p-6 shadow-sm hover:bg-[#f4f3f3] transition-colors">
                      <div className="mb-4 flex items-center justify-between">
                        <Icon className="h-5 w-5 text-[#500608]" />
                        <span className="rounded bg-[#eee0d5] px-2 py-1 text-[9px] font-bold uppercase text-[#211a14]">{resource.tag}</span>
                      </div>
                      <h4 className="mb-2 text-lg font-bold text-[#500608]" style={{ fontFamily: headingFont }}>{resource.title}</h4>
                      <p className="text-sm leading-relaxed text-slate-500">{resource.description}</p>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-8">
              <div className="relative overflow-hidden rounded-lg bg-[#500608] p-8 text-white shadow-xl">
                <span className="mb-4 inline-block rounded bg-white px-2 py-1 text-[9px] font-bold uppercase text-[#500608]">Active Crisis Alert</span>
                <h3 className="mb-4 text-2xl font-bold leading-snug" style={{ fontFamily: headingFont }}>Maritime Incursion in the Bering Strait</h3>
                <p className="mb-6 text-sm leading-relaxed text-[#e2e2e2]">Emergency intelligence indicates unauthorized naval maneuvers. DISEC delegates must prepare for an immediate extraordinary motion.</p>
                <Link href="/live-updates" className="block w-full rounded-lg border border-white/20 bg-white/10 py-3 text-center text-[10px] font-bold uppercase tracking-widest hover:bg-white/20">Read Briefing</Link>
              </div>

              <div className="rounded-lg bg-[#f4f3f3] p-6">
                <h4 className="mb-4 italic font-bold text-[#500608]" style={{ fontFamily: headingFont }}>Recent Messaging</h4>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#e2e2e2] flex items-center justify-center"><UserRound className="h-4 w-4 text-[#500608]" /></div>
                    <div>
                      <p className="text-xs font-bold">Delegate (France)</p>
                      <p className="text-[11px] text-slate-500">Requesting a meeting regarding the caucus motion...</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#e2e2e2] flex items-center justify-center"><UserRound className="h-4 w-4 text-[#500608]" /></div>
                    <div>
                      <p className="text-xs font-bold">Delegate (USA)</p>
                      <p className="text-[11px] text-slate-500">Agreed. We will support the amendment in Clause 4...</p>
                    </div>
                  </div>
                </div>
                <Link href="/messages" className="mt-4 block w-full rounded-lg border border-[#dcc0bd]/20 bg-white py-3 text-center text-[10px] font-bold uppercase tracking-widest text-[#500608] hover:bg-[#e8e8e8]">Go to Messaging</Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default Page;
