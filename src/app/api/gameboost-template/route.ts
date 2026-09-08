import { fetchGameboostTemplate } from '@/lib/marketplaces/gameboost';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * The live `account_data` schema for a game, straight from GameBoost.
 *
 * The adapter's Fortnite field names are a guess — no key was available to
 * check them against. This is how you check: configure GAMEBOOST_API_KEY, open
 * `/api/gameboost-template?slug=fortnite`, and diff the field list against
 * `buildPayload` in lib/marketplaces/gameboost.ts.
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug') ?? 'fortnite';
  try {
    return NextResponse.json({ slug, template: await fetchGameboostTemplate(slug) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Не удалось получить шаблон' },
      { status: 502 },
    );
  }
}
