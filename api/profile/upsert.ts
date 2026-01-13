import { upsertProfile, type UserProfile } from '../../src/server/profile';
import { getSessionUserId } from '../../src/server/session';

type Body = {
  profile: UserProfile;
};

export default async function handler(req: { method?: string; body?: Body; headers?: { cookie?: string } }, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Geen sessie.' });
    return;
  }

  try {
    const profile = req.body?.profile;
    if (!profile?.email || !profile?.displayName) {
      res.status(400).json({ error: 'displayName en email zijn verplicht.' });
      return;
    }
    const result = await upsertProfile(userId, {
      ...profile,
      email: profile.email.toLowerCase(),
      strategies: Array.isArray(profile.strategies) ? profile.strategies : []
    });
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kon profiel niet opslaan.' });
  }
}
