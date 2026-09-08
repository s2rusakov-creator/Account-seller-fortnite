import { eldorado } from './eldorado';
import { gameboost } from './gameboost';
import type { MarketplaceAdapter } from './types';

export const ADAPTERS: MarketplaceAdapter[] = [gameboost, eldorado];

export function getAdapter(id: string): MarketplaceAdapter | undefined {
  return ADAPTERS.find((adapter) => adapter.id === id);
}

export { eldorado, gameboost };
