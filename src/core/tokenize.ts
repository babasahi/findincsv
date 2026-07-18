/** Split an already-normalized string into whitespace-separated tokens. */
export function tokenize(normalized: string): string[] {
  if (normalized.length === 0) return [];
  const out: string[] = [];
  for (const t of normalized.split(' ')) {
    if (t.length > 0) out.push(t);
  }
  return out;
}
