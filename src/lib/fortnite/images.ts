/**
 * Where a cosmetic's art lives.
 *
 * Kept apart from the catalogue module so the browser can import these without
 * pulling the server-side download logic into the client bundle.
 *
 * The URLs are derived from the id rather than stored — verified against all
 * 16268 catalogue entries, zero mismatches — which is worth about 1.9 MB on
 * every catalogue copy.
 */

const BASE = 'https://fortnite-api.com/images/cosmetics/br';

/** The 512px square icon: what both the grid and the collage draw. */
export function iconUrl(id: string): string {
  return `${BASE}/${id.toLowerCase()}/icon.png`;
}

/** The wide shop render. Absent for about a third of the catalogue. */
export function featuredUrl(id: string): string {
  return `${BASE}/${id.toLowerCase()}/featured.png`;
}

/**
 * The same art, through our own origin.
 *
 * The collage is read back out of a canvas, and a cross-origin image taints it
 * so that read throws — hence the proxy. The grid uses the proxied URL too,
 * even though it has no such constraint: it means the collage finds every
 * picture already in the browser cache instead of downloading a second copy of
 * each one under a different URL, which on a full locker is tens of megabytes.
 */
export function proxied(url: string): string {
  return `/api/img?url=${encodeURIComponent(url)}`;
}

export function proxiedIcon(id: string): string {
  return proxied(iconUrl(id));
}
