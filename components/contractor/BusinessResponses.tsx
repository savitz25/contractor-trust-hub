import React from 'react';
import type { PublicBusinessReplies } from '@/lib/business-replies/public-contract';

export function BusinessResponses({data}:{data:PublicBusinessReplies}) {
  if(!data.replies.length) return null;
  return <section aria-labelledby="business-responses-heading" className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:p-6">
    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Provided by the business</p>
    <h2 id="business-responses-heading" className="mt-1 text-xl font-semibold text-[var(--text)]">Response from the business</h2>
    <p className="mt-2 text-sm text-[var(--muted)]">TrustHub does not independently verify statements made in business responses unless otherwise noted. The official evidence above remains unchanged.</p>
    <div className="mt-4 space-y-4">{data.replies.map(reply=><article key={reply.id} className="rounded-xl border border-[var(--border)] bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{reply.targetType.replaceAll('_',' ')}{reply.targetRecordId?<> &middot; {reply.targetRecordId}</>:null}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">{reply.body}</p><p className="mt-3 text-xs text-[var(--muted)]">Provided by the business &middot; Published {new Date(reply.publishedAt).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'})}{reply.updatedAt?<> &middot; Updated {new Date(reply.updatedAt).toLocaleDateString('en-US',{timeZone:'UTC'})}</>:null}</p></article>)}</div>
  </section>;
}
