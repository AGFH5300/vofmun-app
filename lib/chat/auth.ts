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

const mapRawUserToSession = (raw: any): SessionAuthUser | null => {
  if (!raw) return null;
  if (raw.delegateID) return { id: String(raw.delegateID), role: 'delegate' };
  if (raw.chairID) return { id: String(raw.chairID), role: 'chair' };
  if (raw.adminID) return { id: String(raw.adminID), role: 'admin' };
  if (raw.secretariatID) return { id: String(raw.secretariatID), role: 'secretariat' };
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
