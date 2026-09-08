/** One cosmetic from the catalogue, trimmed to what a listing needs. */
export interface Cosmetic {
  /** Catalogue id, e.g. `CID_028_Athena_Commando_F` or `Character_PitGlass`. */
  id: string;
  name: string;
  /** `outfit`, `pickaxe`, `emote`, … — the API's own `type.value`. */
  type: string;
  /** `AthenaCharacter`, `AthenaDance`, … — the half of a templateId before the colon. */
  backend: string;
  rarity: string;
  /** `Icon Series`, `MARVEL SERIES`, … Absent for most items. */
  series?: string;
  /** The set a cosmetic belongs to, e.g. `Voidlands Exile`. */
  set?: string;
  /** Season number the item was introduced in, counted straight through chapters. */
  season?: number;
  /** How the game names that season, e.g. `Глава 4, сезон OG`. Straight from the API,
   * because the numbering is not arithmetic: 27 is Chapter 4 OG and 32 is Chapter 2 Remix. */
  seasonName?: string;
  /** Whether fortnite-api.com has art for this id. 1081 of 16268 do not. */
  art: boolean;
}

/** A cosmetic the account actually owns, joined to its catalogue entry. */
export interface OwnedItem extends Cosmetic {
  /** Styles unlocked on this item, by channel — `{ Material: ['Mat2'] }`. */
  variants?: Record<string, string[]>;
  /** True when the locker held a templateId the catalogue does not know. */
  unknown?: boolean;
}

/** Everything read off one account in a single sitting. */
export interface LockerResult {
  accountId: string;
  displayName: string;
  items: OwnedItem[];
  stats: AccountStats;
  /** ISO timestamp of the read. */
  readAt: string;
  /** What Epic says about the account itself, rather than its locker. */
  account?: AccountInfo;
  /** True when the list was ticked by hand instead of read from Epic. */
  manual?: boolean;
}

/**
 * The account's own state — for a Fortnite listing this often moves the price
 * more than the locker does. A buyer's first two questions are whether the
 * email is theirs to take over and whether the account is bolted to a console.
 */
export interface AccountInfo {
  /** psn, xbl, nintendo, steam… as Epic names them. */
  platforms: string[];
  emailVerified?: boolean;
  /** Two-factor: a buyer has to be able to turn it off, or they are locked out. */
  tfaEnabled?: boolean;
  /** Whether Epic will currently allow a display-name change. */
  canChangeName?: boolean;
  displayNameChanges?: number;
  country?: string;
  /** ISO timestamp of the last sign-in Epic recorded. */
  lastLogin?: string;
}

export interface AccountStats {
  /** Battle-pass level of the current season, and the season's number. */
  seasonLevel?: number;
  seasonNumber?: number;
  accountLevel?: number;
  /** Seasons the account has played, newest first. */
  pastSeasons: PastSeason[];
  /** Total wins across every past season the profile records. */
  lifetimeWins?: number;
  /** V-Bucks on the account, from the common_core profile. */
  vbucks?: number;
  /** Whether the current season's battle pass was bought. */
  battlePassPurchased?: boolean;
}

export interface PastSeason {
  seasonNumber: number;
  seasonLevel?: number;
  bookLevel?: number;
  purchasedVIP?: boolean;
  numWins?: number;
}
