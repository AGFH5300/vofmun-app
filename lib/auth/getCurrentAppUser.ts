import type { Session, User } from "@supabase/supabase-js";
import supabase from "@/lib/supabase";
import { AppUser } from "@/db/types";

const PROFILE_REQUEST_TIMEOUT_MS = 12_000;

interface ProfileResponse {
  appUser: AppUser | null;
}

const requestProfile = async (accessToken: string): Promise<AppUser | null> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), PROFILE_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("/api/auth/profile", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });

    if (response.status === 401) {
      return null;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(body || `Profile request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as ProfileResponse;
    return payload.appUser || null;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Profile request timed out.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

/**
 * Resolve the application profile using a session already supplied by Supabase.
 * The browser never reads app_users directly; the server verifies the bearer
 * token and returns only the authenticated user's own profile.
 */
export async function getAppUserForSession(session: Session) {
  const appUser = await requestProfile(session.access_token);
  return { authUser: session.user, appUser };
}

/**
 * Backward-compatible helper for code that already has a Supabase auth user.
 * Callers should prefer getAppUserForSession because a User alone does not carry
 * the access token required by the authenticated profile endpoint.
 */
export async function getAppUserForAuthUser(authUser: User) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const session = sessionData.session;
  if (!session || session.user.id !== authUser.id) {
    return { authUser, appUser: null as AppUser | null };
  }

  return getAppUserForSession(session);
}

export async function getCurrentAppUser() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const session = sessionData.session;
  if (!session?.user) {
    return { authUser: null, appUser: null as AppUser | null };
  }

  return getAppUserForSession(session);
}
