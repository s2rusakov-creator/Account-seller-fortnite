import { SignJWT, jwtVerify } from 'jose';

/**
 * Кто пользуется сервисом.
 *
 * Пользователь один, поэтому паролей здесь нет вообще: личность подтверждает
 * Telegram — либо подписью Mini App, либо одноразовой ссылкой, которую выдаёт
 * бот. И то и другое обменивается на куку, дальше браузер работает как раньше.
 */

export const SESSION_COOKIE = 'as_session';

/** Сколько браузер помнит вход. */
export const SESSION_DAYS = 30;

/** Ссылка от бота живёт ровно столько, сколько нужно, чтобы по ней кликнуть. */
const LINK_MINUTES = 10;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error('AUTH_SECRET не задан');
  return new TextEncoder().encode(value);
}

/** В проде без секрета сервис закрывается целиком — это намеренно. */
export function authConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET);
}

async function sign(kind: 'session' | 'link', subject: string, expires: string): Promise<string> {
  return new SignJWT({ kind })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secret());
}

async function read(kind: 'session' | 'link', token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.kind !== kind || typeof payload.sub !== 'string') return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export const issueSession = (subject: string) => sign('session', subject, `${SESSION_DAYS}d`);
export const readSession = (token: string | undefined) => read('session', token);

/**
 * Билет для ссылки вида /api/auth/link?t=…
 *
 * Выписывает его бот — он единственный, кроме сервиса, кто знает AUTH_SECRET.
 */
export const issueLoginLink = (subject: string) => sign('link', subject, `${LINK_MINUTES}m`);
export const readLoginLink = (token: string | undefined) => read('link', token);

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: true,
    // Mini App в веб-версии Telegram живёт в iframe, и куке Lax туда не попасть.
    // Поэтому None, а подделку запросов ловит проверка Origin в middleware.
    sameSite: 'none' as const,
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

/**
 * Сравнение без утечки по времени: длина видна и так, а содержимое — нет.
 */
export function safeEqual(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i += 1) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Ключи машин, по одному на потребителя: "bot:9f3c…,cron:71ab…".
 *
 * Метка попадает в заголовок x-caller, поэтому в логах Vercel видно, кто
 * именно дёрнул /api/upload, а утёкший ключ отзывается по одному.
 */
export function apiKeyOwner(given: string | null): string | null {
  if (!given) return null;
  for (const entry of (process.env.API_KEYS ?? '').split(',')) {
    const at = entry.indexOf(':');
    if (at < 1) continue;
    const owner = entry.slice(0, at).trim();
    const key = entry.slice(at + 1).trim();
    if (key && safeEqual(given, key)) return owner;
  }
  return null;
}
