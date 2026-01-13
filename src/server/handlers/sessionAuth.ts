import type { ApiRequest, ApiResponse } from './types';
import { buildSessionCookie } from '../session';
import { fetchSupabaseUser } from '../supabase';

type Body = {
  accessToken?: string;
};

export async function handleSessionAuth(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const header = req.headers?.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.body as Body | undefined)?.accessToken;

  if (!token) {
    res.status(400).json({ error: 'Access token ontbreekt.' });
    return;
  }

  try {
    const user = await fetchSupabaseUser(token);
    res.setHeader?.('Set-Cookie', buildSessionCookie(user.id));
    res.status(200).json({ userId: user.id, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Kon sessie niet valideren.' });
  }
}
