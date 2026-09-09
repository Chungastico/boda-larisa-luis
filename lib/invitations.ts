import { createHash, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { buildImportedInvitations, type GuestImportEntry } from '@/lib/guest-import';
import { isSeatingTableName } from '@/lib/seating';

export const RSVP_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED'] as const;

export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export type Invitee = {
  id: string;
  name: string;
  gender: string | null;
  isAttending: boolean | null;
};

export type FamilyMemberInput = Pick<Invitee, 'name' | 'gender'>;

export type RsvpAttendeeInput = {
  id: string;
  isAttending: boolean;
};

export type FamilyInput = {
  recipientName: string;
  householdName: string | null;
  maxGuests: number;
  status: RsvpStatus;
  attendingCount: number;
  sourceLabel: string | null;
  clusterLabel: string | null;
  clusterColor: string | null;
  tableName: string | null;
  invitationSent: boolean;
  members: FamilyMemberInput[];
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
  clusterLabel: string | null;
  clusterColor: string | null;
  tableName: string | null;
  invitationSent: boolean;
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
  cluster_label: string | null;
  cluster_color: string | null;
  table_name: string | null;
  invitation_sent: boolean;
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
    sourceLabel: 'Invitados Larissa',
    clusterLabel: 'Grupo amarillo',
    clusterColor: 'FFFF00',
    tableName: 'Mesa 5',
    invitationSent: false,
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
    sourceLabel: 'Invitados Luis',
    clusterLabel: 'Grupo celeste',
    clusterColor: '99CCFF',
    tableName: 'Mesa 1',
    invitationSent: true,
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
    sourceLabel: 'Invitados Larissa',
    clusterLabel: 'Grupo rosa',
    clusterColor: 'FF99CC',
    tableName: 'Mesa 2',
    invitationSent: true,
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
    sourceLabel: 'Invitados Luis',
    clusterLabel: 'Grupo lila',
    clusterColor: 'CC99FF',
    tableName: 'Mesa 3',
    invitationSent: false,
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
    clusterLabel: row.cluster_label,
    clusterColor: row.cluster_color,
    tableName: row.table_name,
    invitationSent: Boolean(row.invitation_sent),
    respondedAt: toIso(row.responded_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    invitees: people.get(row.id) ?? [],
  };
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

function cleanFamilyInput(values: FamilyInput) {
  const knownNames = new Set<string>();
  const members = values.members
    .map((member) => ({
      name: member.name.trim().replace(/\s+/g, ' ').slice(0, 120),
      gender: member.gender === 'F' || member.gender === 'M' ? member.gender : null,
    }))
    .filter((member) => {
      const key = member.name.toLocaleLowerCase('es');
      if (!key || knownNames.has(key)) return false;
      knownNames.add(key);
      return true;
    });
  const maxGuests = Math.max(
    members.length,
    Math.min(Math.max(1, Math.trunc(values.maxGuests || 1)), 40),
  );
  const status = values.status;

  return {
    recipientName: values.recipientName.trim().replace(/\s+/g, ' ').slice(0, 120),
    householdName: values.householdName?.trim().replace(/\s+/g, ' ').slice(0, 120) || null,
    maxGuests,
    status,
    attendingCount: status === 'ACCEPTED'
      ? Math.max(1, Math.min(Math.trunc(values.attendingCount), maxGuests))
      : 0,
    sourceLabel: values.sourceLabel?.trim().slice(0, 120) || null,
    clusterLabel: values.clusterLabel?.trim().slice(0, 120) || null,
    clusterColor: values.clusterColor?.replace('#', '').trim().toUpperCase().slice(0, 6) || null,
    tableName: isSeatingTableName(values.tableName) ? values.tableName : null,
    invitationSent: Boolean(values.invitationSent),
    members,
  };
}

function memberAttendance(status: RsvpStatus): boolean | null {
  if (status === 'ACCEPTED') return true;
  if (status === 'DECLINED') return false;
  return null;
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
        attending_count, note, source_label, cluster_label, cluster_color,
        table_name, invitation_sent, responded_at, created_at
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
  attendees,
}: {
  slug: string;
  status: RsvpStatus;
  attendingCount: number;
  note: string;
  attendees?: RsvpAttendeeInput[];
}) {
  const invitation = await getInvitationBySlug(slug);
  if (!invitation) return null;

  const attendeeStatuses = attendees
    ? new Map(attendees.map((attendee) => [attendee.id, attendee.isAttending]))
    : null;
  const attendeeList = attendees ?? [];
  const hasInvalidAttendee = attendeeStatuses
    ? attendeeStatuses.size !== attendeeList.length
      || invitation.invitees.some((invitee) => !attendeeStatuses.has(invitee.id))
      || attendeeList.some((attendee) => !invitation.invitees.some((invitee) => invitee.id === attendee.id))
    : false;

  if (hasInvalidAttendee) return null;

  const guests = attendeeStatuses
    ? Math.min(
        invitation.maxGuests,
        invitation.invitees.filter((invitee) => attendeeStatuses.get(invitee.id)).length,
      )
    : status === 'ACCEPTED'
      ? Math.max(1, Math.min(Math.trunc(attendingCount), invitation.maxGuests))
      : 0;
  const normalizedNote = note.trim().slice(0, 500) || null;
  const sql = getSql();
  const nextInvitees = attendeeStatuses
    ? invitation.invitees.map((invitee) => ({
        ...invitee,
        isAttending: attendeeStatuses.get(invitee.id) ?? false,
      }))
    : invitation.invitees.map((invitee) => ({
        ...invitee,
        isAttending: memberAttendance(status),
      }));

  if (!sql) {
    return {
      ...invitation,
      status,
      attendingCount: guests,
      note: normalizedNote,
      respondedAt: new Date().toISOString(),
      invitees: nextInvitees,
    };
  }

  await sql`
    UPDATE invitations
    SET status = ${status}, attending_count = ${guests}, note = ${normalizedNote},
      responded_at = NOW(), updated_at = NOW()
    WHERE slug = ${slug}
  `;

  if (attendeeStatuses) {
    for (const invitee of invitation.invitees) {
      await sql`
        UPDATE invitees
        SET is_attending = ${attendeeStatuses.get(invitee.id)}
        WHERE id = ${invitee.id} AND invitation_id = ${invitation.id}
      `;
    }
  } else {
    await sql`
      UPDATE invitees
      SET is_attending = ${memberAttendance(status)}
      WHERE invitation_id = ${invitation.id}
    `;
  }

  return getInvitationBySlug(slug);
}

export async function updateInvitationDetails(id: string, values: FamilyInput) {
  const invitation = (await getAdminInvitations()).find((item) => item.id === id);
  if (!invitation) return null;

  const family = cleanFamilyInput(values);
  const responseDate = family.status === 'PENDING'
    ? null
    : invitation.respondedAt ? new Date(invitation.respondedAt) : new Date();
  const sql = getSql();

  if (!sql) {
    const { members, ...details } = family;
    return {
      ...invitation,
      ...details,
      respondedAt: toIso(responseDate),
      invitees: members.map((member, index) => ({
        id: invitation.invitees[index]?.id ?? `demo-member-${randomUUID()}`,
        ...member,
        isAttending: memberAttendance(family.status),
      })),
    };
  }

  await sql`
    UPDATE invitations
    SET recipient_name = ${family.recipientName}, household_name = ${family.householdName},
      max_guests = ${family.maxGuests}, status = ${family.status},
      attending_count = ${family.attendingCount}, source_label = ${family.sourceLabel},
      cluster_label = ${family.clusterLabel}, cluster_color = ${family.clusterColor},
      table_name = ${family.tableName}, invitation_sent = ${family.invitationSent},
      responded_at = ${responseDate}, updated_at = NOW()
    WHERE id = ${id}
  `;

  await sql`DELETE FROM invitees WHERE invitation_id = ${id}`;
  for (const member of family.members) {
    await sql`
      INSERT INTO invitees (id, invitation_id, name, gender, is_attending)
      VALUES (${randomUUID()}, ${id}, ${member.name}, ${member.gender}, ${memberAttendance(family.status)})
    `;
  }

  return (await getAdminInvitations()).find((item) => item.id === id) ?? null;
}

export async function createInvitationFamily(values: FamilyInput) {
  const family = cleanFamilyInput(values);
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const slug = `${slugify(family.recipientName) || 'familia'}-${id.slice(0, 6)}`;
  const responseDate = family.status === 'PENDING' ? null : createdAt;
  const sql = getSql();

  if (!sql) {
    const { members, ...details } = family;
    return {
      id,
      slug,
      ...details,
      note: null,
      respondedAt: responseDate,
      createdAt,
      invitees: members.map((member) => ({
        id: randomUUID(),
        ...member,
        isAttending: memberAttendance(family.status),
      })),
    };
  }

  await sql`
    INSERT INTO invitations (
      id, slug, recipient_name, household_name, max_guests, status, attending_count,
      source_label, cluster_label, cluster_color, table_name, invitation_sent, responded_at
    ) VALUES (
      ${id}, ${slug}, ${family.recipientName}, ${family.householdName},
      ${family.maxGuests}, ${family.status}, ${family.attendingCount},
      ${family.sourceLabel}, ${family.clusterLabel}, ${family.clusterColor},
      ${family.tableName}, ${family.invitationSent}, ${responseDate}
    )
  `;

  for (const member of family.members) {
    await sql`
      INSERT INTO invitees (id, invitation_id, name, gender, is_attending)
      VALUES (${randomUUID()}, ${id}, ${member.name}, ${member.gender}, ${memberAttendance(family.status)})
    `;
  }

  return (await getAdminInvitations()).find((item) => item.id === id) ?? null;
}

export async function deleteInvitationFamily(id: string) {
  const sql = getSql();
  if (!sql) return true;
  const result = await sql`DELETE FROM invitations WHERE id = ${id} RETURNING id`;
  return result.length > 0;
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
        id, import_key, slug, recipient_name, household_name, max_guests, source_label,
        cluster_label, cluster_color, table_name
      ) VALUES (
        ${randomUUID()}, ${invitation.importKey}, ${slug}, ${invitation.recipientName},
        ${invitation.householdName}, ${invitation.maxGuests}, ${invitation.sourceLabel},
        ${invitation.clusterLabel}, ${invitation.clusterColor}, ${invitation.tableName}
      )
      ON CONFLICT (import_key) DO UPDATE SET
        recipient_name = EXCLUDED.recipient_name,
        household_name = EXCLUDED.household_name,
        max_guests = EXCLUDED.max_guests,
        source_label = EXCLUDED.source_label,
        cluster_label = EXCLUDED.cluster_label,
        cluster_color = EXCLUDED.cluster_color,
        table_name = EXCLUDED.table_name,
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
