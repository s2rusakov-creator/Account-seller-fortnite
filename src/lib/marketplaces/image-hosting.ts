import { put } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { envOr } from '@/lib/env';
import type { CollageImage } from './types';

/**
 * Puts the generated collage somewhere the marketplace can fetch it.
 *
 * GameBoost's v2 API takes `image_urls` — links to images hosted elsewhere —
 * not uploads. The collage is rendered in the browser and arrives here as
 * base64, so it has to be published before the offer can reference it.
 *
 * Vercel Blob is the store because that is where this deploys. Two ways in,
 * and which applies is not a preference:
 *
 *   On Vercel, a connected store authenticates over OIDC. It injects
 *   BLOB_READ_WRITE_TOKEN_STORE_ID and the SDK pairs that with the platform's
 *   own VERCEL_OIDC_TOKEN. There is no read-write token to find, which is why
 *   looking only for one fails there.
 *
 *   Anywhere else — a laptop, another host — there is no OIDC token, so a
 *   read-write token from the store's .env.local tab is required.
 *
 * The URLs are public by necessity: the marketplace fetches them anonymously
 * and a buyer's browser loads them from the listing. They hold cosmetic art
 * and nothing else — credentials travel as their own fields straight to the
 * marketplace API, and never through here.
 */

export interface HostedImage {
  url: string;
  filename: string;
}

/** Vercel names this per store; BLOB_STORE_ID is the SDK's own convention. */
function storeId(): string {
  return envOr('BLOB_READ_WRITE_TOKEN_STORE_ID', '') || envOr('BLOB_STORE_ID', '');
}

function readWriteToken(): string {
  return envOr('BLOB_READ_WRITE_TOKEN', '');
}

export function imageHostingConfigured(): boolean {
  return Boolean(readWriteToken() || storeId());
}

/**
 * A short, stable, non-reversible stand-in for the account id.
 *
 * The path becomes a public URL that a buyer and a marketplace both read. An
 * Epic account id in it would be handed to everyone who opens the listing, and
 * an account id is enough to start a support conversation about the account —
 * so it is hashed. Stable, so pages of one listing group together; short,
 * because nobody needs to read it.
 */
function accountToken(accountId: string): string {
  return createHash('sha256').update(accountId).digest('hex').slice(0, 12);
}

export async function hostCollageImages(
  images: CollageImage[],
  accountId: string,
): Promise<HostedImage[]> {
  if (!images.length) return [];

  const token = readWriteToken();
  const store = storeId();
  if (!token && !store) {
    throw new Error(
      'Нет хранилища картинок: подключите Vercel Blob к проекту или задайте ' +
        'BLOB_READ_WRITE_TOKEN. GameBoost принимает ссылки на картинки, а не загрузки.',
    );
  }

  // A listing re-published for the same account must not collide with the last
  // one, and a marketplace may cache by URL, so each run gets its own prefix.
  const run = `${accountToken(accountId)}/${Date.now()}`;

  return Promise.all(
    images.map(async (image) => {
      const blob = await put(
        `collages/${run}/${image.filename}`,
        Buffer.from(image.base64, 'base64'),
        {
          access: 'public',
          contentType: image.contentType,
          // A token wins when present, since it works everywhere; otherwise
          // the store id lets the SDK authenticate over OIDC on Vercel.
          ...(token ? { token } : { storeId: store }),
          // The filename already carries the page number and the run is
          // unique, so a suffix would only make the URL harder to read.
          addRandomSuffix: false,
        },
      );
      return { url: blob.url, filename: image.filename };
    }),
  );
}
