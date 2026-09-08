'use client';

import { buildDescription, buildTitle } from '@/lib/listing';
import type { LockerResult, OwnedItem } from '@/lib/fortnite/types';
import { useState } from 'react';

interface Props {
  locker: LockerResult;
  items: OwnedItem[];
  title: string;
  description: string;
  onTitle: (title: string) => void;
  onDescription: (description: string) => void;
}

/**
 * The listing text, generated from the locker and then edited.
 *
 * The text lives in the page rather than here because the upload panel sends
 * it: two copies of an edited description — one shown, one uploaded — is the
 * kind of bug nobody notices until a buyer reads the wrong one.
 */
export function ListingPanel({ locker, items, title, description, onTitle, onDescription }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(what: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied('Браузер не дал доступ к буферу');
    }
  }

  return (
    <section className="card">
      <div className="spread" style={{ marginBottom: 12 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Текст объявления
        </h2>
        <button
          className="btn secondary small"
          onClick={() => {
            onTitle(buildTitle(locker, items));
            onDescription(buildDescription(locker, items));
          }}
        >
          Сгенерировать заново
        </button>
      </div>

      <div className="row" style={{ marginBottom: 10 }}>
        <input
          type="text"
          value={title}
          onChange={(event) => onTitle(event.target.value)}
          style={{ flex: '1 1 420px' }}
        />
        <button className="btn secondary small" onClick={() => copy('title', title)}>
          {copied === 'title' ? 'Скопировано' : 'Копировать'}
        </button>
      </div>

      <textarea
        rows={16}
        value={description}
        onChange={(event) => onDescription(event.target.value)}
      />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn secondary small" onClick={() => copy('body', description)}>
          {copied === 'body' ? 'Скопировано' : 'Копировать описание'}
        </button>
        {copied && copied !== 'title' && copied !== 'body' && <span className="error">{copied}</span>}
      </div>
    </section>
  );
}
