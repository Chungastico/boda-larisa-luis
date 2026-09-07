import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  hasAdminAccessConfiguration,
  matchesAdminToken,
} from '@/lib/admin-session';

export async function POST(request: Request) {
  if (!hasAdminAccessConfiguration()) {
    return NextResponse.json({ error: 'Acceso no configurado.' }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { accessToken?: unknown } | null;
  const accessToken = typeof body?.accessToken === 'string' ? body.accessToken : '';

  if (!matchesAdminToken(accessToken)) {
    return NextResponse.json({ error: 'Codigo de acceso incorrecto.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, accessToken, {
    httpOnly: true,
    maxAge: 60 * 60 * 12,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
