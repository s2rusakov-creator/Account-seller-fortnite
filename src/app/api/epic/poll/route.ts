import { killSession, pollDeviceAuth } from '@/lib/epic/client';
import { readLocker } from '@/lib/epic/locker';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
// A large locker plus the catalogue on a cold start runs past the default.
export const maxDuration = 60;

/**
 * Asks Epic whether the sign-in finished, and reads the locker the moment it
 * has.
 *
 * The token never leaves this request: it is created here, spent here, and
 * killed here. That is the whole reason the read happens inside the poll
 * rather than in a separate call the client would have to hold a token for.
 */
export async function POST(request: Request) {
  let body: { deviceCode?: string; client?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
  }

  if (!body.deviceCode || !body.client) {
    return NextResponse.json({ error: 'Нет кода устройства' }, { status: 400 });
  }

  let session;
  try {
    const result = await pollDeviceAuth(body.deviceCode, body.client);
    if (result.status !== 'ok') return NextResponse.json({ status: result.status });
    session = result.session;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ошибка авторизации Epic' },
      { status: 502 },
    );
  }

  try {
    const locker = await readLocker(session);
    return NextResponse.json({ status: 'ok', locker });
  } catch (error) {
    // readLocker kills the token on its own way out, but not if it threw
    // before reaching its own finally — kill it again, which is harmless.
    await killSession(session.accessToken);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Не удалось прочитать раздевалку' },
      { status: 502 },
    );
  }
}
