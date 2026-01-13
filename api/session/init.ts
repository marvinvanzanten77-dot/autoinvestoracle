import { buildSessionCookie, createSessionId, getSessionUserId } from '../../src/server/session';

export default async function handler(req: { method?: string; headers?: { cookie?: string } }, res: any) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let userId = getSessionUserId(req);
  if (!userId) {
    userId = createSessionId();
    res.setHeader('Set-Cookie', buildSessionCookie(userId));
  }

  res.status(200).json({ userId });
}
