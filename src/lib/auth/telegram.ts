/**
 * Проверка подписи Mini App.
 *
 * Telegram отдаёт странице строку initData, подписанную токеном бота. Кто
 * знает токен — тот может проверить подпись, и это доказывает и то, что данные
 * не подделаны, и то, кто именно открыл приложение. Ни паролей, ни логинов.
 *
 * Алгоритм описан у Telegram: ключ выводится как HMAC("WebAppData", token),
 * им подписывается строка из отсортированных пар key=value без самого hash.
 */

/** Подпись старше суток не принимается, даже если она верная. */
const MAX_AGE_SECONDS = 24 * 60 * 60;

async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const imported = await crypto.subtle.importKey(
    'raw',
    key as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', imported, new TextEncoder().encode(message));
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface TelegramUser {
  id: number;
  username?: string;
}

/**
 * Возвращает пользователя, если подпись верна, он свежая и id в списке
 * разрешённых. Во всех остальных случаях — null, без объяснений наружу.
 */
export async function verifyInitData(initData: string): Promise<TelegramUser | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = await hmac(new TextEncoder().encode('WebAppData'), token);
  if (hex(await hmac(secretKey, checkString)) !== hash) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;

  let user: TelegramUser;
  try {
    user = JSON.parse(params.get('user') ?? '') as TelegramUser;
  } catch {
    return null;
  }
  if (!user?.id) return null;

  const allowed = (process.env.TELEGRAM_ALLOWED_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(String(user.id))) return null;

  return user;
}
