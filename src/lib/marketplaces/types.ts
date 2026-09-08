/**
 * What an adapter needs to create an offer, and what it reports back.
 *
 * One shape for every marketplace: the differences between them belong in the
 * adapters, not here, so the route and the UI never branch per platform.
 */

export interface CollageImage {
  filename: string;
  contentType: string;
  /** Base64 without the `data:` prefix. */
  base64: string;
}

export interface DeliveryCredentials {
  login: string;
  password: string;
  email?: string;
  emailPassword?: string;
  notes?: string;
}

/**
 * The per-account numbers a marketplace asks about a Fortnite account.
 *
 * All optional: the locker read fills most of them in, and anything Epic does
 * not report (or the seller does not want stated) is simply left out rather
 * than sent as a zero, which would read as a claim.
 */
export interface ListingStats {
  totalItems?: number;
  outfitCount?: number;
  /** Cosmetics from Chapter 1 seasons 1–4 — what a listing calls OG. */
  ogCount?: number;
  /** Names of the unobtainable cosmetics found on the account. */
  notable?: string[];
  accountLevel?: number;
  seasonLevel?: number;
  seasonsPlayed?: number;
  wins?: number;
  vbucks?: number;
  /** External accounts linked to the Epic account: psn, xbl, nintendo, steam. */
  platforms?: string[];
  emailVerified?: boolean;
  /** Whether Epic will let the buyer change the display name. */
  canChangeName?: boolean;
}

export interface ListingInput {
  account: { displayName: string; accountId: string };
  stats: ListingStats;
  /** Hosted collage URLs; GameBoost takes links, not uploads. */
  imageUrls: string[];
  title: string;
  description: string;
  price: number;
  currency: string;
  credentials: DeliveryCredentials;
  images: CollageImage[];
  gameSlug: string;
}

export interface UploadResult {
  marketplace: string;
  label: string;
  ok: boolean;
  dryRun: boolean;
  offerId?: string;
  offerUrl?: string;
  /** Payload actually sent, credentials redacted — shown in the UI. */
  sentPayload?: unknown;
  responseBody?: unknown;
  error?: string;
}

export interface MarketplaceAdapter {
  id: string;
  label: string;
  isConfigured(): boolean;
  missingConfig(): string[];
  /** Payload preview, used by dry runs and by the UI. */
  buildPayload(input: ListingInput): unknown;
  upload(input: ListingInput, options: { dryRun: boolean }): Promise<UploadResult>;
}

/**
 * Credentials must never reach a log, a screen, or a saved dry run.
 *
 * The masking recurses into arrays and objects rather than only handling
 * strings: GameBoost v2 takes credentials as an array of multi-line strings,
 * and a `typeof value === 'string'` check walks straight past that — which in
 * the Brawl Stars build printed the login and password of the account being
 * sold into the dry-run preview on screen.
 */
export function redact(payload: unknown): unknown {
  const secretKey = /pass|password|secret|token|credential|login|email/i;

  const mask = (value: unknown): unknown => {
    if (typeof value === 'string') return value.length > 0 ? '***скрыто***' : value;
    if (Array.isArray(value)) return value.map(mask);
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, inner]) => [key, mask(inner)]),
      );
    }
    return value;
  };

  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
          key,
          secretKey.test(key) ? mask(inner) : walk(inner),
        ]),
      );
    }
    if (typeof value === 'string' && value.length > 512) return `${value.slice(0, 64)}…[обрезано]`;
    return value;
  };

  return walk(payload);
}
