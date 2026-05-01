'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useSession } from '@/app/context/sessionContext';

const primaryNav = [
  { label: 'Dashboard', href: '/home' },
  { label: 'Live Updates', href: '/live-updates' },
  { label: 'Glossary', href: '/glossary' },
  { label: 'Resolutions', href: '/resolutions' },
  { label: 'Speech Repository', href: '/speechrepo' },
  { label: 'Messaging', href: '/messages' },
];

const VOFMUNTopNav = () => {
  const pathname = usePathname();
  const { logout } = useSession();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-[#dcc0bd]/45 bg-[#FFF0E5]/80 shadow-[0_8px_32px_rgba(26,28,28,0.06)] backdrop-blur-md">
      <div className="mx-auto flex h-20 w-full max-w-[1440px] items-center justify-between gap-4 px-4 lg:px-8">
        <Link href="/home" className="font-[var(--font-newsreader),serif] text-[1.5rem] font-semibold text-[#6E1D1B]">
          VOFMUN ONE
        </Link>
        <div className="hidden items-center gap-5 md:flex">
          {primaryNav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${active ? 'text-[#6E1D1B]' : 'text-[#564240] hover:text-[#6E1D1B]'}`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <button
          onClick={logout}
          className="hidden items-center gap-1.5 rounded-lg bg-[#6E1D1B] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white md:inline-flex"
        >
          <LogOut className="h-3.5 w-3.5" />
          Log Out
        </button>
      </div>
    </nav>
  );
};

export default VOFMUNTopNav;
