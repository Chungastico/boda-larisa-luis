'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Clipboard,
  ExternalLink,
  FileSpreadsheet,
  LayoutGrid,
  LoaderCircle,
  Mail,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { FamilyInput, FamilyMemberInput, Invitation, RsvpStatus } from '@/lib/invitations';
import type { GuestImportEntry } from '@/lib/guest-import';
import { seatingTables, type SeatingTable } from '@/lib/seating';

const AdminUserButton = dynamic(
  () => import('@/components/admin-user-button').then((module) => module.AdminUserButton),
  { ssr: false },
);

const statusMeta: Record<RsvpStatus, { label: string; className: string; dot: string }> = {
  PENDING: { label: 'Pendiente', className: 'border-[#d6c68b] bg-[#faf2d7] text-[#775f1d]', dot: 'bg-[#b99533]' },
  ACCEPTED: { label: 'Confirmado', className: 'border-[#aac495] bg-[#e7f0df] text-[#416337]', dot: 'bg-[#5e8a50]' },
  DECLINED: { label: 'No asistirá', className: 'border-[#d7a89f] bg-[#f6e3df] text-[#8b453b]', dot: 'bg-[#b66456]' },
};

type SentFilter = 'ALL' | 'SENT' | 'NOT_SENT';
type SourceFilter = 'ALL' | 'LARISSA' | 'LUIS';
type EditorState = Invitation | 'NEW' | null;

function StatusPill({ status }: { status: RsvpStatus }) {
  const meta = statusMeta[status];
  return (
    <span className={'inline-flex items-center gap-2 border px-2 py-1 text-xs ' + meta.className}>
      <span className={'status-dot ' + meta.dot} />
      {meta.label}
    </span>
  );
}

function formatResponseDate(value: string | null) {
  if (!value) return 'Sin respuesta';
  return new Intl.DateTimeFormat('es-SV', { day: 'numeric', month: 'short' }).format(new Date(value));
}

function sourceName(source: string | null) {
  if (!source) return 'Sin origen';
  if (source.toLocaleLowerCase('es').includes('larissa')) return 'Larissa';
  if (source.toLocaleLowerCase('es').includes('luis')) return 'Luis';
  return source;
}

function memberLines(invitation: Invitation) {
  return invitation.invitees
    .map((member) => (member.gender ? member.name + ' | ' + member.gender : member.name))
    .join('\n');
}

function parseMembers(value: string): FamilyMemberInput[] {
  return value
    .split('\n')
    .map((line) => {
      const [name, rawGender] = line.split('|');
      const gender = rawGender?.trim().toUpperCase();
      return { name: name?.trim() ?? '', gender: gender === 'F' || gender === 'M' ? gender : null };
    })
    .filter((member) => member.name);
}

function invitationPayload(invitation: Invitation, overrides: Partial<FamilyInput> = {}): FamilyInput {
  return {
    recipientName: invitation.recipientName,
    householdName: invitation.householdName,
    maxGuests: invitation.maxGuests,
    status: invitation.status,
    attendingCount: invitation.attendingCount,
    sourceLabel: invitation.sourceLabel,
    clusterLabel: invitation.clusterLabel,
    clusterColor: invitation.clusterColor,
    tableName: invitation.tableName,
    invitationSent: invitation.invitationSent,
    members: invitation.invitees.map(({ name, gender }) => ({ name, gender })),
    ...overrides,
  };
}

async function workbookEntries(file: File): Promise<GuestImportEntry[]> {
  const [buffer, XLSXModule] = await Promise.all([file.arrayBuffer(), import('xlsx')]);
  const XLSX = XLSXModule.default ?? XLSXModule;
  const workbook = XLSX.read(buffer, { cellStyles: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('No encontramos una hoja para importar.');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });
  const columns = [
    { name: 1, gender: 2, letter: 'B', source: 'Invitados Larissa' as const },
    { name: 9, gender: 10, letter: 'J', source: 'Invitados Luis' as const },
  ];

  return rows.flatMap((row, index) => columns.map((column) => {
    const cell = sheet[column.letter + String(index + 1)];
    const name = row[column.name];
    const rawGender = row[column.gender];
    const gender = typeof rawGender === 'string' ? rawGender.trim().toUpperCase() : null;
    return {
      name: typeof name === 'string' ? name.trim() : '',
      gender: gender === 'F' || gender === 'M' ? gender : null,
      color: typeof cell?.s?.fgColor?.rgb === 'string' ? cell.s.fgColor.rgb.slice(-6) : null,
      source: column.source,
    };
  })).filter((entry) => Boolean(entry.name) && !/^invitados\s+(larissa|luis)$/i.test(entry.name));
}

function FamilyEditor({
  family,
  isNew,
  onClose,
  onSaved,
}: {
  family: Invitation | null;
  isNew: boolean;
  onClose: () => void;
  onSaved: (invitation: Invitation) => void;
}) {
  const [recipientName, setRecipientName] = useState(family?.recipientName ?? '');
  const [sourceLabel, setSourceLabel] = useState(family?.sourceLabel ?? 'Invitados Larissa');
  const [tableName, setTableName] = useState(family?.tableName ?? '');
  const [maxGuests, setMaxGuests] = useState(family?.maxGuests ?? 1);
  const [status, setStatus] = useState<RsvpStatus>(family?.status ?? 'PENDING');
  const [attendingCount, setAttendingCount] = useState(family?.attendingCount ?? 0);
  const [invitationSent, setInvitationSent] = useState(family?.invitationSent ?? false);
  const [membersText, setMembersText] = useState(family ? memberLines(family) : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    const members = parseMembers(membersText);
    if (!recipientName.trim()) {
      setError('Escribe el nombre de la familia o del invitado.');
      return;
    }
    if (!members.length) {
      setError('Agrega al menos un integrante de la familia.');
      return;
    }

    setSaving(true);
    setError('');
    const body: FamilyInput = {
      recipientName,
      householdName: recipientName || null,
      sourceLabel: sourceLabel || null,
      clusterLabel: null,
      clusterColor: null,
      tableName: tableName || null,
      maxGuests: Number(maxGuests),
      status,
      attendingCount: Number(attendingCount),
      invitationSent,
      members,
    };
    try {
      const response = await fetch(
        family ? '/api/admin/invitations/' + family.id : '/api/admin/invitations',
        { method: family ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      );
      const payload = (await response.json().catch(() => null)) as { invitation?: Invitation; error?: string } | null;
      if (!response.ok || !payload?.invitation) throw new Error(payload?.error ?? 'No se pudo guardar la familia.');
      onSaved(payload.invitation);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo guardar la familia.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(family) || isNew} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-1.5rem)] max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-none border-[#d8d0bf] bg-[#fffaf0] p-6 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{family ? 'Editar familia' : 'Agregar familia'}</DialogTitle>
          <DialogDescription>Una familia se gestiona como un solo registro. Su mesa organiza automáticamente su grupo visual.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="mt-2 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="recipient-name" className="block text-sm">
              <span className="mb-1.5 block text-[#5c614d]">Nombre visible de la familia</span>
              <Input id="recipient-name" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Familia Vides" className="h-10 rounded-none border-[#c9c0af] bg-[#fffaf0]" />
            </label>
            <label htmlFor="guest-source" className="block text-sm">
              <span className="mb-1.5 block text-[#5c614d]">Origen de los invitados</span>
              <select id="guest-source" value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} className="h-10 w-full rounded-none border border-[#c9c0af] bg-[#fffaf0] px-3 text-sm outline-none focus:border-[#78805e] focus:ring-2 focus:ring-[#78805e]/20">
                <option value="Invitados Larissa">Invitados Larissa</option>
                <option value="Invitados Luis">Invitados Luis</option>
                <option value="Ambos">Ambos</option>
                <option value="Sin origen">Sin origen</option>
              </select>
            </label>
            <label htmlFor="table-name" className="block text-sm">
              <span className="mb-1.5 block text-[#5c614d]">Mesa asignada</span>
              <select id="table-name" value={tableName} onChange={(event) => setTableName(event.target.value)} className="h-10 w-full rounded-none border border-[#c9c0af] bg-[#fffaf0] px-3 text-sm outline-none focus:border-[#78805e] focus:ring-2 focus:ring-[#78805e]/20">
                <option value="">Sin asignar</option>
                {seatingTables.map((table) => <option key={table.name} value={table.name}>{table.name}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-2 gap-3">
              <label htmlFor="max-guests" className="block text-sm">
                <span className="mb-1.5 block text-[#5c614d]">Cupo</span>
                <Input id="max-guests" type="number" min={1} max={40} value={maxGuests} onChange={(event) => setMaxGuests(Number(event.target.value))} className="h-10 rounded-none border-[#c9c0af] bg-[#fffaf0]" />
              </label>
              <label htmlFor="attending-count" className="block text-sm">
                <span className="mb-1.5 block text-[#5c614d]">Confirmados</span>
                <Input id="attending-count" type="number" min={0} max={maxGuests} value={attendingCount} disabled={status !== 'ACCEPTED'} onChange={(event) => setAttendingCount(Number(event.target.value))} className="h-10 rounded-none border-[#c9c0af] bg-[#fffaf0] disabled:opacity-50" />
              </label>
            </div>
            <label htmlFor="rsvp-status" className="block text-sm">
              <span className="mb-1.5 block text-[#5c614d]">Respuesta</span>
              <select id="rsvp-status" value={status} onChange={(event) => setStatus(event.target.value as RsvpStatus)} className="h-10 w-full rounded-none border border-[#c9c0af] bg-[#fffaf0] px-3 text-sm outline-none focus:border-[#78805e] focus:ring-2 focus:ring-[#78805e]/20">
                <option value="PENDING">Pendiente</option>
                <option value="ACCEPTED">Confirmado</option>
                <option value="DECLINED">No asistirá</option>
              </select>
            </label>
          </div>

          <div className="flex items-center justify-between border border-[#d8d0bf] bg-[#f8f4eb] px-4 py-3 text-sm">
            <span>
              <span className="block font-medium text-[#313624]">Invitación enviada</span>
              <span className="text-xs text-[#6e735f]">Actualiza este estado cuando se comparta el enlace.</span>
            </span>
            <Switch checked={invitationSent} onCheckedChange={setInvitationSent} aria-label="Invitación enviada" />
          </div>

          <label htmlFor="family-members" className="block text-sm">
            <span className="mb-1.5 block text-[#5c614d]">Integrantes de la familia</span>
            <textarea id="family-members" value={membersText} onChange={(event) => setMembersText(event.target.value)} placeholder={'Nombre completo | F o M\nEj. Gabriela Vides | F'} rows={6} className="w-full resize-y rounded-none border border-[#c9c0af] bg-[#fffaf0] px-3 py-2 text-sm outline-none focus:border-[#78805e] focus:ring-2 focus:ring-[#78805e]/20" />
            <span className="mt-1 block text-xs text-[#6e735f]">Una persona por línea. El género es opcional.</span>
          </label>

          {error && <p className="text-sm text-[#a54e43]">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-[#d8d0bf] pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-none">Cancelar</Button>
            <Button type="submit" disabled={saving} className="rounded-none bg-[#424934]">{saving ? 'Guardando...' : family ? 'Guardar cambios' : 'Agregar familia'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Seat = { id: string; name: string; familyName: string; source: string | null; color: string };

function SeatCard({ seat, order }: { seat: Seat; order: number }) {
  return (
    <div className="min-w-0 border border-[#d8d0bf] border-l-[3px] bg-[#fffaf0] px-2.5 py-2" style={{ borderLeftColor: seat.color }}>
      <p className="truncate text-xs font-semibold text-[#313624]">{String(order) + '. ' + seat.name}</p>
      <p className="truncate pt-0.5 text-[11px] text-[#6e735f]">{seat.familyName + ' · ' + sourceName(seat.source)}</p>
    </div>
  );
}

function SeatingMap({ table, families }: { table: SeatingTable; families: Invitation[] }) {
  const seats = families.flatMap((family) => family.invitees.map((member) => ({
    id: member.id,
    name: member.name,
    familyName: family.recipientName,
    source: family.sourceLabel,
    color: table.color,
  })));
  const guests = families.flatMap((family) => family.invitees);
  const women = guests.filter((guest) => guest.gender === 'F').length;
  const men = guests.filter((guest) => guest.gender === 'M').length;
  const unspecifiedGender = guests.length - women - men;
  const womenPercentage = seats.length ? Math.round((women / seats.length) * 100) : 0;
  const menPercentage = seats.length ? Math.round((men / seats.length) * 100) : 0;
  const sourceBreakdown = Array.from(seats.reduce((totals, seat) => {
    const source = sourceName(seat.source);
    totals.set(source, (totals.get(source) ?? 0) + 1);
    return totals;
  }, new Map<string, number>()).entries());
  const topCount = Math.min(4, Math.ceil(seats.length / 3));
  const sideCount = Math.min(2, Math.floor((seats.length - topCount) / 3));
  const top = seats.slice(0, topCount);
  const left = seats.slice(topCount, topCount + sideCount);
  const right = seats.slice(topCount + sideCount, topCount + sideCount * 2);
  const bottom = seats.slice(topCount + sideCount * 2);
  const available = table.capacity - seats.length;
  const availability = available < 0
    ? 'Reubicar ' + String(Math.abs(available)) + (Math.abs(available) === 1 ? ' persona' : ' personas')
    : String(available) + (available === 1 ? ' espacio disponible' : ' espacios disponibles');

  return (
    <section className="border border-[#d8d0bf] bg-[#f8f4eb] p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6e735f]">Mesa seleccionada</p>
          <h2 className="font-display mt-1 text-2xl">{table.name}</h2>
        </div>
        <p className={'text-sm font-medium ' + (available < 0 ? 'text-[#a54e43]' : 'text-[#527145]')}>{availability}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <div className="border border-[#d8d0bf] bg-[#fffaf0] p-3">
          <p className="text-xs uppercase text-[#6e735f]">Asignados</p>
          <p className="font-display mt-1 text-2xl">{String(seats.length) + ' / ' + String(table.capacity)}</p>
        </div>
        <div className="border border-[#d8d0bf] bg-[#fffaf0] p-3">
          <p className="text-xs uppercase text-[#6e735f]">{available < 0 ? 'Reubicar' : 'Disponibles'}</p>
          <p className={'font-display mt-1 text-2xl ' + (available < 0 ? 'text-[#a54e43]' : 'text-[#527145]')}>{Math.abs(available)}</p>
        </div>
        <div className="border border-[#d8d0bf] bg-[#fffaf0] p-3">
          <p className="text-xs uppercase text-[#6e735f]">Mujeres</p>
          <p className="font-display mt-1 text-2xl text-[#805a76]">{String(women) + ' · ' + String(womenPercentage) + '%'}</p>
        </div>
        <div className="border border-[#d8d0bf] bg-[#fffaf0] p-3">
          <p className="text-xs uppercase text-[#6e735f]">Hombres</p>
          <p className="font-display mt-1 text-2xl text-[#45687d]">{String(men) + ' · ' + String(menPercentage) + '%'}</p>
        </div>
        <div className="border border-[#d8d0bf] bg-[#fffaf0] p-3">
          <p className="text-xs uppercase text-[#6e735f]">Sin especificar</p>
          <p className="font-display mt-1 text-2xl">{unspecifiedGender}</p>
        </div>
      </div>

      <section className="mt-5 border border-[#d8d0bf] bg-[#fffaf0] p-4">
        <h3 className="font-medium text-[#313624]">Origen de invitados</h3>
        {sourceBreakdown.length ? (
          <ul className="mt-3 space-y-3">
            {sourceBreakdown.map(([source, count]) => (
              <li key={source}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#4c513d]">{source}</span>
                  <span className="font-medium text-[#313624]">{String(count) + ' personas'}</span>
                </div>
                <div className="mt-1.5 h-1.5 bg-[#e2dbce]"><div className="h-full" style={{ width: String(Math.round((count / seats.length) * 100)) + '%', backgroundColor: table.color }} /></div>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-[#6e735f]">Sin invitados asignados.</p>}
      </section>

      {seats.length ? (
        <div className="mx-auto mt-6 max-w-4xl space-y-3">
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
            {top.map((seat, index) => <SeatCard key={seat.id} seat={seat} order={index + 1} />)}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(9rem,.8fr)_minmax(0,1fr)] items-center gap-3">
            <div className="space-y-2">{left.map((seat, index) => <SeatCard key={seat.id} seat={seat} order={top.length + index + 1} />)}</div>
            <div className="flex aspect-square min-h-36 items-center justify-center border-2 border-[#424934] bg-[#e7ddcc] p-3 text-center">
              <div>
                <p className="font-display text-xl text-[#313624]">{table.name}</p>
                <p className="mt-1 text-xs text-[#5c614d]">{String(seats.length) + ' de ' + String(table.capacity) + ' asignados'}</p>
              </div>
            </div>
            <div className="space-y-2">{right.map((seat, index) => <SeatCard key={seat.id} seat={seat} order={top.length + left.length + index + 1} />)}</div>
          </div>
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
            {bottom.map((seat, index) => <SeatCard key={seat.id} seat={seat} order={top.length + left.length + right.length + index + 1} />)}
          </div>
        </div>
      ) : (
        <div className="grid min-h-56 place-items-center border border-dashed border-[#c9c0af] bg-[#fffaf0] text-center">
          <div>
            <LayoutGrid className="mx-auto text-[#78805e]" size={28} />
            <p className="mt-3 text-sm text-[#5c614d]">Aún no hay familias asignadas a esta mesa.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function InvitationActions({
  invitation,
  copied,
  onCopy,
  onEdit,
  onDelete,
}: {
  invitation: Invitation;
  copied: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button variant="ghost" size="icon-sm" title={copied ? 'Enlace copiado' : 'Copiar enlace'} className="rounded-none text-[#5c614d] hover:bg-[#ece6da]" aria-label={copied ? 'Enlace copiado' : 'Copiar enlace de invitación'} onClick={onCopy}><Clipboard size={16} /></Button>
      <a href={'/i/' + invitation.slug} target="_blank" rel="noreferrer" title="Abrir invitación" aria-label="Abrir invitación" className="inline-flex size-7 items-center justify-center text-[#5c614d] hover:bg-[#ece6da]"><ExternalLink size={16} /></a>
      <Button variant="ghost" size="icon-sm" title="Editar familia" className="rounded-none text-[#5c614d] hover:bg-[#ece6da]" aria-label="Editar familia" onClick={onEdit}><Pencil size={16} /></Button>
      <Button variant="ghost" size="icon-sm" title="Eliminar familia" className="rounded-none text-[#a54e43] hover:bg-[#f6e3df]" aria-label="Eliminar familia" onClick={onDelete}><Trash2 size={16} /></Button>
    </div>
  );
}

export function AdminDashboard({ initialInvitations, isDemo }: { initialInvitations: Invitation[]; isDemo: boolean }) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RsvpStatus | 'ALL'>('ALL');
  const [sentFilter, setSentFilter] = useState<SentFilter>('ALL');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');
  const [activeView, setActiveView] = useState<'families' | 'tables'>('families');
  const [editing, setEditing] = useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invitation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [selectedTable, setSelectedTable] = useState(seatingTables[0].name);
  const importInputRef = useRef<HTMLInputElement>(null);

  const metrics = useMemo(() => {
    const accepted = invitations.filter((item) => item.status === 'ACCEPTED');
    const guests = invitations.flatMap((item) => item.invitees);
    const women = guests.filter((guest) => guest.gender === 'F').length;
    const men = guests.filter((guest) => guest.gender === 'M').length;
    return {
      invitations: invitations.length,
      people: invitations.reduce((sum, item) => sum + item.maxGuests, 0),
      accepted: accepted.reduce((sum, item) => sum + item.attendingCount, 0),
      pending: invitations.filter((item) => item.status === 'PENDING').length,
      sent: invitations.filter((item) => item.invitationSent).length,
      declined: invitations.filter((item) => item.status === 'DECLINED').length,
      women,
      men,
      unspecifiedGender: guests.length - women - men,
    };
  }, [invitations]);

  const filteredInvitations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    return invitations
      .filter((invitation) => {
        const matchesStatus = statusFilter === 'ALL' || invitation.status === statusFilter;
        const matchesSent = sentFilter === 'ALL'
          || (sentFilter === 'SENT' && invitation.invitationSent)
          || (sentFilter === 'NOT_SENT' && !invitation.invitationSent);
        const source = sourceName(invitation.sourceLabel);
        const matchesSource = sourceFilter === 'ALL'
          || sourceFilter === 'LARISSA' && (source === 'Larissa' || invitation.sourceLabel === 'Ambos')
          || sourceFilter === 'LUIS' && (source === 'Luis' || invitation.sourceLabel === 'Ambos');
        const haystack = [
          invitation.recipientName,
          invitation.householdName,
          invitation.sourceLabel,
          invitation.tableName,
          ...invitation.invitees.map((member) => member.name),
        ].filter(Boolean).join(' ').toLocaleLowerCase('es');
        return matchesStatus && matchesSent && matchesSource && (!normalized || haystack.includes(normalized));
      })
      .sort((left, right) => left.recipientName.localeCompare(right.recipientName, 'es'));
  }, [invitations, query, sentFilter, sourceFilter, statusFilter]);

  const tableSummaries = useMemo(() => seatingTables.map((table) => {
    const families = invitations.filter((invitation) => invitation.tableName === table.name);
    const occupied = families.reduce((total, family) => total + family.invitees.length, 0);
    return { table, families, occupied, available: table.capacity - occupied };
  }), [invitations]);
  const currentTable = tableSummaries.find((summary) => summary.table.name === selectedTable) ?? tableSummaries[0];
  const unassignedFamilies = invitations.filter((invitation) => !invitation.tableName);

  function updateInvitation(updated: Invitation) {
    setInvitations((items) => {
      const exists = items.some((item) => item.id === updated.id);
      return exists ? items.map((item) => (item.id === updated.id ? updated : item)) : [...items, updated];
    });
  }

  async function copyLink(invitation: Invitation) {
    await navigator.clipboard.writeText(window.location.origin + '/i/' + invitation.slug);
    setCopiedId(invitation.id);
    window.setTimeout(() => setCopiedId(null), 1_800);
  }

  async function toggleInvitationSent(invitation: Invitation, checked: boolean) {
    setSavingId(invitation.id);
    setImportError('');
    try {
      const response = await fetch('/api/admin/invitations/' + invitation.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationPayload(invitation, { invitationSent: checked })),
      });
      const payload = (await response.json().catch(() => null)) as { invitation?: Invitation; error?: string } | null;
      if (!response.ok || !payload?.invitation) throw new Error(payload?.error ?? 'No se pudo actualizar el envío.');
      updateInvitation(payload.invitation);
    } catch (requestError) {
      setImportError(requestError instanceof Error ? requestError.message : 'No se pudo actualizar el envío.');
    } finally {
      setSavingId(null);
    }
  }

  async function deleteFamily() {
    if (!deleteTarget) return;
    setSavingId(deleteTarget.id);
    setImportError('');
    try {
      const response = await fetch('/api/admin/invitations/' + deleteTarget.id, { method: 'DELETE' });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'No se pudo eliminar la familia.');
      setInvitations((items) => items.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (requestError) {
      setImportError(requestError instanceof Error ? requestError.message : 'No se pudo eliminar la familia.');
    } finally {
      setSavingId(null);
    }
  }

  async function importWorkbook(file: File) {
    setIsImporting(true);
    setImportError('');
    setImportMessage('');
    try {
      const entries = await workbookEntries(file);
      if (!entries.length) throw new Error('No encontramos nombres válidos en las columnas de invitados.');
      const response = await fetch('/api/admin/invitations/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      const payload = (await response.json().catch(() => null)) as {
        summary?: { invitations: number; guests: number };
        invitations?: Invitation[];
        error?: string;
      } | null;
      if (!response.ok || !payload?.summary || !payload.invitations) throw new Error(payload?.error ?? 'No se pudo importar el archivo.');
      setInvitations(payload.invitations);
      setImportMessage(String(payload.summary.guests) + ' personas organizadas en ' + String(payload.summary.invitations) + ' familias.');
    } catch (requestError) {
      setImportError(requestError instanceof Error ? requestError.message : 'No se pudo importar el archivo.');
    } finally {
      setIsImporting(false);
    }
  }

  const statusOptions: Array<{ value: RsvpStatus | 'ALL'; label: string }> = [
    { value: 'ALL', label: 'Todos' },
    { value: 'PENDING', label: 'Pendientes' },
    { value: 'ACCEPTED', label: 'Confirmados' },
    { value: 'DECLINED', label: 'No asistirán' },
  ];
  const metricsList = [
    ['Familias', metrics.invitations, ''],
    ['Cupo total', metrics.people, ''],
    ['Confirmados', metrics.accepted, 'text-[#527145]'],
    ['Pendientes', metrics.pending, 'text-[#9a7723]'],
    ['Enviadas', metrics.sent, 'text-[#527145]'],
    ['No asistirán', metrics.declined, 'text-[#9a5148]'],
    ['Mujeres', metrics.women, 'text-[#805a76]'],
    ['Hombres', metrics.men, 'text-[#45687d]'],
    ['Sin especificar', metrics.unspecifiedGender, ''],
  ] as const;

  return (
    <>
      <main className="min-h-screen bg-[#f4eee2] text-[#313624]">
        <header className="border-b border-[#d8d0bf] bg-[#fffaf0]">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <Link href="/admin" className="font-display text-2xl leading-none">Larissa &amp; Luis</Link>
            <div className="flex items-center gap-2">
              {isDemo && <span className="hidden border border-[#d6c68b] bg-[#faf2d7] px-2 py-1 text-xs text-[#775f1d] sm:block">Muestra</span>}
              <AdminUserButton />
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs uppercase text-[#6e735f]">Boda / 04.10.2026</p>
              <h1 className="font-display mt-2 text-4xl leading-none">Control de invitados</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={importInputRef}
                type="file"
                accept=".xls,.xlsx"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void importWorkbook(file);
                }}
              />
              <Button type="button" variant="outline" onClick={() => setEditing('NEW')} className="h-10 rounded-none border-[#78805e] px-4">
                <Plus size={16} /> Agregar familia
              </Button>
              <Button type="button" onClick={() => importInputRef.current?.click()} disabled={isImporting || isDemo} className="h-10 rounded-none bg-[#424934] px-4">
                {isImporting ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />}
                {isImporting ? 'Importando...' : 'Importar Excel'}
              </Button>
              {invitations[0] && (
                <a href={'/i/' + invitations[0].slug} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-[#4c513d] underline underline-offset-4">
                  Ver una invitación <ExternalLink size={15} />
                </a>
              )}
            </div>
          </div>

          {(importMessage || importError) && (
            <div className={'mt-5 flex items-center gap-2 border px-4 py-3 text-sm ' + (importError ? 'border-[#d7a89f] bg-[#f6e3df] text-[#8b453b]' : 'border-[#aac495] bg-[#e7f0df] text-[#416337]')}>
              <FileSpreadsheet size={17} /> {importError || importMessage}
            </div>
          )}

          <section className="mt-8 grid grid-cols-2 gap-px border-y border-[#d8d0bf] bg-[#d8d0bf] sm:grid-cols-3 xl:grid-cols-9">
            {metricsList.map(([label, value, color]) => (
              <div key={label} className="bg-[#f4eee2] px-4 py-5">
                <p className="text-xs uppercase text-[#6e735f]">{label}</p>
                <p className={'font-display mt-2 text-3xl leading-none ' + color}>{value}</p>
              </div>
            ))}
          </section>

          <Tabs value={activeView} onValueChange={(value) => setActiveView(value as 'families' | 'tables')} className="mt-8 gap-5">
            <TabsList variant="line" className="h-auto w-full justify-start gap-5 border-b border-[#d8d0bf] p-0">
              <TabsTrigger value="families" className="h-10 rounded-none px-1 text-[#5c614d] data-active:text-[#313624]"><Users size={16} /> Familias</TabsTrigger>
              <TabsTrigger value="tables" className="h-10 rounded-none px-1 text-[#5c614d] data-active:text-[#313624]"><LayoutGrid size={16} /> Vista por mesa</TabsTrigger>
            </TabsList>

            <TabsContent value="families">
              <section>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="relative max-w-xl flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#78805e]" size={17} />
                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar familia, integrante o mesa" className="h-10 rounded-none border-[#c9c0af] bg-[#fffaf0] pl-10" />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex flex-wrap border border-[#c9c0af] bg-[#fffaf0]">
                      {statusOptions.map((option) => (
                        <button key={option.value} type="button" onClick={() => setStatusFilter(option.value)} className={statusFilter === option.value ? 'h-9 shrink-0 border-r border-[#c9c0af] bg-[#424934] px-3 text-sm text-[#fffaf0] last:border-r-0' : 'h-9 shrink-0 border-r border-[#c9c0af] px-3 text-sm text-[#5c614d] hover:bg-[#ece6da] last:border-r-0'}>
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap border border-[#c9c0af] bg-[#fffaf0]">
                      {([
                        ['ALL', 'Todas'],
                        ['SENT', 'Enviadas'],
                        ['NOT_SENT', 'Sin enviar'],
                      ] as Array<[SentFilter, string]>).map(([value, label]) => (
                        <button key={value} type="button" onClick={() => setSentFilter(value)} className={sentFilter === value ? 'h-9 shrink-0 border-r border-[#c9c0af] bg-[#78805e] px-3 text-sm text-[#fffaf0] last:border-r-0' : 'h-9 shrink-0 border-r border-[#c9c0af] px-3 text-sm text-[#5c614d] hover:bg-[#ece6da] last:border-r-0'}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap border border-[#c9c0af] bg-[#fffaf0]">
                      {([
                        ['ALL', 'Todas'],
                        ['LARISSA', 'Larissa'],
                        ['LUIS', 'Luis'],
                      ] as Array<[SourceFilter, string]>).map(([value, label]) => (
                        <button key={value} type="button" onClick={() => setSourceFilter(value)} className={sourceFilter === value ? 'h-9 shrink-0 border-r border-[#c9c0af] bg-[#655a45] px-3 text-sm text-[#fffaf0] last:border-r-0' : 'h-9 shrink-0 border-r border-[#c9c0af] px-3 text-sm text-[#5c614d] hover:bg-[#ece6da] last:border-r-0'}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 hidden border border-[#d8d0bf] bg-[#fffaf0] lg:block">
                  <Table className="w-full table-fixed">
                    <TableHeader className="bg-[#ece6da]/60">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-11 w-[30%] px-4 text-xs font-semibold uppercase text-[#6e735f]">Familia</TableHead>
                        <TableHead className="h-11 w-[11%] px-3 text-xs font-semibold uppercase text-[#6e735f]">Origen</TableHead>
                        <TableHead className="h-11 w-[12%] px-3 text-xs font-semibold uppercase text-[#6e735f]">Mesa</TableHead>
                        <TableHead className="h-11 w-[9%] px-3 text-xs font-semibold uppercase text-[#6e735f]">Cupo</TableHead>
                        <TableHead className="h-11 w-[12%] px-3 text-xs font-semibold uppercase text-[#6e735f]">Enviada</TableHead>
                        <TableHead className="h-11 w-[14%] px-3 text-xs font-semibold uppercase text-[#6e735f]">Respuesta</TableHead>
                        <TableHead className="h-11 w-[12%] px-3"><span className="sr-only">Acciones</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvitations.length ? filteredInvitations.map((invitation) => (
                        <TableRow key={invitation.id} className="hover:bg-[#f8f4eb]">
                          <TableCell className="px-4 py-3">
                            <div className="min-w-0">
                              <p className="font-medium text-[#313624]">{invitation.recipientName}</p>
                              <p className="mt-0.5 break-words text-xs leading-5 text-[#6e735f]">{invitation.invitees.map((member) => member.name).join(', ') || 'Sin integrantes'}</p>
                            </div>
                          </TableCell>
                          <TableCell className="break-words px-3 py-3 text-sm text-[#4c513d]">{sourceName(invitation.sourceLabel)}</TableCell>
                          <TableCell className="break-words px-3 py-3 text-sm text-[#5c614d]">{invitation.tableName ?? 'Sin asignar'}</TableCell>
                          <TableCell className="px-3 py-3 text-sm text-[#5c614d]">{String(invitation.attendingCount) + ' / ' + String(invitation.maxGuests)}</TableCell>
                          <TableCell className="px-3 py-3">
                            <label className="flex items-center gap-2 text-sm text-[#5c614d]">
                              <Switch size="sm" checked={invitation.invitationSent} disabled={savingId === invitation.id} onCheckedChange={(checked) => void toggleInvitationSent(invitation, checked)} aria-label={'Invitación enviada a ' + invitation.recipientName} />
                              {invitation.invitationSent ? 'Sí' : 'No'}
                            </label>
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <StatusPill status={invitation.status} />
                            <p className="mt-1 text-xs text-[#6e735f]">{formatResponseDate(invitation.respondedAt)}</p>
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <InvitationActions invitation={invitation} copied={copiedId === invitation.id} onCopy={() => void copyLink(invitation)} onEdit={() => setEditing(invitation)} onDelete={() => setDeleteTarget(invitation)} />
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={7} className="h-32 text-center text-sm text-[#6e735f]">No hay familias que coincidan con los filtros.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-5 grid gap-3 lg:hidden">
                  {filteredInvitations.length ? filteredInvitations.map((invitation) => (
                    <article key={invitation.id} className="border border-[#d8d0bf] bg-[#fffaf0] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="font-medium text-[#313624]">{invitation.recipientName}</h2>
                          <p className="mt-1 break-words text-xs leading-5 text-[#6e735f]">{invitation.invitees.map((member) => member.name).join(', ') || 'Sin integrantes'}</p>
                        </div>
                        <StatusPill status={invitation.status} />
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-[#e2dbce] py-3 text-sm">
                        <div><dt className="text-xs uppercase text-[#6e735f]">Origen</dt><dd className="mt-1 text-[#4c513d]">{sourceName(invitation.sourceLabel)}</dd></div>
                        <div><dt className="text-xs uppercase text-[#6e735f]">Mesa</dt><dd className="mt-1 text-[#4c513d]">{invitation.tableName ?? 'Sin asignar'}</dd></div>
                        <div><dt className="text-xs uppercase text-[#6e735f]">Cupo</dt><dd className="mt-1 text-[#4c513d]">{String(invitation.attendingCount) + ' / ' + String(invitation.maxGuests)}</dd></div>
                        <div><dt className="text-xs uppercase text-[#6e735f]">Respuesta</dt><dd className="mt-1 text-[#4c513d]">{formatResponseDate(invitation.respondedAt)}</dd></div>
                      </dl>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-[#5c614d]">
                          <Switch size="sm" checked={invitation.invitationSent} disabled={savingId === invitation.id} onCheckedChange={(checked) => void toggleInvitationSent(invitation, checked)} aria-label={'Invitación enviada a ' + invitation.recipientName} />
                          Invitación {invitation.invitationSent ? 'enviada' : 'sin enviar'}
                        </label>
                        <InvitationActions invitation={invitation} copied={copiedId === invitation.id} onCopy={() => void copyLink(invitation)} onEdit={() => setEditing(invitation)} onDelete={() => setDeleteTarget(invitation)} />
                      </div>
                    </article>
                  )) : (
                    <div className="grid h-32 place-items-center border border-[#d8d0bf] bg-[#fffaf0] text-center text-sm text-[#6e735f]">No hay familias que coincidan con los filtros.</div>
                  )}
                </div>
                <div className="mt-6 flex items-center gap-2 text-sm text-[#6e735f]"><Users size={17} className="text-[#78805e]" /><span>{String(filteredInvitations.length) + ' familias visibles'}</span></div>
              </section>
            </TabsContent>

            <TabsContent value="tables">
              <section>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {tableSummaries.map((summary) => {
                    const selected = summary.table.name === currentTable?.table.name;
                    return (
                      <button
                        key={summary.table.name}
                        type="button"
                        aria-pressed={selected}
                        aria-label={'Ver detalle de ' + summary.table.name}
                        onClick={() => setSelectedTable(summary.table.name)}
                        className={'border border-[#d8d0bf] bg-[#fffaf0] px-4 py-3 text-left text-sm font-medium text-[#313624] transition-colors hover:bg-[#ece6da] ' + (selected ? 'ring-1 ring-[#424934]' : '')}
                        style={{ borderLeftColor: summary.table.color, borderLeftWidth: '4px' }}
                      >
                        {summary.table.name}
                      </button>
                    );
                  })}
                </div>

                {currentTable && <div className="mt-5"><SeatingMap table={currentTable.table} families={currentTable.families} /></div>}

                {unassignedFamilies.length > 0 && (
                  <section className="mt-6 border border-dashed border-[#c9c0af] bg-[#fffaf0] p-4">
                    <div className="flex items-center gap-2">
                      <Mail size={17} className="text-[#78805e]" />
                      <p className="font-medium text-[#313624]">{String(unassignedFamilies.length) + (unassignedFamilies.length === 1 ? ' familia sin mesa asignada' : ' familias sin mesa asignada')}</p>
                    </div>
                    <p className="mt-1 text-sm text-[#6e735f]">{unassignedFamilies.map((family) => family.recipientName).join(', ')}</p>
                  </section>
                )}
              </section>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <FamilyEditor key={editing === 'NEW' ? 'new' : editing?.id ?? 'closed'} family={editing && editing !== 'NEW' ? editing : null} isNew={editing === 'NEW'} onClose={() => setEditing(null)} onSaved={updateInvitation} />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-none border-[#d8d0bf] bg-[#fffaf0]">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta familia?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminarán la familia {deleteTarget?.recipientName ?? ''}, sus integrantes y su enlace de invitación. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="rounded-none bg-[#f8f4eb]">
            <AlertDialogCancel className="rounded-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={savingId === deleteTarget?.id} onClick={(event) => { event.preventDefault(); void deleteFamily(); }} className="rounded-none bg-[#a54e43] hover:bg-[#8f4037]">
              {savingId === deleteTarget?.id ? 'Eliminando...' : 'Eliminar familia'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
