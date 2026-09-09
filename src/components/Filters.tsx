'use client';

import { compareTypes, rarityStyle, typeLabel } from '@/lib/fortnite/rarity';
import type { OwnedItem } from '@/lib/fortnite/types';
import { useMemo } from 'react';

export interface FilterState {
  type: string | null;
  rarity: string | null;
  season: string | null;
  search: string;
}

export const EMPTY_FILTER: FilterState = { type: null, rarity: null, season: null, search: '' };

/**
 * Applies the filter. Kept next to the controls so the label a collage is
 * named after and the items it contains can never describe different things.
 */
export function applyFilter(items: OwnedItem[], filter: FilterState): OwnedItem[] {
  const needle = filter.search.trim().toLowerCase();
  return items.filter((item) => {
    if (filter.type && item.type !== filter.type) return false;
    if (filter.rarity && item.rarity !== filter.rarity) return false;
    if (filter.season && (item.seasonName ?? '') !== filter.season) return false;
    if (needle) {
      const haystack = `${item.name} ${item.set ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

/** What the collage puts in its header and its filename. */
export function filterLabel(filter: FilterState): string {
  const parts: string[] = [];
  if (filter.type) parts.push(typeLabel(filter.type));
  if (filter.rarity) parts.push(rarityStyle(filter.rarity).label);
  if (filter.season) parts.push(filter.season);
  if (filter.search.trim()) parts.push(`поиск «${filter.search.trim()}»`);
  return parts.length ? parts.join(' · ') : 'всё';
}

interface Props {
  items: OwnedItem[];
  filter: FilterState;
  onChange: (filter: FilterState) => void;
}

export function Filters({ items, filter, onChange }: Props) {
  /**
   * Counts come from the items themselves rather than the catalogue, so a
   * filter never offers a category the account has nothing in — the failure
   * mode is a seller clicking "Legendary" and getting an empty grid.
   */
  const { types, rarities, seasons } = useMemo(() => {
    const typeCounts = new Map<string, number>();
    const rarityCounts = new Map<string, number>();
    const seasonCounts = new Map<string, number>();

    for (const item of items) {
      typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);
      rarityCounts.set(item.rarity, (rarityCounts.get(item.rarity) ?? 0) + 1);
      if (item.seasonName) seasonCounts.set(item.seasonName, (seasonCounts.get(item.seasonName) ?? 0) + 1);
    }

    return {
      types: [...typeCounts.entries()].sort((a, b) => compareTypes(a[0], b[0])),
      rarities: [...rarityCounts.entries()].sort(
        (a, b) => rarityStyle(b[0]).weight - rarityStyle(a[0]).weight,
      ),
      // Season numbers are not sortable as text ("сезон X", "сезон OG"), so
      // the order comes from the catalogue's own numbering.
      seasons: [...seasonCounts.entries()].sort((a, b) => {
        const seasonOf = (name: string) => items.find((item) => item.seasonName === name)?.season ?? 0;
        return seasonOf(a[0]) - seasonOf(b[0]);
      }),
    };
  }, [items]);

  const set = (patch: Partial<FilterState>) => onChange({ ...filter, ...patch });

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="chips">
        <button
          className="chip"
          data-active={filter.type === null}
          onClick={() => set({ type: null })}
        >
          Все типы<span className="count">{items.length}</span>
        </button>
        {types.map(([type, count]) => (
          <button
            key={type}
            className="chip"
            data-active={filter.type === type}
            onClick={() => set({ type: filter.type === type ? null : type })}
          >
            {type === 'unknown' ? 'Новые' : typeLabel(type)}
            <span className="count">{count}</span>
          </button>
        ))}
      </div>

      <div className="chips">
        <button
          className="chip"
          data-active={filter.rarity === null}
          onClick={() => set({ rarity: null })}
        >
          Любая редкость
        </button>
        {rarities.map(([rarity, count]) => {
          const style = rarityStyle(rarity);
          return (
            <button
              key={rarity}
              className="chip"
              data-active={filter.rarity === rarity}
              onClick={() => set({ rarity: filter.rarity === rarity ? null : rarity })}
              // Selected: the rarity's own colour, filled. Unselected: the same
              // colour as an outline, so sixteen categories stay tellable apart
              // without sixteen filled chips shouting at once.
              style={
                filter.rarity === rarity
                  ? { background: style.accent, borderColor: style.accent, color: '#fff' }
                  : { borderColor: style.accent, color: style.accent, background: 'var(--surface)' }
              }
            >
              {style.label}
              <span className="count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="row">
        <input
          type="search"
          placeholder="Поиск по названию или набору"
          value={filter.search}
          onChange={(event) => set({ search: event.target.value })}
          style={{ flex: '1 1 260px' }}
        />
        <select
          value={filter.season ?? ''}
          onChange={(event) => set({ season: event.target.value || null })}
        >
          <option value="">Все сезоны</option>
          {seasons.map(([season, count]) => (
            <option key={season} value={season}>
              {season} ({count})
            </option>
          ))}
        </select>
        {(filter.type || filter.rarity || filter.season || filter.search) && (
          <button className="btn secondary small" onClick={() => onChange(EMPTY_FILTER)}>
            Сбросить
          </button>
        )}
      </div>
    </div>
  );
}
