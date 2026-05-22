/**
 * @fileoverview Chrome extension runtime environment detection.
 */

/**
 * Whether the Chrome extension APIs are available in the current context.
 * @type {boolean}
 */
export const IS_CHROME = typeof chrome !== 'undefined';
