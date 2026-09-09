'use client';

import { proxiedIcon } from '@/lib/fortnite/images';
import { needsDarkArtBacking, rarityStyle, seasonLabel } from '@/lib/fortnite/rarity';
import { notableName } from '@/lib/fortnite/notable';
import type { OwnedItem } from '@/lib/fortnite/types';
import { memo } from 'react';

/** How many tiles take part in the arrival cascade — one screenful. */
const CASCADE = 42;

/** Milliseconds between neighbouring tiles in that cascade. */
const CASCADE_STEP = 14;

interface TileProps {
  item: OwnedItem;
  index: number;
  /** True for the moment right after a locker lands, false afterwards. */
  arriving: boolean;
}

/**
 * One cosmetic, drawn the way the game draws it: a rarity-coloured tile with
 * the art, the name, and the season it came from — the three things a buyer
 * looks at.
 */
const Tile = memo(function Tile({ item, index, arriving }: TileProps) {
  const style = rarityStyle(item.rarity);
  const notable = notableName(item.id);
  const styleCount = item.variants
    ? Object.values(item.variants).reduce((total, owned) => total + owned.length, 0)
    : 0;

  // Only the first screenful animates in. A 14 ms stagger across two thousand
  // tiles would run for half a minute with the page unusable throughout.
  const enters = arriving && index < CASCADE;

  return (
    <article
      className="tile"
      data-notable={notable ? true : undefined}
      data-art={needsDarkArtBacking(item.type) ? 'dark' : undefined}
      data-enter={enters ? true : undefined}
      style={
        {
          '--tile-from': style.from,
          '--tile-to': style.to,
          '--tile-accent': style.accent,
          '--enter-delay': enters ? `${index * CASCADE_STEP}ms` : undefined,
          '--ring-delay': `${240 + index * 12}ms`,
        } as React.CSSProperties
      }
      title={`${item.name} — ${style.label}${item.set ? ` · ${item.set}` : ''}`}
    >
      <div className="bar" />
      <div className="art">
        {item.art ? (
          // Not next/image: these are 512px PNGs already sized for the tile, and
          // the optimiser would rewrite a couple of thousand of them per locker.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proxiedIcon(item.id)} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className="no-art">{item.name.slice(0, 2).toUpperCase()}</div>
        )}
      </div>
      <div className="name">{item.name}</div>
      <div className="meta">{item.unknown ? 'Новый предмет' : seasonLabel(item)}</div>
      {styleCount > 1 && <div className="styles">{styleCount} стилей</div>}
      {notable && <div className="notable">★ РЕДКОЕ</div>}
      {/* A gold ring runs over the unobtainable items as the locker lands —
          once, on arrival, never as a loop. */}
      {notable && enters && <div className="ring" />}
    </article>
  );
});

export function ItemGrid({ items, arriving = false }: { items: OwnedItem[]; arriving?: boolean }) {
  if (!items.length) {
    return <p className="note">Под фильтр ничего не попало.</p>;
  }
  return (
    <div className="grid">
      {items.map((item, index) => (
        <Tile key={`${item.backend}:${item.id}`} item={item} index={index} arriving={arriving} />
      ))}
    </div>
  );
}
