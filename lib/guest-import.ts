export type GuestImportEntry = {
  name: string;
  gender: string | null;
  source: 'Invitados Larissa' | 'Invitados Luis';
  color: string | null;
};

export type ImportedInvitation = {
  importKey: string;
  recipientName: string;
  householdName: string | null;
  maxGuests: number;
  sourceLabel: string;
  members: Array<{ name: string; gender: string | null }>;
};

const colorLabels: Record<string, string> = {
  FFFF00: 'Grupo amarillo',
  FF99CC: 'Grupo rosa',
  FFCC00: 'Grupo dorado',
  '99CC00': 'Grupo verde',
  '99CCFF': 'Grupo celeste',
  CC99FF: 'Grupo lila',
  FF0000: 'Grupo rojo',
};

const relationshipAliases: Record<string, string> = {
  gaby: 'gabriela',
};

const relationshipPattern = /\((?:novio|novia|esposo|esposa)\s+de\s+([^)]+)\)/i;

function cleanName(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalize(value: string) {
  return cleanName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function visibleName(name: string) {
  return cleanName(name.replace(/\s*\([^)]*\)/g, ''));
}

function firstMeaningfulName(name: string) {
  const ignored = new Set(['tia', 'tio', 'abuela', 'abuelo', 'mama', 'papa']);
  return normalize(visibleName(name))
    .split(' ')
    .find((part) => part && !ignored.has(part)) ?? '';
}

function surname(name: string) {
  const parts = normalize(visibleName(name)).split(' ').filter(Boolean);
  const honorifics = new Set(['tia', 'tio', 'abuela', 'abuelo']);
  if (honorifics.has(parts[0] ?? '') && parts.length < 3) return '';
  return parts.length > 1 ? parts.at(-1) ?? '' : '';
}

function formatName(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function sourceLabel(source: GuestImportEntry['source'], color: string | null) {
  const label = color ? colorLabels[color.toUpperCase()] : null;
  return label ? `${source} · ${label}` : source;
}

function resolveRelationTarget(entries: GuestImportEntry[], index: number) {
  const relationship = entries[index].name.match(relationshipPattern)?.[1];
  if (!relationship) return null;

  const reference = relationshipAliases[firstMeaningfulName(relationship)] ?? firstMeaningfulName(relationship);
  if (!reference) return null;

  const matches = entries
    .map((entry, candidateIndex) => ({ entry, candidateIndex }))
    .filter(({ entry, candidateIndex }) => (
      candidateIndex !== index &&
      entry.source === entries[index].source &&
      firstMeaningfulName(entry.name) === reference
    ));

  return matches.length === 1 ? matches[0].candidateIndex : null;
}

export function buildImportedInvitations(entries: GuestImportEntry[]): ImportedInvitation[] {
  const normalizedEntries = entries
    .map((entry) => ({
      ...entry,
      name: cleanName(entry.name),
      gender: entry.gender?.trim().toUpperCase() ?? null,
      color: entry.color?.toUpperCase() ?? null,
    }))
    .filter((entry) => entry.name && (entry.gender === 'F' || entry.gender === 'M'));

  const parents = normalizedEntries.map((_, index) => index);
  const find = (index: number): number => {
    if (parents[index] !== index) parents[index] = find(parents[index]);
    return parents[index];
  };
  const join = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };

  const householdsBySurname = new Map<string, number[]>();
  normalizedEntries.forEach((entry, index) => {
    const lastName = surname(entry.name);
    if (!lastName) return;
    const key = `${entry.source}:${lastName}`;
    const members = householdsBySurname.get(key) ?? [];
    members.push(index);
    householdsBySurname.set(key, members);
  });

  for (const household of householdsBySurname.values()) {
    if (household.length < 2) continue;
    household.slice(1).forEach((member) => join(household[0], member));
  }

  normalizedEntries.forEach((_, index) => {
    const target = resolveRelationTarget(normalizedEntries, index);
    if (target !== null) join(index, target);
  });

  const households = new Map<number, Array<GuestImportEntry & { index: number }>>();
  normalizedEntries.forEach((entry, index) => {
    const root = find(index);
    const members = households.get(root) ?? [];
    members.push({ ...entry, index });
    households.set(root, members);
  });

  return [...households.values()]
    .map((members) => {
      const surnameCounts = new Map<string, number>();
      members.forEach((member) => {
        const lastName = surname(member.name);
        if (lastName) surnameCounts.set(lastName, (surnameCounts.get(lastName) ?? 0) + 1);
      });
      const primarySurname = [...surnameCounts.entries()]
        .sort((left, right) => right[1] - left[1])[0]?.[0];
      const recipientName = members.length > 1 && primarySurname
        ? `Familia ${formatName(primarySurname)}`
        : members.length > 1
          ? members.map((member) => formatName(firstMeaningfulName(member.name))).join(' y ')
          : members[0].name;
      const memberNames = members.map((member) => normalize(member.name)).sort();
      const importKey = `${members[0].source}:${memberNames.join('|')}`;

      return {
        importKey,
        recipientName,
        householdName: members.length > 1 ? recipientName : null,
        maxGuests: members.length,
        sourceLabel: sourceLabel(members[0].source, members[0].color),
        members: members.map(({ name, gender }) => ({ name, gender })),
        firstIndex: Math.min(...members.map((member) => member.index)),
      };
    })
    .sort((left, right) => left.firstIndex - right.firstIndex)
    .map(({ firstIndex: _firstIndex, ...invitation }) => invitation);
}
