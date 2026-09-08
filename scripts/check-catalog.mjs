/**
 * Checks the hand-maintained lists against the real catalogue.
 *
 * Two of them decide what a listing says and neither fails loudly on its own:
 *
 *   `notable.ts` — a typo in one of these ids does not throw, it just quietly
 *   stops highlighting Renegade Raider, and nobody notices until a listing has
 *   already gone out without it in the title.
 *
 *   `rarity.ts` — a rarity or item type Epic adds in a new season falls
 *   through to a grey "Прочее" tile. Harmless per item, wrong across a whole
 *   new season's worth of cosmetics.
 *
 * Reads the live catalogue, falling back to the snapshot when offline.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function catalogue() {
  try {
    const response = await fetch('https://fortnite-api.com/v2/cosmetics/br?language=en', {
      headers: { accept: 'application/json' },
    });
    if (response.ok) {
      const { data } = await response.json();
      return { items: data ?? [], source: 'fortnite-api.com' };
    }
  } catch {
    /* fall through to the snapshot */
  }
  const raw = await readFile(join(root, 'src/data/catalog-snapshot.json'), 'utf8');
  const parsed = JSON.parse(raw);
  return {
    items: parsed.items.map((item) => ({
      id: item.id,
      name: item.name,
      type: { value: item.type },
      rarity: { value: item.rarity },
    })),
    source: 'снимок каталога',
  };
}

const { items, source } = await catalogue();
const byId = new Map(items.map((item) => [item.id.toLowerCase(), item]));
const problems = [];

// --- notable ids exist -------------------------------------------------------
const notableSource = await readFile(join(root, 'src/lib/fortnite/notable.ts'), 'utf8');
const notable = [...notableSource.matchAll(/^\s{2}([a-z0-9_]+):\s*'([^']+)'/gm)];
if (notable.length < 10) {
  problems.push('notable.ts: список не разобрался — изменился формат файла?');
}
for (const [, id, label] of notable) {
  const found = byId.get(id);
  if (!found) {
    problems.push(`notable.ts: «${label}» — id ${id} в каталоге отсутствует`);
    continue;
  }
  // The name is not required to match — the table is Russian-facing labels for
  // English catalogue entries — but a wildly different one means the id was
  // copied from the wrong row.
  const same = found.name.toLowerCase().includes(label.toLowerCase().split(' ')[0]);
  if (!same) {
    problems.push(`notable.ts: ${id} в каталоге называется «${found.name}», а не «${label}»`);
  }
}

// --- every rarity and type has a label --------------------------------------
const raritySource = await readFile(join(root, 'src/lib/fortnite/rarity.ts'), 'utf8');
const knownRarities = new Set(
  [...raritySource.matchAll(/^\s{2}([a-z]+):\s*\{\s*label:/gm)].map(([, key]) => key),
);
const knownTypes = new Set(
  [...raritySource.matchAll(/^\s{2}([a-z]+):\s*'[^']+',$/gm)].map(([, key]) => key),
);

const seenRarities = new Set(items.map((item) => item.rarity?.value).filter(Boolean));
const seenTypes = new Set(items.map((item) => item.type?.value).filter(Boolean));

for (const rarity of seenRarities) {
  if (!knownRarities.has(rarity)) problems.push(`rarity.ts: нет цвета для редкости «${rarity}»`);
}
for (const type of seenTypes) {
  if (!knownTypes.has(type)) problems.push(`rarity.ts: нет названия для типа «${type}»`);
}

// --- report ------------------------------------------------------------------
console.log(`Каталог: ${items.length} предметов (${source})`);
console.log(`Редких в списке: ${notable.length}`);

if (problems.length) {
  console.error(`\n${problems.length} проблем:`);
  for (const problem of problems) console.error(`  • ${problem}`);
  process.exit(1);
}

console.log('Все проверки пройдены.');
