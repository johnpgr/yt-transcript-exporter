/**
 * YouTube Transcript Exporter - Popup Controller
 *
 * Manages states, triggers tab communication, handles automatic script injection,
 * formats transcripts (TXT/MD), and executes file downloads.
 */

const raise = (/** @type {string} */ message) => {
  throw new Error(message);
}

document.addEventListener("DOMContentLoaded", () => {
  const timestampToggle = /** @type {HTMLInputElement} */ (document.getElementById("timestampToggle") ?? raise("Timestamp toggle element not found"));
  const formatTxt = /** @type {HTMLInputElement} */ (document.getElementById("formatTxt") ?? raise("TXT format radio element not found"));
  const formatMd = /** @type {HTMLInputElement} */ (document.getElementById("formatMd") ?? raise("MD format radio element not found"));
  const exportBtn = /** @type {HTMLButtonElement} */ (document.getElementById("exportBtn") ?? raise("Export button element not found"));
  const statusPanel = /** @type {HTMLDivElement} */ (document.getElementById("statusPanel") ?? raise("Status panel element not found"));
  const statusDot = /** @type {HTMLSpanElement} */ (document.getElementById("statusDot") ?? raise("Status dot element not found"));
  const logsContainer = /** @type {HTMLDivElement} */ (document.getElementById("logsContainer") ?? raise("Logs container element not found"));

  // Retrieve saved preferences from Chrome storage
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(
      ["includeTimestamps", "exportFormat"],
      (result) => {
        if (result.includeTimestamps != null) {
          timestampToggle.checked = Boolean(result.includeTimestamps);
        }
        if (result.exportFormat === "txt") {
          formatTxt.checked = true;
        } else if (result.exportFormat === "md") {
          formatMd.checked = true;
        }
      },
    );
  }

  // Save changes to storage to preserve state
  function savePreferences() {
    if (chrome.storage && chrome.storage.local) {
      const format = formatTxt.checked ? "txt" : "md";
      chrome.storage.local.set({
        includeTimestamps: timestampToggle.checked,
        exportFormat: format,
      });
    }
  }

  // Attach event listeners for setting updates
  timestampToggle.addEventListener("change", savePreferences);
  formatTxt.addEventListener("change", savePreferences);
  formatMd.addEventListener("change", savePreferences);

  // Trigger transcript export sequence
  exportBtn.addEventListener("click", async () => {
    // Reset status drawer and display it
    logsContainer.innerHTML = "";
    statusPanel.classList.remove("collapsed");
    updateStatus("active");
    addLog("Finding active YouTube watch tab...", "working");

    try {
      // Query the currently active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) {
        throw new Error("No active browser window/tab detected.");
      }

      // Verify page is a YouTube Watch URL
      if (!tab.url || !tab.url.includes("youtube.com/watch")) {
        throw new Error(
          "Active tab is not a YouTube video page. Please open a video first.",
        );
      }

      if (tab.id === undefined) {
        throw new Error("Active tab ID is invalid.");
      }

      addLog("Contacting YouTube page scraper...", "working");
      sendMessageWithInjectionFallback(tab.id);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      addLog(errMsg, "error");
      updateStatus("error");
    }
  });

  /**
   * Sets the visual state of the pulsing indicator dot
   * @param {string} state
   */
  function updateStatus(state) {
    statusDot.className = `status-indicator-dot ${state}`;
  }

  /**
   * Appends an entry line to the logger console
   * @param {string | null} text
   */
  function addLog(text, className = "") {
    const entry = document.createElement("div");
    entry.className = `log-entry ${className}`;
    entry.textContent = text;
    logsContainer.appendChild(entry);

    // Auto-scroll to the bottom of logs
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  /**
   * Sends extraction command to content script.
   * If the tab has no content script loaded, injects it programmatically.
   * @param {number} tabId
   */
  function sendMessageWithInjectionFallback(tabId) {
    chrome.tabs.sendMessage(
      tabId,
      { action: "extractTranscript" },
      (/** @type {any} */ response) => {
        // Detect if content script is missing/unloaded
        if (chrome.runtime.lastError) {
          addLog("Scraper not loaded. Injecting content script...", "info");

          // Dynamic execution injection
          chrome.scripting.executeScript(
            {
              target: { tabId: tabId },
              files: ["content.js"],
            },
            () => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Script injection error:",
                  chrome.runtime.lastError,
                );
                addLog(
                  "Could not initialize the scraper. Please reload your YouTube page.",
                  "error",
                );
                updateStatus("error");
              } else {
                addLog(
                  "Scraper loaded successfully. Restarting search...",
                  "success",
                );
                // Message again after minor initialization timeout
                setTimeout(() => {
                  chrome.tabs.sendMessage(
                    tabId,
                    { action: "extractTranscript" },
                    handleExtractionResponse,
                  );
                }, 300);
              }
            },
          );
        } else {
          handleExtractionResponse(response);
        }
      },
    );
  }

  /**
   * Processes data returned by content.js and compiles the file
   * @param {{ success?: any; error?: any; data?: any; videoTitle?: any; }} response
   */
  function handleExtractionResponse(response) {
    if (!response) {
      addLog(
        "No response from the page. Please reload the YouTube tab.",
        "error",
      );
      updateStatus("error");
      return;
    }

    if (!response.success) {
      addLog(response.error || "Failed to locate transcript.", "error");
      updateStatus("error");
      return;
    }

    const { data, videoTitle } = response;
    if (!data || data.length === 0) {
      addLog("No lines found inside the transcript.", "error");
      updateStatus("error");
      return;
    }

    addLog(`Extracted ${data.length} transcript rows successfully!`, "success");

    const includeTimestamps = timestampToggle.checked;
    const format = formatTxt.checked ? "txt" : "md";

    addLog(`Assembling ${format.toUpperCase()} export data...`, "working");

    let fileContent = "";
    const dateStr = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (format === "md") {
      // Beautiful Markdown compilation
      fileContent += `# YouTube Transcript Exporter\n\n`;
      fileContent += `## Video: **${videoTitle}**\n\n`;
      fileContent += `> Exported on ${dateStr}\n\n`;
      fileContent += `---\n\n`;

      data.forEach((/** @type {{ timestamp: any; text: any; }} */ line) => {
        if (includeTimestamps && line.timestamp) {
          // Bolded brackets format for timestamps
          fileContent += `**[${line.timestamp}]** ${line.text}\n\n`;
        } else {
          fileContent += `${line.text}\n\n`;
        }
      });
    } else {
      // Plain text compilation
      data.forEach((/** @type {{ timestamp: any; text: any; }} */ line) => {
        if (includeTimestamps && line.timestamp) {
          fileContent += `[${line.timestamp}] ${line.text}\n`;
        } else {
          fileContent += `${line.text}\n`;
        }
      });
    }

    addLog("Launching browser file download...", "working");
    triggerDownload(fileContent, videoTitle, format);
  }

  /**
   * Generates a safe filename and downloads the file as a Blob
   * @param {BlobPart} content
   * @param {string} title
   * @param {string} extension
   */
  function triggerDownload(content, title, extension) {
    // Remove invalid characters for OS filenames
    const sanitizedTitle = title
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 100);

    const filename = `${sanitizedTitle}_transcript.${extension}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);

    const downloadLink = document.createElement("a");
    downloadLink.href = blobUrl;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();

    // Cleanup reference
    setTimeout(() => {
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobUrl);
      addLog("Download complete! File saved.", "success");
      updateStatus("success");
    }, 200);
  }
});
