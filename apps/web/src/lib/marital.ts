export type MaritalStatus = 'NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED';

export const MARITAL_OPTIONS: { value: MaritalStatus; label: string }[] = [
  { value: 'NEVER_MARRIED', label: 'Never married' },
  { value: 'DIVORCED', label: 'Divorced' },
  { value: 'WIDOWED', label: 'Widowed' },
];

export function formatMaritalLine(
  status: string | null,
  hasChildren: boolean | null,
  childrenCount: number | null,
): string | null {
  const label = MARITAL_OPTIONS.find(o => o.value === status)?.label;
  if (!label) return null;
  if (hasChildren === null || hasChildren === undefined) return label;
  let kids: string;
  if (!hasChildren) kids = 'No children';
  else if (childrenCount === null || childrenCount === undefined) kids = 'Has children';
  else kids = childrenCount === 1 ? '1 child' : `${childrenCount} children`;
  return `${label} · ${kids}`;
}
