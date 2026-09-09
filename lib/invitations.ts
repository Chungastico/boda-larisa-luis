import { createHash, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { buildImportedInvitations, type GuestImportEntry } from '@/lib/guest-import';

export const RSVP_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED'] as const;

export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export type Invitee = {
  id: string;
  name: string;
  gender: string | null;
  isAttending: boolean | null;
};

export type Invitation = {
  id: string;
  slug: string;
  recipientName: string;
  householdName: string | null;
  maxGuests: number;
  status: RsvpStatus;
  attendingCount: number;
  note: string | null;
  sourceLabel: string | null;
  respondedAt: string | null;
  createdAt: string;
  invitees: Invitee[];
};

export type GuestImportSummary = {
  invitations: number;
  guests: number;
};

type DatabaseInvitation = {
  id: string;
  slug: string;
  recipient_name: string;
  household_name: string | null;
  max_guests: number;
  status: RsvpStatus;
  attending_count: number;
  note: string | null;
  source_label: string | null;
  responded_at: string | Date | null;
  created_at: string | Date;
};

type DatabaseInvitee = {
  id: string;
  invitation_id: string;
  name: string;
  gender: string | null;
  is_attending: boolean | null;
};

const demoInvitations: Invitation[] = [
  {
    id: 'demo-rodriguez',
    slug: 'familia-rodriguez-k7m2p4',
    recipientName: 'Familia Rodriguez',
    householdName: 'Familia Rodriguez',
    maxGuests: 4,
    status: 'PENDING',
    attendingCount: 0,
    note: null,
    sourceLabel: 'Lista principal',
    respondedAt: null,
    createdAt: '2026-08-16T00:00:00.000Z',
    invitees: [
      { id: 'demo-r-1', name: 'Camila Rodriguez', gender: 'F', isAttending: null },
      { id: 'demo-r-2', name: 'Mateo Rodriguez', gender: 'M', isAttending: null },
      { id: 'demo-r-3', name: 'Lucia Rodriguez', gender: 'F', isAttending: null },
      { id: 'demo-r-4', name: 'Pablo Rodriguez', gender: 'M', isAttending: null },
    ],
  },
  {
    id: 'demo-silva',
    slug: 'familia-silva-c3n8q1',
    recipientName: 'Familia Silva',
    householdName: 'Familia Silva',
    maxGuests: 3,
    status: 'ACCEPTED',
    attendingCount: 3,
    note: 'Sin restricciones alimentarias.',
    sourceLabel: 'Lista principal',
    respondedAt: '2026-08-22T16:00:00.000Z',
    createdAt: '2026-08-16T00:00:00.000Z',
    invitees: [
      { id: 'demo-s-1', name: 'Ana Silva', gender: 'F', isAttending: true },
      { id: 'demo-s-2', name: 'Miguel Silva', gender: 'M', isAttending: true },
      { id: 'demo-s-3', name: 'Sofia Silva', gender: 'F', isAttending: true },
    ],
  },
  {
    id: 'demo-martinez',
    slug: 'sofia-martinez-j8v5r2',
    recipientName: 'Sofia Martinez',
    householdName: null,
    maxGuests: 1,
    status: 'DECLINED',
    attendingCount: 0,
    note: 'Acompana a la distancia.',
    sourceLabel: 'Amistades',
    respondedAt: '2026-08-20T11:00:00.000Z',
    createdAt: '2026-08-16T00:00:00.000Z',
    invitees: [{ id: 'demo-m-1', name: 'Sofia Martinez', gender: 'F', isAttending: false }],
  },
  {
    id: 'demo-lopez',
    slug: 'familia-lopez-v4b9d6',
    recipientName: 'Familia Lopez',
    householdName: 'Familia Lopez',
    maxGuests: 2,
    status: 'PENDING',
    attendingCount: 0,
    note: null,
    sourceLabel: 'Familia',
    respondedAt: null,
    createdAt: '2026-08-16T00:00:00.000Z',
    invitees: [
      { id: 'demo-l-1', name: 'Elena Lopez', gender: 'F', isAttending: null },
      { id: 'demo-l-2', name: 'Daniel Lopez', gender: 'M', isAttending: null },
    ],
  },
];

function cloneDemo() {
  return structuredClone(demoInvitations);
}

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  return databaseUrl ? neon(databaseUrl) : null;
}

function toIso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toInvitation(
  row: DatabaseInvitation,
  people: Map<string, Invitee[]>,
): Invitation {
  return {
    id: row.id,
    slug: row.slug,
    recipientName: row.recipient_name,
    householdName: row.household_name,
    maxGuests: Number(row.max_guests),
    status: row.status,
    attendingCount: Number(row.attending_count),
    note: row.note,
    sourceLabel: row.source_label,
    respondedAt: toIso(row.responded_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    invitees: people.get(row.id) ?? [],
  };
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function getAdminInvitations(): Promise<Invitation[]> {
  const sql = getSql();
  if (!sql) return cloneDemo();

  const [rawInvitations, rawInvitees] = await Promise.all([
    sql`
      SELECT id, slug, recipient_name, household_name, max_guests, status,
        attending_count, note, source_label, responded_at, created_at
      FROM invitations
      ORDER BY created_at ASC
    `,
    sql`
      SELECT id, invitation_id, name, gender, is_attending
      FROM invitees
      ORDER BY created_at ASC
    `,
  ]);

  const people = new Map<string, Invitee[]>();
  for (const row of rawInvitees as DatabaseInvitee[]) {
    const members = people.get(row.invitation_id) ?? [];
    members.push({
      id: row.id,
      name: row.name,
      gender: row.gender,
      isAttending: row.is_attending,
    });
    people.set(row.invitation_id, members);
  }

  return (rawInvitations as DatabaseInvitation[]).map((row) => toInvitation(row, people));
}

export async function getInvitationBySlug(slug: string) {
  const invitations = await getAdminInvitations();
  return invitations.find((invitation) => invitation.slug === slug) ?? null;
}

export async function updateInvitationRsvp({
  slug,
  status,
  attendingCount,
  note,
}: {
  slug: string;
  status: RsvpStatus;
  attendingCount: number;
  note: string;
}) {
  const invitation = await getInvitationBySlug(slug);
  if (!invitation) return null;

  const guests = status === 'ACCEPTED'
    ? Math.max(1, Math.min(Math.trunc(attendingCount), invitation.maxGuests))
    : 0;
  const normalizedNote = note.trim().slice(0, 500) || null;
  const sql = getSql();

  if (!sql) {
    return {
      ...invitation,
      status,
      attendingCount: guests,
      note: normalizedNote,
      respondedAt: new Date().toISOString(),
    };
  }

  await sql`
    UPDATE invitations
    SET status = ${status}, attending_count = ${guests}, note = ${normalizedNote},
      responded_at = NOW(), updated_at = NOW()
    WHERE slug = ${slug}
  `;

  await sql`
    UPDATE invitees
    SET is_attending = ${status === 'ACCEPTED'}
    WHERE invitation_id = ${invitation.id}
  `;

  return getInvitationBySlug(slug);
}

export async function updateInvitationDetails(
  id: string,
  values: Pick<
    Invitation,
    'recipientName' | 'householdName' | 'maxGuests' | 'status' | 'attendingCount'
  >,
) {
  const invitation = (await getAdminInvitations()).find((item) => item.id === id);
  if (!invitation) return null;

  const recipientName = values.recipientName.trim().slice(0, 120);
  const householdName = values.householdName?.trim().slice(0, 120) || null;
  const maxGuests = Math.max(1, Math.min(Math.trunc(values.maxGuests), 20));
  const attendingCount = values.status === 'ACCEPTED'
    ? Math.max(1, Math.min(Math.trunc(values.attendingCount), maxGuests))
    : 0;
  const sql = getSql();

  if (!sql) {
    return {
      ...invitation,
      recipientName,
      householdName,
      maxGuests,
      status: values.status,
      attendingCount,
    };
  }

  await sql`
    UPDATE invitations
    SET recipient_name = ${recipientName}, household_name = ${householdName},
      max_guests = ${maxGuests}, status = ${values.status},
      attending_count = ${attendingCount}, updated_at = NOW()
    WHERE id = ${id}
  `;

  return (await getAdminInvitations()).find((item) => item.id === id) ?? null;
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 44);
}

export async function importGuestEntries(entries: GuestImportEntry[]): Promise<GuestImportSummary> {
  const sql = getSql();
  if (!sql) {
    throw new Error('Configura DATABASE_URL antes de importar invitados.');
  }

  const invitations = buildImportedInvitations(entries);
  for (const invitation of invitations) {
    const slug = `${slugify(invitation.recipientName)}-${createHash('sha256')
      .update(invitation.importKey)
      .digest('hex')
      .slice(0, 6)}`;
    const rows = await sql`
      INSERT INTO invitations (
        id, import_key, slug, recipient_name, household_name, max_guests, source_label
      ) VALUES (
        ${randomUUID()}, ${invitation.importKey}, ${slug}, ${invitation.recipientName},
        ${invitation.householdName}, ${invitation.maxGuests}, ${invitation.sourceLabel}
      )
      ON CONFLICT (import_key) DO UPDATE SET
        recipient_name = EXCLUDED.recipient_name,
        household_name = EXCLUDED.household_name,
        max_guests = EXCLUDED.max_guests,
        source_label = EXCLUDED.source_label,
        updated_at = NOW()
      RETURNING id
    `;
    const invitationId = (rows[0] as { id: string }).id;

    for (const member of invitation.members) {
      await sql`
        INSERT INTO invitees (id, invitation_id, name, gender)
        VALUES (${randomUUID()}, ${invitationId}, ${member.name}, ${member.gender})
        ON CONFLICT (invitation_id, name) DO UPDATE SET gender = EXCLUDED.gender
      `;
    }
  }

  return {
    invitations: invitations.length,
    guests: invitations.reduce((total, invitation) => total + invitation.members.length, 0),
  };
}
