import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'boda_admin_session';

export function hasAdminAccessConfiguration() {
  return Boolean(process.env.ADMIN_ACCESS_TOKEN);
}

export function matchesAdminToken(value: string) {
  const expected = process.env.ADMIN_ACCESS_TOKEN;
  if (!expected || !value) return false;

  const actualHash = createHash('sha256').update(value).digest();
  const expectedHash = createHash('sha256').update(expected).digest();

  return timingSafeEqual(actualHash, expectedHash);
}

export async function isAdminSession() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value ?? '';

  return matchesAdminToken(token);
}
