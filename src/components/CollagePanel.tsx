'use client';

import { ITEMS_PER_PAGE, pageCount, renderCollage, type CollagePage } from '@/lib/collage';
import { GROUP_LABELS, planCollages, type GroupMode } from '@/lib/collage-plan';
import { download, toCsv, toJson, toTextList } from '@/lib/export';
import { counted, plural } from '@/lib/plural';
import { renderProfileCard } from '@/lib/profile-card';
import type { LockerResult, OwnedItem } from '@/lib/fortnite/types';
import { useState } from 'react';

interface Props {
  locker: LockerResult;
  /** Exactly what the filters currently select — collage and files must agree. */
  items: OwnedItem[];
  filterLabel: string;
  pages: CollagePage[];
  onPages: (pages: CollagePage[]) => void;
}

export function CollagePanel({ locker, items, filterLabel, pages, onPages }: Props) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [hideName, setHideName] = useState(true);
  const [mode, setMode] = useState<GroupMode>('single');
  const [error, setError] = useState<string | null>(null);

  const groups = planCollages(items, mode, filterLabel);
  const totalPages = groups.reduce((sum, group) => sum + pageCount(group.items.length), 0);

  async function render() {
    setError(null);
    // The profile card survives a re-render of the collage: it is built from
    // the whole account rather than the current filter, so re-rendering the
    // pages says nothing about whether it is still correct.
    const card = pages.filter((page) => page.filename.startsWith('fortnite-profile'));
    onPages(card);
    setProgress({ done: 0, total: totalPages });

    try {
      const rendered: CollagePage[] = [...card];
      let done = 0;
      for (const group of groups) {
        if (!group.items.length) continue;
        const groupPages = await renderCollage(group.items, {
          displayName: locker.displayName,
          filterLabel: group.label,
          hideName,
          onProgress: () => setProgress({ done: ++done, total: totalPages }),
        });
        rendered.push(...groupPages);
        // Handing pages over as each group finishes means a seller can start
        // looking at the skins page while the emotes are still rendering.
        onPages([...rendered]);
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Не удалось собрать коллаж');
    } finally {
      setProgress(null);
    }
  }

  /**
   * The card goes in front of the collage pages, because a marketplace shows
   * the first image as the listing's cover and a wall of tiles is a poor one.
   */
  async function renderCard() {
    setError(null);
    setProgress({ done: 0, total: 1 });
    try {
      const card = await renderProfileCard({ locker, items, hideName });
      onPages([card, ...pages.filter((page) => !page.filename.startsWith('fortnite-profile'))]);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Не удалось собрать карточку');
    } finally {
      setProgress(null);
    }
  }

  function downloadPage(page: CollagePage) {
    fetch(page.dataUrl)
      .then((response) => response.blob())
      .then((blob) => download(page.filename, blob));
  }

  return (
    <section className="card">
      <div className="spread">
        <div>
          <h2 className="section-title">Коллаж и выгрузка</h2>
          <p className="note" style={{ margin: 0 }}>
            {counted(items.length, 'предмет', 'предмета', 'предметов')} —{' '}
            {counted(totalPages, 'страница', 'страницы', 'страниц')} по {ITEMS_PER_PAGE}{' '}
            {plural(ITEMS_PER_PAGE, 'плашке', 'плашки', 'плашек')},
            2560×1440
            {groups.length > 1 &&
              `, ${counted(groups.length, 'набор', 'набора', 'наборов')}`}
            .
          </p>
        </div>
        <div className="row">
          <select value={mode} onChange={(event) => setMode(event.target.value as GroupMode)}>
            {(Object.keys(GROUP_LABELS) as GroupMode[]).map((key) => (
              <option key={key} value={key}>
                {GROUP_LABELS[key]}
              </option>
            ))}
          </select>
          <label className="note" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={hideName}
              onChange={(event) => setHideName(event.target.checked)}
            />
            скрыть ник
          </label>
          <button
            className="btn secondary"
            onClick={renderCard}
            disabled={progress !== null || !items.length}
          >
            Карточка профиля
          </button>
          <button className="btn" onClick={render} disabled={progress !== null || !items.length}>
            {progress ? `Рендер ${progress.done}/${progress.total}…` : 'Собрать коллаж'}
          </button>
        </div>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button
          className="btn secondary small"
          onClick={() => download('fortnite-locker.csv', toCsv(items))}
          disabled={!items.length}
        >
          CSV для таблицы
        </button>
        <button
          className="btn secondary small"
          onClick={() => download('fortnite-locker.json', toJson(locker, items))}
          disabled={!items.length}
        >
          JSON
        </button>
        <button
          className="btn secondary small"
          onClick={() => download('fortnite-locker.txt', toTextList(items))}
          disabled={!items.length}
        >
          Список текстом
        </button>
        {pages.length > 1 && (
          <button className="btn secondary small" onClick={() => pages.forEach(downloadPage)}>
            Скачать все {pages.length} {plural(pages.length, 'страницу', 'страницы', 'страниц')}
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {pages.length > 0 && (
        <div className="previews">
          {pages.map((page) => (
            <figure key={page.filename}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={page.dataUrl} alt={page.filename} />
              <figcaption>
                <span>{counted(page.itemCount, 'плашка', 'плашки', 'плашек')}</span>
                <button className="btn secondary small" onClick={() => downloadPage(page)}>
                  Скачать
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
