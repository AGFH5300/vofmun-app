// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
type SessionRole = 'delegate' | 'chair' | 'admin' | 'secretariat';

import supabaseAdmin from '../supabaseAdmin';

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

const mapRawUserToSession = (raw: Record<string, unknown> | null): SessionAuthUser | null => {
  if (!raw) return null;
  const authUserId = raw.id ? String(raw.id) : null;
  if (!authUserId) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[chat auth] Missing auth user.id in session cookie payload for chat identity mapping.', {
        role: raw.role || null,
      });
    }
    return null;
  }

  assertNoLegacyChatIdentityDev(authUserId, 'mapRawUserToSession');

  if (raw.role && ['delegate', 'chair', 'admin', 'secretariat'].includes(String(raw.role))) {
    return { id: authUserId, role: String(raw.role) as SessionRole };
  }

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

const parseBearerToken = (authorizationHeader?: string | null) => {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1]?.trim();
  return token || null;
};

const normalizeRole = (role: unknown): SessionRole => {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'chair' || value === 'admin' || value === 'secretariat' || value === 'delegate') {
    return value;
  }
  return 'delegate';
};

export const getBearerTokenFromHeaders = (headers: Record<string, string | string[] | undefined>) => {
  const rawHeader = headers.authorization || headers.Authorization;
  const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  return parseBearerToken(headerValue);
};

export const verifySupabaseAccessToken = async (accessToken: string): Promise<SessionAuthUser | null> => {
  if (!accessToken || !supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user?.id) {
    return null;
  }

  assertNoLegacyChatIdentityDev(data.user.id, 'verifySupabaseAccessToken');

  const appRole = data.user.app_metadata?.role;
  const userRole = data.user.user_metadata?.role;
  return {
    id: String(data.user.id),
    role: normalizeRole(appRole || userRole),
  };
};
