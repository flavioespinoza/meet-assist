# SPEC: Naming Conventions

v2 | Mar 11 2026 - 08:30 PM (MST)

**Canonical source:** `SPEC__directive--fx-naming.md` in `flavio__keymaster/_specs/`

This project follows the FX naming directive for all `.md`, `.json`, and `.pdf` files, and the TypeScript / TSX file naming rules defined in that spec.

## Quick Reference

**File names (exterior) — ALL kebab-case:**

| Type | Convention | Example |
|------|-----------|---------|
| Components | kebab-case | `meeting-card.tsx` |
| Hooks | kebab-case with `use-` prefix | `use-transcript.ts` |
| Utilities | kebab-case | `format-duration.ts` |
| Types | kebab-case | `meeting-types.ts` |
| Constants | kebab-case | `app-config.ts` |
| Routes | kebab-case (Next.js default) | `app/dashboard/page.tsx` |
| CSS modules | kebab-case | `card-grid.module.css` |
| Directories | kebab-case | `my-project/`, `tribal-knowledge/` |

**Identifiers (interior) — React / TypeScript required casing:**

| What | Casing | Why | Example |
|------|--------|-----|---------|
| Components | PascalCase | React requires it for JSX rendering | `function MeetingCard() { ... }` |
| Hooks | camelCase with `use` prefix | React requires it for hook rules | `function useTranscript() { ... }` |
| Functions / variables | camelCase | TypeScript convention | `const formatDuration = () => { ... }` |
| Types / interfaces | PascalCase | TypeScript convention | `interface MeetingCardProps { ... }` |
| Constants | UPPER_SNAKE_CASE | Convention for immutable values | `const MAX_RETRIES = 3` |

## Exterior vs Interior

```txt
components/meeting-card.tsx                ← file name: kebab-case
  function MeetingCard() { ... }          ← inside: PascalCase (React JSX requirement)

hooks/use-transcript.ts                    ← file name: kebab-case
  function useTranscript() { ... }        ← inside: camelCase (React hook rules)

hooks/use-copy-clipboard.ts               ← file name: kebab-case
  function useCopyClipboard() { ... }     ← inside: camelCase (React hook rules)
```

## Stack

- **Components:** shadcn/ui
- **Icons:** Lucide React
- **Styling:** Tailwind CSS
