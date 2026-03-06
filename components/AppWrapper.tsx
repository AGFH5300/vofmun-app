// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import { useSession } from "../app/context/sessionContext";
import CustomNav from "@/components/ui/customnav";
import SiteFooter from "@/components/ui/site-footer";
import AmazingCursor from "@/components/ui/AmazingCursor";
import role from "@/lib/roles";
import { usePathname } from "next/navigation";

interface AppWrapperProps {
  children: React.ReactNode;
}

export default function AppWrapper({ children }: AppWrapperProps) {
  const { user: currentUser } = useSession();
  const pathname = usePathname();
  const userRole = role(currentUser);
  
  // Standalone auth pages should not show global navigation/footer
  const isStandaloneAuthRoute = pathname === "/login" || pathname === "/reset-password";
  const showNav = !isStandaloneAuthRoute;
  
  // Get activeLink from pathname
  const getActiveLink = () => {
    if (pathname === "/home") return "home";
    if (pathname === "/speechrepo") return "speechrepo";
    if (pathname === "/glossary") return "glossary";
    if (pathname === "/resolutions") return "resolutions";
    if (pathname === "/live-updates") return "live-updates";
    if (pathname === "/committee-overview") return "committee-overview";
    if (pathname === "/chair") return "chair-tool";
    if (pathname === "/admin") return "admin";
    return undefined;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AmazingCursor />
      {showNav && (
        <CustomNav
          role={userRole as 'delegate' | 'chair' | 'admin'}
          activeLink={getActiveLink()}
        />
      )}
      <main className="flex-1">{children}</main>
      {!isStandaloneAuthRoute && <SiteFooter />}
    </div>
  );
}
