/**
 * @fileoverview Extensible document formatting registry.
 */

import { get as t } from '../i18n/messages.js';
import { ok, err } from './result.js';

/**
 * @typedef {Object} FormatterOptions
 * @property {boolean} includeTimestamps
 */

/** @type {Record<string, FormatterFunction>} */
const registry = {};

/**
 * Registers a new document formatter function.
 * @param {string} formatName
 * @param {FormatterFunction} formatterFn
 */
export function registerFormatter(formatName, formatterFn) {
  registry[formatName] = formatterFn;
}

/**
 * Formats the transcript data using a registered formatter.
 * @param {string} formatName
 * @param {TranscriptRow[]} data
 * @param {string} videoTitle
 * @param {FormatterOptions} options
 * @returns {Result<string>}
 */
export function format(formatName, data, videoTitle, options) {
  const formatter = registry[formatName];
  if (!formatter) {
    return err(`No formatter registered for type: ${formatName}`);
  }
  return ok(formatter(data, videoTitle, options));
}

// Register Built-in Markdown Formatter
registerFormatter('md', (data, videoTitle, options) => {
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let content = `# ${t('headerDocTitle')}\n\n`;
  content += `## ${t('headerVideoLabel')}: **${videoTitle}**\n\n`;
  content += `> ${t('exportedOn', [dateStr])}\n\n`;
  content += `---\n\n`;

  data.forEach((line) => {
    content += options.includeTimestamps && line.timestamp
      ? `**[${line.timestamp}]** ${line.text}\n\n`
      : `${line.text}\n\n`;
  });

  return content;
});

// Register Built-in Plain Text Formatter
registerFormatter('txt', (data, videoTitle, options) => {
  let content = '';
  data.forEach((line) => {
    content += options.includeTimestamps && line.timestamp
      ? `[${line.timestamp}] ${line.text}\n`
      : `${line.text}\n`;
  });
  return content;
});
