/**
 * Shared between the collage renderer and the upload route.
 *
 * The two must not disagree by omission: a browser that happily renders twenty
 * pages the server was always going to reject tells the seller nothing until
 * the end of the flow. Anything deciding whether a payload fits reads these.
 */

/**
 * What one upload request may weigh on the wire.
 *
 * Vercel rejects a serverless request body over 4.5 MB before any handler
 * runs, answering 413 with plain text that the browser then fails to parse as
 * JSON — so the seller sees a parser message and no hint that size was the
 * problem. 3.5 MB leaves room for the title, the description and the
 * credentials travelling in the same body.
 *
 * A full Fortnite locker is far past this: 2000 items is 24 collage pages at
 * roughly 250 KB each. Pages are therefore published one at a time through
 * /api/collage-image, and this ceiling only guards the leftovers.
 */
export const MAX_TOTAL_IMAGE_BYTES = 3.5 * 1024 * 1024;

/** Bytes a base64 string occupies once it is inside a JSON body. */
export function wireBytes(base64: string): number {
  return base64.length;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
