import React, { useState } from 'react';
import { Link, useRouter } from '@/src/router';
import { useSession } from '@/app/context/sessionContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useMobile } from '@/hooks/use-mobile';
import {
  Home,
  FileText,
  MessageSquare,
  BookOpen,
  Menu,
  X,
  Bell,
  LogOut,
  LayoutGrid
} from 'lucide-react';

interface CustomNavProps {
  role?: 'delegate' | 'chair' | 'admin';
  activeLink?: string;
}

const CustomNav: React.FC<CustomNavProps> = () => {
  const { user: currentUser, logout } = useSession();
  const isMobile = useMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useRouter();

  const navigationItems = [
    { name: 'Home', to: '/home', icon: Home },
    { name: 'Live Updates', to: '/live-updates', icon: Bell },
    { name: 'Glossary', to: '/glossary', icon: BookOpen },
    { name: 'Speech Repository', to: '/speechrepo', icon: MessageSquare },
    { name: 'Resolutions', to: '/resolutions', icon: FileText },
    { name: 'Messages', to: '/messages', icon: MessageSquare },
  ];

  const adminItems = [
    { name: 'Admin Panel', to: '/admin', icon: LayoutGrid },
  ];

  const chairItems = [
    { name: 'Chair Dashboard', to: '/chair', icon: LayoutGrid },
  ];

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

  if (isMobile) {
    return (
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-gradient-to-r from-deep-red via-dark-burgundy to-deep-red text-white shadow-[0_18px_45px_-22px_rgba(112,30,30,0.65)] backdrop-blur">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-white font-semibold shadow-inner">
                V
              </div>
              <div className="text-left">
                <p className="text-xs uppercase tracking-[0.4em] text-white/70">VOFMUN</p>
                <p className="text-base font-semibold text-white">Delegate Hub</p>
              </div>
            </div>

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pb-4 border-t border-white/15"
              >
                <div className="space-y-2 pt-4">
                  {[...navigationItems, ...(currentUser && 'adminID' in currentUser ? adminItems : []), ...(currentUser && 'chairID' in currentUser ? chairItems : [])]
                    .map((item) => {
                      const Icon = item.icon ?? Home;
                      const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`);
                      return (
                        <Link
                          key={item.name}
                          to={item.to}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                            isActive
                              ? 'bg-white text-deep-red shadow-[0_14px_35px_-18px_rgba(255,255,255,0.55)]'
                              : 'text-white/85 hover:bg-white/10 hover:text-white'
                          }`}
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            isActive ? 'bg-deep-red/10 text-deep-red' : 'bg-white/10 text-white'
                          }`}>
                            <Icon size={18} strokeWidth={1.75} />
                          </span>
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}

                  <div className="border-t border-white/15 pt-4 mt-6">
                    <div className="px-4 py-2">
                      <p className="text-sm font-medium text-white/90"> Hello {getDisplayName()}</p>
                      <p className="text-xs uppercase tracking-[0.25em] text-white/60">{getUserRole()}</p>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white text-deep-red font-semibold tracking-wide shadow-sm hover:bg-soft-ivory transition"
                    >
                      <LogOut size={18} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-gradient-to-r from-deep-red via-dark-burgundy to-deep-red text-white shadow-[0_24px_55px_-28px_rgba(112,30,30,0.7)] backdrop-blur">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex justify-between items-center h-20 gap-6">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-white font-semibold text-lg shadow-inner">
              V
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-white/70">VOFMUN</p>
              <p className="text-xl font-semibold text-white">Leadership Hub</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2 py-1.5 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            {[...navigationItems, ...(currentUser && 'adminID' in currentUser ? adminItems : []), ...(currentUser && 'chairID' in currentUser ? chairItems : [])]
              .map((item) => {
                const Icon = item.icon ?? Home;
                const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`);
                return (
                  <Link
                    key={item.name}
                    to={item.to}
                    className={`group relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-white text-deep-red shadow-[0_12px_28px_-16px_rgba(255,255,255,0.65)]'
                        : 'text-white/80 hover:text-white hover:bg-white/15'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="lg:hidden flex items-center gap-2">
                      <Icon size={16} strokeWidth={1.75} />
                      <span>{item.name}</span>
                    </span>
                    <span className="hidden lg:inline">{item.name}</span>
                  </Link>
                );
              })}
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{getDisplayName()}</p>
              <p className="text-xs uppercase tracking-[0.22em] text-white/60">{getUserRole()}</p>
            </div>

            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-deep-red shadow-sm transition hover:bg-soft-ivory"
            >
              <LogOut size={16} />
              <span className="hidden lg:inline">Sign Out</span>
            </button>
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default CustomNav;
