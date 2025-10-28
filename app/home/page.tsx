import React, { useEffect, useState } from 'react';
import { Link } from '@/src/router';
import { motion } from 'framer-motion';
import { useSession } from '../context/sessionContext';
import { ProtectedRoute } from '@/components/protectedroute';
import { useMobile } from '@/hooks/use-mobile';
import {
  Bell,
  MessageSquare,
  FileText,
  Calendar,
  ArrowRight,
  Sparkles
} from 'lucide-react';

const Page = () => {
  const { user: currentUser } = useSession();
  const isMobile = useMobile();
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
      <div className="min-h-screen bg-soft-ivory">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-r from-deep-red to-dark-burgundy rounded-2xl shadow-2xl p-6 md:p-8 mb-8 text-white"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div className="mb-4 md:mb-0">
                <div className="flex items-center space-x-3 mb-2">
                  <Sparkles size={28} className="text-pale-aqua" />
                  <h1 className="text-3xl md:text-4xl font-bold">
                    Welcome back, {getDisplayName()}
                  </h1>
                </div>
                <div className="flex items-center space-x-2 text-white/80">
                  <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">
                    {getUserRole()}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl md:text-3xl font-mono font-bold mb-1">
                  {timeString}
                </div>
                <div className="text-sm text-white/80">
                  {dateString}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Actions Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-deep-red mb-6 text-center">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <motion.div
                    key={action.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 * (index + 1) }}
                    className="group"
                  >
                    <Link to={action.href}>
                      <div className={`bg-gradient-to-br ${action.color} rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 text-white group-hover:scale-105`}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                            <Icon size={24} className="text-white" />
                          </div>
                          <ArrowRight
                            size={20}
                            className="text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all duration-300"
                          />
                        </div>

                        <h3 className="text-xl font-bold mb-2 group-hover:text-pale-aqua transition-colors">
                          {action.title}
                        </h3>
                        <p className="text-white/80 text-sm leading-relaxed">
                          {action.description}
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Status Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white rounded-2xl shadow-lg p-6 border border-cool-grey"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-deep-red">Conference Status</h3>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-almost-black-green font-medium">Active</span>
              </div>
            </div>
            <p className="text-almost-black-green">
              The conference is currently in session. Check Live Updates for the latest announcements and schedule changes.
            </p>
          </motion.div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Page;