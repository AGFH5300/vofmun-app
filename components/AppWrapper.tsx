// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import { useSession } from "../app/context/sessionContext";
import CustomNav from "@/components/ui/customnav";
import SiteFooter from "@/components/ui/site-footer";
import { usePathname } from "next/navigation";

interface AppWrapperProps {
  children: React.ReactNode;
}

export default function AppWrapper({ children }: AppWrapperProps) {
  useSession();
  const pathname = usePathname();
  
  // Standalone auth pages should not show global navigation/footer
  const isStandaloneAuthRoute = pathname === "/login" || pathname === "/reset-password";
  const isMessagesRoute = pathname === "/messages" || pathname.startsWith("/messages/");
  const showNav = !isStandaloneAuthRoute && !isMessagesRoute;
  



  return (
    <div className="flex min-h-screen flex-col">
      {showNav && (
        <CustomNav />
      )}
      <main className={`flex-1 ${showNav ? "pt-20 pb-16 md:pb-0" : ""}`}>{children}</main>
      {!isStandaloneAuthRoute && !isMessagesRoute && <SiteFooter />}
    </div>
  );
}
