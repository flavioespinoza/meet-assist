# meet-assist

Real-time meeting assistant. Listens to a call, transcribes with speaker diarization via Deepgram, and feeds the live transcript to Claude for real-time answers.

## Prerequisites

- **Python 3.10+**
- **PortAudio** (required by `sounddevice`)
- **Claude Code CLI** installed and authenticated
- **Deepgram account** with an API key ([deepgram.com](https://deepgram.com))

### Install PortAudio (macOS)

```bash
brew install portaudio
```

### Install Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
```

Authenticate:

```bash
claude
# Follow the prompts to sign in
```

## Setup

```bash
git clone git@github.com:flavioespinoza/meet-assist.git
cd meet-assist
```

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
```

This installs:
- `sounddevice` — low-latency mic capture (wraps PortAudio)
- `deepgram-sdk` — Deepgram WebSocket client for real-time transcription
- `python-dotenv` — loads environment variables from `.env`

### 2. Configure your Deepgram API key

```bash
cp .env.example .env
```

Edit `.env` and replace the placeholder:

```
DEEPGRAM_API_KEY=your_actual_key_here
```

Get a key at [console.deepgram.com](https://console.deepgram.com) → API Keys.

### 3. Make the watcher executable

```bash
chmod +x src/watcher.sh
```

### 4. Load session context (before each call)

Copy any relevant spec/reference files into `src/context/`. These are injected into every Claude prompt during the call:

```bash
cp _specs/SPEC__sol-bot--architecture.md src/context/
cp _specs/SPEC__sol-bot--agent-prompts.md src/context/
```

Clear the directory between calls if context changes:

```bash
rm src/context/*
```

## Running

You need **two terminal windows** open side by side.

### Terminal 1 — Listener (mic → transcript)

```bash
python src/listener.py
```

This captures your mic audio, streams it to Deepgram for real-time transcription with speaker diarization, and appends each utterance as a JSON line to `transcript.jsonl`.

You should see output like:

```
meet-assist listener starting...
Transcript file: /path/to/meet-assist/transcript.jsonl
Connected to Deepgram. Listening...
[Speaker_0] Tell me about the SDK integration.
[Speaker_1] Sure, let me walk you through it.
```

### Terminal 2 — Watcher (transcript → Claude responses)

```bash
./src/watcher.sh
```

This watches `transcript.jsonl` for new lines (polling every 0.5s), sends each new utterance to Claude with your session context, and displays the response as teleprompter text.

You should see output like:

```
=== meet-assist watcher ===
Watching: /path/to/meet-assist/transcript.jsonl
Waiting for new utterances...

────────────────────────────────────
[Speaker_0]: What's the latency on the WebSocket connection?
────────────────────────────────────

>>> Claude:
The Deepgram WebSocket typically adds ~300ms latency for final transcripts...
```

### Protocol Commands

While the watcher is running, type commands directly into Terminal 2:

| Command | What it does |
|---------|-------------|
| `STOP` | Ignore the last utterance and reset. Use when things get out of sync. |
| `EXPAND` | Get a detailed expansion of the last Claude response. |
| Any other text | Send your own text to Claude as a manual override (bypasses the transcript). |

## Stopping

Press `Ctrl+C` in each terminal to stop the listener and watcher.

## Transcript Format

Each line in `transcript.jsonl`:

```json
{"speaker": "Speaker_0", "text": "Tell me about the SDK integration.", "timestamp": 1741550400}
```

- `speaker` — assigned by Deepgram diarization (`Speaker_0`, `Speaker_1`, etc.)
- `text` — the transcribed utterance
- `timestamp` — Unix epoch seconds

The file is **gitignored** and never committed. It resets between sessions (delete it manually or let it accumulate).

## File Structure

```
meet-assist/
├── src/
│   ├── listener.py       ← mic capture → Deepgram → transcript.jsonl
│   ├── watcher.sh        ← watches transcript → Claude responses
│   └── context/          ← spec files loaded at session start
├── _specs/               ← project specs and architecture docs
├── transcript.jsonl      ← live transcript (gitignored)
├── .env                  ← DEEPGRAM_API_KEY (gitignored)
├── .env.example
├── requirements.txt
└── package.json
```

## Architecture

See [`_specs/SPEC__architecture.md`](_specs/SPEC__architecture.md) for the full systems architecture: data flow diagrams, component internals, latency breakdown, and implementation status.

## Troubleshooting

### "Error: DEEPGRAM_API_KEY not set in .env"

Make sure `.env` exists and contains your key:

```bash
cat .env
# Should show: DEEPGRAM_API_KEY=dg-...
```

### "No module named 'sounddevice'"

Install dependencies:

```bash
pip install -r requirements.txt
```

If `sounddevice` fails, make sure PortAudio is installed:

```bash
brew install portaudio  # macOS
```

### "Error: failed to connect to Deepgram"

Check that your API key is valid and has streaming permissions at [console.deepgram.com](https://console.deepgram.com).

### Watcher shows no responses

- Make sure `claude` CLI is installed and authenticated: `claude --version`
- Check that `transcript.jsonl` is being written to: `tail -f transcript.jsonl`
- Verify context files exist: `ls src/context/`
