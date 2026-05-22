/**
 * @fileoverview DOM interaction utilities.
 */

import { ok, err } from './result.js';

/**
 * Safe wrapper to find and cast a DOM element or return an error result if missing.
 * @template {HTMLElement} T
 * @param {string} id
 * @param {new () => T} T
 * @returns {Result<T>}
 */
export function requireElement(id, T) {
  const el = document.getElementById(id);
  if (!el) {
    return err(`DOM Element with id "${id}" was not found.`);
  }
  if (!(el instanceof T)) {
    return err(`DOM Element with id "${id}" is not an instance of ${T.name}.`);
  }
  return ok(el);
}