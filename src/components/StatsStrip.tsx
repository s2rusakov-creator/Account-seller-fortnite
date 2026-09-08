'use client';

import { breakdown, headlineItems } from '@/lib/listing';
import type { AccountInfo, LockerResult, OwnedItem } from '@/lib/fortnite/types';

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
    <p className="note" style={{ marginBottom: 0, marginTop: 14 }}>
      {facts.map((fact, index) => (
        <span key={fact.text} style={fact.warn ? { color: 'var(--warn)' } : undefined}>
          {index > 0 && ' · '}
          {fact.text}
        </span>
      ))}
    </p>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="stat">
      <div className="value">{typeof value === 'number' ? value.toLocaleString('ru-RU') : value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function StatsStrip({ locker, items }: { locker: LockerResult; items: OwnedItem[] }) {
  const { ogCount } = breakdown(items);
  const outfits = items.filter((item) => item.type === 'outfit').length;
  const headline = headlineItems(items);
  const stats = locker.stats;

  return (
    <section className="card">
      <div className="spread" style={{ marginBottom: 14 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          {locker.displayName}
        </h2>
        <span className="note">
          прочитано {new Date(locker.readAt).toLocaleString('ru-RU')}
        </span>
      </div>

      <div className="stats">
        <Stat value={items.length} label="предметов всего" />
        <Stat value={outfits} label="скинов" />
        <Stat value={ogCount} label="из 1–4 сезонов" />
        {stats.vbucks !== undefined && <Stat value={stats.vbucks} label="В-Баксов" />}
        {stats.accountLevel !== undefined && <Stat value={stats.accountLevel} label="уровень аккаунта" />}
        {stats.seasonLevel !== undefined && <Stat value={stats.seasonLevel} label="уровень БП" />}
        {stats.pastSeasons.length > 0 && <Stat value={stats.pastSeasons.length} label="сыграно сезонов" />}
        {stats.lifetimeWins !== undefined && <Stat value={stats.lifetimeWins} label="побед за всё время" />}
      </div>

      {locker.account && <AccountFacts account={locker.account} />}

      {locker.manual && (
        <p className="note" style={{ marginBottom: 0, marginTop: 12 }}>
          Список отмечен вручную — уровень, В-Баксы и привязки Epic не сообщал.
        </p>
      )}

      {headline.length > 0 && (
        <p className="note" style={{ marginBottom: 0, marginTop: 14 }}>
          <b style={{ color: 'var(--warn)' }}>Редкое на аккаунте:</b> {headline.join(', ')}
        </p>
      )}
    </section>
  );
}
