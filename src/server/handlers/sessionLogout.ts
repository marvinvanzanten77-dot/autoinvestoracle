import type { ApiRequest, ApiResponse } from './types';
import { buildClearSessionCookie } from '../session';

export async function handleSessionLogout(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.setHeader?.('Set-Cookie', buildClearSessionCookie());
  res.status(200).json({ ok: true });
}
