import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

const PURPOSE = 'ath-monitoring-feed-v1';

function usableSecret(): string | null {
  const secret = process.env.ATH_HANDOFF_SECRET || '';
  return secret.length >= 32 ? secret : null;
}

function material(timestamp: string, method: string, path: string): string {
  return `${PURPOSE}\n${timestamp}\n${method.toUpperCase()}\n${path}`;
}

export function monitoringRequestSignature(timestamp: string, method: string, path: string): string | null {
  const secret = usableSecret();
  if (!secret) return null;
  const key = createHmac('sha256', secret).update(PURPOSE).digest();
  return createHmac('sha256', key).update(material(timestamp, method, path)).digest('hex');
}

export function verifyMonitoringRequest(request: Request, path: string, now = Date.now()): boolean {
  const timestamp = request.headers.get('x-ath-timestamp') || '';
  const supplied = request.headers.get('x-ath-signature') || '';
  if (!/^\d{10,13}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(supplied)) return false;
  const millis = timestamp.length === 10 ? Number(timestamp) * 1000 : Number(timestamp);
  if (!Number.isFinite(millis) || Math.abs(now - millis) > 5 * 60 * 1000) return false;
  const expected = monitoringRequestSignature(timestamp, request.method, path);
  if (!expected) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
}
