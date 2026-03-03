/**
 * Helpers for normalizing and validating comments (dedupe workflows).
 */

/**
 * Lowercase and collapse whitespace for comment comparison.
 */
export function normalizeComment(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Basic heuristic to filter out empty/very short comments.
 */
export function isValidComment(text: string, minLen: number = 10): boolean {
  return Boolean(text && text.trim().length >= minLen);
}
