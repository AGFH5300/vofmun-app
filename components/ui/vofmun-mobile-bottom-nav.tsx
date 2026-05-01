'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { label: 'Home', href: '/home' },
  { label: 'Updates', href: '/live-updates' },
  { label: 'Resos', href: '/resolutions' },
  { label: 'Speeches', href: '/speechrepo' },
  { label: 'Messages', href: '/messages' },
];

const VOFMUNMobileBottomNav = () => {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dcc0bd]/45 bg-[#FFF0E5]/95 shadow-[0_-8px_24px_rgba(26,28,28,0.06)] md:hidden">
      <div className="grid grid-cols-5 gap-1 px-2 py-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-1 py-2 text-center text-[10px] font-bold uppercase tracking-[0.15em] ${active ? 'text-[#6E1D1B]' : 'text-[#564240]'}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default VOFMUNMobileBottomNav;
