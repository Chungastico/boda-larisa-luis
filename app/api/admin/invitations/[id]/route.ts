import { NextResponse } from 'next/server';
import { isAdminSession } from '@/lib/admin-session';
import { RSVP_STATUSES, updateInvitationDetails } from '@/lib/invitations';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const { id } = await context.params;

  if (!body || typeof body.recipientName !== 'string' || !body.recipientName.trim()) {
    return NextResponse.json({ error: 'Nombre de destinatario requerido.' }, { status: 400 });
  }

  if (
    typeof body.status !== 'string' ||
    !RSVP_STATUSES.includes(body.status as (typeof RSVP_STATUSES)[number])
  ) {
    return NextResponse.json({ error: 'Estado invalido.' }, { status: 400 });
  }

  const invitation = await updateInvitationDetails(id, {
    recipientName: body.recipientName,
    householdName: typeof body.householdName === 'string' ? body.householdName : null,
    maxGuests: typeof body.maxGuests === 'number' ? body.maxGuests : 1,
    status: body.status as (typeof RSVP_STATUSES)[number],
    attendingCount: typeof body.attendingCount === 'number' ? body.attendingCount : 0,
  });

  if (!invitation) {
    return NextResponse.json({ error: 'Invitacion no encontrada.' }, { status: 404 });
  }

  return NextResponse.json({ invitation });
}
