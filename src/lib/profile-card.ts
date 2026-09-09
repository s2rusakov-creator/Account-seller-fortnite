import { featuredUrl, iconUrl } from '@/lib/fortnite/images';
import { renderRarityStyle } from '@/lib/fortnite/rarity';
import type { LockerResult, OwnedItem } from '@/lib/fortnite/types';
import { breakdown, headlineItems } from '@/lib/listing';
import { loadImage, type CollagePage } from '@/lib/collage';

/**
 * The account's headline, drawn as one picture.
 *
 * Competing listings open with a single image that states what the account is
 * — not a grid of two thousand tiles, which answers "what is in here" but not
 * "is this worth my money". This is that image: the best skin on the account
 * rendered large, the numbers a buyer scans for, and the names that move the
 * price.
 *
 * Deliberately not a dashboard. Flat panels and a system font read as a
 * report; the screen this imitates is built from a large character, heavy
 * type, and saturated colour, and those are what it draws.
 */

const WIDTH = 1600;
const HEIGHT = 900;
const PAD = 56;

/** The right-hand column of numbers. */
const PANEL_X = 980;
const PANEL_W = WIDTH - PANEL_X - PAD;

export interface ProfileCardInput {
  locker: LockerResult;
  /** Already sorted: the first notable or rarest item becomes the hero. */
  items: OwnedItem[];
  hideName?: boolean;
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

/**
 * The skin the card is built around.
 *
 * The item list arrives sorted by what a buyer pays for, so the first outfit
 * in it is the right hero — but only an outfit will do: a card headlined by a
 * pickaxe looks like a mistake even when the pickaxe is the rarest thing on
 * the account.
 */
function heroItem(items: OwnedItem[]): OwnedItem | undefined {
  return items.find((item) => item.type === 'outfit' && item.art) ?? items.find((item) => item.art);
}

function panel(
  ctx: CanvasRenderingContext2D,
  y: number,
  height: number,
  accent: string,
): void {
  ctx.fillStyle = 'rgba(9, 12, 28, .82)';
  roundRect(ctx, PANEL_X, y, PANEL_W, height, 14);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();
}

export async function renderProfileCard(input: ProfileCardInput): Promise<CollagePage> {
  const { locker, items, hideName } = input;
  const hero = heroItem(items);
  const accent = renderRarityStyle(hero?.rarity ?? 'icon').accent;
  const { ogCount } = breakdown(items);

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен в этом браузере.');

  const backdrop = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  backdrop.addColorStop(0, renderRarityStyle(hero?.rarity ?? 'icon').from);
  backdrop.addColorStop(1, '#05060d');
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  /**
   * The character, as large as the canvas allows.
   *
   * `featured` is the wide shop render and is the right shape here; about a
   * third of the catalogue has none, so the square icon stands in — scaled to
   * the same height rather than stretched, since a stretched character is the
   * single thing that makes one of these look homemade.
   */
  if (hero) {
    const art =
      (await loadImage(featuredUrl(hero.id))) ?? (await loadImage(iconUrl(hero.id)));
    if (art) {
      const scale = Math.min((PANEL_X - PAD) / art.naturalWidth, (HEIGHT - 120) / art.naturalHeight);
      const w = art.naturalWidth * scale;
      const h = art.naturalHeight * scale;
      ctx.globalAlpha = 0.96;
      ctx.drawImage(art, PAD + (PANEL_X - PAD - w) / 2 - PAD / 2, HEIGHT - h - 40, w, h);
      ctx.globalAlpha = 1;
    }
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(hideName ? 'АККАУНТ FORTNITE' : locker.displayName.toUpperCase(), PAD, 92);

  ctx.fillStyle = accent;
  ctx.font = '600 30px system-ui, sans-serif';
  const outfits = items.filter((item) => item.type === 'outfit').length;
  ctx.fillText(`${outfits} скинов · ${items.length} предметов`, PAD, 138);

  // The numbers, one per row, largest label first.
  const rows: [string, string][] = [];
  if (ogCount) rows.push([String(ogCount), 'предметов 1–4 сезонов']);
  if (locker.stats.vbucks !== undefined) {
    rows.push([locker.stats.vbucks.toLocaleString('ru-RU'), 'В-Баксов']);
  }
  if (locker.stats.accountLevel !== undefined) {
    rows.push([String(locker.stats.accountLevel), 'уровень аккаунта']);
  }
  if (locker.stats.pastSeasons.length) {
    rows.push([String(locker.stats.pastSeasons.length), 'сезонов сыграно']);
  }
  if (locker.stats.lifetimeWins !== undefined) {
    rows.push([String(locker.stats.lifetimeWins), 'побед']);
  }
  if (locker.account?.platforms.length) {
    rows.push([String(locker.account.platforms.length), 'привязки платформ']);
  }

  let y = 190;
  const rowHeight = 86;
  for (const [value, label] of rows.slice(0, 6)) {
    panel(ctx, y, rowHeight - 12, accent);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.fillText(value, PANEL_X + 22, y + 48);
    ctx.fillStyle = 'rgba(255,255,255,.62)';
    ctx.font = '500 20px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(label, PANEL_X + PANEL_W - 22, y + 48);
    ctx.textAlign = 'left';
    y += rowHeight;
  }

  // The names, last, along the bottom — this is what a buyer searches for.
  const notable = headlineItems(items);
  if (notable.length) {
    ctx.fillStyle = '#ffd447';
    ctx.font = 'bold 26px system-ui, sans-serif';
    const text = notable.slice(0, 6).join(' · ');
    ctx.fillText(text, PAD, HEIGHT - 34, WIDTH - PAD * 2);
  }

  const dataUrl = canvas.toDataURL('image/webp', 0.9);
  const webp = dataUrl.startsWith('data:image/webp');
  return {
    filename: webp ? 'fortnite-profile.webp' : 'fortnite-profile.png',
    contentType: webp ? 'image/webp' : 'image/png',
    dataUrl: webp ? dataUrl : canvas.toDataURL('image/png'),
    itemCount: items.length,
  };
}
