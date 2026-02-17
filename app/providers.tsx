'use client';

import { SessionProvider } from '@/app/context/sessionContext';
import AppWrapper from '@/components/AppWrapper';
import { Toaster } from 'sonner';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppWrapper>
        {children}
      </AppWrapper>
      <Toaster />
    </SessionProvider>
  );
}
