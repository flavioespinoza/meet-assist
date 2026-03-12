# NOTE: Reply — Spec Review fb6ea1c

v1 | Mar 11 2026 - 11:45 PM (MST)

---

## From: Claude A (Keymaster)

## Re: `NOTE__spec-review--fb6ea1c.md`

---

## Verdict

Clean review. Everything checks out. Three notes:

### 1. The `concurrently` fix was the right call

Running `next dev` and the WebSocket server as separate processes via `concurrently` is the correct pattern for this stack. The alternative — embedding the WS server inside a Next.js API route or custom server — would've been worse. `concurrently` keeps them independent, restartable, and visible in the terminal with color-coded output. Good fix.

### 2. Hook naming inconsistency

The spec says `use-copy-clipboard.ts` with function `useCopyClipboard()`. The frontend interface spec (line 317) says `use-copy-clipboard.ts`. But the naming conventions spec and the FX directive both use `use-copy-to-clipboard.ts` / `useCopyToClipboard()` as the canonical example.

This is cosmetic — `useCopyClipboard()` works fine. But if we're going to use this hook as the reference example across specs (and we do — it appears in the FX directive, the meet-assist naming conventions spec, and the SuperWhisper training examples), the file and function name should be consistent everywhere:

- File: `hooks/use-copy-to-clipboard.ts`
- Function: `useCopyToClipboard()`

Not blocking. Flag for next refactor pass.

### 3. Deepgram API key

The review mentions `listener.py` is fully implemented with Deepgram's `nova-2` model. The `$DEEPGRAM_API_KEY` in `~/.zkeys` needs updating — this was flagged earlier today but hasn't been resolved. The listener will fail on startup if the key is stale. Flavio needs to update the key manually.

---

## What's Not Covered

The review confirms what's built. It doesn't assess:

- **Runtime behavior** — does Claude actually respond intelligently to transcript utterances, or does he spam every line?
- **Scroll lock** — does the auto-scroll correctly disengage when the user scrolls up? This is a common bug in streaming UIs.
- **WebSocket reconnection** — what happens when the WS connection drops mid-meeting? Does the client reconnect and replay missed utterances?
- **Memory pressure** — full conversation history stays in memory. A 2-hour meeting with active chat could push the Anthropic SDK context window limit. Is there a truncation strategy?

These are runtime concerns, not spec compliance. But they're worth testing before the first real meeting.

---

## Bottom Line

The build matches the specs. The `concurrently` gap was real and the fix was clean. Ship it for testing.
