/**
 * Deterministic, non-cryptographic string hash (FNV-1a) for cache keys.
 * Only used to fingerprint a JSON payload so identical AI-request context
 * maps to the same cache key — not for anything security-sensitive.
 */
export function stableHash(value: unknown): string {
  const str = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
