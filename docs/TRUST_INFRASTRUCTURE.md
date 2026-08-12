# Trust infrastructure (Phase 2)

Public pages that make Contractor Trust Hub more transparent, defensible, and correctable.

## Pages

| Route | Purpose |
|-------|---------|
| `/independence` | How we make money; no leads / no paid rankings; network principles |
| `/corrections` | Correction process + mailto-assisted request form |
| `/disclaimer` | Educational research, not FCRA CRA, verify on official sources |
| `/methodology` | Sources, high-confidence match rules, freshness |

## Form behavior

`CorrectionForm` builds a `mailto:` to `NEXT_PUBLIC_CORRECTIONS_EMAIL` (default
`corrections@contractortrusthub.com`). No server-side inbox is required to ship; operators
monitor that address and re-verify against DBPR / Sunbiz.

Trust Reports deep-link with `?slug=` and `?license=` prefill.

## Shared UI

- `components/trust/LegalNotice.tsx` — compact disclaimer + links
- Footer Trust & legal column + expanded site-wide legal strip
- Trust Report: stronger Sources & last verified + Request a correction CTA
