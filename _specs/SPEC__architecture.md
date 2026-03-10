# meet-assist — Architecture

Date: Mar 09 2026

Hardware: MacBook Pro M4 Silicon (2025)

---

## Overview

meet-assist is a real-time call assistant that runs entirely on the MacBook M4.
It listens to a meeting, transcribes with speaker diarization via Deepgram, and
feeds the live transcript to Claude for real-time answers.

No iMac. No shared folders. No sync. Everything on one machine.
Two independent processes communicate through a single file on disk.

---

## High-Level Data Flow

```
┌──────────────┐
│  Microphone   │
│  (built-in    │
│  or external) │
└──────┬───────┘
       │ raw PCM audio (16kHz, mono, int16)
       ▼
┌──────────────────────────────────────────────────┐
│  src/listener.py  (Python process — Terminal 1)   │
│                                                    │
│  ┌────────────────┐     ┌──────────────────────┐  │
│  │  sounddevice    │────▶│  Deepgram WebSocket  │  │
│  │  InputStream    │     │  (nova-2 model)      │  │
│  │                 │     │                      │  │
│  │  blocksize=4096 │     │  diarize=True        │  │
│  │  dtype=int16    │     │  smart_format=True   │  │
│  │  16kHz / mono   │     │  interim_results=    │  │
│  └────────────────┘     │    False             │  │
│                          └──────────┬───────────┘  │
│                                     │              │
│                          on_message callback       │
│                          extracts speaker +        │
│                          transcript text           │
│                                     │              │
│                          ┌──────────▼───────────┐  │
│                          │  append_utterance()   │  │
│                          │  → transcript.jsonl   │  │
│                          └──────────────────────┘  │
└──────────────────────────────────────────────────┘
                                      │
              appends one JSON line per final utterance
                                      │
                                      ▼
                        ┌──────────────────────┐
                        │  transcript.jsonl     │
                        │  (project root)       │
                        │                       │
                        │  One line per utterance│
                        │  Format:              │
                        │  {                    │
                        │   "speaker":          │
                        │     "Speaker_0",      │
                        │   "text": "...",      │
                        │   "timestamp": epoch  │
                        │  }                    │
                        └──────────┬────────────┘
                                   │
              polled every 0.5s (wc -l comparison)
                                   │
                                   ▼
┌──────────────────────────────────────────────────┐
│  src/watcher.sh  (Bash process — Terminal 2)      │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │  Startup:                                   │   │
│  │  1. Record current line count (LAST_LINE)   │   │
│  │  2. Load all files from src/context/*       │   │
│  │     into CONTEXT variable (preamble)        │   │
│  │  3. Start background stdin reader for       │   │
│  │     protocol commands (STOP/EXPAND/manual)  │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │  Poll loop (every 0.5s):                    │   │
│  │  if new lines detected:                     │   │
│  │    for each new line:                       │   │
│  │      → parse JSON (speaker, text)           │   │
│  │      → build prompt with CONTEXT preamble   │   │
│  │      → pipe prompt to: claude --print       │   │
│  │      → display response in terminal         │   │
│  │      → store as LAST_RESPONSE               │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │  Protocol handler (background stdin reader): │   │
│  │                                              │   │
│  │  "STOP"   → clear LAST_RESPONSE, reset      │   │
│  │  "EXPAND" → send LAST_RESPONSE to Claude     │   │
│  │             asking for full detail            │   │
│  │  [text]   → send as manual prompt to Claude   │   │
│  │             with CONTEXT preamble             │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  Output → Terminal 2 (teleprompter display)        │
└──────────────────────────────────────────────────┘
```

---

## Component Details

### `src/listener.py` — Audio Capture + Transcription

| Aspect | Detail |
|--------|--------|
| Language | Python 3 |
| Dependencies | `sounddevice`, `deepgram-sdk`, `python-dotenv` |
| Audio config | 16kHz sample rate, mono, int16, blocksize 4096 |
| Deepgram model | `nova-2` |
| Deepgram options | `diarize=True`, `smart_format=True`, `punctuate=True`, `interim_results=False` |
| Auth | `DEEPGRAM_API_KEY` from `.env` via `python-dotenv` |
| Output | Appends JSON lines to `transcript.jsonl` at project root |
| Signal handling | SIGINT/SIGTERM → graceful shutdown, closes Deepgram WebSocket |
| Speaker labels | Extracted from `words[0].speaker` → `"Speaker_0"`, `"Speaker_1"`, etc. |
| Timestamp | `int(time.time())` — Unix epoch seconds |

**Deepgram LiveOptions:**

```python
LiveOptions(
    model="nova-2",
    language="en-US",
    smart_format=True,
    diarize=True,
    punctuate=True,
    interim_results=False,
    encoding="linear16",
    sample_rate=16000,
    channels=1,
)
```

**Audio constants:**

```python
SAMPLE_RATE = 16000
CHANNELS = 1
BLOCKSIZE = 4096
```

**Data path inside listener.py:**

```
sd.InputStream(callback=audio_callback)
  → audio_callback sends indata.tobytes() to connection.send()
    → Deepgram fires on_message callback
      → extracts transcript + speaker from result.channel.alternatives[0]
        → append_utterance() writes JSON line to transcript.jsonl
```

`DEEPGRAM_API_KEY` loaded from `.env` via `python-dotenv`. Never hardcoded.

---

### `src/watcher.sh` — File Watcher + Claude Interface

| Aspect | Detail |
|--------|--------|
| Language | Bash (`set -euo pipefail`) |
| Watch method | Polling via `wc -l` comparison every 0.5 seconds |
| New line detection | `tail -n +$((LAST_LINE + 1))` to get only unprocessed lines |
| JSON parsing | `python3 -c "import json; ..."` per line |
| Claude invocation | `echo "$prompt" \| claude --print` |
| Context loading | Reads all files in `src/context/*` at startup → `$CONTEXT` |
| State | `LAST_LINE` (int), `LAST_RESPONSE` (string), `CMD_PID` (bg process) |
| Cleanup | `trap` SIGINT/SIGTERM → kills background reader, exits |

**Prompt template sent to Claude on each utterance:**

```
You are a real-time meeting assistant. You have the following project context:
[contents of src/context/* files]

A speaker just said:
[Speaker_N]: [utterance text]

Rules:
1. Conversational filler → respond with: [no response needed]
2. Technical question or requirement → concise, specific answer
3. Keep responses SHORT — 2-4 sentences max (teleprompter format)
4. Reference project context when relevant
5. No markdown headers, no bullet lists longer than 3 items
```

---

### `src/context/` — Session Context Directory

Files placed here before starting `watcher.sh` are read at startup and injected
as preamble into every Claude prompt. Copy relevant spec files here before the call:

```bash
cp _specs/SPEC__sol-bot--architecture.md src/context/
```

---

### `transcript.jsonl` — Live Transcript Store

- One JSON object per line (JSONL format)
- Append-only during a session
- Gitignored — never committed

```json
{ "speaker": "Speaker_0", "text": "Tell me about the SDK integration.", "timestamp": 1741550400 }
```

---

## Process Model

```
Terminal 1                        Terminal 2
──────────                        ──────────
python src/listener.py            ./src/watcher.sh
     │                                 │
     │  sounddevice captures mic       │  loads src/context/* into memory
     │  streams to Deepgram WS         │  records current line count
     │  appends to transcript.jsonl    │  starts background stdin reader
     │         │                       │         │
     │         │    transcript.jsonl    │         │
     │         └──────────────────────▶│         │
     │              (shared file)      │  polls every 0.5s for new lines
     │                                 │  pipes new utterances to Claude CLI
     │                                 │  displays responses in terminal
     │                                 │
     ▼                                 ▼
  runs until SIGINT               runs until SIGINT
```

Two completely independent processes. State shared only through `transcript.jsonl` on disk.
No IPC, no sockets, no message queues. The file is the interface.

---

## Stack

| Layer | Tool | Why |
|-------|------|-----|
| Audio capture | `sounddevice.InputStream` | 16kHz, mono, int16, blocksize=4096 |
| Transcription | Deepgram WebSocket `nova-2` | Real-time, diarized, final utterances only |
| Transcript store | `transcript.jsonl` | Rolling append, one utterance per line |
| File watcher | Poll loop (`wc -l`, 0.5s) | Detects new lines, triggers Claude |
| AI response | `claude --print` CLI | Reads utterance + context preamble |
| Protocol | Background stdin reader in watcher.sh | STOP / EXPAND / manual input |

---

## External Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| Deepgram Streaming API | Cloud API (WebSocket) | Real-time STT with speaker diarization |
| Claude Code CLI (`claude --print`) | Local CLI | AI response generation |
| `sounddevice` | Python (wraps PortAudio) | Low-latency mic capture |
| `deepgram-sdk` | Python | Deepgram WebSocket client |
| `python-dotenv` | Python | Loads `.env` file |

---

## Latency Target

```
Speech ends → Deepgram final transcript → file write → poll detect → Claude response
     │                  │                      │            │              │
   ~0ms              ~300ms                  ~1ms        ≤500ms        ~1-2s
                                                     (worst case)

Total: ~2 seconds end-to-end
```

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
├── src/
│   ├── listener.py       ← captures mic, streams to Deepgram → transcript.jsonl
│   ├── watcher.sh        ← watches transcript, triggers Claude responses
│   └── context/          ← spec files loaded at session start
├── transcript.jsonl      ← rolling live transcript (gitignored)
├── .env                  ← DEEPGRAM_API_KEY (gitignored)
├── .env.example
├── requirements.txt
├── _specs/
└── package.json
```

---

## Privacy

- `transcript.jsonl` is gitignored — never committed
- Deepgram processes audio on their servers — inform Trajan if needed
- Local fallback: `whisper.cpp` + CoreML on M4 Neural Engine (~1-2s more latency)

---

## Phase Plan

```
P1  ✅  listener.py — sounddevice + Deepgram nova-2 → transcript.jsonl  [BUILT]
P2  ✅  watcher.sh — poll loop + claude --print + STOP/EXPAND protocol  [BUILT]
P3      Load session context — copy spec files into src/context/ before call
P4      Test in isolation — mock transcript, verify Claude responds correctly
P5      Live dry run — test before Trajan call
```

---

## What Is NOT Built Yet

| Feature | Status | Notes |
|---------|--------|-------|
| Post-call cleanup script | Not built | Flatten transcript.jsonl → meeting-[date].json with decisions/open questions |
| Speaker name mapping | Not built | Replace Speaker_0/Speaker_1 with real names after first exchange |
| Question detection filtering | Partial | Claude decides internally via prompt rules — no pre-filter |
| fswatch integration | Not built | watcher.sh uses 0.5s polling; fswatch would give instant detection |
| Gemini questions doc fetch | Not built | Fetch fresh before call, drop into src/context/ |
| Multi-call history | Not built | Load decisions from previous calls as context |

---

## Future

- Speaker name mapping after first exchange
- Post-call summary: decisions + open questions extracted by Claude
- Multi-call history loaded as context
- Local transcription: swap Deepgram for whisper.cpp + CoreML if privacy is a concern
- AI parameter suggestions: post-call Claude proposes sol-bot config updates
