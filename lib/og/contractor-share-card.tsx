import React, { type ReactNode } from 'react';
import { ImageResponse } from 'next/og';
import type { ContractorShareCardModel } from '@/lib/seo/share-card-model';

export const CONTRACTOR_OG_SIZE = { width: 1200, height: 630 };
export const CONTRACTOR_OG_CONTENT_TYPE = 'image/png';
export const CONTRACTOR_SOCIAL_CARD_REVISION = '20260903';
export const CONTRACTOR_SOCIAL_SAFE_AREA = { width: 820, height: 520 };
export const CONTRACTOR_SOCIAL_TEXT_LIMITS = {
  titleMaxLines: 2,
  stateTitleMinSize: 38,
  entityTitleMinSize: 32,
  supportingMaxCharacters: 68,
} as const;

const FALLBACK_ALT = 'Contractor Trust Hub ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Independent Contractor Research';
const ORANGE = '#F5C518';

type TextLayout = { lines: string[]; fontSize: number };

function boundedLines(value: string, maxCharacters: number, maxLines = 2): string[] {
  const words = value.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharacters || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  const consumed = lines.join(' ').length;
  if (consumed < value.trim().replace(/\s+/g, ' ').length && lines.length) {
    const last = lines.length - 1;
    lines[last] = `${lines[last].slice(0, Math.max(1, maxCharacters - 1)).trimEnd()}...`;
  }
  return lines;
}

export function getContractorSocialTextLayout(kind: ContractorShareCardModel['kind'], title: string): TextLayout {
  const length = title.trim().length;
  if (kind === 'entity') {
    const fontSize = length <= 30 ? 44 : length <= 52 ? 38 : 32;
    return { lines: boundedLines(title, fontSize === 44 ? 28 : fontSize === 38 ? 32 : 36), fontSize };
  }
  const fontSize = length <= 34 ? 50 : length <= 52 ? 44 : 38;
  return { lines: boundedLines(title, fontSize === 50 ? 29 : fontSize === 44 ? 31 : 33), fontSize };
}

function boundedSupportingText(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length <= CONTRACTOR_SOCIAL_TEXT_LIMITS.supportingMaxCharacters
    ? normalized
    : `${normalized.slice(0, CONTRACTOR_SOCIAL_TEXT_LIMITS.supportingMaxCharacters - 1).trimEnd()}...`;
}

function Nodes({ side }: { side: 'left' | 'right' }) {
  const points: Array<[number, number]> = side === 'left'
    ? [[22, 76], [72, 146], [18, 270], [96, 352], [28, 468], [142, 528], [196, 398], [172, 214]]
    : [[1170, 88], [1112, 164], [1182, 250], [1096, 332], [1160, 466], [1062, 530], [1014, 400], [1038, 214]];
  return <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
    {points.map(([x, y], index) => <div key={`${side}-${index}`} style={{ position: 'absolute', left: x, top: y, width: index % 3 === 0 ? 8 : 5, height: index % 3 === 0 ? 8 : 5, borderRadius: 12, background: index % 3 === 0 ? ORANGE : 'rgba(255,255,255,.34)', boxShadow: index % 3 === 0 ? '0 0 22px rgba(245,197,24,.9)' : 'none' }} />)}
    {points.slice(0, -1).map(([x, y], index) => { const [nextX, nextY] = points[index + 1]; const width = Math.hypot(nextX - x, nextY - y); const angle = Math.atan2(nextY - y, nextX - x) * 180 / Math.PI; return <div key={`line-${side}-${index}`} style={{ position: 'absolute', left: x, top: y, width, height: 1, background: 'rgba(245,197,24,.18)', transformOrigin: '0 0', transform: `rotate(${angle}deg)` }} />; })}
  </div>;
}

function Bracket({ side }: { side: 'left' | 'right' }) {
  return <div style={{ position: 'absolute', top: 48, [side]: 156, width: 74, height: 502, borderTop: '2px solid rgba(255,255,255,.35)', borderBottom: '2px solid rgba(255,255,255,.35)', [side === 'left' ? 'borderLeft' : 'borderRight']: `3px solid ${ORANGE}`, borderRadius: side === 'left' ? '52px 0 0 52px' : '0 52px 52px 0', opacity: 0.8, boxShadow: '0 0 28px rgba(245,197,24,.22)' }} />;
}

function Center({ children }: { children: ReactNode }) {
  return <div style={{ position: 'relative', width: CONTRACTOR_SOCIAL_SAFE_AREA.width, height: CONTRACTOR_SOCIAL_SAFE_AREA.height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
    <div style={{ position: 'absolute', top: 2, fontSize: 13, fontWeight: 700, letterSpacing: '4px', color: 'rgba(255,255,255,.48)' }}>ASK TRUST HUB NETWORK</div>
    {children}
  </div>;
}

function ContractorShareInner({ model }: { model: ContractorShareCardModel }) {
  const contextual = model.kind !== 'fallback';
  const layout = contextual ? getContractorSocialTextLayout(model.kind, model.title) : null;
  return <Center>
    <div style={{ fontFamily: 'Georgia, serif', fontSize: 76, lineHeight: 1, letterSpacing: '-2px', color: '#fff' }}>Contractor Trust Hub</div>
    <div style={{ width: 760, marginTop: 24, display: 'flex', justifyContent: 'center', fontSize: contextual ? 17 : 25, fontWeight: 600, letterSpacing: contextual ? '5px' : '4px', textTransform: 'uppercase', color: contextual ? ORANGE : 'rgba(255,255,255,.9)' }}>{contextual ? boundedSupportingText(model.eyebrow ?? '') : 'Independent Contractor Research'}</div>
    {contextual && layout ? <div style={{ width: 760, marginTop: 17, display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'Georgia, serif', fontSize: layout.fontSize, lineHeight: 1.06, color: '#fff' }}>{layout.lines.map((line) => <div key={line} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>{line}</div>)}</div> : null}
    {contextual && model.subtitle ? <div style={{ width: 720, marginTop: 12, display: 'flex', justifyContent: 'center', fontSize: 20, letterSpacing: '1px', color: 'rgba(255,255,255,.75)' }}>{boundedSupportingText(model.subtitle)}</div> : null}
    {contextual && model.fact ? <div style={{ width: 720, marginTop: 11, display: 'flex', justifyContent: 'center', fontSize: 16, letterSpacing: '1.5px', color: 'rgba(255,255,255,.62)' }}>{boundedSupportingText(model.fact)}</div> : null}
    <div style={{ marginTop: contextual ? 24 : 52, width: 342, height: 2, background: `linear-gradient(90deg, transparent, ${ORANGE}, #ffd0bd, ${ORANGE}, transparent)` }} />
    <div style={{ marginTop: 22, fontSize: 24, letterSpacing: '4px', color: 'rgba(255,255,255,.9)' }}>contractortrusthub.com</div>
  </Center>;
}

export function renderContractorShareImage(model: ContractorShareCardModel) {
  return new ImageResponse(<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', color: '#fff', fontFamily: 'Arial, sans-serif', background: 'radial-gradient(circle at 17% 48%, rgba(245,197,24,.18), transparent 32%), radial-gradient(circle at 84% 45%, rgba(245,197,24,.12), transparent 30%), linear-gradient(135deg, #020b1d, #06182c 54%, #020817)' }}><Nodes side="left" /><Nodes side="right" /><Bracket side="left" /><Bracket side="right" /><ContractorShareInner model={model} /></div>, { ...CONTRACTOR_OG_SIZE, headers: { 'Cache-Control': 'public, max-age=0, s-maxage=31536000, immutable', 'X-TrustHub-Card-Revision': CONTRACTOR_SOCIAL_CARD_REVISION } });
}

export function renderContractorFallbackImage() { return renderContractorShareImage({ kind: 'fallback', eyebrow: '', title: 'Independent Contractor Research' } as ContractorShareCardModel); }
export { FALLBACK_ALT as CONTRACTOR_OG_FALLBACK_ALT };
