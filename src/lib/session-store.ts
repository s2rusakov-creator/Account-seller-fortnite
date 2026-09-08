'use client';

import type { LockerResult } from '@/lib/fortnite/types';

/**
 * Keeps the last locker read across reloads.
 *
 * Without it, refreshing the tab means going through Epic's device code again
 * — a new code, another sign-in, another wait — to see a list that has not
 * changed. That is the single most irritating thing about the flow, and it
 * costs one localStorage entry to remove.
 *
 * Deliberately per-browser and nothing more: the Brawl Stars build keeps
 * ownership in a shared blob store because there every tick is manual work
 * worth sharing with a colleague. Here the list comes from Epic in one call,
 * so re-reading it is cheap and shared storage would only be somewhere for a
 * stale copy to rot.
 *
 * No token is stored — there is none to store by the time this runs, since the
 * read kills it — and no credentials. Only what the locker read returned.
 */

const KEY = 'fortnite-lister.locker.v1';

/**
 * A week. Long enough that a listing worked on over several days survives,
 * short enough that a stale locker is not presented as current — cosmetics
 * bought since would be missing, and the read timestamp is shown for exactly
 * that reason.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function saveLocker(locker: LockerResult): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(locker));
  } catch {
    // Quota exceeded on a very large locker, or storage blocked. The app works
    // fine without the cache; it just asks for a new sign-in next time.
  }
}

export function loadLocker(): LockerResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LockerResult;
    if (!parsed?.items?.length || !parsed.readAt) return null;
    if (Date.now() - new Date(parsed.readAt).getTime() > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearLocker(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
