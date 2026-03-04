import supabase from '@/lib/supabase';
import { AppUser, AppUserRole } from '@/db/types';

const DEFAULT_RESO_PERMS = {
  'update:reso': [],
  'view:allreso': false,
  'view:ownreso': true,
  'update:ownreso': true,
};

const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();

export async function getCurrentAppUser() {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  const authUser = authData.user;
  if (!authUser) {
    return { authUser: null, appUser: null as AppUser | null };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: existingError } = await (supabase as any)
    .from('app_users')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return { authUser, appUser: existing as AppUser };
  }

  const insertPayload = {
    id: authUser.id,
    email: normalizeEmail(authUser.email),
    role: 'delegate' as AppUserRole,
    reso_perms: DEFAULT_RESO_PERMS,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any).from('app_users').insert(insertPayload);
  if (insertError) {
    throw insertError;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error: createdError } = await (supabase as any)
    .from('app_users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (createdError) {
    throw createdError;
  }

  return { authUser, appUser: created as AppUser };
}
