export interface LinkedMailbox { found: true; dealId: string; address: string; password: string; label?: string }

/** Explicit deal requests must fail closed instead of selecting the latest/free mailbox. */
export async function linkedMailbox(request: Request, dealId: string, game: 'bs' | 'fn', tag?: string): Promise<LinkedMailbox> {
  const chatId = Number(request.headers.get('x-caller')?.replace(/^tg:/, ''));
  const base = process.env.BOT_NOTIFY_URL, key = process.env.BOT_NOTIFY_KEY;
  if (!/^\w{1,64}$/.test(dealId) || !Number.isSafeInteger(chatId) || chatId <= 0 || !request.headers.get('x-caller')?.startsWith('tg:') || !base || !key) {
    throw new Error('Откройте публикацию из карточки сделки в Telegram.');
  }
  try {
    const response = await fetch(new URL('/api/mailbox', base), {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
      headers: { 'content-type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ chatId, dealId, game, ...(tag ? { tag } : {}) }),
    });
    if (!response.ok) throw new Error('Unavailable');
    const box = await response.json() as Partial<LinkedMailbox>;
    if (!box.found || box.dealId !== dealId || !box.address || !box.password) throw new Error('Unavailable');
    return box as LinkedMailbox;
  } catch {
    throw new Error('Ящик этой сделки недоступен. Проверьте карточку в боте и откройте публикацию заново.');
  }
}

export async function verifyLinkedMailbox(request: Request, dealId: string, game: 'bs' | 'fn', credentials: { email?: string; emailPassword?: string }, tag?: string): Promise<void> {
  const box = await linkedMailbox(request, dealId, game, tag);
  if (credentials.email?.trim().toLowerCase() !== box.address.toLowerCase() || credentials.emailPassword !== box.password) {
    throw new Error('Почта не совпадает с выбранной сделкой. Откройте её карточку в боте заново.');
  }
}
