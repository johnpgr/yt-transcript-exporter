/**
 * YouTube Transcript Exporter - Content Script
 * 
 * Injected into YouTube video pages to interact with the DOM,
 * locate/click the transcript button, wait for the panel to load,
 * and extract the transcript text + timestamps.
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
        return true; // Keep message channel open for asynchronous response
      }
    }
  );

  /**
   * Main orchestrator for expanding, clicking, and extracting the transcript
   * @param {(response?: any) => void} sendResponse
   */
  async function handleExtraction(sendResponse) {
    try {
      // 1. Check if we're on a video page
      if (!window.location.pathname.includes('/watch')) {
        throw new Error('Please navigate to a YouTube video page to export transcripts.');
      }

      // 2. See if the transcript panel is already open
      let panel = getTranscriptPanel();
      let segments = panel ? panel.querySelectorAll('ytd-transcript-segment-renderer') : [];

      if (panel && segments.length > 0) {
        console.log('[Transcript Exporter] Panel already open. Scraping directly.');
        const data = extractTranscriptData(panel);
        sendResponse({ success: true, data, videoTitle: getVideoTitle() });
        return;
      }

      // 3. Otherwise, click button & wait for load
      console.log('[Transcript Exporter] Locating transcript button.');
      let btn = await locateAndClickTranscriptButton();
      if (!btn) {
        throw new Error('Could not find the "Mostrar transcrição" / "Show transcript" button. Please make sure the video has transcripts available.');
      }

      console.log('[Transcript Exporter] Transcript button clicked. Waiting for panel load.');
      panel = await waitForTranscriptPanel();
      if (!panel) {
        throw new Error('Transcript panel could not be loaded.');
      }
      
      console.log('[Transcript Exporter] Panel loaded. Extracting data.');
      const data = extractTranscriptData(panel);
      sendResponse({ success: true, data, videoTitle: getVideoTitle() });

    } catch (error) {
      console.error('[Transcript Exporter] Extraction failed:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      sendResponse({ success: false, error: errMsg });
    }
  }

  /**
   * Finds the transcript panel renderer in the DOM
   */
  function getTranscriptPanel() {
    return document.querySelector('ytd-transcript-renderer, ytd-transcript-search-panel-renderer, #content ytd-transcript-renderer');
  }

  /**
   * Helper to retrieve the current video's title
   */
  function getVideoTitle() {
    const titleEl = document.querySelector('ytd-watch-metadata h1 yt-formatted-string, #container h1 ytd-video-primary-info-renderer yt-formatted-string, h1.title');
    return titleEl ? titleEl.textContent.trim() : 'YouTube Video';
  }

  /**
   * Programmatically expands the description box if it is collapsed
   */
  function expandDescription() {
    console.log('[Transcript Exporter] Attempting to expand description box...');
    
    // List of common selectors for expanding description
    const expandSelectors = [
      '#expand',
      'tp-yt-paper-button#expand',
      '.ytd-text-inline-expander #expand',
      '#description-inline-expander ytd-button-renderer button',
      'ytd-video-description-infocards-section-renderer #expand-button'
    ];

    for (const sel of expandSelectors) {
      const expandBtn = /** @type {HTMLElement | null} */ (document.querySelector(sel));
      if (expandBtn && expandBtn.offsetParent !== null) { // visible in DOM
        expandBtn.click();
        return true;
      }
    }
    return false;
  }

  /**
   * Finds the "Show transcript" button using precise selectors and loose text/role fallbacks
   */
  function findTranscriptButton() {
    // 1. Try the precise user-supplied selector
    let btn = /** @type {HTMLElement | null} */ (document.querySelector('#primary-button > ytd-button-renderer > yt-button-shape > button'));
    if (btn && btn.offsetParent !== null) return btn;

    // 2. Try variations of the user selector
    btn = /** @type {HTMLElement | null} */ (document.querySelector('#primary-button ytd-button-renderer button'));
    if (btn && btn.offsetParent !== null) return btn;

    // 3. Search within typical description containers for transcript keywords
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
        for (const b of buttons) {
          const txt = b.textContent ? b.textContent.trim().toLowerCase() : '';
          if (txt.includes('transcri') || txt.includes('transcript')) {
            const actualButton = /** @type {HTMLElement | null} */ (b.tagName === 'BUTTON' ? b : b.querySelector('button'));
            if (actualButton && actualButton.offsetParent !== null) {
              return actualButton;
            }
          }
        }
      }
    }

    // 4. Global fallback search for buttons containing transcript keywords
    const allButtons = document.querySelectorAll('button, ytd-button-renderer, tp-yt-paper-button');
    for (const b of allButtons) {
      const txt = b.textContent ? b.textContent.trim().toLowerCase() : '';
      if (txt.includes('mostrar transcri') || txt.includes('show transcript')) {
        const actualButton = /** @type {HTMLElement | null} */ (b.tagName === 'BUTTON' ? b : b.querySelector('button'));
        if (actualButton && actualButton.offsetParent !== null) {
          return actualButton;
        }
      }
    }

    return null;
  }

  /**
   * Attempts to locate and click the transcript button, including description expansion
   */
  async function locateAndClickTranscriptButton() {
    let btn = findTranscriptButton();
    if (btn) {
      btn.click();
      return btn;
    }

    // If not found, try to expand the description box first
    expandDescription();
    await new Promise(resolve => setTimeout(resolve, 600)); // wait for transition

    btn = findTranscriptButton();
    if (btn) {
      btn.click();
      return btn;
    }

    return null;
  }

  /**
   * Polling-based promise that waits for the transcript panel to load in the DOM
   */
  function waitForTranscriptPanel(timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
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
          reject(new Error('Timed out waiting for the transcript panel to load. Please make sure the video transcript is not empty.'));
        }
      }, 250);
    });
  }

  /**
   * Extract timestamp and text text from the loaded transcript panel elements
   * @param {Element} panel
   * @returns {{timestamp: string, text: string}[]}
   */
  function extractTranscriptData(panel) {
    const segments = panel.querySelectorAll('ytd-transcript-segment-renderer');
    /** @type {{timestamp: string, text: string}[]} */
    const results = [];

    segments.forEach((/** @type {Element} */ segment) => {
      // Find timestamp element (usually has class containing timestamp, or is a nested button/span)
      const timestampEl = segment.querySelector('.segment-timestamp, [class*="timestamp"], button, .segment-timestamp-wrapper');
      const timestamp = timestampEl ? timestampEl.textContent?.trim() ?? '' : '';

      // Find text element (usually has class containing text, or yt-formatted-string)
      const textEl = segment.querySelector('.segment-text, [class*="text"], yt-formatted-string, span');
      const text = textEl ? textEl.textContent?.trim() ?? '' : '';

      if (text) {
        results.push({ timestamp, text });
      }
    });

    return results;
  }
})();
