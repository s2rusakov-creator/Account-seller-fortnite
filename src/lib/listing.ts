import { notableName } from '@/lib/fortnite/notable';
import { plural } from '@/lib/plural';
import { rarityStyle, seasonLabel, typeLabel } from '@/lib/fortnite/rarity';
import type { LockerResult, OwnedItem } from '@/lib/fortnite/types';

export function headlineItems(items: OwnedItem[]): string[] {
  const found: string[] = [];
  for (const item of items) {
    const name = notableName(item.id);
    if (name) found.push(name);
  }
  return found;
}

export interface Breakdown {
  byType: { key: string; label: string; count: number }[];
  byRarity: { key: string; label: string; count: number }[];
  /** Items introduced in Chapter 1, seasons 1–4 — what a listing calls OG. */
  ogCount: number;
}

const OG_MAX_SEASON = 4;

export function breakdown(items: OwnedItem[]): Breakdown {
  const types = new Map<string, number>();
  const rarities = new Map<string, number>();
  let ogCount = 0;

  for (const item of items) {
    types.set(item.type, (types.get(item.type) ?? 0) + 1);
    rarities.set(item.rarity, (rarities.get(item.rarity) ?? 0) + 1);
    if (item.season && item.season <= OG_MAX_SEASON) ogCount += 1;
  }

  return {
    byType: [...types.entries()]
      .map(([key, count]) => ({ key, label: typeLabel(key), count }))
      .sort((a, b) => b.count - a.count),
    byRarity: [...rarities.entries()]
      .map(([key, count]) => ({ key, label: rarityStyle(key).label, count }))
      .sort((a, b) => rarityStyle(b.key).weight - rarityStyle(a.key).weight),
    ogCount,
  };
}

/** A marketplace title: short, and front-loaded with what sells. */
export function buildTitle(locker: LockerResult, items: OwnedItem[]): string {
  const outfits = items.filter((item) => item.type === 'outfit').length;
  const parts = [`Fortnite: ${outfits} ${plural(outfits, 'скин', 'скина', 'скинов')}`];

  const headline = headlineItems(items);
  if (headline.length) parts.push(headline.slice(0, 3).join(', '));

  const { ogCount } = breakdown(items);
  if (ogCount > 0) parts.push(`${ogCount} OG`);

  if (locker.stats.vbucks) parts.push(`${locker.stats.vbucks.toLocaleString('ru-RU')} В-Баксов`);

  return parts.join(' | ');
}

/** The description body, generated but meant to be edited before publishing. */
export function buildDescription(locker: LockerResult, items: OwnedItem[]): string {
  const { byType, byRarity, ogCount } = breakdown(items);
  const lines: string[] = [];

  lines.push(`Аккаунт Fortnite — ${items.length} ${plural(items.length, 'предмет', 'предмета', 'предметов')} в раздевалке.`);
  lines.push('');

  const headline = headlineItems(items);
  if (headline.length) {
    lines.push('Редкие предметы:');
    for (const name of headline) lines.push(`  • ${name}`);
    lines.push('');
  }

  lines.push('Состав:');
  for (const entry of byType.slice(0, 12)) lines.push(`  • ${entry.label}: ${entry.count}`);
  lines.push('');

  lines.push('По редкости:');
  for (const entry of byRarity) lines.push(`  • ${entry.label}: ${entry.count}`);
  lines.push('');

  const stats = locker.stats;
  const statLines: string[] = [];
  if (ogCount) statLines.push(`Предметов из 1–4 сезонов: ${ogCount}`);
  if (stats.accountLevel) statLines.push(`Уровень аккаунта: ${stats.accountLevel}`);
  if (stats.seasonLevel) statLines.push(`Уровень боевого пропуска: ${stats.seasonLevel}`);
  if (stats.pastSeasons.length) statLines.push(`Сыграно сезонов: ${stats.pastSeasons.length}`);
  if (stats.lifetimeWins !== undefined) statLines.push(`Побед за всё время: ${stats.lifetimeWins}`);
  if (stats.vbucks !== undefined) statLines.push(`В-Баксы: ${stats.vbucks.toLocaleString('ru-RU')}`);
  if (statLines.length) {
    lines.push('Аккаунт:');
    for (const line of statLines) lines.push(`  • ${line}`);
    lines.push('');
  }

  const account = locker.account;
  if (account) {
    const lines2: string[] = [];
    if (account.platforms.length) {
      lines2.push(`Привязки: ${account.platforms.join(', ')}`);
    } else {
      lines2.push('Привязок к консолям нет');
    }
    if (account.emailVerified !== undefined) {
      lines2.push(account.emailVerified ? 'Почта подтверждена' : 'Почта не подтверждена');
    }
    if (account.canChangeName !== undefined) {
      lines2.push(account.canChangeName ? 'Смена ника доступна' : 'Смена ника пока недоступна');
    }
    // 2FA is stated only when it is on: it is a thing the buyer must be helped
    // through, and "2FA выключена" in a listing reads as a security boast the
    // seller did not intend to make.
    if (account.tfaEnabled) lines2.push('Включена 2FA — отключается при передаче');
    lines.push('Состояние аккаунта:');
    for (const line of lines2) lines.push(`  • ${line}`);
    lines.push('');
  }

  const oldest = items
    .filter((item) => item.season)
    .sort((a, b) => (a.season ?? 0) - (b.season ?? 0))[0];
  if (oldest) lines.push(`Самый ранний предмет: ${oldest.name} (${seasonLabel(oldest)}).`);

  lines.push('');
  lines.push('Полный список предметов — на скриншотах и в приложенном файле.');

  return lines.join('\n');
}
