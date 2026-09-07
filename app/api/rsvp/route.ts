import { NextResponse } from 'next/server';
import { RSVP_STATUSES, updateInvitationRsvp } from '@/lib/invitations';

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud invalida.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Solicitud invalida.' }, { status: 400 });
  }

  const { slug, status, attendingCount, note } = body as Record<string, unknown>;

  if (
    typeof slug !== 'string' ||
    typeof status !== 'string' ||
    !RSVP_STATUSES.includes(status as (typeof RSVP_STATUSES)[number])
  ) {
    return NextResponse.json({ error: 'Datos de confirmacion invalidos.' }, { status: 400 });
  }

  const invitation = await updateInvitationRsvp({
    slug,
    status: status as (typeof RSVP_STATUSES)[number],
    attendingCount: typeof attendingCount === 'number' ? attendingCount : 0,
    note: typeof note === 'string' ? note : '',
  });

  if (!invitation) {
    return NextResponse.json({ error: 'Invitacion no encontrada.' }, { status: 404 });
  }

  return NextResponse.json({ invitation });
}
