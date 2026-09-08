/**
 * Epic's account service, as far as reading a locker needs it.
 *
 * There is no public way to look up somebody's cosmetics by name or account
 * id — Epic exposes nothing of the kind, and no third-party site has it
 * either; every "skin checker" works the way this does. The account's owner
 * authorises a read with Epic's **device code flow**: we ask Epic for a code,
 * the seller types it at epicgames.com/activate while signed in to their own
 * account in their own browser, and Epic hands us a token afterwards.
 *
 * What that buys, and what it does not:
 *
 * - No password ever reaches this service. Epic collects it, on Epic's domain.
 * - The token is read-only in practice — nothing here writes to a profile —
 *   and it is killed the moment the locker has been read, so a token cannot
 *   outlive the request that made it. Nothing is persisted: no database, no
 *   cookie, no log line with a token in it.
 * - The seller must be able to sign in to the account, which is exactly the
 *   position somebody selling that account is in.
 *
 * These client credentials are the game's own, published for years in the
 * Epic-API reverse-engineering community. Epic disables them from time to
 * time — the old iOS client is dead as of this writing, answering
 * `client_disabled` — which is why several are listed and the first working
 * one wins.
 */

export interface EpicClient {
  name: string;
  id: string;
  secret: string;
}

/**
 * Tried in order. `fortniteNewSwitchGameClient` is the one the locker tools
 * settle on; the others are fallbacks for the day it goes the way of
 * `fortniteIOSGameClient`.
 */
export const CLIENTS: EpicClient[] = [
  {
    name: 'fortniteNewSwitchGameClient',
    id: '98f7e42c2e3a4f86a74eb43fbb41ed39',
    secret: '0a2449a2-001a-451e-afec-3e812901c4d7',
  },
  {
    name: 'fortniteAndroidGameClient',
    id: '3f69e56c7649492c8cc29f1af08a8a12',
    secret: 'b51ee9cb12234f50a69efa67ef53812e',
  },
  {
    name: 'fortnitePCGameClient',
    id: 'ec684b8c687f479fadea3cb2ad83f5c6',
    secret: 'e1f31c211f28413186262d37a13fc84d',
  },
];

const ACCOUNT = 'https://account-public-service-prod.ol.epicgames.com/account/api';
const TIMEOUT_MS = 20_000;

export class EpicError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'EpicError';
  }
}

function basic(client: EpicClient): string {
  return Buffer.from(`${client.id}:${client.secret}`).toString('base64');
}

async function post(url: string, auth: string, body: Record<string, string>): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: auth,
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: new URLSearchParams(body).toString(),
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await response.text();
    const parsed: unknown = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const error = parsed as { errorCode?: string; errorMessage?: string };
      throw new EpicError(
        error.errorMessage ?? `Epic ответил ${response.status}`,
        error.errorCode ?? 'unknown',
        response.status,
      );
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

interface TokenResponse {
  access_token: string;
  account_id?: string;
  displayName?: string;
  expires_in: number;
}

/** A client-level token. Identifies the app, not a person. */
async function clientToken(client: EpicClient): Promise<string> {
  const body = (await post(`${ACCOUNT}/oauth/token`, `basic ${basic(client)}`, {
    grant_type: 'client_credentials',
  })) as TokenResponse;
  return body.access_token;
}

export interface DeviceCode {
  /** What the seller types at epicgames.com/activate. */
  userCode: string;
  /** What we poll with. Never shown. */
  deviceCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  /** Seconds until the code stops working — Epic gives 600. */
  expiresIn: number;
  /** Seconds Epic asks us to wait between polls. */
  interval: number;
  /** Which client the code belongs to; polling must use the same one. */
  client: string;
}

/**
 * Starts a login. Walks the client list so a disabled client degrades to the
 * next one instead of to a dead feature.
 */
export async function startDeviceAuth(): Promise<DeviceCode> {
  let last: unknown;
  for (const client of CLIENTS) {
    try {
      const token = await clientToken(client);
      const body = (await post(`${ACCOUNT}/oauth/deviceAuthorization`, `bearer ${token}`, {
        prompt: 'login',
      })) as {
        user_code: string;
        device_code: string;
        verification_uri: string;
        verification_uri_complete: string;
        expires_in: number;
        interval: number;
      };
      return {
        userCode: body.user_code,
        deviceCode: body.device_code,
        verificationUri: body.verification_uri,
        verificationUriComplete: body.verification_uri_complete,
        expiresIn: body.expires_in,
        interval: body.interval,
        client: client.name,
      };
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error('Epic не выдал код устройства');
}

export interface Session {
  accessToken: string;
  accountId: string;
  displayName: string;
}

export type PollResult =
  | { status: 'pending' }
  | { status: 'expired' }
  | { status: 'ok'; session: Session };

/**
 * Asks whether the seller has finished signing in.
 *
 * Epic reports "not yet" as an HTTP 400 carrying a specific error code, so a
 * pending login and a real failure look alike until that code is read. Getting
 * it wrong shows an error while the seller is still typing.
 */
export async function pollDeviceAuth(deviceCode: string, clientName: string): Promise<PollResult> {
  const client = CLIENTS.find((entry) => entry.name === clientName) ?? CLIENTS[0];
  try {
    const body = (await post(`${ACCOUNT}/oauth/token`, `basic ${basic(client)}`, {
      grant_type: 'device_code',
      device_code: deviceCode,
    })) as TokenResponse;
    if (!body.account_id) throw new Error('Epic вернул токен без аккаунта');
    return {
      status: 'ok',
      session: {
        accessToken: body.access_token,
        accountId: body.account_id,
        displayName: body.displayName ?? body.account_id,
      },
    };
  } catch (error) {
    if (error instanceof EpicError) {
      if (
        error.code === 'errors.com.epicgames.account.oauth.authorization_pending' ||
        // Polling faster than Epic's stated interval. Backing off is the whole
        // remedy, and the loop already waits before asking again.
        error.code === 'errors.com.epicgames.account.oauth.slow_down'
      ) {
        return { status: 'pending' };
      }
      if (
        error.code === 'errors.com.epicgames.account.oauth.expired_device_code' ||
        // What Epic actually answers for a code that has run out or been
        // consumed — verified against a made-up device_code, which returns
        // this rather than `expired_device_code`. Without it the seller is
        // shown the raw string "invalid_grant" instead of being told to ask
        // for a new code.
        error.code === 'errors.com.epicgames.common.oauth.invalid_grant' ||
        error.code === 'errors.com.epicgames.not_found'
      ) {
        return { status: 'expired' };
      }
    }
    throw error;
  }
}

/**
 * Invalidates the token.
 *
 * Called on every path out of a read, successful or not. An unkilled token
 * stays valid for eight hours; killing it means that even if one leaked from a
 * crash dump or a proxy log, it is already useless by the time anyone reads it.
 */
export async function killSession(accessToken: string): Promise<void> {
  try {
    await fetch(`${ACCOUNT}/oauth/sessions/kill/${accessToken}`, {
      method: 'DELETE',
      headers: { authorization: `bearer ${accessToken}` },
      cache: 'no-store',
    });
  } catch {
    // The read already succeeded; failing to tidy up must not turn that into an
    // error for the seller. The token expires on its own regardless.
  }
}
