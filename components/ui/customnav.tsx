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
  ChevronDown,
  Bell,
  LogOut
} from 'lucide-react';

interface CustomNavProps {
  role?: 'delegate' | 'chair' | 'admin';
  activeLink?: string;
}

const CustomNav: React.FC<CustomNavProps> = () => {
  const { user: currentUser, logout } = useSession();
  const isMobile = useMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navigationItems = [
    { name: 'Home', to: '/home' },
    { name: 'Live Updates', to: '/live-updates' },
    { name: 'Glossary', to: '/glossary' },
    { name: 'Speech Repository', to: '/speechrepo' },
    { name: 'Resolutions', to: '/resolutions' },
    { name: 'Messages', to: '/messages' },
  ];

  const adminItems = [
    { name: 'Admin Panel', to: '/admin' },
  ];

  const chairItems = [
    { name: 'Chair Dashboard', to: '/chair' },
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
      <nav className="bg-warm-light-grey shadow-md border-b border-cool-grey sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="text-center">
                <div className="font-bold text-lg text-almost-black-green leading-tight">MUN HUB</div>
              </div>
            </div>

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg text-almost-black-green hover:bg-cool-grey transition-colors"
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
                className="pb-4 border-t border-cool-grey"
              >
                <div className="space-y-2 pt-4">
                  {navigationItems.map((item) => (
                    <Link
                      key={item.name}
                      to={item.to}
                      className="flex items-center px-4 py-3 rounded-lg text-almost-black-green hover:text-deep-red hover:bg-soft-rose transition-colors font-medium"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span>{item.name}</span>
                    </Link>
                  ))}

                  {currentUser && 'adminID' in currentUser && adminItems.map((item) => (
                    <Link
                      key={item.name}
                      to={item.to}
                      className="flex items-center px-4 py-3 rounded-lg text-almost-black-green hover:text-deep-red hover:bg-soft-rose transition-colors font-medium"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span>{item.name}</span>
                    </Link>
                  ))}

                  {currentUser && 'chairID' in currentUser && chairItems.map((item) => (
                    <Link
                      key={item.name}
                      to={item.to}
                      className="flex items-center px-4 py-3 rounded-lg text-almost-black-green hover:text-deep-red hover:bg-soft-rose transition-colors font-medium"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span>{item.name}</span>
                    </Link>
                  ))}

                  <div className="border-t border-cool-grey pt-4 mt-4">
                    <div className="px-4 py-2">
                      <p className="text-sm font-medium text-almost-black-green"> Hello {getDisplayName()}</p>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center space-x-3 px-4 py-3 rounded-lg text-deep-red hover:bg-soft-rose transition-colors w-full text-left font-medium text-black"
                    >
                      <LogOut size={20} />
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
    <nav className="bg-warm-light-grey shadow-md border-b border-cool-grey sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="text-center">
              <div className="font-bold text-lg text-almost-black-green leading-tight">MUN HUB</div>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                to={item.to}
                className="px-3 py-2 text-almost-black-green hover:text-deep-red transition-colors font-medium text-sm"
              >
                {item.name}
              </Link>
            ))}

            {currentUser && 'adminID' in currentUser && adminItems.map((item) => (
              <Link
                key={item.name}
                to={item.to}
                className="px-3 py-2 text-almost-black-green hover:text-deep-red transition-colors font-medium text-sm"
              >
                {item.name}
              </Link>
            ))}

            {currentUser && 'chairID' in currentUser && chairItems.map((item) => (
              <Link
                key={item.name}
                to={item.to}
                className="px-3 py-2 text-almost-black-green hover:text-deep-red transition-colors font-medium text-sm"
              >
                {item.name}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <div className="text-right">
              <p className="text-xs font-medium text-almost-black-green">{getDisplayName()}</p>
              <p className="text-xs text-cool-grey">{getUserRole()}</p>
            </div>

            <button
              onClick={logout}
              className="bg-deep-red hover:bg-dark-burgundy text-white p-2 rounded-lg transition-colors shadow-md"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default CustomNav;