/**
 * @fileoverview User preferences management wrapper for Chrome storage.
 */

import { IS_CHROME } from './chrome-env.js';

/**
 * @typedef {Object} Preferences
 * @property {boolean} includeTimestamps
 * @property {string} exportFormat
 */

/** @type {Preferences} */
const DEFAULTS = {
  includeTimestamps: true,
  exportFormat: 'md'
};

/**
 * Loads the saved user preferences.
 * @returns {Promise<Preferences>}
 */
export function load() {
  return new Promise((resolve) => {
    if (IS_CHROME && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(
        ['includeTimestamps', 'exportFormat'],
        (result) => {
          resolve({
            includeTimestamps: result.includeTimestamps !== undefined ? Boolean(result.includeTimestamps) : DEFAULTS.includeTimestamps,
            exportFormat: typeof result.exportFormat === 'string' ? result.exportFormat : DEFAULTS.exportFormat
          });
        }
      );
      return;
    }

    resolve({ ...DEFAULTS });
  });
}

/**
 * Saves the user preferences.
 * @param {Preferences} prefs
 * @returns {Promise<void>}
 */
export function save(prefs) {
  return new Promise((resolve) => {
    if (IS_CHROME && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(prefs, () => {
        resolve();
      });
      return;
    }

    resolve();
  });
}
