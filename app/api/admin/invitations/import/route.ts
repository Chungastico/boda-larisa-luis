import { getAuth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { getAdminInvitations, importGuestEntries } from '@/lib/invitations';
import type { GuestImportEntry } from '@/lib/guest-import';

const SOURCES = new Set(['Invitados Larissa', 'Invitados Luis']);

function isGuestEntry(value: unknown): value is GuestImportEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.name === 'string' &&
    typeof entry.source === 'string' &&
    SOURCES.has(entry.source) &&
    (entry.gender === null || entry.gender === 'F' || entry.gender === 'M') &&
    (entry.color === null || typeof entry.color === 'string')
  );
}

export async function POST(request: NextRequest) {
  if (!getAuth(request).userId) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { entries?: unknown } | null;
  if (!Array.isArray(body?.entries) || !body.entries.length || body.entries.length > 500) {
    return NextResponse.json({ error: 'El archivo no contiene una lista válida de invitados.' }, { status: 400 });
  }

  if (!body.entries.every(isGuestEntry)) {
    return NextResponse.json({ error: 'El archivo tiene filas con un formato no válido.' }, { status: 400 });
  }

  try {
    const summary = await importGuestEntries(body.entries);
    const invitations = await getAdminInvitations();
    return NextResponse.json({ summary, invitations });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo importar el archivo.' },
      { status: 500 },
    );
  }
}
