import type { ApiRequest, ApiResponse } from './types';
import { getProfile } from '../profile';
import { getSessionUserId } from '../session';

export async function handleProfileGet(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Geen sessie.' });
    return;
  }

  try {
    const data = await getProfile(userId);
    res.status(200).json({ userId, ...data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kon profiel niet ophalen.' });
  }
}
