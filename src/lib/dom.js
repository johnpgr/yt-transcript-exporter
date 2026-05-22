/**
 * @fileoverview DOM interaction utilities.
 */

/**
 * Safe wrapper to find and cast a DOM element or raise an error if missing.
 * @template {HTMLElement} T
 * @param {string} id
 * @param {new () => T} typeClass
 * @returns {T}
 * @throws {Error} If the element is not found or is of wrong type.
 */
export function requireElement(id, typeClass) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`DOM Element with id "${id}" was not found.`);
  }
  if (!(el instanceof typeClass)) {
    throw new Error(`DOM Element with id "${id}" is not an instance of ${typeClass.name}.`);
  }
  return el;
}
