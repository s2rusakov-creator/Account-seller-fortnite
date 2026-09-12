import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Почта, закреплённая за этой продажей в боте.
 *
 * В Fortnite у аккаунта нет тега: ник становится известен только после входа
 * в Epic, а ящик выбирают раньше — в боте, командой продажи. Поэтому здесь
 * спрашивается не «ящик такого-то аккаунта», а «ящик последней незакрытой
 * сделки по Fortnite».
 *
 * Молчание бота — не ошибка: ящика может не быть, и тогда продавец заполнит
 * поля сам.
 */
export async function GET(request: Request) {
  const url = process.env.BOT_NOTIFY_URL;
  const key = process.env.BOT_NOTIFY_KEY;
  if (!url || !key) return NextResponse.json({ found: false });

  // Заголовок ставит middleware: "tg:123456" — это чат продавца.
  const caller = request.headers.get('x-caller') ?? '';
  const chatId = Number(caller.startsWith('tg:') ? caller.slice(3) : '');
  if (!Number.isFinite(chatId) || chatId <= 0) return NextResponse.json({ found: false });

  try {
    const response = await fetch(new URL('/api/mailbox', url).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ chatId, game: 'fn' }),
    });
    if (!response.ok) return NextResponse.json({ found: false });
    return NextResponse.json(await response.json());
  } catch {
    // Бот недоступен — выкладка от этого зависеть не должна.
    return NextResponse.json({ found: false });
  }
}
