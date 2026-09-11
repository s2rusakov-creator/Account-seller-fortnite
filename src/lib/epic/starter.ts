import { getCatalog } from '@/lib/fortnite/catalog';
import type { LockerResult, OwnedItem } from '@/lib/fortnite/types';

/**
 * Раздевалка аккаунта, который ни разу не заходили в игру.
 *
 * Epic закрывает `QueryProfile` для такого аккаунта — права `PLAY` у него нет
 * до первого запуска, — но читать там и нечего: косметика выдаётся при первом
 * входе и одинакова у всех. Поэтому вместо ошибки показывается ровно то, что
 * у аккаунта есть на самом деле: стартовый набор и пустая статистика.
 *
 * Список намеренно короткий и состоит только из предметов, которые игра
 * выдаёт сама. Всё остальное — уже покупки и награды, а их у такого аккаунта
 * быть не может.
 */

/**
 * Список снят с живого аккаунта 11 сентября 2026 года — ровно восемь
 * предметов, три редких и пять обычных.
 *
 * «Рекрутов» здесь нет намеренно: их в каталоге 29 штук трёх поколений, но
 * аккаунту не выдаётся ни один — стартовый скин называется просто Default.
 * Проверять список стоит раз в сезон: Epic иногда добавляет в него трек.
 */
const STARTER_IDS = [
  'CID_DefaultOutfit',
  'DefaultPickaxe',
  'DefaultGlider',
  'EID_DanceMoves',
  'SparksAura_Default',
  // Три трека, которые лежат у всех с самого начала.
  'MusicPack_053_FortniteTrapRemix',
  'MusicPack_143_S21_FNCS',
  'MusicPack_196_S28DefaultTrack',
];

export async function starterLocker(accountId: string, displayName: string): Promise<LockerResult> {
  const catalog = await getCatalog();
  const items: OwnedItem[] = [];

  for (const id of STARTER_IDS) {
    const cosmetic = catalog.byId.get(id.toLowerCase());
    // Если Epic однажды переименует стартовый предмет, потеряется он один,
    // а не весь ответ.
    if (cosmetic) items.push({ ...cosmetic });
  }

  return {
    accountId,
    displayName,
    items,
    stats: {
      accountLevel: 0,
      seasonLevel: 0,
      battlePassPurchased: false,
      pastSeasons: [],
      vbucks: 0,
    },
    readAt: new Date().toISOString(),
    unplayed: true,
  };
}
