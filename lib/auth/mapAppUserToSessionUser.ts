import { AppUser, UserType, Delegate, Chair, Admin, Secretariat } from '@/db/types';

const fullNameParts = (appUser: AppUser) => ({
  firstname: appUser.first_name || '',
  lastname: appUser.last_name || '',
});

export const mapAppUserToSessionUser = (appUser: AppUser): UserType => {
  const base = {
    id: appUser.id,
    email: appUser.email,
    role: appUser.role,
    ...fullNameParts(appUser),
  };

  if (appUser.role === 'delegate') {
    const delegate: Delegate = {
      ...base,
      delegateID: appUser.id,
      committeeID: appUser.committee_id,
      country: appUser.country,
      resoPerms: appUser.reso_perms,
      committee: null,
    };
    return delegate;
  }

  if (appUser.role === 'chair') {
    const chair: Chair = {
      ...base,
      chairID: appUser.id,
    };
    return chair;
  }

  if (appUser.role === 'secretariat') {
    const secretariat: Secretariat = {
      ...base,
      secretariatID: appUser.id,
    };
    return secretariat;
  }

  const admin: Admin = {
    ...base,
    adminID: appUser.id,
  };
  return admin;
};
