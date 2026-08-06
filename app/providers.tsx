// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';

const AuthenticatedShell = dynamic(() => import('./authenticated-shell'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-[#fff8f2]" aria-label="Loading account">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#701e1e]/25 border-t-[#701e1e]" />
    </div>
  ),
});

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicAuthRoute = pathname === '/login' || pathname === '/reset-password';

  // Public authentication pages intentionally avoid loading the global session,
  // navigation, footer, and their Supabase dependencies into app/layout.js.
  if (isPublicAuthRoute) {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
