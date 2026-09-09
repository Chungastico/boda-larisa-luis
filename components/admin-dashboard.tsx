'use client';

import { useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Clipboard,
  ExternalLink,
  FileSpreadsheet,
  LoaderCircle,
  Pencil,
  Search,
  Upload,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Invitation, RsvpStatus } from '@/lib/invitations';
import type { GuestImportEntry } from '@/lib/guest-import';

const AdminUserButton = dynamic(
  () => import('@/components/admin-user-button').then((module) => module.AdminUserButton),
  { ssr: false },
);

const statusMeta: Record<RsvpStatus, { label: string; className: string; dot: string }> = {
  PENDING: {
    label: 'Pendiente',
    className: 'border-[#d6c68b] bg-[#faf2d7] text-[#775f1d]',
    dot: 'bg-[#b99533]',
  },
  ACCEPTED: {
    label: 'Confirmado',
    className: 'border-[#aac495] bg-[#e7f0df] text-[#416337]',
    dot: 'bg-[#5e8a50]',
  },
  DECLINED: {
    label: 'No asistira',
    className: 'border-[#d7a89f] bg-[#f6e3df] text-[#8b453b]',
    dot: 'bg-[#b66456]',
  },
};

function StatusPill({ status }: { status: RsvpStatus }) {
  const meta = statusMeta[status];

  return (
    <span className={`inline-flex items-center gap-2 border px-2 py-1 text-xs ${meta.className}`}>
      <span className={`status-dot ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function formatResponseDate(value: string | null) {
  if (!value) return 'Sin respuesta';
  return new Intl.DateTimeFormat('es-SV', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));
}

async function workbookEntries(file: File): Promise<GuestImportEntry[]> {
  const [buffer, XLSX] = await Promise.all([file.arrayBuffer(), import('xlsx')]);
  const workbook = XLSX.read(buffer, { cellStyles: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('No encontramos una hoja para importar.');

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });
  const columns = [
    { name: 1, gender: 2, letter: 'B', source: 'Invitados Larissa' as const },
    { name: 9, gender: 10, letter: 'J', source: 'Invitados Luis' as const },
  ];

  return rows.flatMap((row, index) => columns.map((column) => {
    const cell = sheet[`${column.letter}${index + 1}`];
    const name = row[column.name];
    const gender = row[column.gender];
    return {
      name: typeof name === 'string' ? name.trim() : '',
      gender: typeof gender === 'string' ? gender.trim().toUpperCase() : null,
      color: typeof cell?.s?.fgColor?.rgb === 'string' ? cell.s.fgColor.rgb.slice(-6) : null,
      source: column.source,
    };
  })).filter((entry): entry is GuestImportEntry => (
    Boolean(entry.name) && (entry.gender === 'F' || entry.gender === 'M')
  ));
}

function SortHead<TData>({ column, label }: { column: Column<TData, unknown>; label: string }) {
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase text-[#6e735f] hover:text-[#313624]"
    >
      {label}
      <ArrowUpDown size={13} />
    </button>
  );
}

function InvitationEditor({
  invitation,
  onClose,
  onSaved,
}: {
  invitation: Invitation | null;
  onClose: () => void;
  onSaved: (invitation: Invitation) => void;
}) {
  const [recipientName, setRecipientName] = useState(invitation?.recipientName ?? '');
  const [householdName, setHouseholdName] = useState(invitation?.householdName ?? '');
  const [maxGuests, setMaxGuests] = useState(invitation?.maxGuests ?? 1);
  const [status, setStatus] = useState<RsvpStatus>(invitation?.status ?? 'PENDING');
  const [attendingCount, setAttendingCount] = useState(invitation?.attendingCount ?? 0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!invitation) return;

    setSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/invitations/${invitation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName,
          householdName,
          maxGuests: Number(maxGuests),
          status,
          attendingCount: Number(attendingCount),
        }),
      });
      const payload = (await response.json()) as { invitation?: Invitation; error?: string };

      if (!response.ok || !payload.invitation) {
        throw new Error(payload.error ?? 'No se pudo actualizar la invitacion.');
      }

      onSaved(payload.invitation);
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No se pudo actualizar la invitacion.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(invitation)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100%-1.5rem)] rounded-none border-[#d8d0bf] bg-[#fffaf0] p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Editar invitacion</DialogTitle>
          <DialogDescription>Actualiza el destinatario, cupo y estado de la respuesta.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="mt-1 space-y-4">
          <label htmlFor="recipient-name" className="block text-sm">
            <span className="mb-1.5 block text-[#5c614d]">Destinatario</span>
            <Input
              id="recipient-name"
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              className="h-10 rounded-none border-[#c9c0af] bg-[#fffaf0]"
            />
          </label>
          <label htmlFor="household-name" className="block text-sm">
            <span className="mb-1.5 block text-[#5c614d]">Familia o grupo</span>
            <Input
              id="household-name"
              value={householdName}
              onChange={(event) => setHouseholdName(event.target.value)}
              className="h-10 rounded-none border-[#c9c0af] bg-[#fffaf0]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label htmlFor="max-guests" className="block text-sm">
              <span className="mb-1.5 block text-[#5c614d]">Cupo</span>
              <Input
                id="max-guests"
                type="number"
                min={1}
                max={20}
                value={maxGuests}
                onChange={(event) => setMaxGuests(Number(event.target.value))}
                className="h-10 rounded-none border-[#c9c0af] bg-[#fffaf0]"
              />
            </label>
            <label htmlFor="attending-count" className="block text-sm">
              <span className="mb-1.5 block text-[#5c614d]">Confirmados</span>
              <Input
                id="attending-count"
                type="number"
                min={0}
                max={maxGuests}
                value={attendingCount}
                onChange={(event) => setAttendingCount(Number(event.target.value))}
                className="h-10 rounded-none border-[#c9c0af] bg-[#fffaf0]"
              />
            </label>
          </div>
          <label htmlFor="rsvp-status" className="block text-sm">
            <span className="mb-1.5 block text-[#5c614d]">Estado</span>
            <select
              id="rsvp-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as RsvpStatus)}
              className="h-10 w-full rounded-none border border-[#c9c0af] bg-[#fffaf0] px-3 text-sm outline-none focus:border-[#78805e] focus:ring-2 focus:ring-[#78805e]/20"
            >
              <option value="PENDING">Pendiente</option>
              <option value="ACCEPTED">Confirmado</option>
              <option value="DECLINED">No asistira</option>
            </select>
          </label>
          {error && <p className="text-sm text-[#a54e43]">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-[#d8d0bf] pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-none">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="rounded-none bg-[#424934]">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminDashboard({
  initialInvitations,
  isDemo,
}: {
  initialInvitations: Invitation[];
  isDemo: boolean;
}) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RsvpStatus | 'ALL'>('ALL');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [editing, setEditing] = useState<Invitation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const metrics = useMemo(() => {
    const accepted = invitations.filter((item) => item.status === 'ACCEPTED');
    return {
      invitations: invitations.length,
      people: invitations.reduce((sum, item) => sum + item.maxGuests, 0),
      accepted: accepted.reduce((sum, item) => sum + item.attendingCount, 0),
      pending: invitations.filter((item) => item.status === 'PENDING').length,
      declined: invitations.filter((item) => item.status === 'DECLINED').length,
    };
  }, [invitations]);

  const filteredInvitations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return invitations.filter((invitation) => {
      const matchesStatus = statusFilter === 'ALL' || invitation.status === statusFilter;
      const haystack = `${invitation.recipientName} ${invitation.householdName ?? ''} ${invitation.sourceLabel ?? ''}`.toLowerCase();
      return matchesStatus && (!normalized || haystack.includes(normalized));
    });
  }, [invitations, query, statusFilter]);

  async function copyLink(invitation: Invitation) {
    await navigator.clipboard.writeText(`${window.location.origin}/i/${invitation.slug}`);
    setCopiedId(invitation.id);
    window.setTimeout(() => setCopiedId(null), 1_800);
  }

  async function importWorkbook(file: File) {
    setIsImporting(true);
    setImportError('');
    setImportMessage('');

    try {
      const entries = await workbookEntries(file);
      if (!entries.length) throw new Error('No encontramos nombres validos en las columnas de invitados.');

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

      if (!response.ok || !payload?.summary || !payload.invitations) {
        throw new Error(payload?.error ?? 'No se pudo importar el archivo.');
      }

      setInvitations(payload.invitations);
      setImportMessage(`${payload.summary.guests} personas organizadas en ${payload.summary.invitations} invitaciones.`);
    } catch (requestError) {
      setImportError(requestError instanceof Error ? requestError.message : 'No se pudo importar el archivo.');
    } finally {
      setIsImporting(false);
    }
  }

  const columns = useMemo<ColumnDef<Invitation>[]>(
    () => [
      {
        accessorKey: 'recipientName',
        header: ({ column }) => <SortHead column={column} label="Invitado" />,
        cell: ({ row }) => (
          <div className="min-w-44">
            <p className="font-medium text-[#313624]">{row.original.recipientName}</p>
            <p className="mt-0.5 text-xs text-[#6e735f]">{row.original.sourceLabel ?? 'Sin grupo'}</p>
          </div>
        ),
      },
      {
        accessorKey: 'maxGuests',
        header: ({ column }) => <SortHead column={column} label="Cupo" />,
        cell: ({ row }) => (
          <span className="text-sm text-[#5c614d]">
            {row.original.attendingCount} / {row.original.maxGuests}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <SortHead column={column} label="Estado" />,
        cell: ({ row }) => <StatusPill status={row.original.status} />,
      },
      {
        accessorKey: 'respondedAt',
        header: ({ column }) => <SortHead column={column} label="Respuesta" />,
        cell: ({ row }) => <span className="text-sm text-[#5c614d]">{formatResponseDate(row.original.respondedAt)}</span>,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Acciones</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-none text-[#5c614d] hover:bg-[#ece6da]"
                    aria-label="Copiar enlace de invitacion"
                    onClick={() => void copyLink(row.original)}
                  >
                    <Clipboard size={16} />
                  </Button>
                }
              />
              <TooltipContent>{copiedId === row.original.id ? 'Enlace copiado' : 'Copiar enlace'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <a
                    href={`/i/${row.original.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Abrir invitacion"
                    className="inline-flex size-7 items-center justify-center text-[#5c614d] hover:bg-[#ece6da]"
                  >
                    <ExternalLink size={16} />
                  </a>
                }
              />
              <TooltipContent>Abrir invitacion</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-none text-[#5c614d] hover:bg-[#ece6da]"
                    aria-label="Editar invitacion"
                    onClick={() => setEditing(row.original)}
                  >
                    <Pencil size={16} />
                  </Button>
                }
              />
              <TooltipContent>Editar invitacion</TooltipContent>
            </Tooltip>
          </div>
        ),
      },
    ],
    [copiedId],
  );

  const table = useReactTable({
    data: filteredInvitations,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const filterOptions: Array<{ value: RsvpStatus | 'ALL'; label: string }> = [
    { value: 'ALL', label: 'Todos' },
    { value: 'PENDING', label: 'Pendientes' },
    { value: 'ACCEPTED', label: 'Confirmados' },
    { value: 'DECLINED', label: 'No asistiran' },
  ];

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-[#f4eee2] text-[#313624]">
        <header className="border-b border-[#d8d0bf] bg-[#fffaf0]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <Link href="/admin" className="font-display text-2xl leading-none">Larissa &amp; Luis</Link>
            <div className="flex items-center gap-2">
              {isDemo && <span className="hidden border border-[#d6c68b] bg-[#faf2d7] px-2 py-1 text-xs text-[#775f1d] sm:block">Muestra</span>}
              <AdminUserButton />
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs uppercase text-[#6e735f]">Boda / 04.10.2026</p>
              <h1 className="font-display mt-2 text-4xl leading-none">Control de invitados</h1>
            </div>
            <div className="flex flex-wrap items-center gap-4">
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
              <Button type="button" onClick={() => importInputRef.current?.click()} disabled={isImporting || isDemo} className="h-10 rounded-none bg-[#424934] px-4">
                {isImporting ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />}
                {isImporting ? 'Importando...' : 'Importar Excel'}
              </Button>
              {invitations[0] && (
                <a href={`/i/${invitations[0].slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-[#4c513d] underline underline-offset-4">
                  Ver una invitacion <ExternalLink size={15} />
                </a>
              )}
            </div>
          </div>

          {(importMessage || importError) && (
            <div className={`mt-5 flex items-center gap-2 border px-4 py-3 text-sm ${importError ? 'border-[#d7a89f] bg-[#f6e3df] text-[#8b453b]' : 'border-[#aac495] bg-[#e7f0df] text-[#416337]'}`}>
              <FileSpreadsheet size={17} />
              {importError || importMessage}
            </div>
          )}

          <section className="mt-8 grid grid-cols-2 border-y border-[#d8d0bf] sm:grid-cols-5">
            <div className="border-b border-r border-[#d8d0bf] px-4 py-5 sm:border-b-0">
              <p className="text-xs uppercase text-[#6e735f]">Invitaciones</p>
              <p className="font-display mt-2 text-3xl leading-none">{metrics.invitations}</p>
            </div>
            <div className="border-b border-[#d8d0bf] px-4 py-5 sm:border-b-0 sm:border-r">
              <p className="text-xs uppercase text-[#6e735f]">Cupo total</p>
              <p className="font-display mt-2 text-3xl leading-none">{metrics.people}</p>
            </div>
            <div className="border-r border-[#d8d0bf] px-4 py-5">
              <p className="text-xs uppercase text-[#6e735f]">Confirmados</p>
              <p className="font-display mt-2 text-3xl leading-none text-[#527145]">{metrics.accepted}</p>
            </div>
            <div className="px-4 py-5">
              <p className="text-xs uppercase text-[#6e735f]">Pendientes</p>
              <p className="font-display mt-2 text-3xl leading-none text-[#9a7723]">{metrics.pending}</p>
            </div>
            <div className="border-t border-[#d8d0bf] px-4 py-5 sm:border-l sm:border-t-0">
              <p className="text-xs uppercase text-[#6e735f]">No asistiran</p>
              <p className="font-display mt-2 text-3xl leading-none text-[#9a5148]">{metrics.declined}</p>
            </div>
          </section>

          <section className="mt-8">
            <div className="flex flex-col gap-4 border-b border-[#d8d0bf] pb-5 md:flex-row md:items-center md:justify-between">
              <div className="relative max-w-md flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#78805e]" size={17} />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar invitado o familia"
                  className="h-10 rounded-none border-[#c9c0af] bg-[#fffaf0] pl-10"
                />
              </div>
              <div className="flex overflow-x-auto border border-[#c9c0af] bg-[#fffaf0]">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value)}
                    className={`h-9 shrink-0 border-r border-[#c9c0af] px-3 text-sm last:border-r-0 ${statusFilter === option.value ? 'bg-[#424934] text-[#fffaf0]' : 'text-[#5c614d] hover:bg-[#ece6da]'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 border border-[#d8d0bf] bg-[#fffaf0]">
              <Table>
                <TableHeader className="bg-[#ece6da]/60">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="hover:bg-transparent">
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="h-11 px-4">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-[#f8f4eb]">
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="px-4 py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-32 text-center text-sm text-[#6e735f]">
                        No hay invitaciones que coincidan con la busqueda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <div className="mt-6 flex items-center gap-2 text-sm text-[#6e735f]">
            <Users size={17} className="text-[#78805e]" />
            <span>{filteredInvitations.length} registros visibles</span>
          </div>
        </div>
      </main>

      <InvitationEditor
        key={editing?.id ?? 'closed'}
        invitation={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setInvitations((items) => items.map((item) => (item.id === updated.id ? updated : item)));
        }}
      />
    </TooltipProvider>
  );
}
