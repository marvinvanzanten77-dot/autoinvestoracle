type SupabaseUserResponse = {
  id: string;
  email?: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export async function fetchSupabaseUser(accessToken: string): Promise<SupabaseUserResponse> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_URL of SUPABASE_ANON_KEY ontbreekt.');
  }

  const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY
    }
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Supabase auth error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as SupabaseUserResponse;
  return data;
}
