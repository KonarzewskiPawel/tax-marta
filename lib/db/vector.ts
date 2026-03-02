/**
 * Convert a numeric array into a pgvector-compatible string literal.
 *
 * pgvector expects vectors in the format `[0.1,0.2,0.3]`.
 * This function serializes a JavaScript number array into that format
 * for use in raw SQL queries.
 *
 * @param v - Array of numbers representing an embedding vector
 * @returns String in pgvector format, e.g. `"[0.1,0.2,0.3]"`
 */
export function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}
