/**
 * Timing-safe comparison.
 *
 * A plain `===` on a secret leaks its length and its matching prefix through
 * how long the comparison takes. The window is small over a network, but the
 * fix costs nothing.
 */
export function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
