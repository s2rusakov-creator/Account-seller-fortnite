import { notableName } from './notable';
import type { Cosmetic } from './types';

/**
 * How an item is labelled and coloured.
 *
 * Fortnite shows a series in place of a rarity when an item has one — an Icon
 * Series skin is never called "Rare" in game even though the API still reports
 * a rarity for it. The API encodes both in the same `rarity.value` field
 * (`icon`, `marvel`, `dc`, …), so one table covers them.
 */

export interface RarityStyle {
  label: string;
  /** Tile fill, top and bottom of the gradient. */
  from: string;
  to: string;
  /** Border and text accent. */
  accent: string;
  /** Sort weight, high to low, roughly by what an account buyer pays for. */
  weight: number;
}

export const RARITIES: Record<string, RarityStyle> = {
  mythic:        { label: 'Мифический',   from: '#8a6a12', to: '#3a2c05', accent: '#ffd447', weight: 100 },
  icon:          { label: 'Icon Series',  from: '#0f6f75', to: '#062a2d', accent: '#3fe0e8', weight: 95 },
  dark:          { label: 'Dark Series',  from: '#5a1073', to: '#22062c', accent: '#d451ff', weight: 90 },
  shadow:        { label: 'Shadow Series',from: '#2e2e33', to: '#111114', accent: '#9aa0aa', weight: 88 },
  slurp:         { label: 'Slurp Series', from: '#0d6a5e', to: '#052622', accent: '#3ce8c6', weight: 86 },
  lava:          { label: 'Lava Series',  from: '#7a3b0c', to: '#2b1204', accent: '#ff9a3c', weight: 84 },
  frozen:        { label: 'Frozen Series',from: '#155a86', to: '#07202f', accent: '#5cc8ff', weight: 82 },
  marvel:        { label: 'MARVEL',       from: '#7e1216', to: '#2c0507', accent: '#ff4a52', weight: 80 },
  dc:            { label: 'DC',           from: '#12305e', to: '#050f1f', accent: '#5a8fe6', weight: 78 },
  starwars:      { label: 'Star Wars',    from: '#1a2340', to: '#070a14', accent: '#8fa4d8', weight: 76 },
  gaminglegends: { label: 'Gaming Legends', from: '#3a1470', to: '#150629', accent: '#a06bff', weight: 74 },
  legendary:     { label: 'Легендарный',  from: '#8a4a12', to: '#301805', accent: '#ffa14a', weight: 60 },
  epic:          { label: 'Эпический',    from: '#5c1f96', to: '#210a37', accent: '#c07dff', weight: 50 },
  rare:          { label: 'Редкий',       from: '#12508f', to: '#061a2f', accent: '#4fb0ff', weight: 40 },
  uncommon:      { label: 'Необычный',    from: '#2c6b13', to: '#0e2506', accent: '#7ede4a', weight: 30 },
  common:        { label: 'Обычный',      from: '#3c4048', to: '#15171a', accent: '#b6bcc6', weight: 20 },
};

const FALLBACK: RarityStyle = { label: 'Прочее', from: '#33363d', to: '#131417', accent: '#9aa0aa', weight: 10 };

export function rarityStyle(rarity: string): RarityStyle {
  return RARITIES[rarity] ?? FALLBACK;
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
