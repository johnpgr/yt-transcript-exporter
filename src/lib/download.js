/**
 * @fileoverview Safe download initiation and filename sanitation.
 */

/**
 * Sanitizes a title string into a safe operating system filename.
 * @param {string} title
 * @returns {string}
 */
export function sanitizeFilename(title) {
  return title
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

/**
 * Generates a virtual download click to trigger a local file download.
 * @param {string} content
 * @param {string} filename
 * @returns {Promise<void>} Resolves when download initiation and cleanup finishes.
 */
export function downloadTextFile(content, filename) {
  return new Promise((resolve) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.href = blobUrl;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();

    // Ensure cleanup occurs after UI thread processing
    setTimeout(() => {
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobUrl);
      resolve();
    }, 200);
  });
}
