/** Parse "owner/name" into { owner, name }. Returns null if invalid. */
export function parseRepo(fullName: string): { owner: string; name: string } | null {
  const idx = fullName.indexOf('/');
  if (idx <= 0 || idx === fullName.length - 1) return null;
  return { owner: fullName.slice(0, idx), name: fullName.slice(idx + 1) };
}
