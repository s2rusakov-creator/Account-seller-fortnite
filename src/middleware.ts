import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, apiKeyOwner, authConfigured, readSession } from '@/lib/auth/session';

/**
 * Единственная дверь в сервис.
 *
 * Внутрь пускают три ключа: заголовок бота, кука после входа и — на странице
 * /tg — подпись Mini App, которая на куку и меняется. Роуты об этом не знают
 * и не менялись.
 *
 * Без AUTH_SECRET в проде не открывается ничего: пустая переменная не должна
 * молча превращаться в открытый /api/upload с ключом GameBoost внутри.
 */

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};

/** Путь входа: сюда пускают без куки, иначе войти было бы нечем. */
const OPEN_PATHS = ['/api/auth/', '/tg'];

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function forbid(request: NextRequest, reason: string) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: reason }, { status: 403 });
  }
  return new NextResponse(reason, { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

export async function middleware(request: NextRequest) {
  // Локальная разработка остаётся как была — закрывается только прод.
  if (process.env.NODE_ENV !== 'production') return NextResponse.next();

  if (!authConfigured()) {
    return forbid(request, 'Сервис не настроен: нет AUTH_SECRET.');
  }

  const { pathname } = request.nextUrl;
  if (OPEN_PATHS.some((path) => pathname === path || pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Кто пришёл — видно дальше по заголовку x-caller: роуты берут из него
  // Telegram ID, чтобы бот знал, в какой чат писать о публикации.
  const pass = (caller: string) => {
    const headers = new Headers(request.headers);
    headers.set('x-caller', caller);
    return NextResponse.next({ request: { headers } });
  };

  const owner = apiKeyOwner(request.headers.get('x-api-key'));
  if (owner) return pass(owner);

  const subject = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!subject) {
    return forbid(request, 'Нужен вход через бота.');
  }

  // Кука ходит с SameSite=None ради Mini App, поэтому подделку запросов
  // с чужой страницы ловим по Origin — у машин его нет, но у них есть ключ.
  if (MUTATING.has(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== request.headers.get('host')) {
      return forbid(request, 'Чужой origin.');
    }
  }

  return pass(subject);
}
