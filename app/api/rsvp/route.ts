import { NextResponse } from 'next/server';
import { RSVP_STATUSES, updateInvitationRsvp, type RsvpAttendeeInput } from '@/lib/invitations';

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const { slug, status, attendingCount, note, attendees: rawAttendees } = body as Record<string, unknown>;

  if (
    typeof slug !== 'string' ||
    typeof status !== 'string' ||
    !RSVP_STATUSES.includes(status as (typeof RSVP_STATUSES)[number])
  ) {
    return NextResponse.json({ error: 'Datos de confirmación inválidos.' }, { status: 400 });
  }

  let attendees: RsvpAttendeeInput[] | undefined;
  if (rawAttendees !== undefined) {
    if (!Array.isArray(rawAttendees)) {
      return NextResponse.json({ error: 'Integrantes inválidos.' }, { status: 400 });
    }

    attendees = [];
    for (const value of rawAttendees) {
      if (
        !value ||
        typeof value !== 'object' ||
        typeof (value as Record<string, unknown>).id !== 'string' ||
        typeof (value as Record<string, unknown>).isAttending !== 'boolean'
      ) {
        return NextResponse.json({ error: 'Integrantes inválidos.' }, { status: 400 });
      }

      attendees.push({
        id: (value as Record<string, unknown>).id as string,
        isAttending: (value as Record<string, unknown>).isAttending as boolean,
      });
    }
  }

  const invitation = await updateInvitationRsvp({
    slug,
    status: status as (typeof RSVP_STATUSES)[number],
    attendingCount: typeof attendingCount === 'number' ? attendingCount : 0,
    note: typeof note === 'string' ? note : '',
    attendees,
  });

  if (!invitation) {
    return NextResponse.json({ error: 'Invitación no encontrada.' }, { status: 404 });
  }

  return NextResponse.json({ invitation });
}
