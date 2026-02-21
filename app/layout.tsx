// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
import '@/app/globals.css';
import '@fontsource/inter';
import '@fontsource/dm-sans';
import '@fontsource/dm-serif-display';
import '@fontsource/merriweather';
import '@fontsource/open-sans';
import '@fontsource/playfair-display';
import '@fontsource/poppins';
import type { Metadata } from 'next';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'VOFMUN ONE',
  description: 'VOFMUN conference platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
