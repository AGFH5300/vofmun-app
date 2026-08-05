import type { User } from "@supabase/supabase-js";
import supabase from "@/lib/supabase";
import { AppUser, AppUserRole } from "@/db/types";

const DEFAULT_RESO_PERMS = {
  "update:reso": [],
  "view:allreso": false,
  "view:ownreso": true,
  "update:ownreso": true,
};

const normalizeEmail = (email?: string | null) => (email || "").trim().toLowerCase();

/**
 * Resolve the application profile for an auth user whose session has already
 * been established. Keeping auth session reads out of onAuthStateChange avoids
 * the Supabase auth lock/deadlock that previously left protected pages blank.
 */
export async function getAppUserForAuthUser(authUser: User) {
  const { data: existing, error: existingError } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    return { authUser, appUser: existing as AppUser };
  }

  const insertPayload = {
    id: authUser.id,
    email: normalizeEmail(authUser.email),
    role: "delegate" as AppUserRole,
    reso_perms: DEFAULT_RESO_PERMS,
  };

  const { error: insertError } = await supabase.from("app_users").insert(insertPayload);
  if (insertError) throw insertError;

  const { data: created, error: createdError } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (createdError) throw createdError;

  return { authUser, appUser: created as AppUser };
}

export async function getCurrentAppUser() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const session = sessionData.session;
  if (!session?.user) {
    return { authUser: null, appUser: null as AppUser | null };
  }

  return getAppUserForAuthUser(session.user);
}
