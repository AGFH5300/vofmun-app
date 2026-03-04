import supabase from "@/lib/supabase";
import { AppUser, AppUserRole } from "@/db/types";

const DEFAULT_RESO_PERMS = {
  "update:reso": [],
  "view:allreso": false,
  "view:ownreso": true,
  "update:ownreso": true,
};

const normalizeEmail = (email?: string | null) => (email || "").trim().toLowerCase();

export async function getCurrentAppUser() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const session = sessionData.session;
  if (!session?.access_token) {
    return { authUser: null, appUser: null as AppUser | null };
  }

  const accessToken = session.access_token;
  const authUser = session.user;

  supabase.auth.setAuth(accessToken);
  const { data: existing, error: existingError } = await (supabase as any)
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

  const { error: insertError } = await (supabase as any).from("app_users").insert(insertPayload);
  if (insertError) throw insertError;
  const { data: created, error: createdError } = await (supabase as any)
    .from("app_users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (createdError) throw createdError;

  return { authUser, appUser: created as AppUser };
}
