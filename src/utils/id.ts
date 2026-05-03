export function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes / jsdom (sufficient for V1 — non-cryptographic but unique enough)
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
