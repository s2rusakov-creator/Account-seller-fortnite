import { NextResponse } from 'next/server';
import { issueSession, sessionCookie } from '@/lib/auth/session';
import { verifyInitData } from '@/lib/auth/telegram';

export const dynamic = 'force-dynamic';

/**
 * Вход из Mini App: подпись Telegram в обмен на куку.
 *
 * Страница /tg присылает сюда initData, дальше приложение работает обычными
 * запросами — ни один роут о Telegram не знает.
 */
export async function POST(request: Request) {
  let body: { initData?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
  }

  const user = await verifyInitData(body.initData ?? '');
  if (!user) {
    return NextResponse.json({ error: 'Подпись Telegram не принята' }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie(await issueSession(`tg:${user.id}`)));
  return response;
}
