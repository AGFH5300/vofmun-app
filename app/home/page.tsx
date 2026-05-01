// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSession } from '../context/sessionContext';
import { ProtectedRoute } from '@/components/protectedroute';
import {
  MessageSquare,
  ArrowRight,
  BookOpen,
  Clock3,
  AlertTriangle,
  Send,
  UserRound,
  Scale,
  ScrollText,
  Globe
} from 'lucide-react';

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

  const brandDarkRed = '#701e1e';
  const serifHeadingFont = "var(--font-dm-serif-display, 'DM Serif Display', serif)";
  const heroHeadingStyle: React.CSSProperties = {
    color: '#FFFFFF',
    fontFamily: serifHeadingFont
  };
  const accentHeadingStyle: React.CSSProperties = {
    color: brandDarkRed,
    fontFamily: serifHeadingFont
  };

  const documentsCount = '3 drafts';

  const resourceCards = [
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
      href: '/live-updates',
      icon: Globe,
      tag: 'Global'
    }
  ];

  return (
    <ProtectedRoute>
      <div className="page-shell bg-[#f9f9f9]">
        <div className="mx-auto w-full max-w-7xl px-6 md:px-8 pb-16 md:pb-8 pt-1 md:pt-2 space-y-6 md:space-y-8 overflow-x-hidden">
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12"
          >
            <div className="lg:col-span-2 rounded-2xl p-7 md:p-8 min-h-[350px] flex flex-col justify-end relative overflow-hidden text-white bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.12),rgba(255,255,255,0)_42%),repeating-linear-gradient(90deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_1px,rgba(255,255,255,0)_1px,rgba(255,255,255,0)_56px),linear-gradient(140deg,#6f1d1c_0%,#4a1014_62%,#2e0b10_100%)]">
              <div className="absolute inset-0 opacity-35 bg-[linear-gradient(120deg,rgba(0,0,0,0.08)_5%,rgba(0,0,0,0.32)_100%)]" />
              <div className="relative z-10">
                <span className="block text-[10px] uppercase tracking-[0.2em] text-white/80 mb-3">General Assembly Session</span>
                <h1 className="text-[2rem] md:text-[2.75rem] italic font-bold leading-[1.08] mb-3" style={heroHeadingStyle}>
                  Welcome back, {getDisplayName()}
                </h1>
                <p className="text-sm md:text-[15px] text-white/80 max-w-lg leading-relaxed">
                  {getUserRole()} access unlocked. Keep your bloc aligned with live developments, draft progress, and committee milestones from one unified dashboard.
                </p>
              </div>
            </div>

            <div className="surface-card rounded-2xl border border-soft-ivory bg-white p-5 md:p-6 shadow-xl flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-xl bg-soft-rose text-deep-red flex items-center justify-center mb-4 border-4 border-[#f3eee8]">
                <UserRound size={30} />
              </div>
              <h2 className="text-[1.6rem] font-semibold text-deep-red break-words leading-tight" style={accentHeadingStyle}>{getDisplayName()}</h2>
              <p className="text-xs uppercase tracking-[0.14em] text-almost-black-green/60 mt-1 break-words">{getUserRole()}</p>
              <div className="divider-soft my-4 w-full"></div>
              <div className="grid grid-cols-2 gap-3 text-sm w-full text-left">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-almost-black-green/60">Committee</p>
                  <p className="font-semibold text-almost-black-green mt-1">DISEC</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-almost-black-green/60">Status</p>
                  <p className="font-semibold text-almost-black-green mt-1">Present</p>
                </div>
              </div>
              <Link href="/resolutions" className="primary-button mt-5 w-full justify-center">
                <Send size={16} />
                Submit Resolution
              </Link>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
          >
            <div className="md:col-span-2 rounded-2xl border border-[#ead6cc] bg-[#FFF0E5] p-5 md:p-6">
              <div className="flex items-center gap-2 mb-3 text-deep-red">
                <Clock3 size={16} />
                <p className="text-[10px] uppercase tracking-[0.22em] font-semibold">Next Session Commences In</p>
              </div>
              <div className="flex items-center gap-3 md:gap-4">
                <div className="flex flex-col">
                  <span className="text-3xl md:text-4xl font-bold text-deep-red" style={accentHeadingStyle}>02</span>
                  <span className="text-[9px] uppercase tracking-wide text-almost-black-green/55">Days</span>
                </div>
                <span className="text-3xl md:text-4xl font-bold text-deep-red" style={accentHeadingStyle}>:</span>
                <div className="flex flex-col">
                  <span className="text-3xl md:text-4xl font-bold text-deep-red" style={accentHeadingStyle}>14</span>
                  <span className="text-[9px] uppercase tracking-wide text-almost-black-green/55">Hours</span>
                </div>
                <span className="text-3xl md:text-4xl font-bold text-deep-red" style={accentHeadingStyle}>:</span>
                <div className="flex flex-col">
                  <span className="text-3xl md:text-4xl font-bold text-deep-red" style={accentHeadingStyle}>45</span>
                  <span className="text-[9px] uppercase tracking-wide text-almost-black-green/55">Mins</span>
                </div>
              </div>
              <p className="text-xs md:text-sm text-almost-black-green/75 mt-4">Agenda: Cyber Warfare Sovereignty</p>
            </div>
            {[
              { title: 'Documents', value: documentsCount, hint: 'Drafts awaiting review' },
              { title: 'Messages', value: '2 unread', hint: 'Chairs awaiting responses' }
            ].map((item) => (
              <div key={item.title} className="surface-card rounded-2xl p-5 border-l-4 border-deep-red/70 bg-[#f4f3f3]">
                <p className="text-[11px] uppercase tracking-[0.24em] text-deep-red/65">{item.title}</p>
                <p className="text-xl font-semibold text-deep-red mt-1.5" style={accentHeadingStyle}>{item.value}</p>
                <p className="text-xs text-almost-black-green/65 mt-1.5">{item.hint}</p>
              </div>
            ))}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-10"
          >
            <div className="lg:col-span-8 space-y-4">
              <h3 className="text-xl font-semibold text-deep-red border-b border-[#dcc0bd]/40 pb-3" style={accentHeadingStyle}>Essential Delegate Resources</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {resourceCards.map((resource) => {
                  const Icon = resource.icon;
                  return (
                    <Link key={resource.title} href={resource.href} className="group block">
                      <div className="bg-white rounded-xl border border-[#dcc0bd]/20 shadow-sm p-4 h-full">
                        <div className="flex items-center justify-between mb-2.5">
                          <Icon size={16} className="text-deep-red" />
                          <span className="text-[9px] font-bold uppercase px-2 py-1 bg-[#eee0d5] rounded text-[#211a14]">{resource.tag}</span>
                        </div>
                        <h4 className="text-[15px] font-semibold text-deep-red mb-1.5 leading-tight" style={accentHeadingStyle}>{resource.title}</h4>
                        <p className="text-xs text-almost-black-green/70 leading-relaxed">{resource.description}</p>
                        <div className="mt-2.5 flex items-center text-deep-red/70 text-xs font-semibold">
                          Open <ArrowRight size={14} className="ml-1" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-xl p-5 text-white overflow-hidden relative bg-[linear-gradient(160deg,#500608_0%,#6e1d1b_100%)] shadow-lg">
                <div className="absolute right-3 top-3 opacity-15">
                  <AlertTriangle size={54} />
                </div>
                <span className="inline-block px-2 py-1 bg-white text-deep-red text-[9px] font-bold uppercase mb-3 rounded">Active Crisis Alert</span>
                <h4 className="text-lg font-semibold leading-snug mb-2.5" style={heroHeadingStyle}>Maritime Incursion in the Bering Strait</h4>
                <p className="text-xs text-white/85 leading-relaxed mb-3.5">Emergency intelligence indicates unauthorized naval maneuvers. DISEC delegates should prepare for an extraordinary motion.</p>
                <Link href="/live-updates" className="ghost-button border-white/30 text-white hover:bg-white/10 w-full justify-center">
                  Read Briefing
                </Link>
              </div>
              <div className="rounded-xl p-4 bg-[#f4f3f3] border border-[#e2e2e2]">
                <h4 className="text-base font-semibold text-deep-red mb-3 italic" style={accentHeadingStyle}>Recent Messaging</h4>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e2e2e2] text-deep-red">
                      <UserRound size={14} />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-almost-black-green">Delegate (France)</p>
                      <p className="text-[11px] text-almost-black-green/65">Requesting a meeting regarding the caucus motion...</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e2e2e2] text-deep-red">
                      <UserRound size={14} />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-almost-black-green">Delegate (USA)</p>
                      <p className="text-[11px] text-almost-black-green/65">Agreed. We will support the amendment in Clause 4...</p>
                    </div>
                  </div>
                </div>
                <Link href="/messages" className="ghost-button mt-4 w-full justify-center">
                  <MessageSquare size={16} />
                  Go to Messaging
                </Link>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Page;
