/**
 * Writes the catalogue snapshot the app falls back to.
 *
 * The app downloads the live catalogue on a cold start and keeps it for six
 * hours; this is what it uses when fortnite-api.com is unreachable and there
 * is no warm copy — without it, one outage there means the app cannot read an
 * account at all.
 *
 * The trimming produces the same shape as the app's own normaliser. It is
 * repeated here rather than imported because that module is TypeScript behind
 * a `@/` alias and this script runs under plain node — so if the catalogue
 * gains a field the app uses, add it in both places.
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'catalog-snapshot.json');

const response = await fetch('https://fortnite-api.com/v2/cosmetics/br?language=en', {
  headers: { accept: 'application/json' },
});
if (!response.ok) {
  console.error(`fortnite-api.com answered ${response.status}`);
  process.exit(1);
}

const { data } = await response.json();
const items = [];
for (const entry of data ?? []) {
  const type = entry.type?.value;
  const backend = entry.type?.backendValue;
  if (!entry.id || !entry.name || !type || !backend) continue;
  const intro = entry.introduction;
  items.push({
    id: entry.id,
    name: entry.name,
    type,
    backend,
    rarity: entry.rarity?.value ?? 'common',
    ...(entry.series?.value ? { series: entry.series.value } : {}),
    ...(entry.set?.value ? { set: entry.set.value } : {}),
    ...(intro?.backendValue ? { season: intro.backendValue } : {}),
    ...(intro?.chapter && intro.season
      ? { seasonName: `Глава ${intro.chapter}, сезон ${intro.season}` }
      : {}),
    art: Boolean(entry.images?.icon),
  });
}

if (items.length < 1000) {
  console.error(`catalogue looks truncated: ${items.length} items`);
  process.exit(1);
}

await writeFile(OUT, JSON.stringify({ builtAt: new Date().toISOString(), items }));
const outfits = items.filter((item) => item.type === 'outfit').length;
console.log(`${items.length} предметов (${outfits} скинов) → src/data/catalog-snapshot.json`);
