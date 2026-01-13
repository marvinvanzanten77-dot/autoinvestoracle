import crypto from 'crypto';

type CookieMap = Record<string, string>;

export function parseCookies(cookieHeader?: string): CookieMap {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<CookieMap>((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

export function createSessionId() {
  return crypto.randomUUID();
}

export function buildSessionCookie(userId: string) {
  const secure = process.env.NODE_ENV === 'production';
  return [
    `aio_uid=${encodeURIComponent(userId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : ''
  ]
    .filter(Boolean)
    .join('; ');
}

export function buildClearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production';
  return [
    'aio_uid=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    secure ? 'Secure' : ''
  ]
    .filter(Boolean)
    .join('; ');
}

export function getSessionUserId(req: { headers?: { cookie?: string } }) {
  const cookies = parseCookies(req.headers?.cookie);
  return cookies.aio_uid || '';
}
