/**
 * @fileoverview YouTube Transcript Exporter Content Script.
 * Injected into YouTube Watch tabs to query transcripts structurally or keyword-based,
 * wait for the DOM load sequence, and extract clean text and timestamp rows.
 */

(() => {
  // Listen for messages from the popup script
  chrome.runtime.onMessage.addListener(
    /**
     * @param {any} request
     * @param {chrome.runtime.MessageSender} sender
     * @param {(response?: any) => void} sendResponse
     */
    (request, sender, sendResponse) => {
      if (request.action === 'extractTranscript') {
        handleExtraction(sendResponse);
        return true; // Keep message channel open for asynchronous responses
      }
    }
  );

  /**
   * Orchestrates the description expansion, clicking, and extracting.
   * @param {(response?: any) => void} sendResponse
   */
  async function handleExtraction(sendResponse) {
    // 1. Verify Watch URL
    if (!window.location.pathname.includes('/watch')) {
      sendResponse({ success: false, error: 'Please navigate to a YouTube video page to export transcripts.' });
      return;
    }

    // 2. Query already open transcript panel
    let panel = getTranscriptPanel();
    let segments = panel ? panel.querySelectorAll('ytd-transcript-segment-renderer') : [];

    if (panel && segments.length > 0) {
      console.log('[Transcript Exporter] Transcript panel is already open. Scraping directly.');
      const data = extractTranscriptData(panel);
      sendResponse({ success: true, data, videoTitle: getVideoTitle() });
      return;
    }

    // 3. Click search/open button
    console.log('[Transcript Exporter] Locating transcript button.');
    const clickedBtn = await locateAndClickTranscriptButton();
    if (!clickedBtn) {
      sendResponse({ success: false, error: 'Could not locate the transcript button. Please verify transcripts are available for this video.' });
      return;
    }

    // 4. Poll for panel rendering
    console.log('[Transcript Exporter] Button clicked. Waiting for panel load.');
    panel = await waitForTranscriptPanel();
    if (!panel) {
      sendResponse({ success: false, error: 'Transcript panel could not be loaded. Timed out waiting for the transcript panel. Please make sure the video transcript is not empty.' });
      return;
    }

    console.log('[Transcript Exporter] Panel loaded successfully. Parsing rows.');
    const data = extractTranscriptData(panel);
    sendResponse({ success: true, data, videoTitle: getVideoTitle() });
  }

  /**
   * Retrieves the transcript panel DOM renderer if active.
   * @returns {Element | null}
   */
  function getTranscriptPanel() {
    return document.querySelector(
      'ytd-transcript-renderer, ytd-transcript-search-panel-renderer, #content ytd-transcript-renderer'
    );
  }

  /**
   * Retrieves the current video's title from Watch metadata.
   * @returns {string}
   */
  function getVideoTitle() {
    const titleEl = document.querySelector(
      'ytd-watch-metadata h1 yt-formatted-string, #container h1 ytd-video-primary-info-renderer yt-formatted-string, h1.title'
    );
    return titleEl ? titleEl.textContent?.trim() ?? 'YouTube Video' : 'YouTube Video';
  }

  /**
   * Expands the main video description expander if closed.
   * @returns {boolean} True if expansion was triggered.
   */
  function expandDescription() {
    console.log('[Transcript Exporter] Attempting description expand...');

    // Selectors for description expansion buttons
    const expandSelectors = [
      '#expand',
      'tp-yt-paper-button#expand',
      '.ytd-text-inline-expander #expand',
      '#description-inline-expander ytd-button-renderer button',
      'ytd-video-description-infocards-section-renderer #expand-button'
    ];

    for (const selector of expandSelectors) {
      const expandBtn = /** @type {HTMLElement | null} */ (document.querySelector(selector));
      if (expandBtn && expandBtn.offsetParent !== null) { // Element is visible
        expandBtn.click();
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if a string contains words matching "transcript" or its translations.
   * @param {string} text
   * @returns {boolean}
   */
  function matchesTranscriptKeywords(text) {
    const lower = text.toLowerCase();
    
    // Multilingual keywords for "transcript" or "show transcript"
    const keywords = [
      'transcri',     // transcrição, transcription, transcripción, transcript, transkript
      'trascri',      // trascrizione
      'transcriptie', // Dutch
      '文字起こし',     // Japanese
      '스크립트',      // Korean
      '자막',          // Korean alternative
      '文字记录',      // Chinese Simp
      '文字記錄',      // Chinese Trad
      'расшифровк',   // Russian (расшифровка)
      'транскрипт',   // Russian alternative
      'प्रतिलेख',       // Hindi
      'نسخة',         // Arabic
      'bản chép lời'  // Vietnamese
    ];

    return keywords.some(kw => lower.includes(kw));
  }

  /**
   * Resolves the transcript button structurally or with keyword heuristics.
   * @returns {HTMLElement | null}
   */
  function findTranscriptButton() {
    // Priority 1: Direct structural selectors that YouTube uses specifically for transcripts
    const structuralSelectors = [
      'ytd-video-description-transcript-section-renderer button',
      'ytd-video-description-transcript-section-renderer ytd-button-renderer button',
      'ytd-video-description-infocards-section-renderer ytd-button-renderer button',
      '#primary-button > ytd-button-renderer > yt-button-shape > button',
      '#primary-button ytd-button-renderer button'
    ];

    for (const selector of structuralSelectors) {
      const btn = /** @type {HTMLElement | null} */ (document.querySelector(selector));
      if (btn && btn.offsetParent !== null) {
        return btn;
      }
    }

    // Priority 2: Attribute-based matching on containers inside typical video description zones
    const descriptionContainers = [
      '#description',
      'ytd-video-description-infocards-section-renderer',
      '#description-inner',
      'ytd-text-inline-expander',
      '#primary-button'
    ];

    for (const containerSel of descriptionContainers) {
      const container = document.querySelector(containerSel);
      if (container) {
        const buttons = container.querySelectorAll('button, ytd-button-renderer, tp-yt-paper-button');
        for (const btn of buttons) {
          // Check text content keywords
          const text = btn.textContent ? btn.textContent.trim() : '';
          if (matchesTranscriptKeywords(text)) {
            const actualButton = /** @type {HTMLElement | null} */ (
              btn.tagName === 'BUTTON' ? btn : btn.querySelector('button')
            );
            if (actualButton && actualButton.offsetParent !== null) {
              return actualButton;
            }
          }
        }
      }
    }

    // Priority 3: Global fallback scan of all document buttons for transcript translations
    const allButtons = document.querySelectorAll('button, ytd-button-renderer, tp-yt-paper-button');
    for (const btn of allButtons) {
      const text = btn.textContent ? btn.textContent.trim() : '';
      if (matchesTranscriptKeywords(text)) {
        const actualButton = /** @type {HTMLElement | null} */ (
          btn.tagName === 'BUTTON' ? btn : btn.querySelector('button')
        );
        if (actualButton && actualButton.offsetParent !== null) {
          return actualButton;
        }
      }
    }

    return null;
  }

  /**
   * Helper that attempts to locate and click the transcript button, expands desc if required.
   * @returns {Promise<HTMLElement | null>}
   */
  async function locateAndClickTranscriptButton() {
    let btn = findTranscriptButton();
    if (btn) {
      btn.click();
      return btn;
    }

    // Attempt expanding description to reveal target button
    expandDescription();
    await new Promise(resolve => setTimeout(resolve, 600)); // Sleep for expand transition

    btn = findTranscriptButton();
    if (btn) {
      btn.click();
      return btn;
    }

    return null;
  }

  /**
   * A polling promise helper that resolves once transcript elements are fully active in DOM.
   * @param {number} timeoutMs
   * @returns {Promise<Element | null>}
   */
  function waitForTranscriptPanel(timeoutMs = 12000) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const interval = setInterval(() => {
        const panel = getTranscriptPanel();
        if (panel) {
          const segments = panel.querySelectorAll('ytd-transcript-segment-renderer');
          if (segments.length > 0) {
            clearInterval(interval);
            resolve(panel);
            return;
          }
        }

        if (Date.now() - startTime > timeoutMs) {
          clearInterval(interval);
          resolve(null);
        }
      }, 250);
    });
  }

  /**
   * Parses time string and transcript segments into object records.
   * @param {Element} panel
   * @returns {{timestamp: string, text: string}[]}
   */
  function extractTranscriptData(panel) {
    const segments = panel.querySelectorAll('ytd-transcript-segment-renderer');
    /** @type {{timestamp: string, text: string}[]} */
    const results = [];

    segments.forEach((segment) => {
      const timestampEl = segment.querySelector('.segment-timestamp, [class*="timestamp"], button, .segment-timestamp-wrapper');
      const timestamp = timestampEl ? timestampEl.textContent?.trim() ?? '' : '';

      const textEl = segment.querySelector('.segment-text, [class*="text"], yt-formatted-string, span');
      const text = textEl ? textEl.textContent?.trim() ?? '' : '';

      if (text) {
        results.push({ timestamp, text });
      }
    });

    return results;
  }
})();
