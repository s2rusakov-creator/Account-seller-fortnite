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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Tiles rendered before the grid asks the seller to show more. */
const FIRST_PAGE = 600;

/** How long the arrival animation runs before the page settles down. */
const ARRIVAL_MS = 1100;

type Tab = 'collage' | 'listing' | 'offer' | 'screenshot';

export default function Home() {
  /**
   * Высота панели шагов — в переменную, а не в константу.
   *
   * Панель закреплена внизу и на узком экране переносится в две-три строки:
   * в Telegram она вырастает вдвое против расчётных 96 пикселей, и нижняя
   * часть страницы — как раз кнопки «Выберите файл» и подсказки — оказывалась
   * под ней. Меряем настоящую высоту и отдаём её вёрстке.
   */
  const stepbarRef = useRef<HTMLDivElement | null>(null);
  const [locker, setLocker] = useState<LockerResult | null>(null);

  useEffect(() => {
    const bar = stepbarRef.current;
    if (!bar) {
      // Панели нет — и отступ под неё не нужен, иначе внизу повиснет пустота.
      document.documentElement.style.removeProperty('--stepbar-h');
      return;
    }
    const apply = () => {
      document.documentElement.style.setProperty('--stepbar-h', `${bar.offsetHeight}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [locker]);

  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [limit, setLimit] = useState(FIRST_PAGE);
  const [pages, setPages] = useState<CollagePage[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [manual, setManual] = useState(false);
  const [tab, setTab] = useState<Tab>('collage');
  const [uploaded, setUploaded] = useState(false);
  /** True for one second after a locker lands — drives the cascade and count-up. */
  const [arriving, setArriving] = useState(false);
  const guide = useGuide();

  const onLocker = useCallback((result: LockerResult) => {
    setLocker(result);
    setFilter(EMPTY_FILTER);
    setLimit(FIRST_PAGE);
    setPages([]);
    setManual(false);
    setTab('collage');
    setUploaded(false);
    setArriving(true);
    saveLocker(result);
  }, []);

  // The arrival animation is a one-shot: it must not replay when a filter
  // moves, so it is switched off on a timer rather than derived from state.
  useEffect(() => {
    if (!arriving) return;
    const timer = setTimeout(() => setArriving(false), ARRIVAL_MS);
    return () => clearTimeout(timer);
  }, [arriving]);

  // Restored after mount rather than during render: localStorage does not
  // exist on the server, and seeding state from it would not match the HTML
  // React rendered there. A restored locker does not animate in — nothing
  // arrived, it was already here.
  useEffect(() => {
    const saved = loadLocker();
    if (saved) setLocker(saved);
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

  const tabs: { id: Tab; label: string; hint: string }[] = [
    { id: 'collage', label: 'Коллаж', hint: pages.length ? `${pages.length} стр.` : 'не собран' },
    { id: 'listing', label: 'Текст', hint: 'готов' },
    { id: 'offer', label: 'Оффер', hint: uploaded ? 'создан' : 'не выставлен' },
    { id: 'screenshot', label: 'Скриншот', hint: 'из игры' },
  ];

  const steps: { n: string; label: string; done: boolean; go: () => void }[] = [
    { n: '1', label: 'Аккаунт', done: true, go: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
    { n: '2', label: 'Предметы', done: true, go: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
    { n: '3', label: 'Коллаж', done: pages.length > 0, go: () => setTab('collage') },
    { n: '4', label: 'Оффер', done: uploaded, go: () => setTab('offer') },
  ];

  return (
    <main className="page">
      <header className="top">
        <div className="brand">
          <div className="mark">FN</div>
          <div>
            <h1>Fortnite — плашки раздевалки</h1>
            <div className="sub">
              Читает косметику аккаунта и собирает сетку, коллажи, объявление и офферы.
            </div>
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
          <StatsStrip locker={locker} items={sorted} arriving={arriving} />

          {/*
            Two columns, not a stack of seven cards. The grid is what the
            seller keeps looking at, so it stays put on the left while the
            right-hand column swaps between collage, text and offer — the old
            layout put a long scroll between the items and the button that
            publishes them.
          */}
          <div className="workspace">
            <section>
              <div className="filters-sticky">
                <div className="card" style={{ margin: 0, padding: '14px 16px' }}>
                  <div className="spread" style={{ alignItems: 'baseline', marginBottom: 10 }}>
                    <h2 className="section-title" style={{ margin: 0 }}>
                      Предметы
                    </h2>
                    <span className="note" style={{ fontVariantNumeric: 'tabular-nums' }}>
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
                </div>
              </div>

              <ItemGrid items={filtered.slice(0, limit)} arriving={arriving} />

              {filtered.length > limit && (
                <div className="row" style={{ marginTop: 14, justifyContent: 'center' }}>
                  <button className="btn secondary" onClick={() => setLimit(filtered.length)}>
                    Показать остальные {filtered.length - limit}
                  </button>
                </div>
              )}
            </section>

            <aside className="side">
              <div className="tabs">
                {tabs.map((entry) => (
                  <button
                    key={entry.id}
                    data-active={tab === entry.id}
                    onClick={() => setTab(entry.id)}
                  >
                    <span>{entry.label}</span>
                    <span className="hint">{entry.hint}</span>
                  </button>
                ))}
              </div>

              {tab === 'collage' && (
                <CollagePanel
                  locker={locker}
                  items={filtered}
                  filterLabel={label}
                  pages={pages}
                  onPages={setPages}
                />
              )}
              {tab === 'listing' && (
                <ListingPanel
                  locker={locker}
                  items={sorted}
                  title={title}
                  description={description}
                  onTitle={setTitle}
                  onDescription={setDescription}
                />
              )}
              {tab === 'offer' && (
                <UploadPanel
                  accountId={locker.accountId}
                  displayName={locker.displayName}
                  stats={listingStats}
                  title={title}
                  description={description}
                  pages={pages}
                  itemCount={sorted.length}
                  onUploaded={() => setUploaded(true)}
                />
              )}
              {tab === 'screenshot' && <ScreenshotRedactor />}
            </aside>
          </div>

          <div className="stepbar" ref={stepbarRef}>
            <div className="inner">
              <div className="steps-row">
                {steps.map((step) => (
                  <button
                    key={step.n}
                    className="step"
                    data-done={step.done}
                    onClick={step.go}
                  >
                    <span className="n">{step.n}</span>
                    <span className="label">{step.label}</span>
                  </button>
                ))}
              </div>
              <div className="row" style={{ marginLeft: 'auto' }}>
                <span className="note" style={{ textAlign: 'right' }}>
                  {pages.length
                    ? `Коллаж готов: ${pages.length} стр.`
                    : 'Осталось: собрать коллаж'}
                </span>
                <button className="btn" onClick={() => setTab('offer')}>
                  К офферу
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
