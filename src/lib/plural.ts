/**
 * Russian plural agreement — "1 предмет", "2 предмета", "5 предметов".
 *
 * Lives on its own because the listing text and the interface both count the
 * same things, and two copies of this drift into "601 предметов" on screen
 * while the description reads correctly.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = count % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** The count and its noun together: `items(3, 'предмет', 'предмета', 'предметов')`. */
export function counted(count: number, one: string, few: string, many: string): string {
  return `${count.toLocaleString('ru-RU')} ${plural(count, one, few, many)}`;
}
