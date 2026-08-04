import { AppUser, SessionUser } from '@/db/types';

const fullNameParts = (appUser: AppUser) => ({
  first_name: appUser.first_name || '',
  last_name: appUser.last_name || '',
});

export const mapAppUserToSessionUser = (appUser: AppUser): SessionUser => {
  const names = fullNameParts(appUser);
  return {
    id: appUser.id,
    email: appUser.email,
    role: appUser.role,
    ...names,
    full_name: `${names.first_name} ${names.last_name}`.trim() || 'Unknown',
    committee_id: appUser.committee_id,
    country: appUser.country,
    legacy_id: appUser.legacy_id,
    reso_perms: appUser.reso_perms,
    firstname: names.first_name,
    lastname: names.last_name,
    committeeID: appUser.committee_id,
    resoPerms: appUser.reso_perms,
    delegateID: appUser.role === "delegate" ? appUser.legacy_id || undefined : undefined,
    chairID: appUser.role === "chair" ? appUser.legacy_id || undefined : undefined,
    adminID: appUser.role === "admin" ? appUser.legacy_id || undefined : undefined,
    secretariatID: appUser.role === "secretariat" ? appUser.legacy_id || undefined : undefined,
  };
};
