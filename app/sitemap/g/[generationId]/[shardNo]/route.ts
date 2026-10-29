import {
  createSitemapGenerationHandlers,
  sitemapGenerationReaderEnabled,
} from "@/lib/seo/sitemap-generation-reader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ generationId: string; shardNo: string }> };

export async function GET(_request: Request, { params }: Props): Promise<Response> {
  if (!sitemapGenerationReaderEnabled()) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  const { generationId, shardNo } = await params;
  return createSitemapGenerationHandlers().child(generationId, shardNo);
}
