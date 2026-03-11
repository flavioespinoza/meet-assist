# meet-assist

Real-time meeting assistant. Listens to a call, transcribes with speaker diarization via Deepgram, and streams the live transcript + Claude conversation through a Next.js browser interface.

## Prerequisites

- **Node.js 18+** and **npm**
- **Python 3.10+**
- **PortAudio** (required by `sounddevice`)
- **Deepgram account** with an API key ([deepgram.com](https://deepgram.com))
- **Anthropic API key** (for Claude streaming in the frontend)

### Install PortAudio (macOS)

```bash
brew install portaudio
```

## Setup

```bash
git clone git@github.com:flavioespinoza/meet-assist.git
cd meet-assist
```

### 1. Install Node dependencies

```bash
npm install
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

This installs:
- `sounddevice` — low-latency mic capture (wraps PortAudio)
- `deepgram-sdk` — Deepgram WebSocket client for real-time transcription
- `python-dotenv` — loads environment variables from `.env`

### 3. Configure API keys

```bash
cp .env.example .env
```

Edit `.env`:

```
DEEPGRAM_API_KEY=your_deepgram_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

Both keys are also available via `~/.zkeys` on Flavio's machines.

### 4. Load session context (before each call)

Copy any relevant spec/reference files into `src/context/`. These are injected into Claude's system prompt at startup:

```bash
cp _specs/SPEC__sol-bot--architecture.md src/context/
```

Clear the directory between calls if context changes:

```bash
rm src/context/*
```

## Running

Two terminals:

### Terminal 1 — Listener (mic → transcript)

```bash
python src/listener.py
```

Captures mic audio, streams to Deepgram for real-time transcription with speaker diarization, appends each utterance to `transcript.jsonl`.

### Terminal 2 — Frontend + WebSocket server

```bash
npm run dev
```

Open `http://localhost:3000`. The interface has two panels:

- **Left (4/5 width) — Chat with Claude.** Type messages, ask questions, get streaming responses. Claude has full conversation history and sees the live transcript.
- **Right (1/5 width) — Live transcript stream.** Each utterance appears as a colored card (steel for Speaker_0, rose for Speaker_1, sage for Speaker_2). Click any card to focus Claude on that utterance.

## Interface

```
┌──────────────────────────────────────────────┬──────────┐
│                                              │          │
│              CHAT PANEL                      │  LIVE    │
│              (4/5 width)                     │ STREAM   │
│                                              │ (1/5)    │
│  Full chat with Claude.                      │          │
│  Streaming responses.                        │ Colored  │
│  Multi-turn conversation.                    │ cards    │
│                                              │ per      │
│                                              │ speaker  │
├──────────────────────────────────────────────┤          │
│  ┌─────────────────────────────────┐         │          │
│  │  Type a message...              │ [Send]  │          │
│  └─────────────────────────────────┘         │          │
└──────────────────────────────────────────────┴──────────┘
```

**What you can do in the chat:**
- Ask Claude questions about the meeting
- "What did Trajan mean by that?"
- "Give me a summary of the last 5 minutes"
- "Stay quiet for now, I've got this"
- Click a transcript card on the right to focus Claude on a specific utterance

## Transcript Format

Each line in `transcript.jsonl`:

```json
{"speaker": "Speaker_0", "text": "Tell me about the SDK integration.", "timestamp": 1741550400}
```

- `speaker` — assigned by Deepgram diarization (`Speaker_0`, `Speaker_1`, etc.)
- `text` — the transcribed utterance
- `timestamp` — Unix epoch seconds

The file is **gitignored** and never committed.

## File Structure

```
meet-assist/
├── app/                        ← Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                ← main UI (chat + live stream)
│   └── globals.css             ← Tailwind + steel/rose/sage palette
├── components/
│   ├── chat-panel.tsx          ← left panel (chat interface)
│   ├── chat-message.tsx        ← message bubble
│   ├── chat-input.tsx          ← text input + send button
│   ├── live-stream.tsx         ← right panel (scrolling transcript)
│   └── chat-card.tsx           ← utterance card (speaker color + copy button)
├── hooks/
│   └── use-copy-clipboard.ts   ← copy utterance text to clipboard
├── server/
│   ├── ws-server.ts            ← WebSocket server (port 3001)
│   ├── transcript-watcher.ts   ← chokidar tailing transcript.jsonl
│   ├── claude-conversation.ts  ← Anthropic SDK multi-turn + streaming
│   └── context-loader.ts       ← reads src/context/* at startup
├── src/
│   ├── listener.py             ← mic capture → Deepgram → transcript.jsonl
│   ├── watcher.sh              ← terminal fallback (legacy)
│   └── context/                ← spec files loaded at session start
├── _specs/                     ← project specs
├── transcript.jsonl            ← live transcript (gitignored)
├── .env                        ← API keys (gitignored)
├── .env.example
├── requirements.txt
└── package.json
```

## Architecture

See [`_specs/SPEC__meet-assist--architecture.md`](_specs/SPEC__meet-assist--architecture.md) for the full systems architecture.

See [`_specs/SPEC__meet-assist--frontend-interface.md`](_specs/SPEC__meet-assist--frontend-interface.md) for the frontend spec.

## Troubleshooting

### "Error: DEEPGRAM_API_KEY not set in .env"

Make sure `.env` exists and contains your key:

```bash
cat .env
# Should show: DEEPGRAM_API_KEY=dg-...
```

### "No module named 'sounddevice'"

```bash
pip install -r requirements.txt
```

If `sounddevice` fails, make sure PortAudio is installed:

```bash
brew install portaudio
```

### "Error: failed to connect to Deepgram"

Check that your API key is valid and has streaming permissions at [console.deepgram.com](https://console.deepgram.com).

### Frontend shows no transcript

- Make sure `listener.py` is running in Terminal 1
- Check that `transcript.jsonl` is being written to: `tail -f transcript.jsonl`
- Verify the WebSocket server started (check terminal output for port 3001)

### Claude not responding

- Check that `ANTHROPIC_API_KEY` is set in `.env`
- Verify context files exist: `ls src/context/`
