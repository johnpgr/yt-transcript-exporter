/**
 * @fileoverview Main entry point and orchestrator for the YouTube Transcript Exporter popup.
 * Wires DOM events, state persistence, extraction coordinating, and format compilation.
 */

import * as i18n from "./i18n/messages.js";
import * as dom from "./lib/dom.js";
import { IS_CHROME } from "./lib/chrome-env.js";
import * as preferences from "./lib/preferences.js";
import * as transcript from "./lib/transcript.js";
import * as formatters from "./lib/formatters.js";
import * as download from "./lib/download.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Translate page to browser locale first
  i18n.translatePage();

  const timestampToggleResult = dom.requireElement(
    "timestampToggle",
    HTMLInputElement,
  );
  if (!timestampToggleResult.ok) {
    console.error(timestampToggleResult.error);
    return;
  }
  const timestampToggle = timestampToggleResult.value;

  const formatTxtResult = dom.requireElement("formatTxt", HTMLInputElement);
  if (!formatTxtResult.ok) {
    console.error(formatTxtResult.error);
    return;
  }
  const formatTxt = formatTxtResult.value;

  const formatMdResult = dom.requireElement("formatMd", HTMLInputElement);
  if (!formatMdResult.ok) {
    console.error(formatMdResult.error);
    return;
  }
  const formatMd = formatMdResult.value;

  const exportBtnResult = dom.requireElement("exportBtn", HTMLButtonElement);
  if (!exportBtnResult.ok) {
    console.error(exportBtnResult.error);
    return;
  }
  const exportBtn = exportBtnResult.value;

  const statusPanelResult = dom.requireElement("statusPanel", HTMLDivElement);
  if (!statusPanelResult.ok) {
    console.error(statusPanelResult.error);
    return;
  }
  const statusPanel = statusPanelResult.value;

  const statusDotResult = dom.requireElement("statusDot", HTMLSpanElement);
  if (!statusDotResult.ok) {
    console.error(statusDotResult.error);
    return;
  }
  const statusDot = statusDotResult.value;

  const logsContainerResult = dom.requireElement(
    "logsContainer",
    HTMLDivElement,
  );
  if (!logsContainerResult.ok) {
    console.error(logsContainerResult.error);
    return;
  }
  const logsContainer = logsContainerResult.value;

  // Load and apply saved preferences (never throws)
  const prefs = await preferences.load();
  timestampToggle.checked = prefs.includeTimestamps;
  formatTxt.checked = prefs.exportFormat === "txt";
  formatMd.checked = prefs.exportFormat !== "txt";

  /**
   * Reads settings from the DOM and persists them (never throws).
   */
  async function saveSettings() {
    await preferences.save({
      includeTimestamps: timestampToggle.checked,
      exportFormat: formatTxt.checked ? "txt" : "md",
    });
  }

  // Wires change listeners
  timestampToggle.addEventListener("change", saveSettings);
  formatTxt.addEventListener("change", saveSettings);
  formatMd.addEventListener("change", saveSettings);

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
    const log = document.createElement("div");
    log.className = `log-entry ${level}`;
    log.textContent = text;
    logsContainer.appendChild(log);
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  // Run the export workflow
  exportBtn.addEventListener("click", async () => {
    logsContainer.innerHTML = "";
    statusPanel.classList.remove("collapsed");
    updateStatusIndicator("active");

    addLogEntry(i18n.get("findingTab"), "working");

    if (!IS_CHROME || !chrome.tabs) {
      addLogEntry(i18n.get("noActiveTab"), "error");
      updateStatusIndicator("error");
      return;
    }

    /** @type {chrome.tabs.Tab | undefined} */
    let tab;
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      tab = tabs[0];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      addLogEntry(msg, "error");
      updateStatusIndicator("error");
      return;
    }

    if (!tab) {
      addLogEntry(i18n.get("noActiveTab"), "error");
      updateStatusIndicator("error");
      return;
    }

    if (!tab.url || !tab.url.includes("youtube.com/watch")) {
      addLogEntry(i18n.get("notWatchPage"), "error");
      updateStatusIndicator("error");
      return;
    }

    if (tab.id === undefined) {
      addLogEntry(i18n.get("invalidTabId"), "error");
      updateStatusIndicator("error");
      return;
    }

    // 2. Request extraction data via content helper coordinator
    const transcriptResult = await transcript.requestTranscript(
      tab.id,
      addLogEntry,
    );
    if (!transcriptResult.ok) {
      updateStatusIndicator("error");
      return;
    }

    const { data, videoTitle } = transcriptResult.value;

    // 3. Compile output file format from registry
    const includeTimestamps = timestampToggle.checked;
    const formatType = formatTxt.checked ? "txt" : "md";

    addLogEntry(
      i18n.get("assemblingExport", [formatType.toUpperCase()]),
      "working",
    );
    const formatResult = formatters.format(formatType, data, videoTitle, {
      includeTimestamps,
    });
    if (!formatResult.ok) {
      addLogEntry(formatResult.error, "error");
      updateStatusIndicator("error");
      return;
    }

    // 4. Fire download blob to local downloads directory
    addLogEntry(i18n.get("launchingDownload"), "working");
    const sanitizedName = download.sanitizeFilename(videoTitle);
    const filename = `${sanitizedName}_transcript.${formatType}`;

    await download.downloadTextFile(formatResult.value, filename);

    addLogEntry(i18n.get("downloadComplete"), "success");
    updateStatusIndicator("success");
  });
});
