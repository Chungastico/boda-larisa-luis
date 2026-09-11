import { getAuth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import {
  deleteInvitationFamily,
  RSVP_STATUSES,
  type FamilyInput,
  updateInvitationDetails,
} from '@/lib/invitations';

function readFamilyInput(body: Record<string, unknown>): FamilyInput | null {
  if (
    typeof body.recipientName !== 'string' ||
    !body.recipientName.trim() ||
    typeof body.status !== 'string' ||
    !RSVP_STATUSES.includes(body.status as (typeof RSVP_STATUSES)[number]) ||
    !Array.isArray(body.members)
  ) {
    return null;
  }

  const members = body.members.flatMap((member) => {
    if (!member || typeof member !== 'object') return [];
    const value = member as Record<string, unknown>;
    if (typeof value.name !== 'string' || !value.name.trim()) return [];
    return [{
      name: value.name,
      gender: value.gender === 'F' || value.gender === 'M' ? value.gender : null,
    }];
  });

  if (!members.length || members.length > 40) return null;

  return {
    recipientName: body.recipientName,
    householdName: typeof body.householdName === 'string' ? body.householdName : null,
    maxGuests: typeof body.maxGuests === 'number' ? body.maxGuests : members.length,
    status: body.status as (typeof RSVP_STATUSES)[number],
    attendingCount: typeof body.attendingCount === 'number' ? body.attendingCount : 0,
    sourceLabel: typeof body.sourceLabel === 'string' ? body.sourceLabel : null,
    clusterLabel: typeof body.clusterLabel === 'string' ? body.clusterLabel : null,
    clusterColor: typeof body.clusterColor === 'string' ? body.clusterColor : null,
    tableName: typeof body.tableName === 'string' ? body.tableName : null,
    invitationSent: body.invitationSent === true,
    members,
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!getAuth(request).userId) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const { id } = await context.params;

  if (!body) {
    return NextResponse.json({ error: 'Datos de familia requeridos.' }, { status: 400 });
  }

  const family = readFamilyInput(body);
  if (!family) {
    return NextResponse.json({ error: 'Revisa el nombre, estado y miembros de la familia.' }, { status: 400 });
  }

  const invitation = await updateInvitationDetails(id, family);

  if (!invitation) {
    return NextResponse.json({ error: 'Invitación no encontrada.' }, { status: 404 });
  }

  return NextResponse.json({ invitation });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!getAuth(request).userId) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const deleted = await deleteInvitationFamily(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Familia no encontrada.' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
