'use client';

import { proxiedIcon } from '@/lib/fortnite/images';
import { compareItems, rarityStyle, typeLabel, TYPE_ORDER } from '@/lib/fortnite/rarity';
import type { Cosmetic, LockerResult, OwnedItem } from '@/lib/fortnite/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Building a listing without signing in to Epic.
 *
 * The device flow is the good path — it reads the real locker in one call —
 * but it has two failure modes that leave a seller with nothing: they may not
 * want to sign in on someone else's machine, and Epic disables the game
 * clients it depends on from time to time (the iOS one is already dead). This
 * is the fallback: pick the items off the catalogue by hand.
 *
 * Only one type is loaded at a time. All 16 268 cosmetics in one grid is not a
 * workflow, and outfits are what a listing is built from anyway.
 */

const TYPES = TYPE_ORDER.slice(0, 8);

interface Props {
  onLocker: (locker: LockerResult) => void;
  onCancel: () => void;
}

export function ManualPicker({ onLocker, onCancel }: Props) {
  const [type, setType] = useState('outfit');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Cosmetic[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Map<string, Cosmetic>>(new Map());
  const [name, setName] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ types: type });
    if (search.trim()) params.set('search', search.trim());

    // Debounced: a search box that fires a request per keystroke walks the
    // whole catalogue on the server each time.
    const timer = setTimeout(() => {
      fetch(`/api/catalog?${params}`)
        .then((response) => response.json() as Promise<{ items?: Cosmetic[]; truncated?: boolean }>)
        .then((body) => {
          if (cancelled) return;
          setItems((body.items ?? []).sort(compareItems));
          setTruncated(body.truncated === true);
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [type, search]);

  const toggle = useCallback((item: Cosmetic) => {
    setPicked((current) => {
      const next = new Map(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  }, []);

  /** Ticks everything currently on screen — the point of filtering by set. */
  const pickAllShown = useCallback(() => {
    setPicked((current) => {
      const next = new Map(current);
      for (const item of items) next.set(item.id, item);
      return next;
    });
  }, [items]);

  const pickedByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of picked.values()) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [picked]);

  function finish() {
    const owned: OwnedItem[] = [...picked.values()];
    onLocker({
      accountId: `manual-${Date.now()}`,
      displayName: name.trim() || 'Аккаунт Fortnite',
      items: owned,
      // Nothing is known about the account itself in this mode: an invented
      // level or V-Bucks figure would end up in the listing as a claim the
      // seller never made. The listing panel simply omits what is missing.
      stats: { pastSeasons: [] },
      readAt: new Date().toISOString(),
      manual: true,
    });
  }

  return (
    <section className="card">
      <div className="spread" style={{ marginBottom: 14 }}>
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>
            Ручной режим
          </h2>
          <p className="note" style={{ margin: '4px 0 0' }}>
            Без входа в Epic. Отмечайте то, что есть на аккаунте: уровень, В-Баксы и историю
            сезонов при этом взять неоткуда — в объявлении их не будет.
          </p>
        </div>
        <button className="btn secondary small" onClick={onCancel}>
          Назад
        </button>
      </div>

      <div className="chips" style={{ marginBottom: 10 }}>
        {TYPES.map((candidate) => (
          <button
            key={candidate}
            className="chip"
            data-active={type === candidate}
            onClick={() => setType(candidate)}
          >
            {typeLabel(candidate)}
          </button>
        ))}
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <input
          type="search"
          placeholder="Поиск по названию или набору"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ flex: '1 1 260px' }}
        />
        <input
          type="text"
          placeholder="Название аккаунта для объявления"
          value={name}
          onChange={(event) => setName(event.target.value)}
          style={{ flex: '1 1 220px' }}
        />
        <button className="btn secondary small" onClick={pickAllShown} disabled={!items.length}>
          Отметить всё на экране
        </button>
        <button className="btn" onClick={finish} disabled={picked.size === 0}>
          Готово — {picked.size}
        </button>
      </div>

      {pickedByType.length > 0 && (
        <p className="note" style={{ marginTop: 0 }}>
          Отмечено: {pickedByType.map(([key, count]) => `${typeLabel(key)} ${count}`).join(' · ')}
        </p>
      )}

      {loading && <p className="note">Загружаем каталог…</p>}
      {truncated && (
        <p className="note">
          Показана часть каталога — уточните поиск, чтобы увидеть остальное.
        </p>
      )}

      <div className="grid">
        {items.map((item) => {
          const style = rarityStyle(item.rarity);
          const on = picked.has(item.id);
          return (
            <button
              key={item.id}
              className="tile"
              data-picked={on ? true : undefined}
              onClick={() => toggle(item)}
              style={
                {
                  '--tile-from': style.from,
                  '--tile-to': style.to,
                  '--tile-accent': style.accent,
                  textAlign: 'center',
                  cursor: 'pointer',
                  opacity: on ? 1 : 0.55,
                } as React.CSSProperties
              }
              title={`${item.name} — ${style.label}`}
            >
              {item.art ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proxiedIcon(item.id)} alt="" loading="lazy" decoding="async" />
              ) : (
                <div className="no-art">{item.name.slice(0, 2).toUpperCase()}</div>
              )}
              <div className="name">{item.name}</div>
              <div className="meta">{on ? '✓ есть' : 'нет'}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
