// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useSession } from '../app/context/sessionContext';
import role from '@/lib/roles';

const CustomNav = dynamic(() => import('@/components/ui/customnav'), { ssr: false });
const SiteFooter = dynamic(() => import('@/components/ui/site-footer'), { ssr: false });

interface AppWrapperProps {
  children: React.ReactNode;
}

export default function AppWrapper({ children }: AppWrapperProps) {
  const { user: currentUser, authReady } = useSession();
  const pathname = usePathname();
  const userRole = role(currentUser);

  const isPublicLandingRoute = pathname === '/';
  const hasAuthenticatedChrome = authReady && Boolean(currentUser);
  const showChrome = isPublicLandingRoute || hasAuthenticatedChrome;

  const getActiveLink = () => {
    if (pathname === '/home') return 'home';
    if (pathname === '/speechrepo') return 'speechrepo';
    if (pathname === '/glossary') return 'glossary';
    if (pathname === '/resolutions') return 'resolutions';
    if (pathname === '/live-updates') return 'live-updates';
    if (pathname === '/committee-overview') return 'committee-overview';
    if (pathname === '/chair') return 'chair-tool';
    if (pathname === '/admin') return 'admin';
    if (pathname === '/about') return 'about';
    return undefined;
  };

  return (
    <div className="flex min-h-screen flex-col">
      {showChrome && (
        <CustomNav
          role={userRole as 'delegate' | 'chair' | 'admin'}
          activeLink={getActiveLink()}
        />
      )}
      <main className={`flex-1 ${showChrome ? 'pt-20' : ''}`}>{children}</main>
      {showChrome && <SiteFooter />}
    </div>
  );
}
