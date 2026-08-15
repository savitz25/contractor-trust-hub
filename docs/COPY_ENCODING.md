# Copy encoding

UI copy must stay readable on production. Phase 10 cleaned a UTF-8 vs OEM/CP437 mojibake incident on `/plan` (arrows, en dashes, and middle dots saved as `ΓåÆ`, `ΓÇô`, `┬╖`).

## Preferred characters

| Meaning | Use | Avoid |
|---|---|---|
| Range | `60-90`, `$25-75k`, `A-Z` | en dash `–`, em dash `—` |
| Pause / aside | hyphen + spaces: ` - ` | em dash |
| Separator | ` - ` or a new line | middle dot `·`, bullet `•` |
| Direction / CTA | no glyph: `Back`, `Continue` | `←` `→` `⇒` |
| Ellipsis | `...` | `…` |
| Quotes | `" "` and `' '` | `“ ” ‘ ’` |

ASCII is the default for buttons, kickers, and range labels. Longer prose may use a hyphen (` - `) instead of an em dash.

## Do not

- Paste from Word, Notion, or Slack into `.tsx` / `.ts` string literals.
- Save a UTF-8 file after an editor treated it as OEM/CP437/Windows-1252.
- Add decorative arrows to buttons.

## How to spot mojibake in QA

Open `/plan` (desktop footer), homepage CTAs, `/verify`, a Trust Report, `/florida`, and one studio.

Fail the pass if you see any of: `†`, `É`, `Æ`, `Ç`, `Ã`, `Â`, `Γ`, `┬`, `â€`.

Typical mappings when UTF-8 was read as OEM:

- `→` became `ΓåÆ` (often looks like `†Æ`)
- `←` became `ΓåÉ`
- `–` became `ΓÇô` (often looks like `Ç§`)
- `·` became `┬╖` (often looks like `†`)

## Source files

Save TypeScript and Markdown as **UTF-8** (no BOM). Next.js emits UTF-8 HTML. If copy is already ASCII, a later mis-decode cannot invent arrows.

Quick scan from repo root:

```bash
rg "Γ|┬|←|→|–|—|·|…|“|”" app components lib/plan
```
