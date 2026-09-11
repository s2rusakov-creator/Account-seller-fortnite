/**
 * Сообщение боту о том, что объявление выложено.
 *
 * Продавец уходит из чата в Mini App, публикует оффер — и должен вернуться к
 * готовой записи в журнале, а не переписывать ссылки руками.
 *
 * Ошибка здесь не должна ломать публикацию: объявление уже создано, и
 * несостоявшееся уведомление — не повод отдавать продавцу ошибку.
 */

interface Listing {
  marketplace: string;
  url?: string;
}

export async function notifyBot(caller: string | null, payload: {
  game: 'bs' | 'fn';
  label?: string;
  price?: number;
  listings: Listing[];
}): Promise<void> {
  const url = process.env.BOT_NOTIFY_URL;
  const key = process.env.BOT_NOTIFY_KEY;
  if (!url || !key) return;

  // Заголовок ставит middleware: "tg:123456" — это и есть чат продавца.
  const chatId = Number(caller?.startsWith('tg:') ? caller.slice(3) : '');
  if (!Number.isFinite(chatId) || chatId <= 0) return;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ chatId, ...payload }),
    });
  } catch {
    // Молча: журнал — удобство, а не часть публикации.
  }
}
