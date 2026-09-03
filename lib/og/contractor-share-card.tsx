import type { ContractorShareCardModel } from '@/lib/seo/share-card-model';
import { NETWORK_OG_SIZE, renderNetworkShareImage } from './network-share-card';

export const CONTRACTOR_OG_SIZE = NETWORK_OG_SIZE;
export const CONTRACTOR_OG_CONTENT_TYPE = 'image/png';
const CONFIG = { hub: 'CONTRACTOR TRUST HUB', descriptor: 'Independent Contractor Research', domain: 'contractortrusthub.com', accent: '#F5C518' };

export function renderContractorShareImage(model: ContractorShareCardModel) {
  return renderNetworkShareImage(CONFIG, model);
}

export function renderContractorFallbackImage() {
  return renderNetworkShareImage(CONFIG);
}
