import { iconUrl, proxied } from '@/lib/fortnite/images';
import { notableName } from '@/lib/fortnite/notable';
import { rarityStyle, typeLabel } from '@/lib/fortnite/rarity';
import type { OwnedItem } from '@/lib/fortnite/types';

/**
 * Renders the owned cosmetics as 2560x1440 pages — the screenshots that go
 * into a marketplace listing.
 *
 * Done in the browser rather than on the server: the art is already being
 * fetched for the grid, a canvas costs nothing, and a server-side renderer
 * would need a headless browser or a native canvas binding for a picture the
 * seller is going to look at before using anyway.
 */

export interface CollagePage {
  filename: string;
  contentType: string;
  /** For <img src> and for the download link. */
  dataUrl: string;
  itemCount: number;
}

export const WIDTH = 2560;
export const HEIGHT = 1440;

const PAD = 40;
const HEADER = 118;
const CELL_W = 172;
const CELL_H = 196;
const ART = 132;

const COLS = Math.floor((WIDTH - PAD * 2) / CELL_W);
const ROWS = Math.floor((HEIGHT - HEADER - PAD) / CELL_H);

/** How many tiles fit on one page — 14 columns by 6 rows. */
export const ITEMS_PER_PAGE = Math.max(1, COLS * ROWS);

export function pageCount(itemCount: number): number {
  return Math.max(1, Math.ceil(itemCount / ITEMS_PER_PAGE));
}

export function slug(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'items'
  );
}

const imageCache = new Map<string, HTMLImageElement>();

/**
 * Concurrent fetches. High enough that a 2000-item locker finishes, low enough
 * that fortnite-api.com does not start refusing — a refused image is a blank
 * tile in a sales picture, which the seller cannot tell from an item that
 * genuinely has no art.
 */
const CONCURRENCY = 8;
const RETRIES = 3;

async function mapLimited<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        await worker(items[index], index);
      }
    }),
  );
}

function attemptLoad(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth > 0 ? image : null);
    image.onerror = () => resolve(null);
    image.src = proxied(url);
  });
}

export async function loadImage(url: string): Promise<HTMLImageElement | null> {
  const cached = imageCache.get(url);
  if (cached) return cached;

  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const image = await attemptLoad(url);
    if (image) {
      imageCache.set(url, image);
      return image;
    }
    // Only successes are cached: caching a failure would reproduce the same
    // holes from memory on every later render without ever asking again.
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  return null;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Fits art inside the tile without distorting it. */
function drawContained(
  ctx: CanvasRenderingContext2D,
  art: HTMLImageElement,
  x: number,
  y: number,
): void {
  const scale = Math.min(ART / art.naturalWidth, ART / art.naturalHeight);
  const width = art.naturalWidth * scale;
  const height = art.naturalHeight * scale;
  ctx.drawImage(art, x + (ART - width) / 2, y + (ART - height) / 2, width, height);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut}…`;
}

const QUALITY = 0.86;

/**
 * WebP, not PNG.
 *
 * These pages are mostly photographic character art, which PNG stores
 * losslessly at roughly 3 MB a page — a full locker is then far past what any
 * marketplace accepts as a screenshot. WebP lands the same page near a fifth
 * of that with no visible difference at tile scale. A browser that cannot
 * encode a requested type hands back PNG rather than failing, so check what
 * actually came back instead of trusting the request.
 */
function encode(canvas: HTMLCanvasElement): {
  dataUrl: string;
  contentType: string;
  extension: string;
} {
  const webp = canvas.toDataURL('image/webp', QUALITY);
  if (webp.startsWith('data:image/webp')) {
    return { dataUrl: webp, contentType: 'image/webp', extension: 'webp' };
  }
  const jpeg = canvas.toDataURL('image/jpeg', QUALITY);
  if (jpeg.startsWith('data:image/jpeg')) {
    return { dataUrl: jpeg, contentType: 'image/jpeg', extension: 'jpg' };
  }
  return { dataUrl: canvas.toDataURL('image/png'), contentType: 'image/png', extension: 'png' };
}

export interface CollageMeta {
  displayName: string;
  /** What the current filter selected, e.g. "Скины · Icon Series". */
  filterLabel: string;
  /** Hides the account name on the picture — a listing screenshot is public. */
  hideName?: boolean;
  onProgress?: (done: number, total: number) => void;
}

export async function renderCollage(
  items: OwnedItem[],
  meta: CollageMeta,
): Promise<CollagePage[]> {
  const total = pageCount(items.length);
  const pages: CollagePage[] = [];

  for (let page = 0; page < total; page++) {
    const slice = items.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas недоступен в этом браузере.');

    const backdrop = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    backdrop.addColorStop(0, '#151a3a');
    backdrop.addColorStop(1, '#07070f');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px system-ui, sans-serif';
    ctx.fillText(meta.hideName ? 'Fortnite — раздевалка' : meta.displayName, PAD, 62);
    ctx.fillStyle = '#4fc3ff';
    ctx.font = '600 26px system-ui, sans-serif';
    ctx.fillText(
      `${items.length} предметов · ${meta.filterLabel} · страница ${page + 1} из ${total}`,
      PAD,
      98,
    );

    await mapLimited(slice, CONCURRENCY, async (item, index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const x = PAD + col * CELL_W;
      const y = HEADER + row * CELL_H;
      const style = rarityStyle(item.rarity);

      const tile = ctx.createLinearGradient(x - 8, y - 8, x - 8, y + CELL_H - 22);
      tile.addColorStop(0, style.from);
      tile.addColorStop(1, style.to);
      ctx.fillStyle = tile;
      roundRect(ctx, x - 8, y - 8, CELL_W - 12, CELL_H - 14, 12);
      ctx.fill();
      // The unobtainable skins get a gold frame: on a page of eighty tiles a
      // buyer should find Renegade Raider without reading every caption.
      const notable = notableName(item.id);
      ctx.strokeStyle = notable ? '#ffd447' : style.accent;
      ctx.lineWidth = notable ? 4 : 2;
      ctx.stroke();

      const art = item.art ? await loadImage(iconUrl(item.id)) : null;
      if (art) {
        drawContained(ctx, art, x, y);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.06)';
        ctx.fillRect(x, y, ART, ART);
        ctx.fillStyle = style.accent;
        ctx.font = 'bold 40px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.name.slice(0, 2).toUpperCase(), x + ART / 2, y + ART / 2 + 14);
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(fitText(ctx, item.name, CELL_W - 24), x + ART / 2, y + ART + 26);
      ctx.fillStyle = style.accent;
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = notable ? '#ffd447' : style.accent;
      ctx.fillText(
        fitText(ctx, item.unknown ? 'Новый предмет' : typeLabel(item.type), CELL_W - 24),
        x + ART / 2,
        y + ART + 46,
      );
      ctx.textAlign = 'left';
    });

    const { dataUrl, contentType, extension } = encode(canvas);
    pages.push({
      filename: `fortnite-${slug(meta.filterLabel)}-${page + 1}.${extension}`,
      contentType,
      dataUrl,
      itemCount: slice.length,
    });

    meta.onProgress?.(page + 1, total);
    // Let the progress the caller just set actually paint before the next page
    // takes the main thread again.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return pages;
}
