/**
 * Map scraped course labels to known valid course codes.
 */

/**
 * Clean a single course label scraped from RMP (remove counts, trim).
 */
export function cleanCourseLabel(raw: string): string {
  const withoutCounts = raw.replace(/\(\d+\)/g, "");
  return withoutCounts.replace(/\s+/g, " ").trim();
}

/**
 * Rudimentary mapping from scraped labels -> known valid course codes.
 * Returns a map of scraped label -> set of matching valid codes (or null if ambiguous/unknown).
 */
export function buildCourseMapping(
  scrapedLabels: Iterable<string>,
  validCourses: Iterable<string>
): Map<string, Set<string> | null> {
  const validSet = new Set([...validCourses].map((vc) => vc.trim().toUpperCase()));
  const byNospace = new Map<string, string>();
  for (const vc of validSet) {
    byNospace.set(vc.replace(/\s/g, ""), vc);
  }

  const mapping = new Map<string, Set<string> | null>();

  for (const raw of scrapedLabels) {
    const cleaned = cleanCourseLabel(raw);
    const key = cleaned.replace(/\s/g, "").toUpperCase();

    if (byNospace.has(key)) {
      mapping.set(raw, new Set([byNospace.get(key)!]));
      continue;
    }

    const prefixMatch = key.match(/^[A-Z]+/);
    const numMatch = key.match(/(\d{3,4})/);
    const candidates = new Set<string>();
    if (prefixMatch && numMatch) {
      const prefix = prefixMatch[0];
      const num = numMatch[1];
      const candidate = `${prefix} ${num}`;
      if (validSet.has(candidate)) {
        candidates.add(candidate);
      }
    }
    mapping.set(raw, candidates.size > 0 ? candidates : null);
  }

  return mapping;
}
