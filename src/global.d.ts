/**
 * @fileoverview Global type definitions for the YouTube Transcript Exporter.
 * Declares mutual structures used inside modular JSDoc comments.
 */

interface TranscriptRow {
  timestamp: string;
  text: string;
}

type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

type FormatterFunction = (
  data: TranscriptRow[],
  videoTitle: string,
  options: { includeTimestamps: boolean }
) => string;


