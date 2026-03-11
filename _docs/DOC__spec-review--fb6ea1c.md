# DOC: Spec Review — fb6ea1c

v1 | Mar 11 2026 - 04:23 PM (MST)

---

## Specs Reviewed

1. `SPEC__ux-design.md`
2. `SPEC__meet-assist--frontend-interface.md`
3. `SPEC__directive--fx-naming.md`

---

## Summary

All three specs are fully implemented in the codebase. One operational gap was found and fixed.

---

## SPEC__ux-design.md

**Status:** Fully implemented

- Steel/rose/sage color palette defined in `app/globals.css` — all hex values match the spec exactly
- Chat card layout in `components/chat-card.tsx` matches the spec:
  - Text on top, never truncated
  - Speaker name bottom-left
  - Copy-to-clipboard button bottom-right (Lucide `Copy` icon)
  - Even `p-4` padding on all sides
  - Speaker color assignment: `bg-steel-300`, `bg-rose-300`, `bg-sage-300`, `bg-steel-200`
- `hooks/use-copy-clipboard.ts` hook implemented for clipboard functionality

---

## SPEC__meet-assist--frontend-interface.md

**Status:** Fully implemented

### Layout
- 4/5 + 1/5 split layout in `app/page.tsx`
- Left panel: full chat interface with Claude (`components/chat-panel.tsx`)
- Right panel: live scrolling transcript (`components/live-stream.tsx`)

### Chat Panel (Left)
- User messages: right-aligned bubble, dark background (`components/chat-message.tsx`)
- Claude messages: left-aligned bubble, lighter background
- Transcript focus: highlighted card with `[Meeting — Speaker_N]` label
- Streaming "Claude is thinking..." indicator
- Auto-scroll to bottom on new messages
- Text input with Enter-to-send (`components/chat-input.tsx`)

### Live Stream (Right)
- Scrolling feed of utterance cards from `transcript.jsonl`
- Each speaker gets a unique background color, assigned dynamically at runtime
- Scroll lock: auto-scrolls unless user scrolls up manually
- Click any card to inject it into the chat as a focused transcript item

### WebSocket Protocol
- All message types match the spec: `utterance`, `claude_chunk`, `claude_done`, `focus`, `message`, `stop`
- Server broadcasts to all connected clients (`server/ws-server.ts`)
- Existing utterances replayed to new clients on connection

### Claude Integration
- Multi-turn conversation with full history (`server/claude-conversation.ts`)
- System prompt matches the spec exactly (meeting assistant role, rules for when to respond)
- Context files loaded from `src/context/*` at startup (`server/context-loader.ts`)
- Streaming via `@anthropic-ai/sdk` with `messages.stream()`

### Transcript Watcher
- Chokidar tailing `transcript.jsonl` with 300ms polling (`server/transcript-watcher.ts`)
- Skips existing lines on startup, only emits new utterances
- Speaker fallback to `Speaker_0` if diarization data is missing

### Python Listener
- `src/listener.py` fully implemented: mic capture via `sounddevice`, Deepgram WebSocket streaming with `nova-2` model, speaker diarization, appends to `transcript.jsonl`

---

## SPEC__directive--fx-naming.md

**Status:** Compliant

- All `.ts`/`.tsx` file names use kebab-case
- Component identifiers use PascalCase inside files (e.g., `ChatCard`, `ChatPanel`)
- Hook uses `use` prefix: file `use-copy-clipboard.ts`, function `useCopyClipboard()`
- Spec/doc `.md` files follow FX naming convention
- Directory names use kebab-case

---

## Gap Found and Fixed

**Issue:** `npm run dev` only started Next.js (`next dev`), but the WebSocket server at `server/ws-server.ts` had no way to start. The README and spec both state `npm run dev` should start everything.

**Fix (commit `fb6ea1c`):**
- Added `tsx` and `concurrently` as dev dependencies
- Updated `npm run dev` to: `concurrently --names next,ws --prefix-colors blue,green "next dev" "tsx server/ws-server.ts"`
- Added `dev:next` and `dev:ws` scripts for running individually
- Added `ANTHROPIC_API_KEY` to `.env.example` (was missing per spec)
