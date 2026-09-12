import manifest from '@/data/home/contractor-network-metrics-v1.json';
export const dynamic = 'force-static';
export function GET() { return Response.json(manifest); }
