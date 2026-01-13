import { getProfile } from '../../src/server/profile';
import { getSessionUserId } from '../../src/server/session';

export default async function handler(req: { method?: string; headers?: { cookie?: string } }, res: any) {
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
