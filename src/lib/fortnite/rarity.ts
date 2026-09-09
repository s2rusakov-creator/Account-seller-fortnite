import { notableName } from './notable';
import type { Cosmetic } from './types';

/**
 * How an item is labelled and coloured.
 *
 * Fortnite shows a series in place of a rarity when an item has one — an Icon
 * Series skin is never called "Rare" in game even though the API still reports
 * a rarity for it. The API encodes both in the same `rarity.value` field
 * (`icon`, `marvel`, `dc`, …), so one table covers them.
 *
 * There are two palettes here and they are not interchangeable:
 *
 *   `RARITIES` is the light one, for the interface.
 *   `RENDER_RARITIES` is the dark one, for the canvas.
 *
 * The canvas draws the collage and the profile card — pictures that go onto a
 * marketplace listing, not onto this page. Fortnite art is cut for a dark
 * ground, rarity colours wash out on white, and a pale collage loses to the
 * listings next to it in search results. So the interface went light and the
 * render stayed dark, and the two need separate colours.
 */

export interface RarityStyle {
  label: string;
  /** Tile fill, top and bottom of the gradient. */
  from: string;
  to: string;
  /** Border, accent bar, and secondary text. */
  accent: string;
  /** Sort weight, high to low, roughly by what an account buyer pays for. */
  weight: number;
}

/** The interface palette: pale fill, saturated border, dark ink. */
export const RARITIES: Record<string, RarityStyle> = {
  mythic:        { label: 'Мифический',     from: '#fff7dc', to: '#ffeab2', accent: '#8a6410', weight: 100 },
  icon:          { label: 'Icon Series',    from: '#ddf7f7', to: '#b7edef', accent: '#0a6a70', weight: 95 },
  dark:          { label: 'Dark Series',    from: '#f9e7fd', to: '#efc9f8', accent: '#7a1e94', weight: 90 },
  shadow:        { label: 'Shadow Series',  from: '#edeff2', to: '#dadde4', accent: '#43494f', weight: 88 },
  slurp:         { label: 'Slurp Series',   from: '#ddf9ee', to: '#b3f0da', accent: '#0a6b52', weight: 86 },
  lava:          { label: 'Lava Series',    from: '#ffe9dc', to: '#ffd0b4', accent: '#9c3d0a', weight: 84 },
  frozen:        { label: 'Frozen Series',  from: '#e6f5ff', to: '#c2e7fd', accent: '#0f5f87', weight: 82 },
  marvel:        { label: 'MARVEL',         from: '#ffe5e5', to: '#ffc7c7', accent: '#a81c22', weight: 80 },
  dc:            { label: 'DC',             from: '#e4eafa', to: '#c4d4f2', accent: '#1b3f8f', weight: 78 },
  starwars:      { label: 'Star Wars',      from: '#eaecf4', to: '#d2d6e6', accent: '#3c4468', weight: 76 },
  gaminglegends: { label: 'Gaming Legends', from: '#ece9fe', to: '#d4cefc', accent: '#4b2fb0', weight: 74 },
  legendary:     { label: 'Легендарный',    from: '#fff1de', to: '#ffdfb7', accent: '#8f5406', weight: 60 },
  epic:          { label: 'Эпический',      from: '#f2e9fd', to: '#dfcefb', accent: '#6a2bc4', weight: 50 },
  rare:          { label: 'Редкий',         from: '#e3effe', to: '#c1ddfc', accent: '#0f5bbd', weight: 40 },
  uncommon:      { label: 'Необычный',      from: '#e9f7dd', to: '#cfefb6', accent: '#3d6b12', weight: 30 },
  common:        { label: 'Обычный',        from: '#f4f5f7', to: '#e5e7ec', accent: '#585f70', weight: 20 },
};

/** The canvas palette: saturated fill fading to near-black, bright accent. */
export const RENDER_RARITIES: Record<string, RarityStyle> = {
  mythic:        { label: 'Мифический',     from: '#8a6a12', to: '#3a2c05', accent: '#ffd447', weight: 100 },
  icon:          { label: 'Icon Series',    from: '#0f6f75', to: '#062a2d', accent: '#3fe0e8', weight: 95 },
  dark:          { label: 'Dark Series',    from: '#5a1073', to: '#22062c', accent: '#d451ff', weight: 90 },
  shadow:        { label: 'Shadow Series',  from: '#2e2e33', to: '#111114', accent: '#9aa0aa', weight: 88 },
  slurp:         { label: 'Slurp Series',   from: '#0d6a5e', to: '#052622', accent: '#3ce8c6', weight: 86 },
  lava:          { label: 'Lava Series',    from: '#7a3b0c', to: '#2b1204', accent: '#ff9a3c', weight: 84 },
  frozen:        { label: 'Frozen Series',  from: '#155a86', to: '#07202f', accent: '#5cc8ff', weight: 82 },
  marvel:        { label: 'MARVEL',         from: '#7e1216', to: '#2c0507', accent: '#ff4a52', weight: 80 },
  dc:            { label: 'DC',             from: '#12305e', to: '#050f1f', accent: '#5a8fe6', weight: 78 },
  starwars:      { label: 'Star Wars',      from: '#1a2340', to: '#070a14', accent: '#8fa4d8', weight: 76 },
  gaminglegends: { label: 'Gaming Legends', from: '#3a1470', to: '#150629', accent: '#a06bff', weight: 74 },
  legendary:     { label: 'Легендарный',    from: '#8a4a12', to: '#301805', accent: '#ffa14a', weight: 60 },
  epic:          { label: 'Эпический',      from: '#5c1f96', to: '#210a37', accent: '#c07dff', weight: 50 },
  rare:          { label: 'Редкий',         from: '#12508f', to: '#061a2f', accent: '#4fb0ff', weight: 40 },
  uncommon:      { label: 'Необычный',      from: '#2c6b13', to: '#0e2506', accent: '#7ede4a', weight: 30 },
  common:        { label: 'Обычный',        from: '#3c4048', to: '#15171a', accent: '#b6bcc6', weight: 20 },
};

const FALLBACK: RarityStyle = { label: 'Прочее', from: '#f4f5f7', to: '#e5e7ec', accent: '#585f70', weight: 10 };
const FALLBACK_RENDER: RarityStyle = { label: 'Прочее', from: '#33363d', to: '#131417', accent: '#9aa0aa', weight: 10 };

/** For the interface. */
export function rarityStyle(rarity: string): RarityStyle {
  return RARITIES[rarity] ?? FALLBACK;
}

/** For the collage and the profile card, which stay dark. */
export function renderRarityStyle(rarity: string): RarityStyle {
  return RENDER_RARITIES[rarity] ?? FALLBACK_RENDER;
}

/**
 * Types whose art is a white silhouette and therefore needs a dark backing on
 * a light tile.
 *
 * Measured rather than guessed. Icons were downloaded and decoded pixel by
 * pixel: skins average 65–73 brightness out of 255, pickaxes 107, wraps 61,
 * gliders 100, sprays 153 — all readable on a pale tile. Emotes came back at
 * **255 with 100% of visible pixels pure white**, on two different files in
 * two different PNG encodings (grayscale+alpha and palette). On a white tile
 * they do not read poorly, they vanish.
 *
 * Only this one type qualifies, so only this one type gets the dark backing.
 */
const WHITE_ART_TYPES = new Set(['emote']);

export function needsDarkArtBacking(type: string): boolean {
  return WHITE_ART_TYPES.has(type);
}

/**
 * Sorts the way a buyer scans a listing: best first, then by name.
 *
 * The unobtainable Chapter 1 skins come first whatever their colour. Renegade
 * Raider and Recon Expert are both plain `rare` in the data, so a pure rarity
 * sort buries the two items a listing is built around behind three hundred
 * battle-pass cosmetics — which is exactly what the first render did.
 */
export function compareItems(a: Cosmetic, b: Cosmetic): number {
  const notableA = notableName(a.id) ? 1 : 0;
  const notableB = notableName(b.id) ? 1 : 0;
  if (notableA !== notableB) return notableB - notableA;

  const byRarity = rarityStyle(b.rarity).weight - rarityStyle(a.rarity).weight;
  if (byRarity !== 0) return byRarity;
  // An older item on the account carries more weight than a recent one; within
  // a rarity, season ascending puts the OG cosmetics at the front.
  const seasonA = a.season ?? 999;
  const seasonB = b.season ?? 999;
  if (seasonA !== seasonB) return seasonA - seasonB;
  return a.name.localeCompare(b.name);
}

export const TYPE_LABELS: Record<string, string> = {
  outfit: 'Скины',
  backpack: 'Рюкзаки',
  pickaxe: 'Кирки',
  glider: 'Планеры',
  emote: 'Эмоции',
  wrap: 'Обёртки',
  contrail: 'Следы',
  loadingscreen: 'Загрузочные экраны',
  music: 'Музыка',
  spray: 'Спреи',
  emoji: 'Смайлики',
  banner: 'Баннеры',
  pet: 'Питомцы',
  petcarrier: 'Питомцы',
  toy: 'Игрушки',
  shoe: 'Обувь',
  sidekick: 'Напарники',
  aura: 'Ауры',
  bundle: 'Наборы',
  jamtrack: 'Джем-треки',
  legotrack: 'LEGO-треки',
  buildinginstruction: 'LEGO-инструкции',
  buildingprop: 'LEGO-декор',
};

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

/**
 * The order the type filters appear in — what a buyer looks at first.
 * Types not listed here follow, alphabetically by label.
 */
export const TYPE_ORDER = [
  'outfit',
  'pickaxe',
  'glider',
  'backpack',
  'emote',
  'wrap',
  'contrail',
  'shoe',
  'music',
  'loadingscreen',
  'spray',
  'emoji',
  'banner',
  'pet',
  'toy',
];

export function compareTypes(a: string, b: string): number {
  const ia = TYPE_ORDER.indexOf(a);
  const ib = TYPE_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return typeLabel(a).localeCompare(typeLabel(b));
}

/**
 * The season label for a cosmetic. The catalogue carries the game's own
 * wording; only items the API gives no introduction for fall back to a dash.
 */
export function seasonLabel(item: { seasonName?: string }): string {
  return item.seasonName ?? 'Сезон неизвестен';
}
