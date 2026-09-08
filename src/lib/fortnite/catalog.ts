import type { Cosmetic } from './types';

// Re-exported so server code has one import for the catalogue and its art.
export { featuredUrl, iconUrl } from './images';

/**
 * The cosmetic catalogue, from fortnite-api.com.
 *
 * Unlike Brawl Stars — where no API carries skins at all and the art had to be
 * enumerated off a fan wiki — Fortnite's community API returns every cosmetic
 * the game has ever shipped, with the pictures. One unauthenticated GET, 16268
 * items, 16.5 MB of JSON.
 *
 * That 16.5 MB is the reason for everything below. The response is trimmed to
 * the nine fields a listing uses, held in module memory for six hours, and
 * never sent to the browser whole: the client is only ever given the items an
 * account actually owns.
 */

const SOURCE = 'https://fortnite-api.com/v2/cosmetics/br';
const TTL_MS = 6 * 60 * 60 * 1000;

interface RawCosmetic {
  id: string;
  name?: string;
  type?: { value?: string; backendValue?: string };
  rarity?: { value?: string };
  series?: { value?: string };
  set?: { value?: string };
  introduction?: { backendValue?: number; chapter?: string; season?: string };
  images?: { icon?: string };
}

export interface Catalog {
  items: Cosmetic[];
  /** Lower-cased id to entry — locker templateIds arrive lower-cased. */
  byId: Map<string, Cosmetic>;
  fetchedAt: number;
}

let cached: Catalog | null = null;
let inFlight: Promise<Catalog> | null = null;

/**
 * The season an item came from, named the way the game names it.
 *
 * Not derived from the number: the sequence runs 27 = Chapter 4 OG, 31 =
 * Chapter 5 Season 4, 32 = Chapter 2 Remix, 33 = Chapter 6 Season 1, so any
 * arithmetic over the number mislabels every special season. The API's own
 * chapter and season strings are used instead.
 */
function seasonName(intro: RawCosmetic['introduction']): string | undefined {
  if (!intro?.chapter || !intro.season) return undefined;
  return `Глава ${intro.chapter}, сезон ${intro.season}`;
}

function normalize(raw: RawCosmetic[]): Cosmetic[] {
  const items: Cosmetic[] = [];
  for (const entry of raw) {
    if (!entry.id || !entry.name) continue;
    const type = entry.type?.value;
    const backend = entry.type?.backendValue;
    if (!type || !backend) continue;
    items.push({
      id: entry.id,
      name: entry.name,
      type,
      backend,
      rarity: entry.rarity?.value ?? 'common',
      series: entry.series?.value,
      set: entry.set?.value,
      season: entry.introduction?.backendValue,
      seasonName: seasonName(entry.introduction),
      art: Boolean(entry.images?.icon),
    });
  }
  return items;
}

function index(items: Cosmetic[]): Catalog {
  const byId = new Map<string, Cosmetic>();
  for (const item of items) byId.set(item.id.toLowerCase(), item);
  return { items, byId, fetchedAt: Date.now() };
}

async function download(): Promise<Catalog> {
  const response = await fetch(`${SOURCE}?language=en`, {
    headers: { accept: 'application/json' },
    // Next would try to store 16.5 MB in its own fetch cache otherwise, which
    // exceeds the 2 MB entry limit and logs a warning on every cold start.
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`fortnite-api.com answered ${response.status}`);
  const body = (await response.json()) as { data?: RawCosmetic[] };
  const items = normalize(body.data ?? []);
  if (items.length < 1000) throw new Error(`catalogue looks truncated: ${items.length} items`);
  return index(items);
}

/**
 * The catalogue, downloading it at most once per six hours.
 *
 * Concurrent callers on a cold start share one download rather than each
 * pulling 16.5 MB — the grid and the collage both ask for it at once.
 */
export async function getCatalog(): Promise<Catalog> {
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached;
  if (inFlight) return inFlight;

  inFlight = download()
    .then((catalog) => {
      cached = catalog;
      return catalog;
    })
    .finally(() => {
      inFlight = null;
    });

  try {
    return await inFlight;
  } catch (error) {
    // A stale catalogue beats no catalogue: a listing built off six-hour-old
    // data is correct except for cosmetics added since, while a failure here
    // means the seller cannot read the account at all.
    if (cached) return cached;
    const snapshot = await loadSnapshot();
    if (snapshot) return snapshot;
    throw error;
  }
}

/**
 * The bundled copy, written by `npm run build:catalog`.
 *
 * Only reached on a cold start with fortnite-api.com down — which is the exact
 * moment an account read would otherwise be impossible. Items released after
 * the snapshot was built still appear in the listing, marked as new, because
 * the locker parser keeps templateIds the catalogue does not know.
 */
async function loadSnapshot(): Promise<Catalog | null> {
  try {
    const module = (await import('@/data/catalog-snapshot.json')) as {
      default: { items: Cosmetic[] };
    };
    const items = module.default.items;
    return items?.length ? index(items) : null;
  } catch {
    return null;
  }
}
