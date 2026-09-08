import { envOr } from '@/lib/env';
import { redact, type ListingInput, type MarketplaceAdapter, type UploadResult } from './types';

/**
 * GameBoost, API v2.
 *
 * The v1 endpoint was sunset on 30 November 2025 and answers 410 Gone, so this
 * is written against v2 from the start. Four things differ from v1 and each
 * one breaks a request on its own:
 *
 *   POST /v2/account-offers/create        not  POST /accounts
 *   price is EUR, minimum 0.99            no currency field at all
 *   credentials are an array of strings   not nested objects
 *   image_urls takes links                not base64 uploads
 *
 * **The Fortnite field names below are not verified.** Every game has its own
 * `account_data` schema, published at GET /v2/account-offers/templates/{slug},
 * and this app has no GameBoost key to read the Fortnite one with. The mapping
 * here is the obvious reading of the fields a Fortnite listing shows; run
 * `/api/gameboost-template?slug=fortnite` once a key is configured, diff it
 * against this list, and correct it. Unknown keys are the likeliest cause of a
 * 422 on the first live upload — which is why the dry run prints the payload.
 */

const DEFAULT_BASE = 'https://api.gameboost.com/v2';
const DEFAULT_CREATE_PATH = '/account-offers/create';
const DEFAULT_SLUG = 'fortnite';

/** GameBoost prices in euros and rejects anything under this. */
const MIN_PRICE_EUR = 0.99;

/**
 * One credential per account being sold, as the free-form string v2 expects.
 *
 * The template endpoint advertises flat login/password fields, but the create
 * endpoint rejects a request without `credentials` — "At least one credential
 * is required" — so the array is what actually counts.
 */
function credentialLines(input: ListingInput): string[] {
  const { login, password, email, emailPassword } = input.credentials;
  const lines = [`Login: ${login}`, `Password: ${password}`];
  if (email) lines.push(`Email: ${email}`);
  if (emailPassword) lines.push(`Email password: ${emailPassword}`);
  return [lines.join('\n')];
}

function base(): string {
  return envOr('GAMEBOOST_API_BASE', DEFAULT_BASE).replace(/\/$/, '');
}

function headers(): Record<string, string> {
  return {
    authorization: `Bearer ${envOr('GAMEBOOST_API_KEY', '')}`,
    'content-type': 'application/json',
    accept: 'application/json',
  };
}

/**
 * Live field list for a game. This is the authority when the mapping below
 * drifts — trusting the file instead is exactly how the v1 sunset went
 * unnoticed in the Brawl Stars build for months.
 */
export async function fetchGameboostTemplate(gameSlug: string): Promise<unknown> {
  const response = await fetch(
    `${base()}/account-offers/templates/${encodeURIComponent(gameSlug)}`,
    { headers: headers(), cache: 'no-store' },
  );
  const body = await response.text();
  if (!response.ok) throw new Error(`GameBoost template ${response.status}: ${body.slice(0, 300)}`);
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/** Drops keys with no value: GameBoost validates whatever is present. */
function defined<T extends Record<string, unknown>>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== null),
  ) as Partial<T>;
}

export const gameboost: MarketplaceAdapter = {
  id: 'gameboost',
  label: 'GameBoost',

  isConfigured() {
    return Boolean(envOr('GAMEBOOST_API_KEY', ''));
  },

  missingConfig() {
    return envOr('GAMEBOOST_API_KEY', '') ? [] : ['GAMEBOOST_API_KEY'];
  },

  buildPayload(input: ListingInput) {
    const { stats } = input;

    return defined({
      game: input.gameSlug || DEFAULT_SLUG,
      title: input.title.slice(0, 255),
      description: input.description.slice(0, 2048),
      // Euros, two decimals, and no currency field — v2 removed it.
      price: Math.max(MIN_PRICE_EUR, Math.round(input.price * 100) / 100),

      credentials: credentialLines(input),
      email_login: input.credentials.email,
      email_password: input.credentials.emailPassword,

      is_manual: false,
      delivery_instructions: input.credentials.notes,

      // Links, not uploads — see lib/marketplaces/image-hosting.ts.
      image_urls: input.imageUrls,

      account_data: defined({
        skins_count: stats.outfitCount,
        cosmetics_count: stats.totalItems,
        og_skins_count: stats.ogCount,
        account_level: stats.accountLevel,
        battle_pass_level: stats.seasonLevel,
        seasons_played: stats.seasonsPlayed,
        wins_count: stats.wins,
        vbucks: stats.vbucks,
        // Platform links and a changeable name move a Fortnite price as much
        // as the locker does, so they travel with the offer rather than only
        // being mentioned in the description.
        linked_platforms: stats.platforms?.length ? stats.platforms.join(', ') : undefined,
        email_verified: stats.emailVerified,
        name_change_available: stats.canChangeName,
      }),
    });
  },

  async upload(input, { dryRun }): Promise<UploadResult> {
    const payload = this.buildPayload(input);
    const result: UploadResult = {
      marketplace: this.id,
      label: this.label,
      ok: false,
      dryRun,
      sentPayload: redact(payload),
    };

    if (dryRun) return { ...result, ok: true };
    if (!this.isConfigured()) {
      return { ...result, error: `Не хватает настроек: ${this.missingConfig().join(', ')}` };
    }
    if (!input.imageUrls.length) {
      return { ...result, error: 'GameBoost требует хотя бы одну картинку — сначала соберите коллаж.' };
    }

    const endpoint = `${base()}${envOr('GAMEBOOST_CREATE_PATH', DEFAULT_CREATE_PATH)}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep raw text */
    }

    if (!response.ok) {
      /**
       * A 5xx is their server falling over, not a rejection of the offer, and
       * the two want different reactions: a 422 names the field to fix, a 500
       * names nothing at all. Saying which it is stops the seller hunting
       * through a payload that may be perfectly valid.
       */
      const whose =
        response.status >= 500
          ? 'GameBoost упал на своей стороне — оффер не создан. Повторите; если повторяется, ' +
            'ищите значение вне допустимого диапазона, а не отсутствующее поле.'
          : 'GameBoost отклонил оффер. Сверьте account_data с /api/gameboost-template.';
      return {
        ...result,
        responseBody: body,
        error: `HTTP ${response.status} от ${endpoint} — ${whose}`,
      };
    }

    const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    const data = (record.data ?? record) as Record<string, unknown>;

    return {
      ...result,
      ok: true,
      responseBody: body,
      offerId: data.id ? String(data.id) : undefined,
      offerUrl: typeof data.url === 'string' ? data.url : undefined,
    };
  },
};
