import { compareItems, rarityStyle, typeLabel } from '@/lib/fortnite/rarity';
import type { OwnedItem } from '@/lib/fortnite/types';

/**
 * How a locker is split into collages.
 *
 * One collage per whatever filter happens to be active is the wrong unit of
 * work: a seller who wants a picture of the skins and a picture of the emotes
 * has to filter, render, save, filter again, render again — and a marketplace
 * that keeps only the last upload silently drops the first set. Buyers read a
 * listing by category, so that is how the pictures are grouped, and all of
 * them are rendered in one go.
 */

export type GroupMode = 'single' | 'type' | 'rarity';

export interface CollageGroup {
  /** Printed on the collage header and used to name the file. */
  label: string;
  items: OwnedItem[];
}

export const GROUP_LABELS: Record<GroupMode, string> = {
  single: 'Одним коллажем',
  type: 'Отдельно по типам',
  rarity: 'Отдельно по редкости',
};

export function planCollages(
  items: OwnedItem[],
  mode: GroupMode,
  filterLabel: string,
): CollageGroup[] {
  if (mode === 'single' || items.length === 0) {
    return [{ label: filterLabel, items }];
  }

  const buckets = new Map<string, OwnedItem[]>();
  for (const item of items) {
    const key = mode === 'type' ? item.type : item.rarity;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const groups: CollageGroup[] = [...buckets.entries()].map(([key, bucket]) => ({
    label: mode === 'type' ? typeLabel(key) : rarityStyle(key).label,
    // Each group is sorted on its own: a page of emotes ordered by the whole
    // locker's ranking would open on whatever emote happened to be rarest.
    items: [...bucket].sort(compareItems),
  }));

  // Biggest first — the skins page is the one a buyer opens, and it should be
  // the first picture on the listing.
  return groups.sort((a, b) => b.items.length - a.items.length);
}
