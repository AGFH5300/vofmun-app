import React, { useState } from 'react';
import { Link } from '@/src/router';
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
      <nav className="sticky top-0 z-50 backdrop-blur bg-warm-light-grey/95 border-b border-cool-grey/70 shadow-[0_10px_30px_-25px_rgba(112,30,30,0.45)]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-deep-red to-dark-burgundy flex items-center justify-center text-white font-semibold">
                V
              </div>
              <div className="text-left">
                <p className="text-xs uppercase tracking-[0.35em] text-deep-red/80">Vofmun</p>
                <p className="text-base font-semibold text-almost-black-green">Delegate Hub</p>
              </div>
            </div>

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg text-almost-black-green hover:bg-soft-rose/60 transition-colors"
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
                className="pb-4 border-t border-cool-grey/60"
              >
                <div className="space-y-2 pt-4">
                  {[...navigationItems, ...(currentUser && 'adminID' in currentUser ? adminItems : []), ...(currentUser && 'chairID' in currentUser ? chairItems : [])]
                    .map((item) => {
                      const Icon = item.icon ?? Home;
                      return (
                        <Link
                          key={item.name}
                          to={item.to}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl text-almost-black-green hover:text-deep-red hover:bg-soft-ivory transition-colors font-medium"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-soft-ivory text-deep-red">
                            <Icon size={18} />
                          </span>
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}

                  <div className="border-t border-cool-grey/60 pt-4 mt-6">
                    <div className="px-4 py-2">
                      <p className="text-sm font-medium text-almost-black-green"> Hello {getDisplayName()}</p>
                      <p className="text-xs text-deep-red/80">{getUserRole()}</p>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-deep-red to-dark-burgundy text-white font-semibold tracking-wide"
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
    <nav className="sticky top-0 z-50 backdrop-blur bg-warm-light-grey/95 border-b border-cool-grey/70 shadow-[0_20px_45px_-30px_rgba(112,30,30,0.45)]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-deep-red via-dark-burgundy to-deep-red flex items-center justify-center text-white font-semibold text-lg shadow-lg">
              V
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-deep-red/80">Vofmun</p>
              <p className="text-xl font-semibold text-almost-black-green">Leadership Hub</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 lg:gap-3 bg-white/60 border border-cool-grey/70 rounded-full px-2 py-1.5 shadow-inner">
            {[...navigationItems, ...(currentUser && 'adminID' in currentUser ? adminItems : []), ...(currentUser && 'chairID' in currentUser ? chairItems : [])]
              .map((item) => {
                const Icon = item.icon ?? Home;
                return (
                  <Link
                    key={item.name}
                    to={item.to}
                    className="group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-almost-black-green/80 transition-all hover:bg-soft-ivory hover:text-deep-red"
                  >
                    <span className="hidden lg:flex h-8 w-8 items-center justify-center rounded-full bg-soft-rose/70 text-deep-red group-hover:bg-deep-red group-hover:text-white transition-colors">
                      <Icon size={16} />
                    </span>
                    <span>{item.name}</span>
                  </Link>
                );
              })}
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-almost-black-green">{getDisplayName()}</p>
              <p className="text-xs text-deep-red/80 uppercase tracking-[0.18em]">{getUserRole()}</p>
            </div>

            <button
              onClick={logout}
              className="primary-button !py-2 !px-4"
            >
              <LogOut size={16} />
              <span className="hidden lg:inline">Sign Out</span>
            </button>
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg text-almost-black-green hover:bg-soft-rose/60 transition-colors"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default CustomNav;