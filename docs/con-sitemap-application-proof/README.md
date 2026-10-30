# Contractor sitemap application proof

This isolated application proof is based on the approved #178 package, which
merged to `main` as `73c89c1e8ecaa4d90dcc8a62f267b282121b1d35`. It does not edit
that reviewed head. The new reader is opt-in only when
`SITEMAP_GENERATION_READER_ENABLED=true`; absent that exact value, `/sitemap.xml`
continues to use the existing route implementation. Versioned child requests
return `404 no-store` while the reader is disabled.

The CI test uses only an ephemeral PostgreSQL 17 service container, synthetic
contractor/license rows, a test-only administrator and a separate test reader
login. It imports and invokes the actual Next route `GET` handlers, the actual
`listSearchableContractorSlugs` query, `getSitemapShardPlan`, and the existing
`renderUrlSetXml` serializer. Test fixtures exercise Florida home-state and
license eligibility, thin-profile exclusion, canonical host, XML shape,
lastmod, generation publication changes, retained children, missing shards,
query permission failures, checksum/body corruption and compressed/decompressed
size limits.

The D15 follow-up assertions carry the Phase 0 boundary forward:

- An unpublished first pointer returns `503 no-store`, never empty `200`.
- A successful lookup proving an unknown generation or out-of-range shard
  returns `404 no-store`; a failed SQL read returns `503 no-store`.
- A missing required shard invalidates the index and child response; an
  individual corrupt body/checksum is rejected before that child can return a
  successful response.
- The index is no-store; immutable generation children have a one-year
  immutable cache policy and are addressed by generation UUID.
- Child responses negotiate gzip versus identity using `Accept-Encoding`,
  include `Vary: Accept-Encoding`, and enforce a 52,428,800-byte decompressed
  XML ceiling. One-year caching describes the cache policy for an immutable
  URL; it does not extend origin retention. After a generation is swept, a
  cache miss for its child URL returns `404 no-store`.
- Actual CDN purge acknowledgement and Supabase role/RLS, session-pooler and
  TLS behavior remain outside these disposable application tests.

## Validation boundary

`APPLICATION_HTTP_VALIDATION` and `HEADER_CONTRACT_VALIDATION` are established
only by the exact-head PostgreSQL 17 CI run. They do not prove Next/Vercel
rewrite behavior at the edge, deployed environment configuration, CDN purge,
Supabase grants/RLS, pooler pinning, or TLS. Those deployment gates must be run
and recorded separately before any future reader activation. This change does
not activate the reader, alter Production configuration, apply a migration,
or publish a generation.
