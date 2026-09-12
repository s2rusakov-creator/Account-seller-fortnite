import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface MailboxOption {
  dealId: string;
  address: string;
  password: string | null;
}

/**
 * Ящики продавца — чтобы выбрать нужный прямо в панели оффера.
 *
 * В Fortnite у аккаунта нет тега, по которому связку можно найти самой, а
 * ящиков у продавца обычно несколько. Список приходит из бота: он их и
 * выдаёт, он же знает, какой за кем закреплён.
 */
export async function GET(request: Request) {
  const url = process.env.BOT_NOTIFY_URL;
  const key = process.env.BOT_NOTIFY_KEY;
  if (!url || !key) return NextResponse.json({ boxes: [] });

  // Заголовок ставит middleware: "tg:123456" — это чат продавца.
  const caller = request.headers.get('x-caller') ?? '';
  const chatId = Number(caller.startsWith('tg:') ? caller.slice(3) : '');
  if (!Number.isFinite(chatId) || chatId <= 0) return NextResponse.json({ boxes: [] });

  try {
    const response = await fetch(new URL('/api/mailboxes', url).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ chatId }),
    });
    if (!response.ok) return NextResponse.json({ boxes: [] });
    return NextResponse.json(await response.json());
  } catch {
    // Бот недоступен — список будет пуст, поля заполняются руками.
    return NextResponse.json({ boxes: [] });
  }
}
