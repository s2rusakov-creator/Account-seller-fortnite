'use client';

import { proxiedIcon } from '@/lib/fortnite/images';
import { notableName } from '@/lib/fortnite/notable';
import { rarityStyle, seasonLabel } from '@/lib/fortnite/rarity';
import type { OwnedItem } from '@/lib/fortnite/types';
import { memo } from 'react';

/**
 * One cosmetic, drawn the way the game draws it: a rarity-coloured tile with
 * the art, the name, and the season it came from — the three things a buyer
 * looks at.
 */
const Tile = memo(function Tile({ item }: { item: OwnedItem }) {
  const style = rarityStyle(item.rarity);
  const notable = notableName(item.id);
  const styleCount = item.variants
    ? Object.values(item.variants).reduce((total, owned) => total + owned.length, 0)
    : 0;

  return (
    <article
      className="tile"
      data-notable={notable ? true : undefined}
      style={
        {
          '--tile-from': style.from,
          '--tile-to': style.to,
          '--tile-accent': style.accent,
        } as React.CSSProperties
      }
      title={`${item.name} — ${style.label}${item.set ? ` · ${item.set}` : ''}`}
    >
      {item.art ? (
        // Not next/image: these are 512px PNGs already sized for the tile, and
        // the optimiser would rewrite a couple of thousand of them per locker.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={proxiedIcon(item.id)} alt="" loading="lazy" decoding="async" />
      ) : (
        <div className="no-art">{item.name.slice(0, 2).toUpperCase()}</div>
      )}
      <div className="name">{item.name}</div>
      <div className="meta">{item.unknown ? 'Новый предмет' : seasonLabel(item)}</div>
      {styleCount > 1 && <div className="styles">{styleCount} стилей</div>}
      {notable && <div className="notable">★ редкое</div>}
    </article>
  );
});

export function ItemGrid({ items }: { items: OwnedItem[] }) {
  if (!items.length) {
    return <p className="note">Под фильтр ничего не попало.</p>;
  }
  return (
    <div className="grid">
      {items.map((item) => (
        <Tile key={`${item.backend}:${item.id}`} item={item} />
      ))}
    </div>
  );
}
