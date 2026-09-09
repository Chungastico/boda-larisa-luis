export type SeatingTable = {
  name: string;
  capacity: number;
  color: string;
};

// Las capacidades reflejan el plano original. Las mesas 1 y 2 conservan los
// espacios disponibles anotados en el Excel (1 y 2, respectivamente).
export const seatingTables: SeatingTable[] = [
  { name: 'Mesa 1', capacity: 10, color: '#74c7e6' },
  { name: 'Mesa 2', capacity: 11, color: '#ef8ac2' },
  { name: 'Mesa 3', capacity: 11, color: '#b75ceb' },
  { name: 'Mesa 4', capacity: 6, color: '#92cc49' },
  { name: 'Mesa 5', capacity: 12, color: '#f4dc3f' },
  { name: 'Mesa 6', capacity: 12, color: '#e6a936' },
  { name: 'Mesa central', capacity: 3, color: '#ef534d' },
];

export function isSeatingTableName(value: string | null | undefined) {
  return Boolean(value && seatingTables.some((table) => table.name === value));
}
