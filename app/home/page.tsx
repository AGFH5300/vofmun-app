// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSession } from '../context/sessionContext';
import { ProtectedRoute } from '@/components/protectedroute';
import VOFMUNPageShell from '@/components/ui/vofmun-page-shell';
import VOFMUNCard from '@/components/ui/vofmun-card';
import VOFMUNBadge from '@/components/ui/vofmun-badge';
import { Bell, MessageSquare, FileText, BookOpen, Users, Clock3, AlertTriangle, ArrowRight } from 'lucide-react';

const Page = () => {
  const { user: currentUser } = useSession();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getUserRole = () => {
    if (!currentUser) return '';
    if (currentUser.role === 'admin') return 'Administrator';
    if (currentUser.role === 'chair') return 'Chair';
    if (currentUser.role === 'delegate') return 'Delegate';
    if (currentUser.role === 'secretariat') return 'Secretariat';
    return '';
  };

  const displayName = useMemo(() => {
    if (!currentUser) return 'Delegate';
    return currentUser.full_name || `${currentUser.first_name} ${currentUser.last_name}`.trim() || 'Delegate';
  }, [currentUser]);

  const dateString = currentTime.toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const countdown = {
    days: '02',
    hours: '14',
    mins: '45'
  };

  return (
    <ProtectedRoute>
      <VOFMUNPageShell>
        <div className="page-maxwidth space-y-10 px-4 pb-10 pt-3 md:px-6 md:pb-12 md:pt-4 lg:px-8">
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <VOFMUNCard className="relative overflow-hidden lg:col-span-2">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,240,229,0.22),transparent_45%),linear-gradient(135deg,#6E1D1B,#4d1413)]" />
                <div className="relative z-10 flex min-h-[340px] flex-col justify-end p-7 text-white md:p-10">
                  <VOFMUNBadge className="mb-4 w-fit bg-white/15 text-[#FFF0E5]">General Assembly Session IV</VOFMUNBadge>
                  <h1 className="mb-3 max-w-3xl text-4xl italic leading-tight md:text-5xl lg:text-[3.25rem]" style={{ fontFamily: "var(--font-newsreader, 'Newsreader', serif)" }}>
                    Welcome back, {displayName}.
                  </h1>
                  <p className="max-w-2xl text-sm leading-relaxed text-[#FFF0E5] md:text-base">
                    {getUserRole()} access enabled. Monitor agenda movement, resource updates, and coordination signals in one unified diplomatic dashboard.
                  </p>
                </div>
              </VOFMUNCard>

              <VOFMUNCard className="p-6 md:p-7">
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-[#6E1D1B]">Delegate profile</p>
                <h2 className="break-words text-2xl font-semibold text-[#6E1D1B]" style={{ fontFamily: "var(--font-newsreader, 'Newsreader', serif)" }}>
                  {displayName}
                </h2>
                <p className="mt-1 break-words text-[11px] font-bold uppercase tracking-[0.2em] text-[#564240]">
                  {getUserRole() || 'Delegate'}
                </p>
                <div className="my-5 h-px bg-[#ece5e1]" />
                <div className="space-y-3 text-sm text-[#564240]">
                  <p className="break-words"><span className="mr-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E1D1B]">Country</span>{currentUser?.country || 'N/A'}</p>
                  <p className="break-words"><span className="mr-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E1D1B]">Committee</span>{currentUser?.committee || 'General Assembly'}</p>
                  <p className="break-words"><span className="mr-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E1D1B]">Date</span>{dateString}</p>
                  <p><span className="mr-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E1D1B]">Status</span>Present</p>
                </div>
                <Link href="/resolutions" className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-[#6E1D1B] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:opacity-90">
                  Submit Resolution
                </Link>
              </VOFMUNCard>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
              <VOFMUNCard className="bg-[#FFF0E5] p-6 md:col-span-2 lg:p-8">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#6E1D1B]">Next session commences in</p>
                <div className="flex items-end gap-3 text-[#6E1D1B]" style={{ fontFamily: "var(--font-newsreader, 'Newsreader', serif)" }}>
                  <span className="text-5xl font-semibold">{countdown.days}</span><span className="mb-2 text-xl">:</span>
                  <span className="text-5xl font-semibold">{countdown.hours}</span><span className="mb-2 text-xl">:</span>
                  <span className="text-5xl font-semibold">{countdown.mins}</span>
                </div>
                <p className="mt-3 text-xs font-medium italic text-[#564240]">Agenda: Cyber Warfare Sovereignty</p>
              </VOFMUNCard>

              <VOFMUNCard className="border-l-4 border-l-[#6E1D1B] bg-[#f4f3f3] p-6 lg:p-8">
                <FileText className="mb-2 text-[#6E1D1B]" size={18} />
                <p className="text-3xl font-bold text-[#6E1D1B]" style={{ fontFamily: "var(--font-newsreader, 'Newsreader', serif)" }}>3</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#564240]">Draft documents</p>
              </VOFMUNCard>

              <VOFMUNCard className="border-l-4 border-l-[#6E1D1B] bg-[#f4f3f3] p-6 lg:p-8">
                <Users className="mb-2 text-[#6E1D1B]" size={18} />
                <p className="text-3xl font-bold text-[#6E1D1B]" style={{ fontFamily: "var(--font-newsreader, 'Newsreader', serif)" }}>2</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#564240]">Unread messages</p>
              </VOFMUNCard>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-8">
                <h3 className="border-b border-[#dcc0bd]/40 pb-3 text-2xl font-semibold text-[#6E1D1B]" style={{ fontFamily: "var(--font-newsreader, 'Newsreader', serif)" }}>
                  Essential Delegate Resources
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    { title: 'Live Updates', desc: 'Track announcements and directives from chairs and crisis staff.', href: '/live-updates', icon: Bell },
                    { title: 'Speech Repository', desc: 'Store and review speech drafts before committee delivery.', href: '/speechrepo', icon: MessageSquare },
                    { title: 'Rules Glossary', desc: 'Quick procedural definitions for motions, points, and protocol.', href: '/glossary', icon: BookOpen },
                    { title: 'Resolutions Workspace', desc: 'Continue drafting and editing your working papers and resolutions.', href: '/resolutions', icon: FileText }
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.title} href={item.href} className="group">
                        <VOFMUNCard className="h-full p-5 transition hover:bg-[#f7f4f2]">
                          <div className="mb-3 flex items-center justify-between">
                            <Icon size={18} className="text-[#6E1D1B]" />
                            <ArrowRight size={14} className="text-[#6E1D1B]/60 transition group-hover:translate-x-0.5" />
                          </div>
                          <h4 className="text-lg font-semibold text-[#6E1D1B]" style={{ fontFamily: "var(--font-newsreader, 'Newsreader', serif)" }}>{item.title}</h4>
                          <p className="mt-2 text-sm leading-relaxed text-[#564240]">{item.desc}</p>
                        </VOFMUNCard>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 lg:col-span-4">
                <VOFMUNCard className="bg-[#6E1D1B] p-6 text-white">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle size={16} />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Active crisis alert</p>
                  </div>
                  <h4 className="text-2xl italic" style={{ fontFamily: "var(--font-newsreader, 'Newsreader', serif)" }}>Security Council Notice</h4>
                  <p className="mt-2 text-sm leading-relaxed text-[#FFF0E5]">Delegations should align bloc response language before the next moderated caucus begins.</p>
                </VOFMUNCard>

                <VOFMUNCard className="p-6">
                  <div className="mb-3 flex items-center gap-2 text-[#6E1D1B]">
                    <Clock3 size={16} />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Recent messaging</p>
                  </div>
                  <p className="text-sm text-[#564240]">You have <span className="font-semibold text-[#6E1D1B]">2 unread</span> messages from chairs and bloc members.</p>
                  <Link href="/messages" className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6E1D1B]">
                    Open Messages <ArrowRight size={14} />
                  </Link>
                </VOFMUNCard>
              </div>
            </div>
          </motion.section>
        </div>
      </VOFMUNPageShell>
    </ProtectedRoute>
  );
};

export default Page;
