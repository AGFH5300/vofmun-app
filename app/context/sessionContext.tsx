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
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { UserType } from "@/db/types";
import Cookies from "js-cookie";
import { usePathname, useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { getAppUserForAuthUser } from "@/lib/auth/getCurrentAppUser";
import { mapAppUserToSessionUser } from "@/lib/auth/mapAppUserToSessionUser";

interface SessionContextProps {
  user: UserType | null;
  isSessionHydrated: boolean;
  isAuthenticated: boolean;
  authReady: boolean;
  login: (user: NonNullable<UserType>) => void;
  logout: () => Promise<void>;
}

const SESSION_DEBUG_PREFIX = "[SessionContextDebug]";
const SessionContext = createContext<SessionContextProps | undefined>(undefined);

const readCachedUser = (): UserType | null => {
  const storedUser = Cookies.get("user");
  if (!storedUser) return null;

  try {
    const parsed = JSON.parse(storedUser) as UserType;
    if (!parsed?.id || !parsed.role) {
      Cookies.remove("user");
      return null;
    }
    return parsed;
  } catch {
    Cookies.remove("user");
    return null;
  }
};

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserType>(null);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const appUserResolutionInFlightRef = useRef<{
    userId: string;
    promise: Promise<UserType | null>;
  } | null>(null);
  const hydrateSessionInFlightRef = useRef<Promise<void> | null>(null);
  const userRef = useRef<UserType | null>(null);
  const isResetPasswordRoute = pathname === "/reset-password";

  const applyUser = useCallback((nextUser: UserType | null) => {
    userRef.current = nextUser;
    setUser(nextUser);

    if (nextUser) {
      Cookies.set("user", JSON.stringify(nextUser), { sameSite: "lax" });
    } else {
      Cookies.remove("user");
    }
  }, []);

  const resolveAppUser = useCallback(async (authUser: User): Promise<UserType | null> => {
    const existingRequest = appUserResolutionInFlightRef.current;
    if (existingRequest?.userId === authUser.id) {
      return existingRequest.promise;
    }

    const promise = (async () => {
      const { appUser } = await getAppUserForAuthUser(authUser);
      return appUser ? mapAppUserToSessionUser(appUser) : null;
    })().finally(() => {
      if (appUserResolutionInFlightRef.current?.userId === authUser.id) {
        appUserResolutionInFlightRef.current = null;
      }
    });

    appUserResolutionInFlightRef.current = { userId: authUser.id, promise };
    return promise;
  }, []);

  useEffect(() => {
    let active = true;
    const scheduledCallbacks = new Set<number>();
    const shouldBypassResetPasswordHydration = isResetPasswordRoute;

    const completeHydration = () => {
      if (!active) return;
      setAuthReady(true);
      setIsSessionHydrated(true);
    };

    const clearSession = () => {
      if (!active) return;
      applyUser(null);
      completeHydration();
    };

    const hydrateSession = async () => {
      if (hydrateSessionInFlightRef.current) {
        await hydrateSessionInFlightRef.current;
        return;
      }

      const hydrationPromise = (async () => {
        setAuthReady(false);
        setIsSessionHydrated(false);

        const cachedUser = readCachedUser();

        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (!active) return;

          if (sessionError || !sessionData.session?.user) {
            clearSession();
            return;
          }

          if (shouldBypassResetPasswordHydration) {
            completeHydration();
            return;
          }

          const sessionUser = sessionData.session.user;
          const matchingCachedUser = cachedUser?.id === sessionUser.id ? cachedUser : null;

          try {
            const mappedUser = await resolveAppUser(sessionUser);
            if (!active) return;

            if (mappedUser) {
              applyUser(mappedUser);
            } else if (matchingCachedUser) {
              applyUser(matchingCachedUser);
            } else {
              applyUser(null);
            }
          } catch (error) {
            console.error(`${SESSION_DEBUG_PREFIX} profile hydration failed`, error);
            if (!active) return;

            // A matching cached profile is safe for temporary UI continuity because
            // every privileged server operation independently verifies the live role.
            if (matchingCachedUser) {
              applyUser(matchingCachedUser);
            } else {
              applyUser(null);
            }
          } finally {
            completeHydration();
          }
        } catch (error) {
          console.error(`${SESSION_DEBUG_PREFIX} session hydration failed`, error);
          if (!active) return;
          clearSession();
        }
      })().finally(() => {
        hydrateSessionInFlightRef.current = null;
      });

      hydrateSessionInFlightRef.current = hydrationPromise;
      await hydrationPromise;
    };

    const synchronizeAuthState = async (
      event: AuthChangeEvent,
      session: Session | null,
    ) => {
      if (!active) return;

      if (hydrateSessionInFlightRef.current) {
        await hydrateSessionInFlightRef.current;
      }
      if (!active) return;

      if (shouldBypassResetPasswordHydration) {
        completeHydration();
        return;
      }

      if (!session?.user) {
        clearSession();
        return;
      }

      const currentUserMatchesSession = userRef.current?.id === session.user.id;
      const shouldHoldRenderGate = !currentUserMatchesSession && event !== "TOKEN_REFRESHED";

      if (shouldHoldRenderGate) {
        setAuthReady(false);
        setIsSessionHydrated(false);
      }

      try {
        const mappedUser = await resolveAppUser(session.user);
        if (!active) return;

        if (mappedUser) {
          applyUser(mappedUser);
        } else if (!currentUserMatchesSession) {
          applyUser(null);
        }
      } catch (error) {
        console.error(`${SESSION_DEBUG_PREFIX} auth state profile refresh failed`, error);
        if (!active) return;

        // Keep an already verified profile visible during a transient refresh failure.
        if (!currentUserMatchesSession) {
          applyUser(null);
        }
      } finally {
        completeHydration();
      }
    };

    void hydrateSession();

    // Supabase auth callbacks must return immediately. Calling getSession or
    // awaiting other Supabase work inside the callback can hold the auth lock and
    // prevent the subsequent app_users request from ever being sent.
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const timeoutId = window.setTimeout(() => {
        scheduledCallbacks.delete(timeoutId);
        void synchronizeAuthState(event, session);
      }, 0);
      scheduledCallbacks.add(timeoutId);
    });

    return () => {
      active = false;
      scheduledCallbacks.forEach((timeoutId) => window.clearTimeout(timeoutId));
      scheduledCallbacks.clear();
      authListener.subscription.unsubscribe();
    };
  }, [applyUser, isResetPasswordRoute, resolveAppUser]);

  const login = useCallback((nextUser: NonNullable<UserType>) => {
    applyUser(nextUser);
    setAuthReady(true);
    setIsSessionHydrated(true);
  }, [applyUser]);

  const logout = useCallback(async () => {
    applyUser(null);
    await supabase.auth.signOut();
    setAuthReady(true);
    setIsSessionHydrated(true);
    router.replace("/login");
  }, [applyUser, router]);

  const value = useMemo(
    () => ({
      user,
      isSessionHydrated,
      isAuthenticated: Boolean(user),
      authReady,
      login,
      logout,
    }),
    [authReady, isSessionHydrated, login, logout, user]
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
