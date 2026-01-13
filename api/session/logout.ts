import { buildClearSessionCookie } from '../../src/server/session';

export default async function handler(req: { method?: string }, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.setHeader('Set-Cookie', buildClearSessionCookie());
  res.status(200).json({ ok: true });
}
