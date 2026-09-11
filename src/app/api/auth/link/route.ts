import { NextResponse } from 'next/server';
import { issueSession, readLoginLink, sessionCookie } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Вход по ссылке от бота.
 *
 * Бот присылает кнопку со ссылкой на этот адрес, клик ставит куку на тридцать
 * дней и уводит на главную. Сам билет живёт десять минут, поэтому попавшая в
 * чужие руки ссылка бесполезна почти сразу.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('t') ?? undefined;
  const subject = await readLoginLink(token);
  if (!subject) {
    return new NextResponse('Ссылка истекла — попросите у бота новую.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.set(sessionCookie(await issueSession(subject)));
  return response;
}
