# SPEC: Frontend — Interface

v2 | Mar 09 2026 - 07:15 PM (MST)

---

## Overview

A Next.js web UI running on `localhost:3000`. The left side is a full chat interface with Claude (like the Claude VS Code plugin). The right side is a live-scrolling transcript of the meeting. Clicking any utterance on the right sends it into the chat on the left so Claude can focus on it.

Everything runs locally on the MacBook M4. The meeting happens on the iMac. Flavio types to Claude on the MacBook while talking to Trajan on the iMac.

---

## The Three Participants

```
iMac (mounted on wall)              MacBook M4 (in front of Flavio)
┌────────────────────┐              ┌──────────────────────────────────┐
│                    │              │                                  │
│  Zoom call with    │   audio ──▶ │  listener.py captures mic        │
│  Trajan            │              │  → transcript.jsonl              │
│                    │              │                                  │
│  Flavio talks      │              │  Browser: localhost:3000         │
│  to Trajan here    │              │  ┌──────────────────┬─────────┐ │
│                    │              │  │  CHAT WITH CLAUDE │  LIVE   │ │
│                    │              │  │  (Flavio types    │ STREAM  │ │
│                    │              │  │   here)           │         │ │
│                    │              │  └──────────────────┴─────────┘ │
└────────────────────┘              └──────────────────────────────────┘
```

1. **Flavio ↔ Trajan** — voice conversation on the iMac (Zoom)
2. **Flavio ↔ Claude** — text chat on the MacBook (this interface)
3. **Claude ← Meeting** — Claude sees the live transcript and can respond to it

---

## Layout

```
┌──────────────────────────────────────────────┬──────────┐
│                                              │          │
│              CHAT PANEL                      │  LIVE    │
│              (4/5 width)                     │ STREAM   │
│                                              │ (1/5     │
│  Full chat interface with Claude.            │  width)  │
│  Looks like the Claude VS Code plugin.       │          │
│                                              │ Scrolls  │
│  - Message bubbles (Flavio + Claude)         │ auto     │
│  - Claude responses stream token-by-token    │          │
│  - Clicked utterances appear as              │ Each     │
│    system/context messages in the chat        │ line is  │
│  - Claude sees full conversation history     │ clickable│
│                                              │          │
│                                              │          │
│                                              │          │
├──────────────────────────────────────────────┤          │
│  ┌─────────────────────────────────┐         │          │
│  │  Type a message...              │ [Send]  │          │
│  └─────────────────────────────────┘         │          │
└──────────────────────────────────────────────┴──────────┘
```

---

### Left Panel — Chat Interface (4/5 width)

This is a full conversational chat with Claude, styled like the Claude VS Code extension.

**Message types:**

| Type | Visual | Source |
|------|--------|--------|
| **User message** | Right-aligned bubble, dark background | Flavio types in the input field |
| **Claude message** | Left-aligned bubble, lighter background | Claude's streaming response |
| **Transcript focus** | Highlighted card/banner, distinct style | Clicked from right panel |

**How it works:**

- Flavio types freely to Claude in the input field — just like chatting in the VS Code plugin
- Claude maintains full conversation history (multi-turn) so he has context of everything discussed
- When Flavio clicks an utterance on the right, it appears in the chat as a focused item — a distinct card that says something like: `[Meeting — Speaker_0]: "What about the SDK integration?"`
- Claude sees this and responds to it in the chat flow
- Claude's responses stream in token-by-token (Anthropic SDK, `stream: true`)
- The chat scrolls to the bottom on new messages

**Claude's behavior in the chat:**

- He has the full meeting transcript scrolling in (he sees everything via the context)
- He has the `src/context/*` files loaded as system prompt
- He can proactively flag things — if Trajan asks a technical question, Claude can chime in without Flavio clicking anything
- But Flavio can also force-focus: click an utterance → Claude knows "answer this one"
- Claude should be smart about when to respond vs stay quiet (conversational filler = no response)

**Input field:**

- Text input at the bottom of the chat panel
- Enter to send (or click Send button)
- This is how Flavio talks to Claude — asking questions, giving instructions, requesting focus
- Examples of what Flavio might type:
  - "What did Trajan mean by that?"
  - "Give me a summary of the last 5 minutes"
  - "Focus on the architecture question he just asked"
  - "Stay quiet for now, I've got this"

---

### Right Panel — Live Stream (1/5 width)

- Scrolling feed of the raw transcript from `transcript.jsonl`
- Each utterance is rendered as an individual shadcn/ui `Card` component (`chat-card.tsx`)
- Cards are compact — speaker label, utterance text, timestamp
- **Each speaker gets a unique card background color** — assigned dynamically as speakers appear
- Typically two speakers (Flavio + Trajan), but if a third joins they get a new color automatically
- Speaker → color mapping is built at runtime: first speaker seen = color 1, second = color 2, etc.
- Color palette defined as a Tailwind array (Flavio will provide the exact values)
- Hover: simple background highlight — nothing fancy, just a subtle brightness/opacity shift
- Auto-scrolls to bottom as new cards arrive
- **Click any card** → it gets injected into the chat on the left as a focused transcript item
- Scroll lock: auto-scrolls unless user scrolls up manually

**Speaker color assignment (dynamic):**

```tsx
// Speaker colors — assigned in order of appearance
// See: flavio__keymaster/_specs/images/ux-chat-cards--meet-assist.png
const SPEAKER_COLORS = [
  'bg-steel-300',  // Speaker_0 (Flavio) — blue
  'bg-rose-300',   // Speaker_1 (Trajan) — pink
  'bg-sage-300',   // Speaker_2 — green
  'bg-steel-200',  // Speaker_3 — fallback
]
```

---

## Data Flow

```
transcript.jsonl
       │
       │  chokidar (server-side, tails new lines)
       ▼
Next.js WebSocket server
       │
       ├──▶ Browser right panel: new utterance card appears
       │
       ├──▶ Claude context: transcript appended to conversation
       │    (Claude sees everything, decides when to respond)
       │
       │  On utterance click OR Flavio types a message:
       │
       ├──▶ Server sends to Anthropic SDK (stream: true)
       │    - Full conversation history
       │    - src/context/* preamble
       │    - Latest transcript lines
       │
       └──▶ Browser left panel: Claude response streams in
            token by token as a chat bubble
```

---

## Conversation Model

This is a **multi-turn conversation** with Claude, not one-shot prompts.

**System prompt (loaded once at startup):**

```
You are a real-time meeting assistant. Flavio is on a call with Trajan.
You are running on Flavio's MacBook while the call happens on his iMac.

You have the following project context:
[contents of src/context/* files]

You will receive:
1. Direct messages from Flavio (he's typing to you during the call)
2. Live transcript utterances from the meeting (marked as [Meeting — Speaker_N])

Rules:
- When Flavio sends you a focused transcript utterance, help him with it
- When Flavio asks you a direct question, answer it
- You can proactively flag important things from the transcript
- Keep responses concise — Flavio is in a live call and reading quickly
- If the transcript is just filler ("yeah", "okay", "sure"), don't respond to it
- Flavio may say "stay quiet" or "I've got this" — respect that until he re-engages
```

**Message history sent to Anthropic SDK on each request:**

```json
[
  { "role": "user", "content": "[Meeting — Speaker_0]: What about the SDK?" },
  { "role": "assistant", "content": "The SDK uses WebSocket for..." },
  { "role": "user", "content": "Can you elaborate on the auth flow?" },
  { "role": "assistant", "content": "The auth flow works by..." },
  { "role": "user", "content": "[Meeting — Speaker_1]: We need to handle reconnection" },
  ...
]
```

The full conversation stays in memory. Claude has context of everything.

---

## WebSocket Messages

**Server → Client:**

```json
{ "type": "utterance", "speaker": "Speaker_0", "text": "...", "timestamp": 1741550400, "id": "utt_001" }
```

```json
{ "type": "claude_chunk", "delta": "The SDK..." }
```

```json
{ "type": "claude_done" }
```

**Client → Server:**

```json
{ "type": "focus", "id": "utt_001" }
```

```json
{ "type": "message", "text": "What did Trajan mean by that?" }
```

```json
{ "type": "stop" }
```

---

## Design System

Steel/rose/sage color palette with Tailwind CSS v4. Add to `app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-steel-50: #f1f7fa;
  --color-steel-100: #dcebf1;
  --color-steel-200: #bdd8e4;
  --color-steel-300: #8fbcd1;
  --color-steel-400: #4c8bab;
  --color-steel-500: #3f7b9b;
  --color-steel-600: #376483;
  --color-steel-700: #32546c;
  --color-steel-800: #2f475b;
  --color-steel-900: #2b3d4e;
  --color-steel-950: #192733;

  --color-rose-50: #fff0f1;
  --color-rose-100: #ffe3e5;
  --color-rose-200: #ffcad1;
  --color-rose-300: #ff9fab;
  --color-rose-400: #ff6980;
  --color-rose-500: #fe3557;
  --color-rose-600: #ec1242;
  --color-rose-700: #c80837;
  --color-rose-800: #a70a36;
  --color-rose-900: #8e0d35;
  --color-rose-950: #500117;

  --color-sage-50: #f9faf9;
  --color-sage-100: #f4f5f4;
  --color-sage-200: #e5e8e3;
  --color-sage-300: #d3d8cf;
  --color-sage-400: #a2ac9a;
  --color-sage-500: #636e5b;
  --color-sage-600: #4f5b4a;
  --color-sage-700: #3e4739;
  --color-sage-800: #282b22;
  --color-sage-900: #191e15;
  --color-sage-950: #0a0d08;
}
```

| Role | Name | Primary Hex | Usage |
|------|------|-------------|-------|
| Primary | `steel` | `#4c8bab` | Buttons, links, focus rings, primary actions |
| Secondary | `rose` | `#fe3557` | Alerts, destructive actions, accents |
| Tertiary | `sage` | `#636e5b` | Muted backgrounds, secondary text, borders |

### Chat Card Design (chat-card.tsx)

Color reference — each speaker gets one of these backgrounds:

![chat-cards-meet-assist](images/ux-chat-cards--meet-assist.png)

Layout reference — text on top, speaker bottom-left, copy icon bottom-right:

![chat-card-layout-reference](images/ux-chat-card--layout-reference.png)

```txt
┌─────────────────────────────────┐
│  Utterance text goes here.      │
│  Full text — never truncated.   │
│                                 │
│  Speaker_0              [ ⎘ ]   │
└─────────────────────────────────┘
```

- Card height grows to fit full utterance text — no truncation, no ellipsis
- Even padding on all sides (consistent `p-4`)
- **Top:** utterance text
- **Bottom-left:** speaker name
- **Bottom-right:** copy-to-clipboard button (Lucide `Copy` icon)
- Background color assigned per speaker (steel-300, rose-300, sage-300)
- Create a `hooks/use-copy-clipboard.ts` hook for the copy functionality

---

## Stack

| Layer | Tool |
|-------|------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| WebSocket | `ws` on server, native WebSocket on client |
| Claude | `@anthropic-ai/sdk` with streaming, multi-turn |
| Transcript watch | `chokidar` tailing `transcript.jsonl` |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Icons | Lucide React |
| Chat UI | shadcn/ui components (Card, ScrollArea, Button, Input) + custom message bubbles |
| State | React state (conversation history, utterances list) |

---

## Environment Variables

```
ANTHROPIC_API_KEY     — for Claude streaming (from ~/.zkeys)
DEEPGRAM_API_KEY      — not needed here (listener.py handles it)
```

---

## File Structure (additions to meet-assist)

```
meet-assist/
├── src/
│   ├── listener.py             ← unchanged
│   ├── watcher.sh              ← terminal fallback (still works)
│   └── context/                ← unchanged
├── app/                        ← Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                ← main UI (chat + live stream)
│   └── globals.css             ← Tailwind base styles
├── server/
│   ├── ws-server.ts            ← WebSocket server (runs alongside Next.js)
│   ├── transcript-watcher.ts   ← chokidar tailing transcript.jsonl
│   ├── claude-conversation.ts  ← Anthropic SDK multi-turn + streaming
│   └── context-loader.ts       ← reads src/context/* at startup
├── components/
│   ├── chat-panel.tsx          ← left panel (full chat interface)
│   ├── chat-message.tsx        ← individual message bubble
│   ├── chat-input.tsx          ← text input + send button
│   ├── live-stream.tsx         ← right panel (scrolling transcript)
│   └── chat-card.tsx           ← individual utterance card (shadcn Card) in the live stream
├── hooks/
│   └── use-copy-clipboard.ts   ← copy utterance text to clipboard (used by chat-card.tsx)
├── transcript.jsonl
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Running

```bash
# Terminal 1 — listener (unchanged)
python3 src/listener.py

# Terminal 2 — Next.js frontend
npm run dev
```

Open `http://localhost:3000`. Chat with Claude on the left, live transcript scrolling on the right. Click any utterance to focus Claude on it.

---

## Visual Reference

The chat panel should look like the Claude VS Code extension chat window:
- Dark background
- Message bubbles with clear user/assistant distinction
- Streaming text animation as Claude responds
- Smooth auto-scroll
- Clean monospace or sans-serif font

[Screenshot reference to be added by Flavio]

---

## What This Does NOT Cover

- Speaker name mapping (future — replace Speaker_0 with "Trajan")
- Post-call summary view (future)
- Call history / multi-session (future)
- Mobile layout (desktop only)
