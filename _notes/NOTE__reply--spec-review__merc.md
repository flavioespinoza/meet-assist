# Reply: Spec Review — fb6ea1c

v1 | Mar 11 2026 - (MST)

**Reviewer:** Claude B (merc-task instance)
**Reviewing:** `NOTE__spec-review--fb6ea1c.md`

---

## Overall Assessment

Clean review. All three specs verified against the codebase with specific file references and line-level detail. The gap identification and fix were the most valuable part — catching that `npm run dev` only started Next.js and not the WebSocket server is exactly the kind of operational issue that burns 20 minutes during a live call setup.

---

## Per-Spec Notes

### SPEC__ux-design.md

Nothing to add. Color palette verification is straightforward — hex values either match or they don't. The reviewer confirmed they match. Card layout details (padding, speaker name placement, copy button) are all accounted for.

### SPEC__meet-assist--frontend-interface.md

This was the heaviest section and the reviewer covered it thoroughly:

- **Layout split** confirmed (4/5 + 1/5)
- **WebSocket protocol** — all 6 message types verified (`utterance`, `claude_chunk`, `claude_done`, `focus`, `message`, `stop`)
- **Transcript watcher** — 300ms polling interval noted, startup skip behavior confirmed
- **Claude integration** — streaming via SDK, multi-turn history, context loader all verified

One thing worth flagging for future reviews: the system prompt content itself wasn't quoted or compared line-by-line. The reviewer says it "matches the spec exactly" — trusting that, but if this project ever gets a system prompt update, the next reviewer should do a diff.

### SPEC__directive--fx-naming.md

Compliant. Kebab-case files, PascalCase components, `use` prefix on hooks, FX naming on markdown files. Standard stuff, correctly verified.

---

## Gap Fix Assessment

The `npm run dev` fix was the right call:

- **Problem:** WebSocket server had no startup path — a silent failure that only shows up when you try to use the app
- **Solution:** `concurrently` to run both Next.js and WebSocket server from a single command
- **Bonus:** Added individual `dev:next` and `dev:ws` scripts for debugging in isolation
- **Bonus:** Added missing `ANTHROPIC_API_KEY` to `.env.example`

All four changes are correct and necessary. The `concurrently` approach with `--names` and `--prefix-colors` is clean — makes it easy to tell which process is logging what.

---

## What's Not Covered

The review doesn't mention:

- **Error handling** — what happens if Deepgram disconnects mid-call? Does `listener.py` reconnect or crash?
- **Memory** — conversation history lives in memory with no cap. A 2-hour call with heavy back-and-forth could get large. Not a problem today, worth noting for long sessions.
- **Context loader** — no validation on what gets dropped into `src/context/*`. A 500KB file would silently bloat the system prompt.

These aren't gaps in the review — the reviewer was scoped to spec compliance, not operational resilience. But they're worth tracking for future work.

---

## Verdict

Review is accurate and complete within its scope. The gap fix was well-executed. Project is ready for use.
