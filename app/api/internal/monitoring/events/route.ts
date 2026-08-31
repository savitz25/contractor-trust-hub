import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyMonitoringRequest } from '@/lib/monitoring/signature';

export const dynamic = 'force-dynamic';
const PATH = '/api/internal/monitoring/events';

type EventRow = {
  sequence_id: string; id: string; native_profile_id: string; source_system: string;
  source_dataset: string; source_record_id: string; change_type: string;
  prior_state: unknown; current_state: unknown; source_effective_at: string | null;
  detected_at: string; fingerprint_sha256: string; provenance: unknown;
};

export async function GET(request: Request) {
  if (!verifyMonitoringRequest(request, PATH)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const url = new URL(request.url);
  const after = Math.max(0, Number.parseInt(url.searchParams.get('after') || '0', 10) || 0);
  const limit = Math.min(250, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '100', 10) || 100));
  const rows = await query<EventRow>(
    `SELECT e.sequence_id::text,e.id::text,e.contractor_id::text AS native_profile_id,
            e.source_system,e.source_dataset,e.source_record_id,e.change_type,
            e.prior_state,e.current_state,e.source_effective_at::text,e.detected_at::text,
            e.fingerprint_sha256,e.provenance
       FROM regulatory_change_events e
      WHERE e.sequence_id > $1 ORDER BY e.sequence_id LIMIT $2`, [after, limit]);
  return NextResponse.json({ contractVersion: 1, events: rows }, {
    headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}
