import { getCatalog } from '@/lib/fortnite/catalog';
import { parseProfiles, type ProfileItem, type ProfileResponse } from '@/lib/epic/locker';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * A synthetic locker, in Epic's own response shape, run through the real
 * parser.
 *
 * Exists because the interesting half of this app cannot otherwise be
 * exercised without signing in to a real Fortnite account: the grid, the
 * filters, the collage and the listing text all hang off a `QueryProfile`
 * answer. This builds one — recognised cosmetics, an item the catalogue has
 * never seen, the quest and token entries that share the profile with the
 * locker — so the whole path can be checked, including that the junk is
 * dropped and the unknown item is not.
 *
 * Development only: in production it 404s, so a demo locker can never be
 * mistaken for an account that was actually read.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 });
  }

  const catalog = await getCatalog();
  const size = Math.min(2000, Number(new URL(request.url).searchParams.get('size') ?? 400));

  // The ones a listing would name in its title, so the headline logic has
  // something to find.
  const headline = [
    'CID_028_Athena_Commando_F',
    'CID_035_Athena_Commando_M_Medieval',
    'CID_022_Athena_Commando_F',
    'CID_029_Athena_Commando_F_Halloween',
    'EID_Floss',
    'EID_TakeTheL',
    'Pickaxe_ID_294_CandyCane',
  ];

  const pool = catalog.items.filter((item) => item.backend.startsWith('Athena'));
  const picked = new Set(headline);
  // Deterministic spread across the catalogue rather than random, so two runs
  // are comparable.
  for (let index = 0; picked.size < size && index < pool.length; index += Math.max(1, Math.floor(pool.length / size))) {
    picked.add(pool[index].id);
  }

  const items: Record<string, ProfileItem> = {};
  let n = 0;
  for (const id of picked) {
    const entry = catalog.byId.get(id.toLowerCase());
    items[`item-${n++}`] = {
      templateId: `${entry?.backend ?? 'AthenaCharacter'}:${id.toLowerCase()}`,
      quantity: 1,
      attributes: {
        item_seen: true,
        variants:
          n % 7 === 0
            ? [{ channel: 'Material', active: 'Mat1', owned: ['Mat1', 'Mat2', 'Mat3'] }]
            : [],
      },
    };
  }

  // A cosmetic from a season newer than the catalogue: must survive, labelled
  // as new rather than dropped.
  items['item-unknown'] = {
    templateId: 'AthenaCharacter:character_notinthecatalogueyet',
    quantity: 1,
    attributes: {},
  };
  // Profile clutter that shares the athena profile with the locker: must be
  // dropped.
  items['item-quest'] = { templateId: 'Quest:achievement_battleroyalewins', quantity: 1 };
  items['item-token'] = { templateId: 'Token:athenaseasonxpboost', quantity: 5 };
  items['item-xp'] = { templateId: 'AccountResource:athenaseasonalxp', quantity: 120 };

  const athena: ProfileResponse = {
    profileChanges: [
      {
        profile: {
          items: items,
          stats: {
            attributes: {
              season_num: 42,
              level: 87,
              accountLevel: 640,
              book_purchased: true,
              past_seasons: [
                { seasonNumber: 40, seasonLevel: 120, bookLevel: 100, purchasedVIP: true, numWins: 18 },
                { seasonNumber: 41, seasonLevel: 95, bookLevel: 84, purchasedVIP: true, numWins: 24 },
                { seasonNumber: 39, seasonLevel: 60, bookLevel: 55, purchasedVIP: false, numWins: 7 },
              ],
            },
          },
        },
      },
    ],
  };

  const core: ProfileResponse = {
    profileChanges: [
      {
        profile: {
          items: {
            a: { templateId: 'Currency:MtxPurchased', quantity: 8200 },
            b: { templateId: 'Currency:MtxGiveaway', quantity: 1300 },
            c: { templateId: 'HomebaseBannerIcon:standardbanner15', quantity: 1 },
          },
        },
      },
    ],
  };

  const locker = await parseProfiles(athena, core, 'demo-account', 'ДЕМО-АККАУНТ');

  // The account facts come from a different Epic service than the profiles, so
  // the demo supplies them too — otherwise the one part of the listing a buyer
  // reads first has no coverage here at all.
  return NextResponse.json({
    status: 'ok',
    locker: {
      ...locker,
      account: {
        platforms: ['psn', 'xbl'],
        emailVerified: true,
        tfaEnabled: true,
        canChangeName: true,
        country: 'DE',
        lastLogin: new Date().toISOString(),
      },
    },
  });
}
