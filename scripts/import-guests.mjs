import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import * as XLSXModule from 'xlsx/xlsx.mjs';

const XLSX = XLSXModule;

const DEFAULT_FILE = '/Users/chungus/Downloads/Copia de Invitados.xls';
const sourceFile = resolve(
  process.argv.find((argument) => argument.startsWith('--file='))?.slice(7) ??
    process.env.GUEST_IMPORT_FILE ??
    DEFAULT_FILE,
);
const dryRun = process.argv.includes('--dry-run');

if (!existsSync(sourceFile)) {
  throw new Error(`Guest file not found: ${sourceFile}`);
}

const colorLabels = {
  FFFF00: 'Grupo amarillo',
  FF99CC: 'Grupo rosa',
  FFCC00: 'Grupo dorado',
  '99CC00': 'Grupo verde',
};

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 44);
}

function familyKey(name, surnameCounts) {
  const parts = name.replace(/\([^)]*\)/g, '').trim().split(/\s+/);
  const surname = parts.at(-1)?.toLowerCase() ?? '';

  return surnameCounts.get(surname) > 1 ? `family:${surname}` : `guest:${slugify(name)}`;
}

function readWorkbookRoster(file) {
  const workbook = XLSX.read(readFileSync(file), { cellStyles: true, type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  // The source keeps the roster in columns B (name) and C (gender), starting at row 4.
  const entries = rows
    .map((row, index) => {
      const name = typeof row[1] === 'string' ? row[1].trim() : '';
      const gender = typeof row[2] === 'string' ? row[2].trim().toUpperCase() : '';
      const cell = sheet[`B${index + 1}`];
      const color = cell?.s?.fgColor?.rgb ?? null;

      return { name, gender, color };
    })
    .filter((entry) => entry.name && /^(F|M)$/.test(entry.gender));

  const surnameCounts = new Map();
  for (const entry of entries) {
    const surname = entry.name
      .replace(/\([^)]*\)/g, '')
      .trim()
      .split(/\s+/)
      .at(-1)
      ?.toLowerCase();
    if (surname) surnameCounts.set(surname, (surnameCounts.get(surname) ?? 0) + 1);
  }

  const groups = new Map();
  for (const entry of entries) {
    const key = familyKey(entry.name, surnameCounts);
    const existing = groups.get(key) ?? [];
    existing.push(entry);
    groups.set(key, existing);
  }

  const usedSlugs = new Set();
  const takeSlug = (base) => {
    let candidate = base;
    let suffix = 2;
    while (usedSlugs.has(candidate)) candidate = `${base}-${suffix++}`;
    usedSlugs.add(candidate);
    return candidate;
  };

  return [...groups.entries()].map(([key, members]) => {
    const isFamily = key.startsWith('family:');
    const surname = key.replace('family:', '');
    const recipientName = isFamily
      ? `Familia ${surname[0].toUpperCase()}${surname.slice(1)}`
      : members[0].name;
    const sourceLabel = colorLabels[members[0].color] ?? 'Lista de Larissa';
    const slug = takeSlug(`${slugify(recipientName)}-${randomUUID().slice(0, 6)}`);

    return {
      id: randomUUID(),
      slug,
      recipientName,
      householdName: isFamily ? recipientName : null,
      maxGuests: members.length,
      sourceLabel,
      members,
    };
  });
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
      id, slug, recipient_name, household_name, max_guests, source_label
    ) VALUES (
      ${invitation.id}, ${invitation.slug}, ${invitation.recipientName},
      ${invitation.householdName}, ${invitation.maxGuests}, ${invitation.sourceLabel}
    )
    ON CONFLICT (slug) DO UPDATE SET
      recipient_name = EXCLUDED.recipient_name,
      household_name = EXCLUDED.household_name,
      max_guests = EXCLUDED.max_guests,
      source_label = EXCLUDED.source_label,
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
