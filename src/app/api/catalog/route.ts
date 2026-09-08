import { getCatalog } from '@/lib/fortnite/catalog';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * The catalogue, for picking items by hand.
 *
 * Only reached by the manual mode — the path for a seller who will not sign in
 * to Epic, or for the day Epic disables the game client the device flow rides
 * on. The whole catalogue is 16 268 items and the browser has no use for all
 * of it at once, so a type filter is required and the response is capped.
 *
 * `art` is dropped from the payload: the client derives every URL from the id.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const types = (params.get('types') ?? 'outfit')
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean);
  const search = (params.get('search') ?? '').trim().toLowerCase();
  const limit = Math.min(3000, Number(params.get('limit') ?? 1500));

  const catalog = await getCatalog();
  const wanted = new Set(types);

  const matched = catalog.items.filter((item) => {
    if (wanted.size && !wanted.has(item.type)) return false;
    if (search && !`${item.name} ${item.set ?? ''}`.toLowerCase().includes(search)) return false;
    return true;
  });

  return NextResponse.json({
    total: matched.length,
    // Truncation is reported rather than hidden: a seller who scrolls to the
    // end of a silently cut list concludes the catalogue is missing items.
    truncated: matched.length > limit,
    items: matched.slice(0, limit),
  });
}
