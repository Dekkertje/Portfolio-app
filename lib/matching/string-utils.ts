/**
 * Shared string similarity utilities for matching broker instrument names
 * to securities database entries.
 */

/**
 * Computes the Levenshtein edit distance between two strings.
 * Uses a single-row DP approach (O(min(m,n)) space).
 */
export function levenshteinDistance(a: string, b: string): number {
  // Always iterate over the shorter string as the inner loop
  if (a.length < b.length) return levenshteinDistance(b, a)

  const costs: number[] = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    let prev = i
    for (let j = 1; j <= b.length; j++) {
      const val = costs[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      const next = Math.min(val, prev + 1, costs[j] + 1)
      costs[j - 1] = prev
      prev = next
    }
    costs[b.length] = prev
  }

  return costs[b.length]
}

/**
 * Returns a similarity score in [0, 1] based on Levenshtein distance.
 * 1.0 = identical, 0.0 = completely different.
 *
 * Also rewards exact substring containment so that e.g.
 * "ASML" inside "ASML HOLDING NV" scores higher than pure edit distance.
 */
export function similarity(s1: string, s2: string): number {
  const a = s1.trim().toUpperCase()
  const b = s2.trim().toUpperCase()

  if (a === b) return 1.0
  if (a.length === 0 || b.length === 0) return 0.0

  // Substring bonus: if one is fully contained in the other
  const longer  = a.length >= b.length ? a : b
  const shorter = a.length >= b.length ? b : a
  if (longer.includes(shorter)) {
    // Scale bonus by relative length to avoid short tokens over-matching
    return 0.7 + 0.3 * (shorter.length / longer.length)
  }

  const dist = levenshteinDistance(a, b)
  return (longer.length - dist) / longer.length
}

/**
 * Normalises a broker product name before matching:
 * strips legal suffixes, extra whitespace, and common noise tokens.
 *
 * e.g. "ASML HOLDING NV CLASS A" → "ASML HOLDING"
 */
export function normaliseName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(
      /\b(N\.?V\.?|INC\.?|CORP\.?|PLC\.?|LTD\.?|LLC\.?|S\.?A\.?|B\.?V\.?|AG\.?|SE\.?)\b/g,
      ""
    )
    .replace(/\b(CLASS [A-Z]|COMMON STOCK|ORDINARY SHARES?|REGISTERED SHARES?|DIST|ACC)\b/g, "")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

/**
 * Returns the best similarity score between `query` and any of `candidates`,
 * using both raw and normalised forms.
 */
export function bestNameScore(query: string, candidates: string[]): number {
  const normQuery = normaliseName(query)
  return candidates.reduce((best, c) => {
    const raw  = similarity(query, c)
    const norm = similarity(normQuery, normaliseName(c))
    return Math.max(best, raw, norm)
  }, 0)
}
