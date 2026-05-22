/**
 * @fileoverview Centralized i18n accessors and page translation utility.
 */

import { IS_CHROME } from '../lib/chrome-env.js';

/**
 * Retrieves the localized string for the given key and substitutions.
 * @param {string} key
 * @param {string | string[]} [substitutions]
 * @returns {string}
 */
export function get(key, substitutions) {
  if (IS_CHROME && chrome.i18n) {
    return chrome.i18n.getMessage(key, substitutions) || key;
  }
  return key;
}

/**
 * Translates the entire popup page using elements with data-i18n attribute.
 */
export function translatePage() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (key) {
      element.textContent = get(key);
    }
  });
}
