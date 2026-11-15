import React, { useEffect, useState } from 'react';
import { Link } from '@/src/router';
import { motion } from 'framer-motion';
import { useSession } from '../context/sessionContext';
import { ProtectedRoute } from '@/components/protectedroute';
import {
  Bell,
  MessageSquare,
  FileText,
  ArrowRight,
  Sparkles,
  BookOpen
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
    if ('adminID' in currentUser) return 'Administrator';
    if ('chairID' in currentUser) return 'Chair';
    if ('delegateID' in currentUser) return 'Delegate';
    return '';
  };

  const getDisplayName = () => {
    if (!currentUser) return '';
    return `${currentUser.firstname} ${currentUser.lastname}`;
  };

  const quickActions = [
    {
      title: "Live Updates",
      description: "Stay informed with real-time conference updates",
      href: "/live-updates",
      icon: Bell,
      color: "from-deep-red to-dark-burgundy"
    },
    {
      title: "Speech Repository",
      description: "Manage and organize your speeches",
      href: "/speechrepo",
      icon: MessageSquare,
      color: "from-dark-burgundy to-dark-navy"
    },
    {
      title: "Resolutions",
      description: "Draft and submit your committee resolutions",
      href: "/resolutions",
      icon: FileText,
      color: "from-deep-red to-dark-burgundy"
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
        <div className="page-maxwidth space-y-12">
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="surface-card is-emphasised overflow-hidden"
          >
            <div className="relative grid gap-6 md:grid-cols-[1.6fr_1fr] p-8 md:p-10">
              <div>
                <div className="flex items-center gap-3 text-sm text-white/80 mb-4">
                  <span className="badge-pill bg-white/15 text-white/80">
                    <Sparkles size={16} />
                    Daily Briefing
                  </span>
                  <span className="hidden md:inline-block text-white/70">{dateString}</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-serif font-bold text-white leading-tight mb-3">
                  Welcome back, {getDisplayName()}
                </h1>
                <p className="text-base md:text-lg text-white/80 max-w-xl leading-relaxed">
                  {getUserRole()} access unlocked. Stay on top of committee updates, resources, and your team’s next moves in one streamlined dashboard.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 mt-8">
                  <Link to="/live-updates" className="primary-button">
                    <Bell size={18} />
                    Live Updates
                  </Link>
                  <Link to="/speechrepo" className="ghost-button">
                    <FileText size={18} />
                    Upload Speech
                  </Link>
                </div>
              </div>

              <div className="relative">
                <div className="surface-card rounded-2xl border border-soft-ivory bg-white p-6 text-deep-red shadow-xl">
                  <p className="mb-3 text-xs uppercase tracking-[0.35em] text-deep-red/70">Now</p>
                  <p className="mb-2 text-4xl font-mono font-semibold text-deep-red">{timeString}</p>
                  <p className="mb-6 text-sm text-almost-black-green/70">{dateString}</p>
                  <div className="divider-soft"></div>
                  <p className="text-sm leading-relaxed text-almost-black-green/80">
                    Keep an eye on the crisis room and be prepared to respond. Remember to sync with your bloc before the moderated caucus begins.
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-transparent pointer-events-none"></div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="space-y-6"
          >
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h2 className="section-heading">Quick Actions</h2>
                <p className="section-subheading max-w-2xl">
                  Navigate to the tools you’ll need for speeches, resolutions, and staying informed during committee.
                </p>
              </div>
              <Link to="/messages" className="ghost-button">
                <MessageSquare size={16} />
                Open Messages
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <motion.div
                    key={action.title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, delay: 0.1 * (index + 1) }}
                  >
                    <Link to={action.href} className="group block h-full">
                      <div className="surface-card h-full overflow-hidden p-6 transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-xl">
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-soft-rose text-deep-red">
                              <Icon size={22} />
                            </span>
                            <div>
                              <h3 className="text-xl font-semibold text-deep-red">{action.title}</h3>
                              <p className="text-sm text-almost-black-green/70">{action.description}</p>
                            </div>
                          </div>
                          <ArrowRight size={18} className="text-deep-red/50 group-hover:text-deep-red transition-colors" />
                        </div>
                        <div className="divider-soft"></div>
                        <p className="text-sm text-almost-black-green/80">
                          Tap to open the {action.title.toLowerCase()} workspace in a focused view.
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="grid gap-6 lg:grid-cols-[1.4fr_1fr]"
          >
            <div className="surface-card p-6 md:p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-semibold text-deep-red">Conference Status</h3>
                <span className="badge-pill bg-pale-aqua text-deep-red">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                  Active Session
                </span>
              </div>
              <p className="text-almost-black-green/80 leading-relaxed">
                The committee is in active debate. Crisis staff are monitoring developments closely; watch for new directives every 15 minutes.
              </p>
              <div className="grid sm:grid-cols-3 gap-4 mt-6">
                {[
                  { title: 'Next Motion', value: 'Moderated Caucus', hint: 'Proposed by Germany – 8 minutes' },
                  { title: 'Documents', value: documentsCount, hint: 'Drafts awaiting review' },
                  { title: 'Messages', value: '2 unread', hint: 'Chairs awaiting responses' },
                ].map((item) => (
                  <div key={item.title} className="surface-card rounded-xl p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-deep-red/60">{item.title}</p>
                    <p className="text-lg font-semibold text-almost-black-green mt-1">{item.value}</p>
                    <p className="text-xs text-almost-black-green/60 mt-2">{item.hint}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="surface-card p-6">
                <h4 className="text-lg font-semibold text-deep-red mb-3">Today’s Priorities</h4>
                <ul className="space-y-3 text-sm text-almost-black-green/80">
                  <li className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-deep-red"></span>
                    Coordinate final talking points for the bloc statement.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-dark-burgundy"></span>
                    Review chair feedback on your draft resolution.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: 'var(--rich-gold)' }}></span>
                    Confirm delegates assigned to crisis response roles.
                  </li>
                </ul>
              </div>

              <div className="surface-card p-6">
                <h4 className="text-lg font-semibold text-deep-red mb-3">Need a refresher?</h4>
                <p className="text-sm text-almost-black-green/75 mb-4">
                  Access the glossary for parliamentary procedure or jump into the resolution workspace to keep drafting with your bloc.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link to="/glossary" className="ghost-button !py-2 !px-4">
                    <BookOpen size={16} /> Glossary
                  </Link>
                  <Link to="/resolutions" className="ghost-button !py-2 !px-4">
                    <FileText size={16} /> Resolutions
                  </Link>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Page;
