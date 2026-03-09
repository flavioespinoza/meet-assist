# meet-assist

Real-time call assistant that listens to a meeting, transcribes with speaker diarization via Deepgram, and feeds the live transcript to Claude for real-time answers.

---

## Systems Architecture

### High-Level Data Flow

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

### Component Details

#### 1. `src/listener.py` — Audio Capture + Transcription

| Aspect | Detail |
|--------|--------|
| **Language** | Python 3 |
| **Dependencies** | `sounddevice`, `deepgram-sdk`, `python-dotenv` |
| **Audio config** | 16kHz sample rate, mono, int16, blocksize 4096 |
| **Deepgram model** | `nova-2` (fastest + most accurate English model) |
| **Deepgram options** | `diarize=True`, `smart_format=True`, `punctuate=True`, `interim_results=False` |
| **Auth** | `DEEPGRAM_API_KEY` from `.env` via `python-dotenv` |
| **Output** | Appends JSON lines to `transcript.jsonl` at project root |
| **Signal handling** | SIGINT/SIGTERM → graceful shutdown, closes Deepgram WebSocket |
| **Speaker labels** | Extracted from `words[0].speaker` → `"Speaker_0"`, `"Speaker_1"`, etc. |
| **Timestamp** | `int(time.time())` — Unix epoch seconds |

**Data path inside listener.py:**
```
sd.InputStream(callback=audio_callback)
  → audio_callback sends indata.tobytes() to connection.send()
    → Deepgram processes audio, fires on_message callback
      → on_message extracts transcript + speaker from result.channel.alternatives[0]
        → append_utterance() writes JSON line to transcript.jsonl
```

#### 2. `src/watcher.sh` — File Watcher + Claude Interface

| Aspect | Detail |
|--------|--------|
| **Language** | Bash (set -euo pipefail) |
| **Watch method** | Polling via `wc -l` comparison every 0.5 seconds |
| **New line detection** | `tail -n +$((LAST_LINE + 1))` to get only unprocessed lines |
| **JSON parsing** | Shells out to `python3 -c "import json; ..."` per line |
| **Claude invocation** | `echo "$prompt" \| claude --print` (Claude Code CLI, piped mode) |
| **Context loading** | Reads all files in `src/context/*` at startup, concatenated into `$CONTEXT` |
| **State** | `LAST_LINE` (int), `LAST_RESPONSE` (string), `CMD_PID` (bg process) |
| **Cleanup** | trap SIGINT/SIGTERM → kills background reader, exits |

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

#### 3. `src/context/` — Session Context Directory

Spec files and reference docs placed here before starting `watcher.sh`. Every file in this directory is read at startup and injected as preamble context into every Claude prompt. This gives Claude full project knowledge so answers are specific, not generic.

#### 4. `transcript.jsonl` — Live Transcript Store

- One JSON object per line (JSONL format)
- Append-only during a session
- Gitignored — never committed
- Fields: `speaker` (string), `text` (string), `timestamp` (int, epoch seconds)

### Process Model

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

**Two completely independent processes.** They share state only through `transcript.jsonl` on disk. No IPC, no sockets, no message queues. The file is the interface.

### Latency Breakdown

```
Speech ends → Deepgram final transcript → file write → poll detect → Claude response
     │                  │                      │            │              │
   ~0ms              ~300ms                  ~1ms        ≤500ms        ~1-2s
                                                     (worst case)

Total: ~2 seconds end-to-end
```

### External Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| **Deepgram Streaming API** | Cloud API (WebSocket) | Real-time speech-to-text with speaker diarization |
| **Claude Code CLI** (`claude --print`) | Local CLI tool | AI response generation from transcript + context |
| **sounddevice** | Python library (wraps PortAudio) | Low-latency mic capture |
| **deepgram-sdk** | Python library | Deepgram WebSocket client |
| **python-dotenv** | Python library | Loads `.env` file |

### Configuration

**`.env`** (gitignored):
```
DEEPGRAM_API_KEY=your_key_here
```

**Deepgram LiveOptions (hardcoded in listener.py):**
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

**Audio constants (hardcoded in listener.py):**
```python
SAMPLE_RATE = 16000
CHANNELS = 1
BLOCKSIZE = 4096
```

### What Is NOT Built Yet

| Feature | Status | Notes |
|---------|--------|-------|
| Post-call cleanup script | Not built | Should flatten transcript.jsonl → meeting-[date].json with decisions/open questions |
| Speaker name mapping | Not built | Replace Speaker_0/Speaker_1 with real names after first exchange |
| Question detection filtering | Partial | Current impl sends all utterances to Claude; Claude decides internally if response is needed via prompt rules |
| fswatch integration | Not built | watcher.sh uses 0.5s polling; fswatch would give instant detection on macOS |
| Gemini questions doc fetch | Not built | Spec mentions fetching fresh before call |
| Multi-call history | Not built | Loading decisions from previous calls as context |

---

## File Structure

```txt
meet-assist/
├── src/
│   ├── listener.py       ← captures mic, streams to Deepgram → transcript.jsonl
│   ├── watcher.sh        ← watches transcript, triggers Claude responses
│   └── context/          ← spec files loaded at session start
├── transcript.jsonl      ← rolling live transcript (gitignored)
├── .env                  ← DEEPGRAM_API_KEY (gitignored)
├── .env.example
├── requirements.txt
├── _specs/               ← project specs
└── package.json
```

## Setup

```bash
git clone git@github.com:flavioespinoza/meet-assist.git
cd meet-assist

# Python dependencies
pip install -r requirements.txt

# Configure API key
cp .env.example .env
# Edit .env and add your DEEPGRAM_API_KEY

# Make watcher executable
chmod +x src/watcher.sh
```

## Usage

### 1. Start the listener (captures mic → Deepgram → transcript.jsonl)

```bash
python src/listener.py
```

### 2. Start the watcher (reads new transcript lines → Claude responses)

In a separate terminal:

```bash
./src/watcher.sh
```

### 3. Load session context

Copy relevant spec files into `src/context/` before starting the watcher:

```bash
cp _specs/SPEC__sol-bot--architecture.md src/context/
```

## Protocol Commands

Type these in the watcher terminal during a call:

| Command | Meaning |
|---------|---------|
| `STOP` | Out of sync — ignore last input, reset |
| `EXPAND` | Give full explanation of last response |
| `[typed text]` | Manual input — override with your own text |

## Transcript Format

Each line in `transcript.jsonl`:

```json
{ "speaker": "Speaker_0", "text": "Tell me about the SDK integration.", "timestamp": 1741550400 }
```

## Latency Target

~2 seconds from end of utterance to Claude response on screen.
