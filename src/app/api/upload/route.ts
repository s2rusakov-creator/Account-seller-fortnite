import { NextResponse } from 'next/server';
import { getAdapter } from '@/lib/marketplaces';
import { hostCollageImages, imageHostingConfigured } from '@/lib/marketplaces/image-hosting';
import type { CollageImage, ListingInput, ListingStats, UploadResult } from '@/lib/marketplaces/types';
import { MAX_TOTAL_IMAGE_BYTES, formatBytes, wireBytes } from '@/lib/upload-limits';
import { notifyBot } from '@/lib/notify-bot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface UploadBody {
  accountId?: string;
  displayName?: string;
  stats?: ListingStats;
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  marketplaces?: string[];
  dryRun?: boolean;
  gameSlug?: string;
  credentials?: {
    login?: string;
    password?: string;
    email?: string;
    emailPassword?: string;
    notes?: string;
  };
  images?: { filename?: string; contentType?: string; base64?: string }[];
  /** Pages already published by /api/collage-image, sent instead of bytes. */
  imageUrls?: string[];
}

type Checked = { error: string } | { input: ListingInput; ids: string[]; dryRun: boolean };

function validate(body: UploadBody): Checked {
  const dryRun = body.dryRun === true;

  if (!body.accountId?.trim()) return { error: 'Не указан аккаунт — сначала прочитайте раздевалку.' };
  if (!body.title?.trim()) return { error: 'Заголовок обязателен.' };
  if (!body.description?.trim()) return { error: 'Описание обязательно.' };

  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0) return { error: 'Цена должна быть положительным числом.' };
  /**
   * A ceiling, because the marketplace has none and breaks instead.
   *
   * In the Brawl Stars build a price of ten billion passed GameBoost's own
   * validation and came back HTTP 500 — the shape of a number too large for
   * the column behind it — with nothing naming the field. No account sells for
   * six figures; refusing here names the problem instead.
   */
  if (price > 100_000) {
    return {
      error:
        `Цена ${price.toLocaleString('ru-RU')} вне диапазона — маркетплейс ответит 500, а не отказом. ` +
        'Проверьте лишний ноль.',
    };
  }

  const ids = Array.isArray(body.marketplaces) ? body.marketplaces : [];
  if (ids.length === 0) return { error: 'Выберите хотя бы одну площадку.' };
  for (const id of ids) {
    if (!getAdapter(id)) return { error: `Неизвестная площадка: ${id}` };
  }

  const login = body.credentials?.login?.trim() ?? '';
  const password = body.credentials?.password ?? '';
  // A real upload creates a sellable offer, so the buyer must actually receive
  // something; a dry run is only a payload preview and needs no credentials.
  if (!dryRun && (!login || !password)) {
    return { error: 'Для реальной загрузки нужны логин и пароль автовыдачи.' };
  }

  const images: CollageImage[] = [];
  let totalBytes = 0;
  for (const [index, image] of (body.images ?? []).entries()) {
    if (!image?.base64) continue;
    const base64 = image.base64.replace(/^data:[^,]+,/, '');
    totalBytes += wireBytes(base64);
    images.push({
      filename: image.filename ?? `collage-${index + 1}.webp`,
      contentType: image.contentType ?? 'image/webp',
      base64,
    });
  }
  if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
    return {
      error:
        `Картинки весят ${formatBytes(totalBytes)} — больше ${formatBytes(MAX_TOTAL_IMAGE_BYTES)}, ` +
        'которые проходят в одном запросе. Публикуйте страницы по одной через /api/collage-image: ' +
        'полная раздевалка в один запрос не влезает никогда.',
    };
  }

  return {
    ids,
    dryRun,
    input: {
      account: {
        accountId: body.accountId.trim(),
        displayName: body.displayName?.trim() || 'Fortnite',
      },
      stats: body.stats ?? {},
      // Pages the browser published one at a time before calling this, so a
      // listing is not capped at what one request body can carry.
      imageUrls: (body.imageUrls ?? []).filter((url) => typeof url === 'string' && url.length > 0),
      title: body.title.trim(),
      description: body.description.trim(),
      price,
      currency: body.currency?.trim() || 'USD',
      credentials: {
        login,
        password,
        email: body.credentials?.email?.trim() || undefined,
        emailPassword: body.credentials?.emailPassword || undefined,
        notes: body.credentials?.notes?.trim() || undefined,
      },
      images,
      gameSlug: body.gameSlug?.trim() || 'fortnite',
    },
  };
}

/**
 * Creates the offer on every selected marketplace.
 *
 * Each adapter runs independently so one failing platform never blocks the
 * other, and a dry run returns the exact payload without contacting anyone.
 */
export async function POST(request: Request) {
  let body: UploadBody;
  try {
    body = (await request.json()) as UploadBody;
  } catch {
    return NextResponse.json({ error: 'Тело запроса должно быть JSON.' }, { status: 400 });
  }

  const checked = validate(body);
  if ('error' in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

  // GameBoost takes links, not uploads, so any pictures still travelling as
  // bytes have to be published before the offer can point at them. A dry run
  // skips this: it contacts no marketplace and should leave no files behind.
  if (!checked.dryRun && checked.input.images.length) {
    // Skipping quietly here would make the adapter fail later with "generate
    // the collage first" — which is wrong, and sends the seller off to
    // re-render a collage that already exists. Say what is actually missing.
    if (!imageHostingConfigured()) {
      return NextResponse.json(
        {
          error:
            'Коллаж негде опубликовать: хранилище картинок не подключено. GameBoost принимает ' +
            'ссылки, а не загрузки, — подключите Vercel Blob к проекту (он сам задаст токен).',
        },
        { status: 503 },
      );
    }

    try {
      const hosted = await hostCollageImages(checked.input.images, checked.input.account.accountId);
      // Appended, not assigned: the caller may have published most pages one
      // at a time and sent the last one's bytes along, and replacing here
      // would drop every picture but that one from the listing.
      checked.input.imageUrls = [...checked.input.imageUrls, ...hosted.map((image) => image.url)];
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Не удалось опубликовать коллаж' },
        { status: 502 },
      );
    }
  }

  const results: UploadResult[] = await Promise.all(
    checked.ids.map(async (id) => {
      const adapter = getAdapter(id)!;
      try {
        return await adapter.upload(checked.input, { dryRun: checked.dryRun });
      } catch (error) {
        return {
          marketplace: adapter.id,
          label: adapter.label,
          ok: false,
          dryRun: checked.dryRun,
          error: error instanceof Error ? error.message : 'Загрузка не удалась',
        };
      }
    }),
  );

  // Журнал сделок ведёт бот, и узнать о публикации ему больше неоткуда.
  if (!checked.dryRun && results.some((result) => result.ok)) {
    await notifyBot(request.headers.get('x-caller'), {
      game: 'fn',
      label: checked.input.account.displayName,
      price: checked.input.price,
      listings: results
        .filter((result) => result.ok)
        .map((result) => ({ marketplace: result.label, url: result.offerUrl })),
    });
  }

  return NextResponse.json({ dryRun: checked.dryRun, results });
}
