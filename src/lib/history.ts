'use client';

import type { UploadResult } from '@/lib/marketplaces/types';

/**
 * A record of what was actually listed.
 *
 * The upload route returns an offer id and a URL per marketplace, and without
 * this both are dropped on the floor — so "did I already list this account,
 * and where?" can only be answered by opening two seller dashboards. Survivable
 * for one listing, untenable for a business.
 *
 * Kept in the browser: it is one seller's working log, not shared state, and
 * putting it behind an API would mean standing up storage for a single-user
 * tool. Nothing sensitive goes in — no credentials, no account id, only what
 * the offer already says publicly.
 */

const KEY = 'fortnite-lister.history.v1';
const LIMIT = 200;

export interface UploadRecord {
  /** Milliseconds since the epoch, and the sort key. */
  at: number;
  displayName: string;
  marketplace: string;
  label: string;
  offerId?: string;
  offerUrl?: string;
  price: number;
  currency: string;
  itemCount: number;
  ok: boolean;
  error?: string;
}

function read(): UploadRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as UploadRecord[]) : [];
  } catch {
    // A corrupt entry must not take the app down with it.
    return [];
  }
}

export function loadHistory(): UploadRecord[] {
  return read().sort((a, b) => b.at - a.at);
}

export function recordUploads(
  results: UploadResult[],
  context: { displayName: string; price: number; currency: string; itemCount: number },
): UploadRecord[] {
  // A dry run created nothing, so logging it would fill the log with offers
  // that do not exist.
  const live = results.filter((result) => !result.dryRun);
  if (!live.length) return loadHistory();

  const now = Date.now();
  const added: UploadRecord[] = live.map((result) => ({
    at: now,
    displayName: context.displayName,
    marketplace: result.marketplace,
    label: result.label,
    offerId: result.offerId,
    offerUrl: result.offerUrl,
    price: context.price,
    currency: context.currency,
    itemCount: context.itemCount,
    ok: result.ok,
    error: result.error,
  }));

  const next = [...added, ...read()].slice(0, LIMIT);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the offer was still created, and losing the log
    // line must not read as a failed upload.
  }
  return next.sort((a, b) => b.at - a.at);
}

export function clearHistory(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
