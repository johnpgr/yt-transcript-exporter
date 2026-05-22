/**
 * @fileoverview Main entry point and orchestrator for the YouTube Transcript Exporter popup.
 * Wires DOM events, state persistence, extraction coordinating, and format compilation.
 */

import * as i18n from './i18n/messages.js';
import * as dom from './lib/dom.js';
import * as preferences from './lib/preferences.js';
import * as transcript from './lib/transcript.js';
import * as formatters from './lib/formatters.js';
import * as download from './lib/download.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Translate page to browser locale first
  i18n.translatePage();

  // Acquired elements safely with typescript types
  const timestampToggle = dom.requireElement('timestampToggle', HTMLInputElement);
  const formatTxt = dom.requireElement('formatTxt', HTMLInputElement);
  const formatMd = dom.requireElement('formatMd', HTMLInputElement);
  const exportBtn = dom.requireElement('exportBtn', HTMLButtonElement);
  const statusPanel = dom.requireElement('statusPanel', HTMLDivElement);
  const statusDot = dom.requireElement('statusDot', HTMLSpanElement);
  const logsContainer = dom.requireElement('logsContainer', HTMLDivElement);

  // Load and apply saved preferences
  try {
    const prefs = await preferences.load();
    timestampToggle.checked = prefs.includeTimestamps;
    if (prefs.exportFormat === 'txt') {
      formatTxt.checked = true;
    } else {
      formatMd.checked = true;
    }
  } catch (err) {
    console.error('Failed to load preferences:', err);
  }

  /**
   * Reads settings from the DOM and persists them.
   */
  async function saveSettings() {
    try {
      await preferences.save({
        includeTimestamps: timestampToggle.checked,
        exportFormat: formatTxt.checked ? 'txt' : 'md'
      });
    } catch (err) {
      console.error('Failed to save preferences:', err);
    }
  }

  // Wires change listeners
  timestampToggle.addEventListener('change', saveSettings);
  formatTxt.addEventListener('change', saveSettings);
  formatMd.addEventListener('change', saveSettings);

  /**
   * Mutates the visual status indicator.
   * @param {'idle' | 'active' | 'success' | 'error'} state
   */
  function updateStatusIndicator(state) {
    statusDot.className = `status-indicator-dot ${state}`;
  }

  /**
   * Appends a safe log row entry to the logging container panel.
   * @param {string} text
   * @param {string} level
   */
  function addLogEntry(text, level) {
    const log = document.createElement('div');
    log.className = `log-entry ${level}`;
    log.textContent = text;
    logsContainer.appendChild(log);
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  // Run the export workflow
  exportBtn.addEventListener('click', async () => {
    logsContainer.innerHTML = '';
    statusPanel.classList.remove('collapsed');
    updateStatusIndicator('active');

    addLogEntry(i18n.get('findingTab'), 'working');

    try {
      if (typeof chrome === 'undefined' || !chrome.tabs) {
        throw new Error(i18n.get('noActiveTab'));
      }

      // 1. Fetch active window watched tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error(i18n.get('noActiveTab'));
      }

      if (!tab.url || !tab.url.includes('youtube.com/watch')) {
        throw new Error(i18n.get('notWatchPage'));
      }

      if (tab.id === undefined) {
        throw new Error(i18n.get('invalidTabId'));
      }

      // 2. Request extraction data via content helper coordinator
      const { data, videoTitle } = await transcript.requestTranscript(tab.id, addLogEntry);

      // 3. Compile output file format from registry
      const includeTimestamps = timestampToggle.checked;
      const formatType = formatTxt.checked ? 'txt' : 'md';

      addLogEntry(i18n.get('assemblingExport', [formatType.toUpperCase()]), 'working');
      const fileContent = formatters.format(formatType, data, videoTitle, { includeTimestamps });

      // 4. Fire download blob to local downloads directory
      addLogEntry(i18n.get('launchingDownload'), 'working');
      const sanitizedName = download.sanitizeFilename(videoTitle);
      const filename = `${sanitizedName}_transcript.${formatType}`;

      await download.downloadTextFile(fileContent, filename);

      addLogEntry(i18n.get('downloadComplete'), 'success');
      updateStatusIndicator('success');

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      addLogEntry(msg, 'error');
      updateStatusIndicator('error');
    }
  });
});
