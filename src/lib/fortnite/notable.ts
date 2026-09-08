/**
 * The cosmetics a buyer actually shops for.
 *
 * Nothing in the API marks scarcity: "rare" is a colour, not a statement about
 * availability, and Renegade Raider carries the same `rare` as a battle-pass
 * filler from last season. The items below stopped being obtainable years ago
 * or were bound to hardware and promotions, which is what a price is actually
 * built on — so they are named here by hand, and they sort ahead of everything
 * else regardless of what colour the game gives them.
 *
 * Deliberately short: every entry is something a listing would put in its
 * title.
 */
export const NOTABLE_IDS: Record<string, string> = {
  cid_017_athena_commando_m: 'Aerial Assault Trooper',
  cid_022_athena_commando_f: 'Recon Expert',
  cid_028_athena_commando_f: 'Renegade Raider',
  cid_029_athena_commando_f_halloween: 'Ghoul Trooper',
  cid_030_athena_commando_m_halloween: 'Skull Trooper',
  cid_032_athena_commando_m_medieval: 'Blue Squire',
  cid_033_athena_commando_f_medieval: 'Royale Knight',
  cid_035_athena_commando_m_medieval: 'Black Knight',
  cid_039_athena_commando_f_disco: 'Sparkle Specialist',
  cid_084_athena_commando_m_assassin: 'The Reaper',
  cid_175_athena_commando_m_celestial: 'Galaxy',
  cid_183_athena_commando_m_modernmilitaryred: 'Double Helix',
  cid_313_athena_commando_m_kpopfashion: 'IKONIK',
  cid_342_athena_commando_m_streetracermetallic: 'Honor Guard',
  cid_371_athena_commando_m_speedymidnight: 'Dark Vertex',
  cid_434_athena_commando_f_stealthhonor: 'Wonder',
  cid_703_athena_commando_m_cyclone: 'Travis Scott',
  cid_761_athena_commando_m_cyclonespace: 'Astro Jack',
  eid_floss: 'Floss',
  eid_takethel: 'Take The L',
  eid_rocketrodeo: 'Rocket Rodeo',
  pickaxe_id_294_candycane: 'Merry Mint Axe',
};

export function notableName(id: string): string | undefined {
  return NOTABLE_IDS[id.toLowerCase()];
}
