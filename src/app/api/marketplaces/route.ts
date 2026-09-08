import { ADAPTERS } from '@/lib/marketplaces';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Which platforms are ready to receive an offer.
 *
 * Keys live server-side, so the browser cannot work this out on its own — and
 * without it the seller only discovers a missing key after filling in a price
 * and a password.
 */
export async function GET() {
  return NextResponse.json({
    marketplaces: ADAPTERS.map((adapter) => ({
      id: adapter.id,
      label: adapter.label,
      configured: adapter.isConfigured(),
      missing: adapter.missingConfig(),
    })),
  });
}
