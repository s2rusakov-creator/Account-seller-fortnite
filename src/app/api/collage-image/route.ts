import { NextResponse } from 'next/server';
import { hostCollageImages, imageHostingConfigured } from '@/lib/marketplaces/image-hosting';
import { MAX_TOTAL_IMAGE_BYTES, formatBytes, wireBytes } from '@/lib/upload-limits';

export const dynamic = 'force-dynamic';

/**
 * Publishes one collage page and returns its URL.
 *
 * The batch cannot travel inside the create request: a serverless body accepts
 * around 4.5 MB, which is eight pages, and a full Fortnite locker runs to
 * twenty-four. Splitting the upload in two does not help either — the second
 * create replaces the first one's pictures on the marketplace.
 *
 * A page at a time removes the ceiling. Each request carries one image of a
 * few hundred KB, the create request that follows carries only URLs, and the
 * marketplace fetches the pictures itself — which is what GameBoost wanted all
 * along, since it takes links rather than uploads.
 */

interface Body {
  accountId?: string;
  filename?: string;
  contentType?: string;
  base64?: string;
}

export async function POST(request: Request) {
  if (!imageHostingConfigured()) {
    return NextResponse.json(
      { error: 'Хранилище картинок не подключено — коллаж негде опубликовать.' },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Тело запроса должно быть JSON.' }, { status: 400 });
  }

  const { accountId, filename, contentType, base64 } = body;
  if (!accountId || !filename || !contentType || !base64) {
    return NextResponse.json(
      { error: 'Нужны accountId, filename, contentType и base64.' },
      { status: 400 },
    );
  }

  // One page still has to fit in one request. The same ceiling as before, but
  // now it bounds a single picture rather than the whole listing.
  const bytes = wireBytes(base64);
  if (bytes > MAX_TOTAL_IMAGE_BYTES) {
    return NextResponse.json(
      {
        error:
          `Страница весит ${formatBytes(bytes)} — больше ${formatBytes(MAX_TOTAL_IMAGE_BYTES)}, ` +
          'которые проходят в одном запросе.',
      },
      { status: 400 },
    );
  }

  try {
    const [hosted] = await hostCollageImages([{ filename, contentType, base64 }], accountId);
    return NextResponse.json({ url: hosted.url, filename: hosted.filename });
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : 'Не удалось опубликовать страницу' },
      { status: 502 },
    );
  }
}
