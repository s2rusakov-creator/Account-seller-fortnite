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
 * Пять предметов, которые игра выдаёт сама.
 *
 * «Рекрутов» здесь нет намеренно: их в каталоге 29 штук трёх поколений, но
 * аккаунту не выдаётся ни один — стартовый скин называется просто Default.
 *
 * Лобби-треков тоже нет, хотя на давно заведённом аккаунте их лежит три.
 * Они приходят не при регистрации, а раздачами за вход в определённый
 * период: «Show Them Who We Are» выдавали после обновления v28.01, и позже
 * забрали обратно со всех аккаунтов. Новый аккаунт застаёт другие раздачи
 * или никаких, поэтому заявлять их нельзя — объявление обещало бы предметы,
 * которых у аккаунта нет.
 *
 * Проверять список стоит раз в сезон, и лучше по свежему аккаунту, на
 * котором игру запустили один раз.
 */
const STARTER_IDS = [
  'CID_DefaultOutfit',
  'DefaultPickaxe',
  'DefaultGlider',
  'EID_DanceMoves',
  'SparksAura_Default',
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
