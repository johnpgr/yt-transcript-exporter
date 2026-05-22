/**
 * @fileoverview Coordination of transcript extraction with the active tab.
 */

import { get as t } from "../i18n/messages.js";

/**
 * Initiates the transcript extraction from the specified tab.
 * @param {number} tabId
 * @param {(text: string, level: string) => void} onProgress
 * @returns {Promise<{ data: TranscriptRow[], videoTitle: string }>} Resolves with extraction data.
 */
export function requestTranscript(tabId, onProgress) {
  return new Promise((resolve, reject) => {
    onProgress(t("contactingScraper"), "working");

    /**
     * Callback handling the extraction message response.
     * @param {any} response
     */
    function handleResponse(response) {
      if (!response) {
        onProgress(t("noResponse"), "error");
        reject(new Error(t("noResponse")));
        return;
      }

      if (!response.success) {
        const errorMsg = response.error || t("extractionFailed");
        onProgress(errorMsg, "error");
        reject(new Error(errorMsg));
        return;
      }

      const { data, videoTitle } = response;
      if (!data || data.length === 0) {
        onProgress(t("noLinesFound"), "error");
        reject(new Error(t("noLinesFound")));
        return;
      }

      onProgress(t("extractedRows", [String(data.length)]), "success");
      resolve({ data, videoTitle });
    }

    /**
     * Sends the extract command. Injects the content script as fallback.
     */
    function sendWithFallback() {
      chrome.tabs.sendMessage(
        tabId,
        { action: "extractTranscript" },
        (response) => {
          if (!chrome.runtime.lastError) {
            handleResponse(response);
            return;
          }

          onProgress(t("scraperNotLoaded"), "info");
          // Inject script dynamically (Paths here are relative to the extension root directory)
          chrome.scripting.executeScript(
            {
              target: { tabId: tabId },
              files: ["src/content.js"],
            },
            () => {
              if (!chrome.runtime.lastError) {
                onProgress(t("scraperSuccess"), "success");
                // Retry with a small delay for initialization
                setTimeout(() => {
                  chrome.tabs.sendMessage(
                    tabId,
                    { action: "extractTranscript" },
                    handleResponse,
                  );
                }, 300);

                return;
              }

              console.error(
                "Content script injection failed:",
                chrome.runtime.lastError,
              );
              onProgress(t("initError"), "error");
              reject(new Error(t("initError")));
            },
          );
        },
      );
    }

    sendWithFallback();
  });
}
