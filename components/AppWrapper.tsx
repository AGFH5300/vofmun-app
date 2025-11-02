import { useSession } from "../app/context/sessionContext";
import CustomNav from "@/components/ui/customnav";
import SiteFooter from "@/components/ui/site-footer";
import role from "@/lib/roles";
import { useRouter } from "@/src/router";
import AmazingCursor from "@/components/ui/AmazingCursor";

interface AppWrapperProps {
  children: React.ReactNode;
}

export default function AppWrapper({ children }: AppWrapperProps) {
  const { user: currentUser } = useSession();
  const { pathname } = useRouter();
  const userRole = role(currentUser);
  
  // Don't show navigation or footer on login page
  const isLoginRoute = pathname === "/login";
  const showNav = !isLoginRoute;
  
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
    <>
      <AmazingCursor />
      <div className="flex min-h-screen flex-col">
        {showNav && (
          <CustomNav
            role={userRole as 'delegate' | 'chair' | 'admin'}
            activeLink={getActiveLink()}
          />
        )}
        <main className="flex-1">{children}</main>
        {!isLoginRoute && <SiteFooter />}
      </div>
    </>
  );
}
