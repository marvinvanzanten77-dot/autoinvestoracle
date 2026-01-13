import { kv } from '@vercel/kv';
import type { UserProfile } from '../lib/profile/types';

export type UserMeta = {
  createdAt: string;
  updatedAt: string;
  onboardingComplete: boolean;
};

export async function getProfile(userId: string) {
  const profile = (await kv.get(`user:${userId}:profile`)) as UserProfile | null;
  const meta = (await kv.get(`user:${userId}:meta`)) as UserMeta | null;
  return { profile, meta };
}

export async function upsertProfile(userId: string, profile: UserProfile) {
  const now = new Date().toISOString();
  const meta: UserMeta = {
    createdAt: now,
    updatedAt: now,
    onboardingComplete: true
  };
  await kv.set(`user:${userId}:profile`, profile);
  await kv.set(`user:${userId}:meta`, meta);
  return { profile, meta };
}
