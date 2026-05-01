// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSession } from '../context/sessionContext';
import { ProtectedRoute } from '@/components/protectedroute';
import {
  Bell,
  MessageSquare,
  FileText,
  ArrowRight,
  Sparkles,
  BookOpen,
  Clock3,
  AlertTriangle,
  Send,
  UserRound
} from 'lucide-react';

const Page = () => {
  const { user: currentUser } = useSession();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

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

  const quickActions = [
    {
      title: 'Live Updates',
      description: 'Stay informed with real-time conference updates',
      href: '/live-updates',
      icon: Bell,
      color: 'from-deep-red to-dark-burgundy'
    },
    {
      title: 'Speech Repository',
      description: 'Manage and organize your speeches',
      href: '/speechrepo',
      icon: MessageSquare,
      color: 'from-dark-burgundy to-dark-navy'
    },
    {
      title: 'Resolutions',
      description: 'Draft and submit your committee resolutions',
      href: '/resolutions',
      icon: FileText,
      color: 'from-deep-red to-dark-burgundy'
    }
  ];

  const documentsCount = '3 drafts';

  const timeString = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const dateString = currentTime.toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <ProtectedRoute>
      <div className="page-shell">
        <div className="page-maxwidth space-y-8 md:space-y-10 pb-24 md:pb-8">
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="grid grid-cols-1 xl:grid-cols-3 gap-6"
          >
            <div className="xl:col-span-2 surface-card is-emphasised overflow-hidden p-7 md:p-10 min-h-[320px] flex flex-col justify-end relative">
              <div className="flex items-center gap-3 text-sm text-white/80 mb-4">
                <span className="badge-pill bg-white/15 text-white/80">
                  <Sparkles size={16} />
                  General Assembly Session
                </span>
                <span className="hidden md:inline-block text-white/70">{dateString}</span>
              </div>
              <h1
                className="text-3xl md:text-5xl font-serif font-bold text-white leading-tight mb-3"
                style={heroHeadingStyle}
              >
                Welcome back, {getDisplayName()}
              </h1>
              <p className="text-base md:text-lg text-white/80 max-w-2xl leading-relaxed">
                {getUserRole()} access unlocked. Keep your bloc aligned with live developments, draft progress, and committee milestones from one unified dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <Link href="/live-updates" className="primary-button">
                  <Bell size={18} />
                  Live Updates
                </Link>
                <Link href="/resolutions" className="ghost-button">
                  <FileText size={18} />
                  Submit Resolution
                </Link>
              </div>
            </div>

            <div className="surface-card rounded-2xl border border-soft-ivory bg-white p-6 md:p-7 shadow-xl">
              <div className="w-16 h-16 rounded-xl bg-soft-rose text-deep-red flex items-center justify-center mb-4">
                <UserRound size={28} />
              </div>
              <h2 className="text-2xl font-semibold text-deep-red" style={accentHeadingStyle}>{getDisplayName()}</h2>
              <p className="text-xs uppercase tracking-[0.28em] text-almost-black-green/60 mt-1">{getUserRole()}</p>
              <div className="divider-soft my-5"></div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-almost-black-green/60">Status</p>
                  <p className="font-semibold text-almost-black-green mt-1">Present</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-almost-black-green/60">Time</p>
                  <p className="font-semibold text-almost-black-green mt-1">{timeString}</p>
                </div>
              </div>
              <Link href="/messages" className="ghost-button mt-6 w-full justify-center">
                <Send size={16} />
                Open Messages
              </Link>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-4 gap-5"
          >
            <div className="lg:col-span-2 rounded-2xl border border-[#ead6cc] bg-[#fff2e8] p-6 md:p-8">
              <div className="flex items-center gap-2 mb-4 text-deep-red">
                <Clock3 size={16} />
                <p className="text-xs uppercase tracking-[0.24em] font-semibold">Next Session Commences In</p>
              </div>
              <p className="text-3xl md:text-4xl text-deep-red font-semibold" style={accentHeadingStyle}>02 : 14 : 45</p>
              <p className="text-sm text-almost-black-green/70 mt-2">Agenda: Cyber Warfare Sovereignty</p>
              <div className="divider-soft my-4"></div>
              <p className="text-sm text-almost-black-green/80">Stay prepared for extraordinary motions and update your caucus positions ahead of moderated debate.</p>
            </div>
            {[
              { title: 'Documents', value: documentsCount, hint: 'Drafts awaiting review' },
              { title: 'Messages', value: '2 unread', hint: 'Chairs awaiting responses' }
            ].map((item) => (
              <div key={item.title} className="surface-card rounded-2xl p-6 border-l-4 border-deep-red/70">
                <p className="text-[11px] uppercase tracking-[0.24em] text-deep-red/65">{item.title}</p>
                <p className="text-2xl font-semibold text-deep-red mt-2" style={accentHeadingStyle}>{item.value}</p>
                <p className="text-xs text-almost-black-green/65 mt-2">{item.hint}</p>
              </div>
            ))}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="grid grid-cols-1 xl:grid-cols-12 gap-6"
          >
            <div className="xl:col-span-8 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-2xl font-semibold text-deep-red" style={accentHeadingStyle}>Essential Delegate Resources</h3>
                <BookOpen size={18} className="text-deep-red/70" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <motion.div
                      key={action.title}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.55, delay: 0.1 * (index + 1) }}
                    >
                      <Link href={action.href} className="group block h-full">
                        <div className="surface-card h-full overflow-hidden rounded-2xl p-6 transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-xl border border-soft-ivory/70">
                          <div className="flex items-start justify-between mb-4">
                            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-soft-rose text-deep-red">
                              <Icon size={20} />
                            </span>
                            <ArrowRight size={18} className="text-deep-red/50 group-hover:text-deep-red transition-colors" />
                          </div>
                          <h4 className="text-xl font-semibold text-deep-red mb-2" style={accentHeadingStyle}>{action.title}</h4>
                          <p className="text-sm text-almost-black-green/75 leading-relaxed">{action.description}</p>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="xl:col-span-4 space-y-5">
              <div className="surface-card is-emphasised rounded-2xl p-6 text-white overflow-hidden relative">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} />
                  <p className="text-[11px] uppercase tracking-[0.24em] font-semibold">Active Crisis Alert</p>
                </div>
                <h4 className="text-2xl font-semibold leading-snug mb-3" style={heroHeadingStyle}>Maritime Incursion in the Bering Strait</h4>
                <p className="text-sm text-white/85 leading-relaxed mb-5">Emergency intelligence indicates unauthorized naval maneuvers. DISEC delegates should prepare for an extraordinary motion.</p>
                <Link href="/live-updates" className="ghost-button border-white/30 text-white hover:bg-white/10">
                  Read Briefing
                </Link>
              </div>
              <div className="surface-card rounded-2xl p-6">
                <h4 className="text-lg font-semibold text-deep-red mb-4" style={accentHeadingStyle}>Recent Messaging</h4>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-soft-rose text-deep-red">
                      <UserRound size={14} />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-almost-black-green">Delegate (France)</p>
                      <p className="text-xs text-almost-black-green/65">Requesting a meeting regarding the caucus motion...</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-soft-rose text-deep-red">
                      <UserRound size={14} />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-almost-black-green">Delegate (USA)</p>
                      <p className="text-xs text-almost-black-green/65">Agreed. We will support the amendment in Clause 4...</p>
                    </div>
                  </div>
                </div>
                <Link href="/messages" className="ghost-button mt-5 w-full justify-center">
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
