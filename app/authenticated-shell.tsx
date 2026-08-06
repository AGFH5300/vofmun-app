// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import { SessionProvider } from '@/app/context/sessionContext';
import AppWrapper from '@/components/AppWrapper';
import { Toaster } from 'sonner';

export default function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppWrapper>{children}</AppWrapper>
      <Toaster />
    </SessionProvider>
  );
}
