/**
 * Player-name normalization, shared by the pool merge, the ESPN league
 * adapter, the injury overlay, and the roster-import matcher.
 *
 * One pipeline, one place: name matching silently breaks across adapters
 * the day someone tweaks the suffix regex in only one file.
 */
const SUFFIX = /\s+(jr|sr|ii|iii|iv|v)\.?$/i;

/** Lowercase, strip punctuation/suffixes, collapse whitespace. */
export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'`’-]/g, "")
    .replace(SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** `normalized-name|POSITION` join key used to line adapters up. */
export function playerNameKey(name: string, position: string): string {
  return `${normalizePlayerName(name)}|${position}`;
}
