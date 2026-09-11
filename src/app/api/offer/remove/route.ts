import { NextResponse } from 'next/server';
import { getAdapter } from '@/lib/marketplaces';

export const dynamic = 'force-dynamic';

/**
 * Снимает объявление с площадки.
 *
 * Зовётся, когда сделку отмечают проданной. Пока объявление висит, его может
 * купить второй человек — а это возврат, спор и штраф площадки, причём
 * заметит его обычно уже покупатель.
 *
 * Площадки обрабатываются по отдельности: неудача на одной не должна отменять
 * снятие на другой.
 */
export async function POST(request: Request) {
  let body: { offers?: { marketplace?: string; offerId?: string }[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Тело запроса должно быть JSON.' }, { status: 400 });
  }

  const offers = (body.offers ?? []).filter((offer) => offer.marketplace && offer.offerId);
  if (offers.length === 0) return NextResponse.json({ error: 'Нечего снимать.' }, { status: 400 });

  const results = await Promise.all(
    offers.map(async (offer) => {
      const adapter = getAdapter(offer.marketplace!);
      if (!adapter) return { marketplace: offer.marketplace!, ok: false, error: 'Неизвестная площадка' };
      if (!adapter.remove) {
        return { marketplace: adapter.label, ok: false, error: 'Площадка не умеет снимать объявления через API' };
      }

      try {
        await adapter.remove(offer.offerId!);
        return { marketplace: adapter.label, ok: true };
      } catch (error) {
        return {
          marketplace: adapter.label,
          ok: false,
          error: error instanceof Error ? error.message : 'Не удалось снять',
        };
      }
    }),
  );

  return NextResponse.json({ results });
}
