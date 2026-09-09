'use client';

import { breakdown, headlineItems } from '@/lib/listing';
import type { AccountInfo, LockerResult, OwnedItem } from '@/lib/fortnite/types';
import { useEffect, useState } from 'react';

/** How Epic names the external accounts, in the words a listing uses. */
const PLATFORM_LABELS: Record<string, string> = {
  psn: 'PlayStation',
  xbl: 'Xbox',
  nintendo: 'Nintendo',
  steam: 'Steam',
  github: 'GitHub',
  google: 'Google',
  apple: 'Apple',
  twitch: 'Twitch',
};

/**
 * Counts up to the real figure once, when the locker lands.
 *
 * This is the payoff of the whole flow — a moment ago the screen held an
 * eight-character code, now it holds the account. Numbers that snap into
 * place read as a page swap; numbers that run up read as an arrival.
 *
 * Fourteen frames at 50 ms — 700 ms total, matching the tile cascade. Anything
 * longer and a seller reading the figures is waiting on them.
 */
function useCountUp(active: boolean): number {
  const [progress, setProgress] = useState(active ? 0 : 1);

  useEffect(() => {
    if (!active) {
      setProgress(1);
      return;
    }
    let frame = 0;
    setProgress(0);
    const timer = setInterval(() => {
      frame += 1;
      setProgress(Math.min(1, frame / 14));
      if (frame >= 14) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [active]);

  return progress;
}

function Stat({ value, label, index, progress }: {
  value: number | string;
  label: string;
  index: number;
  progress: number;
}) {
  const shown =
    typeof value === 'number'
      ? Math.round(value * progress).toLocaleString('ru-RU')
      : value;
  return (
    <div className="stat" style={{ animationDelay: `${index * 45}ms` }}>
      <div className="value">{shown}</div>
      <div className="label">{label}</div>
    </div>
  );
}

/**
 * The account's own state, which for a Fortnite listing is often the first
 * question a buyer asks — before the skins.
 *
 * Two-factor is called out as a warning rather than a fact: a buyer who cannot
 * disable it is locked out of the account they just paid for, so it has to be
 * handed over deliberately.
 */
function AccountFacts({ account }: { account: AccountInfo }) {
  const facts: { text: string; warn?: boolean }[] = [];

  if (account.platforms.length) {
    facts.push({
      text: `Привязки: ${account.platforms
        .map((platform) => PLATFORM_LABELS[platform] ?? platform)
        .join(', ')}`,
    });
  } else {
    facts.push({ text: 'Привязок к консолям нет' });
  }

  if (account.emailVerified !== undefined) {
    facts.push({
      text: account.emailVerified ? 'Почта подтверждена' : 'Почта не подтверждена',
      warn: !account.emailVerified,
    });
  }
  if (account.tfaEnabled) facts.push({ text: '2FA включена — отключите перед передачей', warn: true });
  if (account.canChangeName !== undefined) {
    facts.push({
      text: account.canChangeName ? 'Ник можно сменить' : 'Смена ника недоступна',
      warn: !account.canChangeName,
    });
  }
  if (account.country) facts.push({ text: `Регион: ${account.country}` });

  return (
    <p className="facts">
      {facts.map((fact, index) => (
        <span key={fact.text} className={fact.warn ? 'warn' : undefined}>
          {index > 0 && ' · '}
          {fact.text}
        </span>
      ))}
    </p>
  );
}

export function StatsStrip({
  locker,
  items,
  arriving = false,
}: {
  locker: LockerResult;
  items: OwnedItem[];
  arriving?: boolean;
}) {
  const progress = useCountUp(arriving);
  const { ogCount } = breakdown(items);
  const outfits = items.filter((item) => item.type === 'outfit').length;
  const headline = headlineItems(items);
  const stats = locker.stats;

  const cells: { value: number; label: string }[] = [
    { value: items.length, label: 'предметов всего' },
    { value: outfits, label: 'скинов' },
    { value: ogCount, label: 'из 1–4 сезонов' },
  ];
  if (stats.vbucks !== undefined) cells.push({ value: stats.vbucks, label: 'В-Баксов' });
  if (stats.accountLevel !== undefined) cells.push({ value: stats.accountLevel, label: 'уровень аккаунта' });
  if (stats.seasonLevel !== undefined) cells.push({ value: stats.seasonLevel, label: 'уровень БП' });
  if (stats.pastSeasons.length) cells.push({ value: stats.pastSeasons.length, label: 'сыграно сезонов' });
  if (stats.lifetimeWins !== undefined) cells.push({ value: stats.lifetimeWins, label: 'побед за всё время' });

  return (
    <section className="card">
      <div className="spread" style={{ alignItems: 'baseline', marginBottom: 12 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          {locker.displayName}
        </h2>
        <span className="note">прочитано {new Date(locker.readAt).toLocaleString('ru-RU')}</span>
      </div>

      <div className="stats">
        {cells.map((cell, index) => (
          <Stat
            key={cell.label}
            value={cell.value}
            label={cell.label}
            index={index}
            progress={progress}
          />
        ))}
      </div>

      {locker.account && <AccountFacts account={locker.account} />}

      {locker.manual && (
        <p className="facts">Список отмечен вручную — уровень, В-Баксы и привязки Epic не сообщал.</p>
      )}

      {headline.length > 0 && (
        <p className="headline">
          <b>Редкое на аккаунте:</b> {headline.join(', ')}
        </p>
      )}
    </section>
  );
}
