// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { UserType } from "@/db/types";
import Cookies from "js-cookie";
import { usePathname, useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { getCurrentAppUser } from "@/lib/auth/getCurrentAppUser";
import { mapAppUserToSessionUser } from "@/lib/auth/mapAppUserToSessionUser";

interface SessionContextProps {
  user: UserType | null;
  isSessionHydrated: boolean;
  isAuthenticated: boolean;
  authReady: boolean;
  login: (user: UserType) => void;
  logout: () => Promise<void>;
}

const SESSION_DEBUG_PREFIX = "[SessionContextDebug]";

const SessionContext = createContext<SessionContextProps | undefined>(
  undefined
);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserType>(null);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const appUserResolutionInFlightRef = useRef<Promise<UserType | null> | null>(null);
  const hydrateSessionInFlightRef = useRef<Promise<void> | null>(null);
  const userRef = useRef<UserType | null>(null);
  const isResetPasswordRoute = pathname === "/reset-password";

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const resolveAppUser = useCallback(async (): Promise<UserType | null> => {
    if (!appUserResolutionInFlightRef.current) {
      appUserResolutionInFlightRef.current = (async () => {
        const { appUser } = await getCurrentAppUser();
        return appUser ? mapAppUserToSessionUser(appUser) : null;
      })().finally(() => {
        appUserResolutionInFlightRef.current = null;
      });
    }

    return appUserResolutionInFlightRef.current;
  }, []);

  useEffect(() => {
    let active = true;
    const shouldBypassResetPasswordHydration = isResetPasswordRoute;

    console.debug(`${SESSION_DEBUG_PREFIX} route_context`, {
      pathname,
      bypassResetPasswordHydration: shouldBypassResetPasswordHydration,
    });

    const hydrateSession = async () => {
      if (hydrateSessionInFlightRef.current) {
        await hydrateSessionInFlightRef.current;
        return;
      }

      hydrateSessionInFlightRef.current = (async () => {
        let hydrationAuthenticated = false;
        console.debug(`${SESSION_DEBUG_PREFIX} hydrate:start`);
        setAuthReady(false);
        setIsSessionHydrated(false);

        const storedUser = Cookies.get("user");
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser) as UserType;
            if (active) {
              setUser(parsed);
              console.debug(`${SESSION_DEBUG_PREFIX} hydrate:cookie_user_loaded`, {
                id: (parsed as { id?: string }).id,
                role: (parsed as { role?: string }).role,
              });
            }
          } catch {
            Cookies.remove("user");
            if (active) {
              setUser(null);
            }
            console.debug(`${SESSION_DEBUG_PREFIX} hydrate:cookie_parse_failed`);
          }
        } else if (active) {
          setUser(null);
        }

        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

          if (!active) return;

          if (sessionError) {
            console.debug(`${SESSION_DEBUG_PREFIX} hydrate:session_error`, {
              message: sessionError.message,
            });
            setUser(null);
            Cookies.remove("user");
          } else if (!sessionData.session) {
            console.debug(`${SESSION_DEBUG_PREFIX} hydrate:no_auth_session`);
            setUser(null);
            Cookies.remove("user");
          } else {
            console.debug(`${SESSION_DEBUG_PREFIX} hydrate:auth_session_present`, {
              userId: sessionData.session.user?.id,
            });

            if (shouldBypassResetPasswordHydration) {
              hydrationAuthenticated = Boolean(sessionData.session.user);
              console.debug(`${SESSION_DEBUG_PREFIX} hydrate:app_user_resolution_skipped`, {
                reason: "reset-password-route",
              });
              return;
            }

            const mappedUser = await resolveAppUser();

            if (!active) return;

            if (!mappedUser) {
              console.debug(`${SESSION_DEBUG_PREFIX} hydrate:app_user_missing`);
              setUser(null);
              Cookies.remove("user");
            } else {
              hydrationAuthenticated = true;
              setUser(mappedUser);
              Cookies.set("user", JSON.stringify(mappedUser));
              console.debug(`${SESSION_DEBUG_PREFIX} hydrate:app_user_resolved`, {
                id: mappedUser.id,
                role: mappedUser.role,
              });
            }
          }
        } catch (error) {
          if (!active) return;
          console.debug(`${SESSION_DEBUG_PREFIX} hydrate:unexpected_error`, {
            error: error instanceof Error ? error.message : String(error),
          });
          setUser(null);
          Cookies.remove("user");
        } finally {
          if (active) {
            setAuthReady(true);
            setIsSessionHydrated(true);
            console.debug(`${SESSION_DEBUG_PREFIX} hydrate:complete`, {
              authenticated: hydrationAuthenticated,
            });
          }
          hydrateSessionInFlightRef.current = null;
        }
      })();

      await hydrateSessionInFlightRef.current;
    };

    void hydrateSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.debug(`${SESSION_DEBUG_PREFIX} auth_state_change:event_name`, {
        eventName: event,
        hasSession: Boolean(session),
      });

      if (!active) return;

      if (hydrateSessionInFlightRef.current) {
        await hydrateSessionInFlightRef.current;
      }

      if (!active) return;

      if (shouldBypassResetPasswordHydration) {
        console.debug(`${SESSION_DEBUG_PREFIX} reset_password_bypass_active`, {
          pathname,
          event,
          hasSession: Boolean(session),
        });
        console.debug(`${SESSION_DEBUG_PREFIX} skipped_app_user_resolution`, {
          pathname,
          event,
        });
        setAuthReady(true);
        setIsSessionHydrated(true);
        return;
      }

      if (!session) {
        setUser(null);
        Cookies.remove("user");
        setAuthReady(true);
        setIsSessionHydrated(true);
        return;
      }

      const sessionUserId = session.user?.id ? String(session.user.id) : null;
      const resolvedUserId = userRef.current?.id ? String(userRef.current.id) : null;
      const isSameResolvedUser = Boolean(sessionUserId && resolvedUserId && sessionUserId === resolvedUserId);
      const isSilentResumeEvent = isSameResolvedUser && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED');
      const shouldHoldRenderGate = !isSilentResumeEvent && event !== 'TOKEN_REFRESHED';

      if (shouldHoldRenderGate) {
        setAuthReady(false);
        setIsSessionHydrated(false);
      }

      try {
        const mappedUser = await resolveAppUser();
        if (!active) return;

        if (mappedUser) {
          setUser(mappedUser);
          Cookies.set("user", JSON.stringify(mappedUser));
        } else if (shouldHoldRenderGate) {
          setUser(null);
          Cookies.remove("user");
        }
      } catch (error) {
        if (!active) return;
        console.debug(`${SESSION_DEBUG_PREFIX} auth_state_change:profile_error`, {
          error: error instanceof Error ? error.message : String(error),
          event,
        });
        if (shouldHoldRenderGate) {
          setUser(null);
          Cookies.remove("user");
        }
      } finally {
        if (active) {
          setAuthReady(true);
          setIsSessionHydrated(true);
        }
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [isResetPasswordRoute, pathname, resolveAppUser]);

  const login = (nextUser: UserType) => {
    console.debug(`${SESSION_DEBUG_PREFIX} login`, { id: nextUser.id, role: nextUser.role });
    setUser(nextUser);
    Cookies.set("user", JSON.stringify(nextUser));
    setAuthReady(true);
    setIsSessionHydrated(true);
  };

  const logout = async () => {
    console.debug(`${SESSION_DEBUG_PREFIX} logout:start`);
    setUser(null);
    Cookies.remove("user");
    await supabase.auth.signOut();
    setAuthReady(true);
    setIsSessionHydrated(true);
    router.replace("/login");
  };

  const value = useMemo(
    () => ({
      user,
      isSessionHydrated,
      isAuthenticated: Boolean(user),
      authReady,
      login,
      logout,
    }),
    [authReady, isSessionHydrated, user]
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};
