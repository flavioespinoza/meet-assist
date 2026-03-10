# SPEC: Naming Conventions

v1 | Mar 09 2026 - 07:56 PM (MST)

## Rule

**Everything is kebab-case.** Files, folders, all of it.

## Files

| Type | Convention | Example |
|------|-----------|---------|
| Components | kebab-case | `meeting-card.tsx` |
| Hooks | kebab-case with `use-` prefix | `use-transcript.ts` |
| Utilities | kebab-case | `format-duration.ts` |
| Types | kebab-case | `meeting-types.ts` |
| Constants | kebab-case | `app-config.ts` |
| Routes | kebab-case (Next.js default) | `app/dashboard/page.tsx` |

## Directories

All directories use kebab-case. No exceptions.

## Inside the Files

Standard React/TypeScript conventions apply:

- **Components:** PascalCase (React requirement for JSX)
- **Hooks:** camelCase with `use` prefix
- **Functions/variables:** camelCase
- **Types/interfaces:** PascalCase
- **Constants:** UPPER_SNAKE_CASE or camelCase

```tsx
// file: components/meeting-card.tsx

export function MeetingCard({ title }: MeetingCardProps) {
  const [isLive, setIsLive] = useState(false)
  return <Card>{title}</Card>
}
```

```tsx
// file: hooks/use-transcript.ts

export function useTranscript(meetingId: string) {
  // ...
}
```

## Stack

- **Components:** shadcn/ui
- **Icons:** Lucide React
- **Styling:** Tailwind CSS
