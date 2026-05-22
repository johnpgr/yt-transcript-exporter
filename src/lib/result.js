/**
 * @fileoverview Result type factories for errors-as-values control flow.
 */

/**
 * Constructs a successful result.
 * @template T
 * @param {T} value
 * @returns {Result<T>}
 */
export function ok(value) {
  return { ok: true, value };
}

/**
 * Constructs a failed result.
 * @param {string} error
 * @returns {Result<never>}
 */
export function err(error) {
  return { ok: false, error };
}