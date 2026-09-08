import { envOr } from '@/lib/env';
import { redact, type ListingInput, type MarketplaceAdapter, type UploadResult } from './types';

/**
 * Eldorado.
 *
 * Their Seller API key comes from the seller dashboard and the endpoint
 * reference arrives by email on request, so nothing here is hardcoded:
 *
 *   ELDORADO_CREATE_PATH   e.g. /api/offers/accounts
 *   ELDORADO_AUTH_HEADER   header name, default `Authorization`
 *   ELDORADO_AUTH_SCHEME   prefix, default `Bearer` (blank sends a raw key)
 *   ELDORADO_GAME_ID       Fortnite's id in their catalogue
 *
 * Always dry-run first and diff the payload against their reference: the field
 * names below are a reasonable guess at an account offer, not a verified
 * schema.
 */

const DEFAULT_BASE = 'https://api.eldorado.gg';

function base(): string {
  return envOr('ELDORADO_API_BASE', DEFAULT_BASE).replace(/\/$/, '');
}

function headers(): Record<string, string> {
  const name = envOr('ELDORADO_AUTH_HEADER', 'Authorization');
  // Deliberately not envOr: a blank scheme is a valid setting — it sends the
  // raw key with no `Bearer ` prefix, which some seller APIs expect.
  const scheme = process.env.ELDORADO_AUTH_SCHEME ?? 'Bearer';
  const key = envOr('ELDORADO_API_KEY', '');
  return {
    [name]: scheme ? `${scheme} ${key}` : key,
    'content-type': 'application/json',
    accept: 'application/json',
  };
}

export const eldorado: MarketplaceAdapter = {
  id: 'eldorado',
  label: 'Eldorado',

  isConfigured() {
    return Boolean(envOr('ELDORADO_API_KEY', '') && envOr('ELDORADO_CREATE_PATH', ''));
  },

  missingConfig() {
    const missing: string[] = [];
    if (!envOr('ELDORADO_API_KEY', '')) missing.push('ELDORADO_API_KEY');
    if (!envOr('ELDORADO_CREATE_PATH', '')) missing.push('ELDORADO_CREATE_PATH');
    return missing;
  },

  buildPayload(input: ListingInput) {
    const { stats } = input;
    return {
      gameId: envOr('ELDORADO_GAME_ID', 'fortnite'),
      offerType: 'Account',
      offerTitle: input.title,
      description: input.description,
      pricePerUnit: input.price,
      currency: input.currency,
      quantity: 1,
      isInstantDelivery: true,
      deliveryTimeMinutes: 5,
      accountDetails: {
        skins: stats.outfitCount,
        cosmetics: stats.totalItems,
        ogCosmetics: stats.ogCount,
        accountLevel: stats.accountLevel,
        battlePassLevel: stats.seasonLevel,
        seasonsPlayed: stats.seasonsPlayed,
        wins: stats.wins,
        vbucks: stats.vbucks,
        linkedPlatforms: stats.platforms,
        emailVerified: stats.emailVerified,
        login: input.credentials.login,
        password: input.credentials.password,
        email: input.credentials.email,
        emailPassword: input.credentials.emailPassword,
        additionalInfo: input.credentials.notes,
      },
      // Eldorado's reference has not been seen, so pictures go inline. If they
      // turn out to take links the way GameBoost does, `imageUrls` is already
      // populated and the swap is one line.
      images: input.images.map((image) => ({
        fileName: image.filename,
        contentType: image.contentType,
        base64: image.base64,
      })),
      imageUrls: input.imageUrls,
    };
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

    const endpoint = `${base()}${envOr('ELDORADO_CREATE_PATH', '')}`;
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
      return { ...result, responseBody: body, error: `HTTP ${response.status} от ${endpoint}` };
    }

    const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    const data = (record.data ?? record) as Record<string, unknown>;
    const id = data.id ?? data.offerId;

    return {
      ...result,
      ok: true,
      responseBody: body,
      offerId: id ? String(id) : undefined,
      offerUrl: typeof data.url === 'string' ? data.url : undefined,
    };
  },
};
