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

const STARTER_IDS = [
  // Восемь «рекрутов» — базовые модели, между которыми игра выбирает при
  // первом входе. В раздевалке видно все восемь.
  'CID_001_Athena_Commando_F_Default',
  'CID_002_Athena_Commando_F_Default',
  'CID_003_Athena_Commando_F_Default',
  'CID_004_Athena_Commando_F_Default',
  'CID_005_Athena_Commando_M_Default',
  'CID_006_Athena_Commando_M_Default',
  'CID_007_Athena_Commando_M_Default',
  'CID_008_Athena_Commando_M_Default',
  'DefaultPickaxe',
  'DefaultGlider',
  'EID_DanceMoves',
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
