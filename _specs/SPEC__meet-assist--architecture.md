# meet-assist — Architecture

v1 | Date: Mar 09 2026

Hardware: MacBook Pro M4 Silicon (2025)

---

## Overview

meet-assist is a real-time call assistant that runs entirely on the MacBook M4.
It listens to a meeting, transcribes with speaker diarization, and feeds the
live transcript to Claude who answers technical questions in real time.

No iMac. No shared folders. No sync. Everything on one machine.

```
Microphone
    │
    ▼
Real-time transcription + speaker diarization (M4 Neural Engine)
    │
    ▼
Rolling transcript.jsonl (appended per utterance)
    │
    ▼
Claude Code watches file (fswatch)
    │
    ▼
Claude answers on screen in real time
```

---

## Hardware

| Component | Role |
|-----------|------|
| MacBook Pro M4 Silicon | Everything — transcription, inference, display |
| Built-in mic or external | Audio input |
| MacBook screen | Teleprompter + Claude responses |

The M4 Neural Engine handles real-time transcription with low overhead,
leaving the Zoom/Meet call unaffected.

---

## Stack

| Layer | Tool | Why |
|-------|------|-----|
| Audio capture | `sounddevice` (Python) | Low-latency mic stream |
| Transcription | Deepgram Streaming API | Real-time, speaker-diarized, fast |
| Transcript store | `transcript.jsonl` | Rolling append, one utterance per line |
| File watcher | `fswatch` | Triggers Claude Code on new lines |
| AI response | Claude Code CLI + Haiku | Haiku for speed — reads new utterance, responds in terminal |
| Protocol | STOP / EXPAND / typed input | Manual override for out-of-sync moments |

---

## Transcript Format

Each line in `transcript.jsonl` is one utterance:

```json
{ "speaker": "Speaker_0", "text": "Tell me about the Kamino SDK integration.", "timestamp": 1741550400 }
```

Speaker labels are assigned by Deepgram diarization.
After the first exchange, Speaker_0 = Trajan, Speaker_1 = Flavio (or vice versa).

---

## Claude Code Behavior

Claude Code watches `transcript.jsonl` via fswatch.

On each new line:
- If speaker is Trajan → run question detection
  - If utterance contains a question or new requirement → generate response
  - If utterance is conversational filler → log only, no response
- If speaker is Flavio → log only, no response needed
- Display response in terminal as teleprompter text

**Question detection** prevents Claude from firing on every sentence.
It looks for interrogative patterns, technical terms from the sol-bot spec,
and explicit requirement language ("we need", "can it", "what about", "how would").

**Session context loaded at startup:**
- `SPEC__sol-bot--architecture.md`
- `SPEC__sol-bot--trajan-call--2026-03-13.md`
- `SPEC__sol-bot--agent-prompts.md`
- Gemini questions doc (fetched fresh before call)

This gives Claude full context on the sol-bot project so answers are
specific and accurate, not generic.

---

## Post-Call Memory

After the call ends, a cleanup script flattens `transcript.jsonl` into
`meeting-[date].json` — a single structured document with:
- Full transcript with speaker labels
- Claude responses inline with the utterance that triggered them
- Decisions made (extracted by Claude)
- Open questions (extracted by Claude)

This becomes loadable context for future calls and the sol-bot build.

---

## Call Protocol

| Command | Meaning |
|---------|---------|
| `STOP` | Out of sync — ignore last input, reset |
| `EXPAND` | Give full explanation of last response |
| `[typed text]` | Manual input — Trajan got verbose, you summarized |

---

## File Structure

```
meet-assist/
  src/
    listener.py       ← captures mic, streams to Deepgram
    watcher.sh        ← fswatch command that triggers Claude Code
    context/          ← spec files loaded at session start
  transcript.jsonl    ← rolling live transcript (gitignored)
  .env                ← DEEPGRAM_API_KEY
  README.md
```

---

## Transcription Engine

Deepgram streams audio to their API. For a fully local alternative,
`whisper.cpp` compiled for CoreML runs on the M4 Neural Engine with
near-zero CPU overhead — same chip Apple uses for on-device ML inference.

Default: Deepgram (faster, easier setup).
Local fallback: whisper.cpp + CoreML (no API key, full privacy).

---

## Deepgram Config

```python
options = {
  'model': 'nova-2',
  'language': 'en-US',
  'smart_format': True,
  'diarize': True,         # speaker labels
  'punctuate': True,
  'interim_results': False # only emit final utterances
}
```

`nova-2` is Deepgram's fastest + most accurate English model.
`interim_results: False` means Claude only sees complete sentences,
not partial transcriptions mid-word.

---

## Latency Target

```
Speech ends → Deepgram final transcript → fswatch trigger → Claude response
     ↑                  ↑                        ↑                ↑
  ~0ms               ~300ms                   ~50ms           ~1-2s
```

Total: ~2 seconds from end of utterance to Claude response on screen.
Fast enough to read while Trajan is still speaking or taking a breath.

---

## Privacy

- `transcript.jsonl` is gitignored — never committed
- Deepgram processes audio on their servers — inform Trajan if needed
- Local-only alternative: `whisper.cpp` on M4 Neural Engine (slower, ~1-2s more latency)

---

## Phase Plan

```
P1  Build listener.py — mic capture + Deepgram streaming → transcript.jsonl
P2  Build watcher.sh — fswatch triggers Claude Code on new lines
P3  Load session context — spec files + Gemini doc fetched at startup
P4  Test in isolation — mock transcript, verify Claude responds correctly
P5  Live dry run — test on a non-critical call before using with Trajan
```

---

## Future

- Speaker name mapping: replace Speaker_0/Speaker_1 with real names after first exchange
- Multi-call history: decisions from previous calls loaded as context
- Local transcription: swap Deepgram for whisper.cpp + CoreML if privacy is a concern
- AI parameter suggestions: post-call Claude analyzes decisions and proposes sol-bot config updates
