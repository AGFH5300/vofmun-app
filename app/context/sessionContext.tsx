// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { UserType } from "@/db/types";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { getAppUserForSession } from "@/lib/auth/getCurrentAppUser";
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
const INITIAL_SESSION_TIMEOUT_MS = 12_000;
const SessionContext = createContext<SessionContextProps | undefined>(undefined);


const findPersistedSession = (value: unknown): Session | null => {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (
    typeof record.access_token === "string" &&
    record.user &&
    typeof record.user === "object" &&
    typeof (record.user as Record<string, unknown>).id === "string"
  ) {
    return value as Session;
  }

  for (const nested of Object.values(record)) {
    const resolved = findPersistedSession(nested);
    if (resolved) return resolved;
  }

  return null;
};

const readPersistedSession = (): Session | null => {
  if (typeof window === "undefined") return null;

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;

    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) continue;

    try {
      const resolved = findPersistedSession(JSON.parse(rawValue));
      if (resolved) return resolved;
    } catch {
      // Ignore malformed or unrelated storage entries.
    }
  }

  return null;
};

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
  const userRef = useRef<UserType | null>(null);
  const requestGenerationRef = useRef(0);
  const profileRequestRef = useRef<{
    userId: string;
    promise: Promise<UserType | null>;
  } | null>(null);

  const applyUser = useCallback((nextUser: UserType | null) => {
    userRef.current = nextUser;
    setUser(nextUser);

    if (nextUser) {
      Cookies.set("user", JSON.stringify(nextUser), { sameSite: "lax" });
    } else {
      Cookies.remove("user");
    }
  }, []);

  const completeHydration = useCallback(() => {
    setAuthReady(true);
    setIsSessionHydrated(true);
  }, []);

  const resolveProfile = useCallback(async (session: Session): Promise<UserType | null> => {
    const existingRequest = profileRequestRef.current;
    if (existingRequest?.userId === session.user.id) {
      return existingRequest.promise;
    }

    const promise = (async () => {
      const { appUser } = await getAppUserForSession(session);
      return appUser ? mapAppUserToSessionUser(appUser) : null;
    })().finally(() => {
      if (profileRequestRef.current?.userId === session.user.id) {
        profileRequestRef.current = null;
      }
    });

    profileRequestRef.current = { userId: session.user.id, promise };
    return promise;
  }, []);

  useEffect(() => {
    let active = true;
    let receivedInitialAuthEvent = false;
    const scheduledCallbacks = new Set<number>();

    const finish = () => {
      if (!active) return;
      completeHydration();
    };

    const synchronizeAuthState = async (
      event: AuthChangeEvent,
      session: Session | null,
    ) => {
      const generation = ++requestGenerationRef.current;
      if (!active) return;

      if (!session?.user) {
        applyUser(null);
        finish();
        return;
      }

      const cachedUser = readCachedUser();
      const matchingCachedUser = cachedUser?.id === session.user.id ? cachedUser : null;
      const currentUserMatchesSession = userRef.current?.id === session.user.id;

      if (!currentUserMatchesSession) {
        setAuthReady(false);
        setIsSessionHydrated(false);
      }

      try {
        const mappedUser = await resolveProfile(session);
        if (!active || generation !== requestGenerationRef.current) return;

        if (mappedUser) {
          applyUser(mappedUser);
        } else if (matchingCachedUser) {
          applyUser(matchingCachedUser);
        } else {
          applyUser(null);
        }
      } catch (error) {
        console.error(`${SESSION_DEBUG_PREFIX} profile synchronization failed`, {
          event,
          error: error instanceof Error ? error.message : String(error),
        });
        if (!active || generation !== requestGenerationRef.current) return;

        if (matchingCachedUser) {
          applyUser(matchingCachedUser);
        } else if (!currentUserMatchesSession) {
          applyUser(null);
        }
      } finally {
        if (active && generation === requestGenerationRef.current) {
          finish();
        }
      }
    };

    // Supabase emits INITIAL_SESSION immediately after subscription. The callback
    // itself must return synchronously; all network/profile work is deferred.
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      receivedInitialAuthEvent = true;

      const timeoutId = window.setTimeout(() => {
        scheduledCallbacks.delete(timeoutId);

        // Supabase may emit INITIAL_SESSION with null while a persisted token is
        // still being refreshed. Treating that transient state as a confirmed
        // logout redirects protected pages before refresh can complete.
        const effectiveSession =
          event === "INITIAL_SESSION" && !session
            ? readPersistedSession()
            : session;

        void synchronizeAuthState(event, effectiveSession);
      }, 0);

      scheduledCallbacks.add(timeoutId);
    });


    // Replit development previews can occasionally suppress INITIAL_SESSION while
    // the token refresh still succeeds. Read the Supabase-persisted session without
    // calling back into the auth client so profile loading remains deterministic.
    const persistedFallbackId = window.setTimeout(() => {
      if (!active || receivedInitialAuthEvent) return;
      const persistedSession = readPersistedSession();
      if (!persistedSession) return;
      receivedInitialAuthEvent = true;
      void synchronizeAuthState("INITIAL_SESSION", persistedSession);
    }, 1_500);

    // Never leave the application behind an infinite loader if the auth client or
    // development transport fails before INITIAL_SESSION is delivered.
    const watchdogId = window.setTimeout(() => {
      if (!active || receivedInitialAuthEvent) return;
      console.error(`${SESSION_DEBUG_PREFIX} initial auth event timed out`);
      requestGenerationRef.current += 1;
      applyUser(null);
      finish();
    }, INITIAL_SESSION_TIMEOUT_MS);

    return () => {
      active = false;
      window.clearTimeout(persistedFallbackId);
      window.clearTimeout(watchdogId);
      scheduledCallbacks.forEach((timeoutId) => window.clearTimeout(timeoutId));
      scheduledCallbacks.clear();
      authListener.subscription.unsubscribe();
    };
  }, [applyUser, completeHydration, resolveProfile]);

  const login = useCallback((nextUser: NonNullable<UserType>) => {
    requestGenerationRef.current += 1;
    applyUser(nextUser);
    completeHydration();
  }, [applyUser, completeHydration]);

  const logout = useCallback(async () => {
    requestGenerationRef.current += 1;
    applyUser(null);
    completeHydration();
    await supabase.auth.signOut();
    router.replace("/login");
  }, [applyUser, completeHydration, router]);

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
