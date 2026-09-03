import { renderContractorFallbackImage } from '@/lib/og/contractor-share-card';

export const runtime = 'edge';
export const alt = 'Contractor Trust Hub — Independent Contractor Research';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() { return renderContractorFallbackImage(); }
