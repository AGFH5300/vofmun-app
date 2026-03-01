// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
type SessionRole = 'delegate' | 'chair' | 'admin' | 'secretariat';

export interface SessionAuthUser {
  id: string;
  role: SessionRole;
}

const parseCookieHeader = (cookieHeader?: string | null): Record<string, string> => {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) return acc;
    const key = rawKey.trim();
    const value = rest.join('=');
    acc[key] = value;
    return acc;
  }, {});
};

const LEGACY_CHAT_ID_PREFIX_RE = /^(del|delegate|chair|admin|secretariat)[_-]/i;

export const isLegacyChatIdentity = (value: string | null | undefined) => {
  if (!value) return false;
  return LEGACY_CHAT_ID_PREFIX_RE.test(String(value).trim());
};

export const assertNoLegacyChatIdentityDev = (identity: string, context: string) => {
  if (process.env.NODE_ENV === 'production') return;
  if (!isLegacyChatIdentity(identity)) return;

  const message = `[chat auth] Legacy identity blocked in ${context}: ${identity}. Expected Supabase auth user.id (uuid-like).`;
  console.error(message);
  throw new Error(message);
};

const mapRawUserToSession = (raw: any): SessionAuthUser | null => {
  if (!raw) return null;
  const authUserId = raw.id ? String(raw.id) : null;
  if (!authUserId) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[chat auth] Missing auth user.id in session cookie payload for chat identity mapping.', {
        hasDelegateId: Boolean(raw.delegateID),
        hasChairId: Boolean(raw.chairID),
        hasAdminId: Boolean(raw.adminID),
        hasSecretariatId: Boolean(raw.secretariatID),
      });
    }
    return null;
  }

  assertNoLegacyChatIdentityDev(authUserId, 'mapRawUserToSession');

  if (raw.role && ['delegate', 'chair', 'admin', 'secretariat'].includes(String(raw.role))) {
    return { id: authUserId, role: String(raw.role) as SessionRole };
  }

  if (raw.delegateID) return { id: authUserId, role: 'delegate' };
  if (raw.chairID) return { id: authUserId, role: 'chair' };
  if (raw.adminID) return { id: authUserId, role: 'admin' };
  if (raw.secretariatID) return { id: authUserId, role: 'secretariat' };
  return null;
};

export const getSessionUserFromCookieHeader = (cookieHeader?: string | null): SessionAuthUser | null => {
  const parsed = parseCookieHeader(cookieHeader);
  const rawUser = parsed.user ? decodeURIComponent(parsed.user) : null;
  if (!rawUser) return null;
  try {
    const user = JSON.parse(rawUser);
    return mapRawUserToSession(user);
  } catch (error) {
    console.error('[chat auth] failed to parse user cookie', error);
    return null;
  }
};

export const getSessionUserFromRequest = (request: Request): SessionAuthUser | null => {
  const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie');
  return getSessionUserFromCookieHeader(cookieHeader);
};
