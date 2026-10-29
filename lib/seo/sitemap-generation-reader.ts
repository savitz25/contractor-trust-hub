import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { query } from "@/lib/db";
import {
  isPublishableSitemapLoc,
  MAX_SITEMAP_SHARDS,
  renderVersionedSitemapIndexXml,
  SITEMAP_MAX_URLS_PER_CHILD,
} from "@/lib/seo/sitemap-data";

export const SITEMAP_GENERATION_MAX_COMPRESSED_BYTES = 16 * 1024 * 1024;
export const SITEMAP_GENERATION_MAX_XML_BYTES = 52_428_800;
const MAX_GENERATION_BYTES = 400_000_000;
const NOT_FOUND_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
};
const UNAVAILABLE_HEADERS = NOT_FOUND_HEADERS;
const INDEX_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "no-store",
};
const IMMUTABLE_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
  Vary: "Accept-Encoding",
};
const NOT_ACCEPTABLE_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
  Vary: "Accept-Encoding",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type QueryRows = <T extends Record<string, unknown>>(
  sql: string,
  values?: readonly unknown[],
) => Promise<T[]>;

type ShardMetadata = {
  shard_no: number | string;
  url_count: number | string;
  compressed_bytes: number | string;
  payload_sha256: string;
};

type GenerationSnapshot = {
  pointer_epoch: number | string | null;
  pointer_generation_id: string | null;
  pointer_state?: string | null;
  pointer_retired_at?: Date | string | null;
  generation_id: string | null;
  state: string | null;
  retired_at: Date | string | null;
  shard_count: number | string | null;
  url_count: number | string | null;
  compressed_bytes: number | string | null;
  manifest_sha256: string | null;
  shards: ShardMetadata[] | null;
  stored_shard_count: number | string | null;
  stored_url_count: number | string | null;
  stored_compressed_bytes: number | string | null;
  requested_shard_no?: number | null;
  requested_payload?: Buffer | null;
  requested_bytes?: number | string | null;
  requested_sha256?: string | null;
};

const INDEX_SNAPSHOT_SQL = `
  SELECT p.pointer_epoch, p.current_generation_id::text AS pointer_generation_id,
         g.generation_id::text, g.state, g.retired_at, g.shard_count, g.url_count,
         g.compressed_bytes, encode(g.manifest_sha256, 'hex') AS manifest_sha256,
         COALESCE(s.shards, '[]'::json) AS shards,
         COALESCE(s.stored_shard_count, 0) AS stored_shard_count,
         COALESCE(s.stored_url_count, 0) AS stored_url_count,
         COALESCE(s.stored_compressed_bytes, 0) AS stored_compressed_bytes
  FROM sitemap_private.publication p
  LEFT JOIN sitemap_private.generation g
    ON g.generation_id = p.current_generation_id
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object(
             'shard_no', x.shard_no,
             'url_count', x.url_count,
             'compressed_bytes', x.compressed_bytes,
             'payload_sha256', encode(x.payload_sha256, 'hex')
           ) ORDER BY x.shard_no) AS shards,
           count(*) AS stored_shard_count,
           sum(x.url_count) AS stored_url_count,
           sum(x.compressed_bytes) AS stored_compressed_bytes
    FROM sitemap_private.shard x
    WHERE x.generation_id = g.generation_id
  ) s ON true
  WHERE p.singleton = true
`;

const CHILD_SNAPSHOT_SQL = `
  SELECT p.pointer_epoch, p.current_generation_id::text AS pointer_generation_id,
         current_generation.state AS pointer_state,
         current_generation.retired_at AS pointer_retired_at,
         g.generation_id::text, g.state, g.retired_at, g.shard_count, g.url_count,
         g.compressed_bytes, encode(g.manifest_sha256, 'hex') AS manifest_sha256,
         COALESCE(s.shards, '[]'::json) AS shards,
         COALESCE(s.stored_shard_count, 0) AS stored_shard_count,
         COALESCE(s.stored_url_count, 0) AS stored_url_count,
         COALESCE(s.stored_compressed_bytes, 0) AS stored_compressed_bytes,
         requested.shard_no AS requested_shard_no,
         CASE WHEN requested.compressed_bytes <= $3
              THEN requested.compressed_payload ELSE NULL END AS requested_payload,
         requested.compressed_bytes AS requested_bytes,
         encode(requested.payload_sha256, 'hex') AS requested_sha256
  FROM sitemap_private.generation g
  LEFT JOIN sitemap_private.publication p ON p.singleton = true
  LEFT JOIN sitemap_private.generation current_generation
    ON current_generation.generation_id = p.current_generation_id
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object(
             'shard_no', x.shard_no,
             'url_count', x.url_count,
             'compressed_bytes', x.compressed_bytes,
             'payload_sha256', encode(x.payload_sha256, 'hex')
           ) ORDER BY x.shard_no) AS shards,
           count(*) AS stored_shard_count,
           sum(x.url_count) AS stored_url_count,
           sum(x.compressed_bytes) AS stored_compressed_bytes
    FROM sitemap_private.shard x
    WHERE x.generation_id = g.generation_id
  ) s ON true
  LEFT JOIN sitemap_private.shard requested
    ON requested.generation_id = g.generation_id AND requested.shard_no = $2
  WHERE g.generation_id = $1::uuid
`;

function appQueryRows<T extends Record<string, unknown>>(
  sql: string,
  values: readonly unknown[] = [],
): Promise<T[]> {
  return query<T>(sql, [...values]);
}

function unavailable(): Response {
  return new Response("Sitemap temporarily unavailable", {
    status: 503,
    headers: UNAVAILABLE_HEADERS,
  });
}

function notFound(): Response {
  return new Response("Sitemap resource not found", { status: 404, headers: NOT_FOUND_HEADERS });
}

function asInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function snapshotIsComplete(snapshot: GenerationSnapshot): boolean {
  const generationId = snapshot.generation_id;
  const shards = Array.isArray(snapshot.shards) ? snapshot.shards : [];
  const shardCount = asInteger(snapshot.shard_count);
  const urlCount = asInteger(snapshot.url_count);
  const compressedBytes = asInteger(snapshot.compressed_bytes);
  if (
    !generationId ||
    snapshot.state !== "sealed" ||
    !UUID.test(generationId) ||
    shardCount < 1 ||
    shardCount > MAX_SITEMAP_SHARDS ||
    urlCount < 1 ||
    compressedBytes < 1 ||
    compressedBytes > MAX_GENERATION_BYTES ||
    asInteger(snapshot.stored_shard_count) !== shardCount ||
    asInteger(snapshot.stored_url_count) !== urlCount ||
    asInteger(snapshot.stored_compressed_bytes) !== compressedBytes ||
    shards.length !== shardCount
  ) {
    return false;
  }

  const manifest = createHash("sha256");
  let totalUrls = 0;
  let totalBytes = 0;
  for (let index = 0; index < shards.length; index += 1) {
    const shard = shards[index];
    if (
      !shard ||
      asInteger(shard.shard_no) !== index ||
      asInteger(shard.url_count) < 1 ||
      asInteger(shard.url_count) > SITEMAP_MAX_URLS_PER_CHILD ||
      asInteger(shard.compressed_bytes) < 1 ||
      !/^[0-9a-f]{64}$/.test(shard.payload_sha256)
    ) {
      return false;
    }
    totalUrls += asInteger(shard.url_count);
    totalBytes += asInteger(shard.compressed_bytes);
    manifest.update(shard.payload_sha256, "ascii");
  }
  return (
    totalUrls === urlCount &&
    totalBytes === compressedBytes &&
    totalBytes <= MAX_GENERATION_BYTES &&
    manifest.digest("hex") === snapshot.manifest_sha256
  );
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function validateSitemapXml(xml: string, expectedUrlCount: number): boolean {
  if (
    !xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>') ||
    !/^\s*<\?xml[^>]*>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">[\s\S]*<\/urlset>\s*$/.test(
      xml,
    )
  ) {
    return false;
  }
  const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)];
  const locations = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) =>
    decodeXmlText(match[1] ?? ""),
  );
  if (urls.length !== expectedUrlCount || locations.length !== expectedUrlCount) return false;
  if (new Set(locations).size !== locations.length) return false;
  return locations.every((loc) => isPublishableSitemapLoc(loc));
}

function decompressAndValidate(payload: Buffer, urlCount: number): Buffer | null {
  try {
    const xml = gunzipSync(payload, { maxOutputLength: SITEMAP_GENERATION_MAX_XML_BYTES });
    const text = new TextDecoder("utf-8", { fatal: true }).decode(xml);
    return validateSitemapXml(text, urlCount) ? xml : null;
  } catch {
    return null;
  }
}

function qualityValue(raw: string): number {
  if (!/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(raw)) return 0;
  return Number(raw);
}

/**
 * Select a supported representation according to Accept-Encoding. With no
 * field, either representation is acceptable and gzip wins the tie. An
 * explicitly empty field means no content coding was requested.
 */
function selectRepresentation(request: Request): "gzip" | "identity" | null {
  const header = request.headers.get("accept-encoding");
  if (header === null) return "gzip";
  if (header.trim() === "") return "identity";

  const qualities = new Map<string, number>();
  for (const part of header.split(",")) {
    const [rawCoding, ...parameters] = part.trim().split(";");
    const coding = rawCoding?.trim().toLowerCase();
    if (!coding) continue;
    let q = 1;
    if (parameters.length > 0) {
      if (parameters.length !== 1 || !/^\s*q\s*=\s*/i.test(parameters[0] ?? "")) {
        q = 0;
      } else {
        q = qualityValue((parameters[0] ?? "").replace(/^\s*q\s*=\s*/i, "").trim());
      }
    }
    // Ambiguous duplicate codings fail closed to the least permissive value.
    qualities.set(coding, Math.min(qualities.get(coding) ?? 1, q));
  }

  const wildcard = qualities.get("*");
  const gzipQ = qualities.get("gzip") ?? wildcard ?? 0;
  const identityQ = qualities.get("identity") ?? (wildcard === 0 ? 0 : 1);
  if (gzipQ > 0 && gzipQ >= identityQ) return "gzip";
  if (identityQ > 0) return "identity";
  if (gzipQ > 0) return "gzip";
  return null;
}

export function sitemapGenerationReaderEnabled(): boolean {
  return process.env.SITEMAP_GENERATION_READER_ENABLED === "true";
}

/** Application HTTP handlers for the disabled-by-default immutable generation reader. */
export function createSitemapGenerationHandlers(
  readRows: QueryRows = appQueryRows,
) {
  return {
    async index(): Promise<Response> {
      try {
        const [snapshot] = await readRows<GenerationSnapshot>(INDEX_SNAPSHOT_SQL);
        if (
          !snapshot ||
          !snapshot.pointer_generation_id ||
          snapshot.pointer_generation_id !== snapshot.generation_id ||
          snapshot.retired_at != null ||
          asInteger(snapshot.pointer_epoch) < 1 ||
          !snapshotIsComplete(snapshot)
        ) {
          return unavailable();
        }
        const xml = renderVersionedSitemapIndexXml(
          snapshot.generation_id!,
          (snapshot.shards ?? []).map((shard) => asInteger(shard.shard_no)),
        );
        return new Response(xml, { status: 200, headers: INDEX_HEADERS });
      } catch {
        return unavailable();
      }
    },

    async child(rawGenerationId: string, rawShardNo: string, request?: Request): Promise<Response> {
      const representation = selectRepresentation(request ?? new Request("http://localhost/"));
      if (!representation) {
        return new Response("No acceptable sitemap representation", {
          status: 406,
          headers: NOT_ACCEPTABLE_HEADERS,
        });
      }
      if (!UUID.test(rawGenerationId) || !/^(0|[1-9]\d*)$/.test(rawShardNo)) return notFound();
      const shardNo = Number(rawShardNo);
      if (!Number.isSafeInteger(shardNo) || shardNo >= MAX_SITEMAP_SHARDS) return notFound();

      try {
        const [snapshot] = await readRows<GenerationSnapshot>(CHILD_SNAPSHOT_SQL, [
          rawGenerationId,
          shardNo,
          SITEMAP_GENERATION_MAX_COMPRESSED_BYTES,
        ]);
        if (!snapshot) return notFound();
        if (
          !snapshotIsComplete(snapshot) ||
          asInteger(snapshot.pointer_epoch) < 1 ||
          !snapshot.pointer_generation_id ||
          !UUID.test(snapshot.pointer_generation_id) ||
          snapshot.pointer_state !== "sealed" ||
          snapshot.pointer_retired_at != null
        ) return unavailable();
        const shardCount = asInteger(snapshot.shard_count);
        if (shardNo >= shardCount) return notFound();
        const shard = snapshot.shards?.[shardNo];
        if (!shard || asInteger(shard.shard_no) !== shardNo) return unavailable();
        const payload = snapshot.requested_payload;
        const requestedBytes = asInteger(snapshot.requested_bytes);
        if (
          snapshot.requested_shard_no == null ||
          asInteger(snapshot.requested_shard_no) !== shardNo ||
          requestedBytes < 1 ||
          requestedBytes > SITEMAP_GENERATION_MAX_COMPRESSED_BYTES ||
          requestedBytes !== asInteger(shard.compressed_bytes) ||
          !payload ||
          payload.byteLength !== requestedBytes ||
          !snapshot.requested_sha256 ||
          snapshot.requested_sha256 !== shard.payload_sha256 ||
          createHash("sha256").update(payload).digest("hex") !== shard.payload_sha256
        ) {
          return unavailable();
        }
        const xml = decompressAndValidate(payload, asInteger(shard.url_count));
        if (!xml) return unavailable();
        const headers = new Headers(IMMUTABLE_HEADERS);
        const body = representation === "gzip" ? payload : xml;
        if (representation === "gzip") headers.set("Content-Encoding", "gzip");
        return new Response(new Uint8Array(body), { status: 200, headers });
      } catch {
        return unavailable();
      }
    },
  };
}
