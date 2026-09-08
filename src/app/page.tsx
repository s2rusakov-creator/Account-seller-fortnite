'use client';

import { CollagePanel } from '@/components/CollagePanel';
import { EpicConnect } from '@/components/EpicConnect';
import { applyFilter, EMPTY_FILTER, Filters, filterLabel, type FilterState } from '@/components/Filters';
import { Guide, useGuide } from '@/components/Guide';
import { ItemGrid } from '@/components/ItemGrid';
import { ListingPanel } from '@/components/ListingPanel';
import { ManualPicker } from '@/components/ManualPicker';
import { ScreenshotRedactor } from '@/components/ScreenshotRedactor';
import { StatsStrip } from '@/components/StatsStrip';
import { UploadPanel } from '@/components/UploadPanel';
import type { CollagePage } from '@/lib/collage';
import { compareItems } from '@/lib/fortnite/rarity';
import type { LockerResult } from '@/lib/fortnite/types';
import { breakdown, buildDescription, buildTitle, headlineItems } from '@/lib/listing';
import { clearLocker, loadLocker, saveLocker } from '@/lib/session-store';
import { useCallback, useEffect, useMemo, useState } from 'react';

/** Tiles rendered before the grid asks the seller to show more. */
const FIRST_PAGE = 600;

export default function Home() {
  const [locker, setLocker] = useState<LockerResult | null>(null);
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [limit, setLimit] = useState(FIRST_PAGE);
  const [pages, setPages] = useState<CollagePage[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [manual, setManual] = useState(false);
  const guide = useGuide();

  const onLocker = useCallback((result: LockerResult) => {
    setLocker(result);
    setFilter(EMPTY_FILTER);
    setLimit(FIRST_PAGE);
    setPages([]);
    setManual(false);
    saveLocker(result);
  }, []);

  // Restored after mount rather than during render: localStorage does not
  // exist on the server, and seeding state from it would not match the HTML
  // React rendered there.
  useEffect(() => {
    const saved = loadLocker();
    if (saved) {
      setLocker(saved);
      setTitle(buildTitle(saved, saved.items));
      setDescription(buildDescription(saved, saved.items));
    }
  }, []);

  // Sorted once per read: a locker of a few thousand items is not something to
  // re-sort on every keystroke in the search box.
  const sorted = useMemo(() => (locker ? [...locker.items].sort(compareItems) : []), [locker]);
  const filtered = useMemo(() => applyFilter(sorted, filter), [sorted, filter]);
  const label = filterLabel(filter);

  useEffect(() => {
    if (!locker) return;
    setTitle(buildTitle(locker, locker.items));
    setDescription(buildDescription(locker, locker.items));
  }, [locker]);

  /** What the marketplaces are told about the account. */
  const listingStats = useMemo(() => {
    if (!locker) return {};
    const { ogCount } = breakdown(sorted);
    return {
      totalItems: sorted.length,
      outfitCount: sorted.filter((item) => item.type === 'outfit').length,
      ogCount,
      notable: headlineItems(sorted),
      accountLevel: locker.stats.accountLevel,
      seasonLevel: locker.stats.seasonLevel,
      seasonsPlayed: locker.stats.pastSeasons.length || undefined,
      wins: locker.stats.lifetimeWins,
      vbucks: locker.stats.vbucks,
      platforms: locker.account?.platforms,
      emailVerified: locker.account?.emailVerified,
      canChangeName: locker.account?.canChangeName,
    };
  }, [locker, sorted]);

  function reset() {
    setLocker(null);
    setFilter(EMPTY_FILTER);
    setPages([]);
    setManual(false);
    clearLocker();
  }

  return (
    <main className="page">
      <header className="top">
        <div>
          <h1>Fortnite — плашки раздевалки</h1>
          <div className="sub">
            Читает косметику аккаунта и собирает из неё сетку, коллажи, объявление и офферы.
          </div>
        </div>
        <div className="row">
          <button className="btn secondary small" onClick={guide.open}>
            Инструкция
          </button>
          {locker && (
            <button className="btn secondary small" onClick={reset}>
              Другой аккаунт
            </button>
          )}
        </div>
      </header>

      <Guide state={guide} />

      {!locker && !manual && (
        <>
          <EpicConnect onLocker={onLocker} />
          <p className="note">
            <button className="btn secondary small" onClick={() => setManual(true)}>
              Отметить вручную
            </button>{' '}
            — если входить в Epic не хочется: список собирается по каталогу, без уровня и В-Баксов.
            {process.env.NODE_ENV !== 'production' && (
              <>
                {' '}
                <button
                  className="btn secondary small"
                  onClick={async () => {
                    const response = await fetch('/api/demo?size=600');
                    const body = (await response.json()) as { locker?: LockerResult };
                    if (body.locker) onLocker(body.locker);
                  }}
                >
                  Демо
                </button>
              </>
            )}
          </p>
        </>
      )}

      {!locker && manual && <ManualPicker onLocker={onLocker} onCancel={() => setManual(false)} />}

      {locker && (
        <>
          <StatsStrip locker={locker} items={sorted} />

          <section className="card">
            <div className="spread" style={{ marginBottom: 14 }}>
              <h2 className="section-title" style={{ margin: 0 }}>
                Предметы
              </h2>
              <span className="note">
                {filtered.length === sorted.length
                  ? `${sorted.length} шт.`
                  : `${filtered.length} из ${sorted.length} — ${label}`}
              </span>
            </div>

            <Filters
              items={sorted}
              filter={filter}
              onChange={(next) => {
                setFilter(next);
                setLimit(FIRST_PAGE);
              }}
            />

            <div style={{ marginTop: 16 }}>
              <ItemGrid items={filtered.slice(0, limit)} />
              {filtered.length > limit && (
                <div className="row" style={{ marginTop: 14, justifyContent: 'center' }}>
                  <button className="btn secondary" onClick={() => setLimit(filtered.length)}>
                    Показать остальные {filtered.length - limit}
                  </button>
                </div>
              )}
            </div>
          </section>

          <CollagePanel
            locker={locker}
            items={filtered}
            filterLabel={label}
            pages={pages}
            onPages={setPages}
          />

          <ScreenshotRedactor />

          <ListingPanel
            locker={locker}
            items={sorted}
            title={title}
            description={description}
            onTitle={setTitle}
            onDescription={setDescription}
          />

          <UploadPanel
            accountId={locker.accountId}
            displayName={locker.displayName}
            stats={listingStats}
            title={title}
            description={description}
            pages={pages}
            itemCount={sorted.length}
          />
        </>
      )}
    </main>
  );
}
