export function missingHint(missing: readonly string[], purpose: string): string | null {
  if (missing.length === 0) return null;
  const last = missing[missing.length - 1];
  const list = missing.length === 1 ? last : `${missing.slice(0, -1).join(", ")} and ${last}`;
  return `Fill ${list} to ${purpose}.`;
}
