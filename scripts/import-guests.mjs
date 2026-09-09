import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import * as XLSXModule from 'xlsx/xlsx.mjs';
import { buildImportedInvitations } from '../lib/guest-import.ts';

const XLSX = XLSXModule;

const DEFAULT_FILE = '/Users/chungus/Downloads/Copia de Invitados (1).xls';
const sourceFile = resolve(
  process.argv.find((argument) => argument.startsWith('--file='))?.slice(7) ??
    process.env.GUEST_IMPORT_FILE ??
    DEFAULT_FILE,
);
const dryRun = process.argv.includes('--dry-run');

if (!existsSync(sourceFile)) {
  throw new Error(`Guest file not found: ${sourceFile}`);
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 44);
}

function readWorkbookRoster(file) {
  const workbook = XLSX.read(readFileSync(file), { cellStyles: true, type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  const columns = [
    { name: 1, gender: 2, letter: 'B', source: 'Invitados Larissa' },
    { name: 9, gender: 10, letter: 'J', source: 'Invitados Luis' },
  ];
  const entries = rows.flatMap((row, index) => columns.map((column) => {
    const cell = sheet[`${column.letter}${index + 1}`];
    return {
      name: typeof row[column.name] === 'string' ? row[column.name] : '',
      gender: typeof row[column.gender] === 'string' ? row[column.gender].trim().toUpperCase() : null,
      color: cell?.s?.fgColor?.rgb ?? null,
      source: column.source,
    };
  }));

  return buildImportedInvitations(entries).map((invitation) => ({
    ...invitation,
    id: randomUUID(),
    slug: `${slugify(invitation.recipientName)}-${createHash('sha256')
      .update(invitation.importKey)
      .digest('hex')
      .slice(0, 6)}`,
  }));
}

const invitations = readWorkbookRoster(sourceFile);
const people = invitations.reduce((total, invitation) => total + invitation.members.length, 0);

console.log(
  JSON.stringify(
    {
      source: sourceFile,
      invitations: invitations.length,
      guests: people,
      mode: dryRun ? 'dry-run' : 'import',
    },
    null,
    2,
  ),
);

if (dryRun) process.exit(0);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for imports. Run with --dry-run to validate without Neon.');
}

const sql = neon(databaseUrl);

for (const invitation of invitations) {
  const current = await sql`
    INSERT INTO invitations (
        id, import_key, slug, recipient_name, household_name, max_guests, source_label,
        cluster_label, cluster_color, table_name
    ) VALUES (
      ${invitation.id}, ${invitation.importKey}, ${invitation.slug}, ${invitation.recipientName},
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

  const invitationId = current[0].id;
  for (const member of invitation.members) {
    await sql`
      INSERT INTO invitees (id, invitation_id, name, gender)
      VALUES (${randomUUID()}, ${invitationId}, ${member.name}, ${member.gender})
      ON CONFLICT (invitation_id, name) DO NOTHING
    `;
  }
}

console.log('Guest import completed.');
