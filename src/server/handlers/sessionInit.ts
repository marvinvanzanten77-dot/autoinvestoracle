import type { ApiRequest, ApiResponse } from './types';
import { buildSessionCookie, createSessionId, getSessionUserId } from '../session';

export async function handleSessionInit(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let userId = getSessionUserId(req);
  if (!userId) {
    userId = createSessionId();
    res.setHeader?.('Set-Cookie', buildSessionCookie(userId));
  }

  res.status(200).json({ userId });
}
