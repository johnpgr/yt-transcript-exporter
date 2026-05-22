/**
 * @fileoverview Coordination of transcript extraction with the active tab.
 */

import { get as t } from "../i18n/messages.js";
import { ok, err } from "./result.js";

/**
 * Processes the extraction response and returns a result.
 * @param {any} response
 * @returns {Result<{ data: TranscriptRow[], videoTitle: string }>}
 */
function handleResponse(response) {
  if (!response) {
    return err(t("noResponse"));
  }

  if (!response.success) {
    return err(response.error || t("extractionFailed"));
  }

  const { data, videoTitle } = response;
  if (!data || data.length === 0) {
    return err(t("noLinesFound"));
  }

  return ok({ data, videoTitle });
}

/**
 * Applies progress feedback and settles the promise with the result.
 * @param {Result<{ data: TranscriptRow[], videoTitle: string }>} result
 * @param {(text: string, level: string) => void} onProgress
 * @param {(result: Result<{ data: TranscriptRow[], videoTitle: string }>) => void} resolve
 */
function settleResult(result, onProgress, resolve) {
  if (result.ok) {
    onProgress(t("extractedRows", [String(result.value.data.length)]), "success");
    resolve(result);
    return;
  }

  onProgress(result.error, "error");
  resolve(result);
}

/**
 * Initiates the transcript extraction from the specified tab.
 * @param {number} tabId
 * @param {(text: string, level: string) => void} onProgress
 * @returns {Promise<Result<{ data: TranscriptRow[], videoTitle: string }>>}
 */
export function requestTranscript(tabId, onProgress) {
  return new Promise((resolve) => {
    onProgress(t("contactingScraper"), "working");

    /**
     * Sends the extract command. Injects the content script as fallback.
     */
    function sendWithFallback() {
      chrome.tabs.sendMessage(
        tabId,
        { action: "extractTranscript" },
        (response) => {
          if (!chrome.runtime.lastError) {
            settleResult(handleResponse(response), onProgress, resolve);
            return;
          }

          onProgress(t("scraperNotLoaded"), "info");
          chrome.scripting.executeScript(
            {
              target: { tabId: tabId },
              files: ["src/content.js"],
            },
            () => {
              if (!chrome.runtime.lastError) {
                onProgress(t("scraperSuccess"), "success");
                setTimeout(() => {
                  chrome.tabs.sendMessage(
                    tabId,
                    { action: "extractTranscript" },
                    (retryResponse) => {
                      if (!chrome.runtime.lastError) {
                        settleResult(handleResponse(retryResponse), onProgress, resolve);
                        return;
                      }

                      resolve(err(t("initError")));
                    },
                  );
                }, 300);

                return;
              }

              console.error(
                "Content script injection failed:",
                chrome.runtime.lastError,
              );
              resolve(err(t("initError")));
            },
          );
        },
      );
    }

    sendWithFallback();
  });
}