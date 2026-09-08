import { NextResponse } from 'next/server';

/**
 * Same-origin proxy for cosmetic art.
 *
 * The collage is drawn into a canvas and read back out with toDataURL(); a
 * cross-origin image would taint the canvas and make that read throw, so every
 * tile is loaded through here. Only fortnite-api.com is proxied, so this
 * cannot be pointed at arbitrary URLs.
 */
const ALLOWED_HOSTS = ['fortnite-api.com'];

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get('url');
  if (!target) return new NextResponse('Missing url', { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new NextResponse('Malformed url', { status: 400 });
  }

  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new NextResponse('Host not allowed', { status: 403 });
  }

  const upstream = await fetch(parsed.toString(), {
    headers: { accept: 'image/*' },
    next: { revalidate: 86400 },
  });
  if (!upstream.ok || !upstream.body) return new NextResponse('Upstream error', { status: 502 });

  return new NextResponse(upstream.body, {
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'image/png',
      'cache-control': 'public, max-age=86400, immutable',
    },
  });
}
