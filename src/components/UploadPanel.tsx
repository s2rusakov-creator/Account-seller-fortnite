'use client';

import type { CollagePage } from '@/lib/collage';
import { loadHistory, recordUploads, type UploadRecord } from '@/lib/history';
import { counted } from '@/lib/plural';
import type { ListingStats, UploadResult } from '@/lib/marketplaces/types';
import { useEffect, useState } from 'react';

interface MarketplaceInfo {
  id: string;
  label: string;
  configured: boolean;
  missing: string[];
}

interface Props {
  accountId: string;
  displayName: string;
  stats: ListingStats;
  title: string;
  description: string;
  /** Rendered collage pages, published one at a time before the offer. */
  pages: CollagePage[];
  itemCount: number;
  /** Fires once a real offer is created, so the step bar can tick over. */
  onUploaded?: () => void;
}

/**
 * Creates the offer on the marketplaces.
 *
 * Two things are deliberate. The dry run and the real publish are separate
 * cards with different colour and different wording, because the difference
 * has to read before the click, not after. And the collage pages are published
 * one at a time ahead of the create call, so a large locker is not capped by
 * what a single request body carries.
 */
export function UploadPanel({
  accountId,
  displayName,
  stats,
  title,
  description,
  pages,
  itemCount,
  onUploaded,
}: Props) {
  const [markets, setMarkets] = useState<MarketplaceInfo[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [share, setShare] = useState(0);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<UploadRecord[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    fetch('/api/marketplaces')
      .then((response) => response.json() as Promise<{ marketplaces?: MarketplaceInfo[] }>)
      .then((body) => {
        const list = body.marketplaces ?? [];
        setMarkets(list);
        setSelected(list.filter((market) => market.configured).map((market) => market.id));
      })
      .catch(() => setMarkets([]));
  }, []);

  /**
   * Publishes each page and returns its URL.
   *
   * Sequential on purpose: a locker can be twenty-four pages, and firing them
   * all at the blob store at once is how a batch upload starts failing halfway
   * with no way to tell which pages made it.
   */
  async function publishPages(): Promise<string[]> {
    const urls: string[] = [];
    for (const [index, page] of pages.entries()) {
      setBusy(`Публикуем страницу ${index + 1} из ${pages.length}…`);
      setShare((index) / Math.max(1, pages.length));
      const response = await fetch('/api/collage-image', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId,
          filename: page.filename,
          contentType: page.contentType,
          base64: page.dataUrl.split(',')[1] ?? '',
        }),
      });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? 'Страница не опубликовалась');
      urls.push(body.url);
    }
    return urls;
  }

  async function submit(dryRun: boolean) {
    setError(null);
    setResults([]);
    setShare(0);
    setBusy(dryRun ? 'Собираем payload…' : 'Готовим картинки…');

    try {
      const imageUrls = dryRun ? [] : await publishPages();
      if (!dryRun) {
        setBusy('Создаём офферы…');
        setShare(0.85);
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId,
          displayName,
          stats,
          title,
          description,
          price: Number(price),
          currency,
          marketplaces: selected,
          dryRun,
          credentials: { login, password, email, emailPassword, notes },
          imageUrls,
        }),
      });

      const body = (await response.json()) as { results?: UploadResult[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Загрузка не удалась');

      const list = body.results ?? [];
      setShare(1);
      setResults(list);
      if (!dryRun) {
        setHistory(
          recordUploads(list, { displayName, price: Number(price), currency, itemCount }),
        );
        if (list.some((entry) => entry.ok)) onUploaded?.();
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Загрузка не удалась');
    } finally {
      setBusy(null);
    }
  }

  const canDryRun = selected.length > 0 && Number(price) > 0 && title.trim().length > 0;
  const canUpload = canDryRun && login.trim().length > 0 && password.length > 0 && pages.length > 0;
  const uploading = busy !== null;

  return (
    <div className="pane">
      <div className="chips" style={{ marginBottom: 12 }}>
        {markets.map((market) => (
          <button
            key={market.id}
            className="chip"
            data-active={selected.includes(market.id)}
            onClick={() =>
              setSelected((current) =>
                current.includes(market.id)
                  ? current.filter((id) => id !== market.id)
                  : [...current, market.id],
              )
            }
            title={market.configured ? '' : `Не задано: ${market.missing.join(', ')}`}
          >
            {market.label}
            {!market.configured && <span className="count">нет ключа</span>}
          </button>
        ))}
        {!markets.length && <span className="note">Площадки не отвечают.</span>}
      </div>

      <div className="row">
        <input
          type="text"
          inputMode="decimal"
          placeholder="Цена"
          value={price}
          onChange={(event) => setPrice(event.target.value.replace(',', '.'))}
          style={{ width: 110 }}
        />
        <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="RUB">RUB</option>
        </select>
      </div>
      <p className="note" style={{ margin: '8px 0 12px' }}>
        GameBoost считает в евро и не принимает меньше 0.99 — валюта здесь для Eldorado.
      </p>

      <details className="pack" style={{ marginBottom: 14 }}>
        <summary>
          Данные автовыдачи <span>— уходят только на площадку</span>
        </summary>
        <div className="row" style={{ marginTop: 12 }}>
          <input
            type="text"
            placeholder="Логин Epic"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            autoComplete="off"
            style={{ flex: '1 1 45%', minWidth: 0, background: 'var(--surface)' }}
          />
          <input
            type="text"
            placeholder="Пароль"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="off"
            style={{ flex: '1 1 45%', minWidth: 0, background: 'var(--surface)' }}
          />
          <input
            type="text"
            placeholder="Почта аккаунта"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="off"
            style={{ flex: '1 1 45%', minWidth: 0, background: 'var(--surface)' }}
          />
          <input
            type="text"
            placeholder="Пароль от почты"
            value={emailPassword}
            onChange={(event) => setEmailPassword(event.target.value)}
            autoComplete="off"
            style={{ flex: '1 1 45%', minWidth: 0, background: 'var(--surface)' }}
          />
          <input
            type="text"
            placeholder="Примечание покупателю"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            style={{ flex: '1 1 100%', minWidth: 0, background: 'var(--surface)' }}
          />
        </div>
      </details>

      <div style={{ display: 'grid', gap: 10 }}>
        <div className="action-card">
          <div className="spread" style={{ flexWrap: 'nowrap' }}>
            <div>
              <div className="title">Пробный прогон</div>
              <div className="hint">Показывает payload. Ничего не создаёт.</div>
            </div>
            <button
              className="btn secondary small"
              onClick={() => submit(true)}
              disabled={!canDryRun || uploading}
              style={{ whiteSpace: 'nowrap' }}
            >
              Проверить
            </button>
          </div>
        </div>

        <div className="action-card" data-live="true">
          <div className="spread" style={{ flexWrap: 'nowrap' }}>
            <div>
              <div className="title">Выставить оффер</div>
              <div className="hint">
                Создаст реальные офферы · {selected.length}{' '}
                {selected.length === 1 ? 'площадка' : 'площадки'} · {price || '0'} {currency}
              </div>
            </div>
            <button
              className="btn"
              onClick={() => submit(false)}
              disabled={!canUpload || uploading}
              data-busy={uploading ? true : undefined}
              style={{ whiteSpace: 'nowrap' }}
            >
              {uploading ? 'Выставляем…' : 'Выставить'}
            </button>
          </div>

          {uploading && (
            <>
              <div className="meter" data-sweep="true" style={{ marginTop: 10, background: 'var(--accent-border)' }}>
                <i style={{ transform: `scaleX(${share.toFixed(2)})`, transition: 'transform 400ms linear' }} />
              </div>
              <div className="hint" style={{ marginTop: 5 }}>{busy}</div>
            </>
          )}
        </div>
      </div>

      {!pages.length && (
        <p className="note" style={{ marginTop: 10 }}>
          Для реальной загрузки сначала соберите коллаж.
        </p>
      )}

      {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}

      {results.map((result) => (
        <div
          key={result.marketplace}
          className="result"
          data-kind={result.ok ? (result.dryRun ? 'dry' : 'ok') : 'fail'}
        >
          <div className="spread" style={{ flexWrap: 'nowrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span className="icon">{result.ok ? '✓' : '!'}</span>
              <b style={{ font: '650 13.5px/1.3 system-ui' }}>
                {result.label} —{' '}
                {result.ok ? (result.dryRun ? 'payload собран' : 'оффер создан') : 'ошибка'}
              </b>
            </div>
            {result.offerUrl && (
              <a href={result.offerUrl} target="_blank" rel="noreferrer">
                открыть оффер
              </a>
            )}
          </div>
          {result.error && <p className="note" style={{ marginTop: 6 }}>{result.error}</p>}
          {result.sentPayload !== undefined && (
            <details>
              <summary className="note" style={{ cursor: 'pointer', marginTop: 6 }}>
                Что уходит на площадку
              </summary>
              <pre>{JSON.stringify(result.sentPayload, null, 2)}</pre>
            </details>
          )}
        </div>
      ))}

      {history.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary className="note" style={{ cursor: 'pointer' }}>
            История загрузок ({history.length})
          </summary>
          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
            {history.slice(0, 20).map((record) => (
              <div key={`${record.at}-${record.marketplace}`} className="note">
                {new Date(record.at).toLocaleString('ru-RU')} · {record.label} ·{' '}
                {record.ok ? 'ок' : 'ошибка'} · {record.price} {record.currency} ·{' '}
                {counted(record.itemCount, 'предмет', 'предмета', 'предметов')}
                {record.offerUrl && (
                  <>
                    {' · '}
                    <a href={record.offerUrl} target="_blank" rel="noreferrer">
                      оффер
                    </a>
                  </>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
