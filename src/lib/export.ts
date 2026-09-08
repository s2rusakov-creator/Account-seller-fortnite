import { iconUrl } from '@/lib/fortnite/images';
import { rarityStyle, seasonLabel, typeLabel } from '@/lib/fortnite/rarity';
import type { LockerResult, OwnedItem } from '@/lib/fortnite/types';

/** Downloads in the browser. Marketplaces want a file, not a screenshot of a table. */
export function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking immediately cancels the download in Safari; a tick is enough.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: string | number | undefined): string {
  const text = value === undefined ? '' : String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * A spreadsheet of the locker.
 *
 * Semicolon-separated and BOM-prefixed, because the buyers and sellers here
 * open these in a Russian-locale Excel, where a comma is a decimal separator
 * and a plain UTF-8 CSV renders as mojibake.
 */
export function toCsv(items: OwnedItem[]): Blob {
  const header = ['Название', 'Тип', 'Редкость', 'Серия', 'Набор', 'Сезон', 'Стили', 'ID', 'Картинка'];
  const rows = items.map((item) =>
    [
      csvCell(item.name),
      csvCell(item.unknown ? 'Новый предмет' : typeLabel(item.type)),
      csvCell(rarityStyle(item.rarity).label),
      csvCell(item.series ?? ''),
      csvCell(item.set ?? ''),
      csvCell(seasonLabel(item)),
      csvCell(countVariants(item)),
      csvCell(item.id),
      csvCell(item.art ? iconUrl(item.id) : ''),
    ].join(';'),
  );
  return new Blob([`﻿${[header.join(';'), ...rows].join('\r\n')}`], {
    type: 'text/csv;charset=utf-8',
  });
}

function countVariants(item: OwnedItem): number {
  if (!item.variants) return 0;
  return Object.values(item.variants).reduce((total, owned) => total + owned.length, 0);
}

/** The whole read, verbatim, for anyone who wants to process it further. */
export function toJson(locker: LockerResult, items: OwnedItem[]): Blob {
  return new Blob([JSON.stringify({ ...locker, items }, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
}

/** A plain list, for pasting into a chat with a buyer. */
export function toTextList(items: OwnedItem[]): Blob {
  const lines = items.map((item) => `${item.name} — ${rarityStyle(item.rarity).label}`);
  return new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
}
