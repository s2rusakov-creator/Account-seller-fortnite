import { getCatalog } from '@/lib/fortnite/catalog';
import type {
  AccountInfo,
  AccountStats,
  LockerResult,
  OwnedItem,
  PastSeason,
} from '@/lib/fortnite/types';
import { killSession, type Session } from './client';

/**
 * Reads a locker through the same endpoint the game itself calls.
 *
 * `QueryProfile` on the `athena` profile returns every item the account owns —
 * outfits, back blings, pickaxes, gliders, emotes, wraps, sprays, music,
 * loading screens, banners — along with the styles unlocked on each and the
 * account's season history. `common_core` holds the V-Bucks balance, which is
 * usually the second thing a buyer asks about.
 */

const FORTNITE = 'https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile';
const TIMEOUT_MS = 30_000;

interface ProfileItem {
  templateId?: string;
  quantity?: number;
  attributes?: {
    variants?: { channel?: string; active?: string; owned?: string[] }[];
    favorite?: boolean;
    item_seen?: boolean;
  };
}

interface ProfileResponse {
  profileChanges?: {
    profile?: {
      items?: Record<string, ProfileItem>;
      stats?: { attributes?: Record<string, unknown> };
    };
  }[];
}

async function queryProfile(session: Session, profileId: string): Promise<ProfileResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(
      `${FORTNITE}/${session.accountId}/client/QueryProfile?profileId=${profileId}&rvn=-1`,
      {
        method: 'POST',
        headers: {
          authorization: `bearer ${session.accessToken}`,
          'content-type': 'application/json',
        },
        // The endpoint insists on a JSON body even though it reads nothing
        // from it; an empty body answers 400.
        body: '{}',
        signal: controller.signal,
        cache: 'no-store',
      },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`QueryProfile(${profileId}) → ${response.status}: ${text.slice(0, 300)}`);
    }
    return (await response.json()) as ProfileResponse;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Profile item ids that are not cosmetics.
 *
 * The athena profile mixes the locker with quest state, XP tokens, season
 * currency and account-level bookkeeping. Rather than list those, only
 * templateIds whose prefix the catalogue recognises as a cosmetic type are
 * kept — a new junk prefix in a future season is then ignored for free.
 */
function parseItems(
  items: Record<string, ProfileItem>,
  byId: Map<string, import('@/lib/fortnite/types').Cosmetic>,
  cosmeticBackends: Set<string>,
): OwnedItem[] {
  const owned: OwnedItem[] = [];
  const seen = new Set<string>();

  for (const entry of Object.values(items)) {
    const template = entry.templateId;
    if (!template) continue;
    const colon = template.indexOf(':');
    if (colon === -1) continue;

    const backend = template.slice(0, colon);
    const id = template.slice(colon + 1).toLowerCase();
    if (!cosmeticBackends.has(backend)) continue;
    // A locker can hold the same template twice (granted by two different
    // bundles); the grid must not show it twice.
    if (seen.has(id)) continue;
    seen.add(id);

    const variants: Record<string, string[]> = {};
    for (const variant of entry.attributes?.variants ?? []) {
      if (variant.channel && variant.owned?.length) variants[variant.channel] = variant.owned;
    }
    const hasVariants = Object.keys(variants).length > 0;

    const known = byId.get(id);
    if (known) {
      owned.push({ ...known, ...(hasVariants ? { variants } : {}) });
      continue;
    }

    // Items the catalogue has never heard of are kept rather than dropped:
    // they are usually cosmetics from the season that shipped after the last
    // catalogue refresh, and silently losing them would understate the
    // account. The listing shows them under their raw id.
    owned.push({
      id: template.slice(colon + 1),
      name: template.slice(colon + 1),
      type: 'unknown',
      backend,
      rarity: 'common',
      art: false,
      unknown: true,
      ...(hasVariants ? { variants } : {}),
    });
  }

  return owned;
}

function parseStats(attributes: Record<string, unknown> | undefined): AccountStats {
  const pastSeasons: PastSeason[] = [];
  const raw = attributes?.past_seasons;
  if (Array.isArray(raw)) {
    for (const season of raw as Record<string, unknown>[]) {
      const number = Number(season.seasonNumber);
      if (!Number.isFinite(number)) continue;
      pastSeasons.push({
        seasonNumber: number,
        seasonLevel: numberOr(season.seasonLevel),
        bookLevel: numberOr(season.bookLevel),
        purchasedVIP: season.purchasedVIP === true,
        numWins: numberOr(season.numWins),
      });
    }
    pastSeasons.sort((a, b) => b.seasonNumber - a.seasonNumber);
  }

  const lifetimeWins = pastSeasons.reduce((total, season) => total + (season.numWins ?? 0), 0);

  return {
    seasonNumber: numberOr(attributes?.season_num),
    seasonLevel: numberOr(attributes?.level),
    accountLevel: numberOr(attributes?.accountLevel),
    battlePassPurchased: attributes?.book_purchased === true,
    pastSeasons,
    lifetimeWins: pastSeasons.length ? lifetimeWins : undefined,
  };
}

function numberOr(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** V-Bucks, summed across the several buckets Epic splits them into. */
function parseVbucks(items: Record<string, ProfileItem> | undefined): number | undefined {
  if (!items) return undefined;
  let total = 0;
  let found = false;
  for (const entry of Object.values(items)) {
    if (!entry.templateId?.startsWith('Currency:Mtx')) continue;
    found = true;
    total += entry.quantity ?? 0;
  }
  return found ? total : undefined;
}

/**
 * Everything the listing needs, in one pass, after which the token is killed.
 *
 * The two profile reads run together: athena is the slow one (a large locker
 * is several megabytes) and common_core is small, so serialising them would
 * add the small one's latency for nothing.
 */
export async function readLocker(session: Session): Promise<LockerResult> {
  try {
    const [athena, core, account] = await Promise.all([
      queryProfile(session, 'athena'),
      // A brand-new account can lack common_core entirely; V-Bucks are then
      // simply unknown rather than an error that loses the whole locker.
      queryProfile(session, 'common_core').catch(() => null),
      // Same token, no extra sign-in. Failing here must not cost the locker:
      // the listing is worse without the platform links, not impossible.
      readAccountInfo(session).catch(() => undefined),
    ]);
    const locker = await parseProfiles(athena, core, session.accountId, session.displayName);
    return { ...locker, account };
  } finally {
    await killSession(session.accessToken);
  }
}

const ACCOUNT_API = 'https://account-public-service-prod.ol.epicgames.com/account/api/public/account';

/**
 * The account's own state, as opposed to its locker.
 *
 * A Fortnite buyer asks two things before the skins: can I take the email
 * over, and is this welded to somebody's PlayStation. Both come from here,
 * with the token the locker read already holds — no second sign-in.
 *
 * Console links matter in both directions. They prove the account is old and
 * played, and they are also what makes it awkward to resell, since an external
 * account can only be linked to one Epic account at a time.
 */
async function readAccountInfo(session: Session): Promise<AccountInfo> {
  const headers = { authorization: `bearer ${session.accessToken}`, accept: 'application/json' };

  const [profile, externals] = await Promise.all([
    fetch(`${ACCOUNT_API}/${session.accountId}`, { headers, cache: 'no-store' }).then((response) =>
      response.ok ? (response.json() as Promise<Record<string, unknown>>) : null,
    ),
    fetch(`${ACCOUNT_API}/${session.accountId}/externalAuths`, { headers, cache: 'no-store' }).then(
      (response) => (response.ok ? (response.json() as Promise<Record<string, unknown>[]>) : []),
    ),
  ]);

  const platforms = (Array.isArray(externals) ? externals : [])
    .map((entry) => (typeof entry.type === 'string' ? entry.type : ''))
    .filter(Boolean);

  return {
    platforms,
    emailVerified: typeof profile?.emailVerified === 'boolean' ? profile.emailVerified : undefined,
    tfaEnabled: typeof profile?.tfaEnabled === 'boolean' ? profile.tfaEnabled : undefined,
    canChangeName:
      typeof profile?.canUpdateDisplayName === 'boolean' ? profile.canUpdateDisplayName : undefined,
    displayNameChanges: numberOr(profile?.numberOfDisplayNameChanges),
    country: typeof profile?.country === 'string' ? profile.country : undefined,
    lastLogin: typeof profile?.lastLogin === 'string' ? profile.lastLogin : undefined,
  };
}

/**
 * Turns the two profile responses into a listing.
 *
 * Split out from the fetching so it can be exercised without an account: the
 * shape of Epic's answer is the part that breaks silently when a season adds a
 * new item kind, and the failure — cosmetics quietly missing from a listing —
 * is invisible unless the parse is tested on its own.
 */
export async function parseProfiles(
  athena: ProfileResponse,
  core: ProfileResponse | null,
  accountId: string,
  displayName: string,
): Promise<LockerResult> {
  const catalog = await getCatalog();
  const cosmeticBackends = new Set(catalog.items.map((item) => item.backend));
  const profile = athena.profileChanges?.[0]?.profile;
  const items = parseItems(profile?.items ?? {}, catalog.byId, cosmeticBackends);
  const stats = parseStats(profile?.stats?.attributes);
  stats.vbucks = parseVbucks(core?.profileChanges?.[0]?.profile?.items);

  return {
    accountId,
    displayName,
    items,
    stats,
    readAt: new Date().toISOString(),
  };
}

export type { ProfileResponse, ProfileItem };
