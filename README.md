# meet-assist

Real-time meeting assistant. Listens to a call, transcribes with speaker diarization via Deepgram, and feeds the live transcript to Claude for real-time answers — all through a web UI.

## Prerequisites

- **Node.js 18+** and **npm**
- **Python 3.10+** (for the audio listener)
- **PortAudio** (required by `sounddevice`)
- **Deepgram account** with an API key ([deepgram.com](https://deepgram.com))
- **Anthropic API key** (for Claude streaming responses)

### Install PortAudio (macOS)

```bash
brew install portaudio
```

## Setup

```bash
git clone git@github.com:flavioespinoza/meet-assist.git
cd meet-assist
```

### 1. Install dependencies

```bash
npm install
pip install -r requirements.txt
```

### 2. Configure API keys

```bash
cp .env.example .env
```

Edit `.env` and set your Deepgram key:

```
DEEPGRAM_API_KEY=your_actual_key_here
```

Get a key at [console.deepgram.com](https://console.deepgram.com) → API Keys.

Make sure your `ANTHROPIC_API_KEY` is set in your environment (e.g. via `~/.zkeys` or your shell profile).

### 3. Load session context (before each call)

Copy any relevant spec/reference files into `src/context/`. These are injected into Claude's system prompt during the call:

```bash
cp _specs/SPEC__sol-bot--architecture.md src/context/
```

Clear the directory between calls if context changes:

```bash
rm src/context/*
```

## Running

Start the audio listener (mic capture → Deepgram → transcript file):

```bash
python src/listener.py
```

In a second terminal, start the frontend:

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000) in your browser.

### How it works

The browser shows a two-panel layout:

- **Left panel (chat)** — Full conversational chat with Claude. Type messages or click utterances from the right panel to focus Claude on a specific part of the conversation. Claude streams responses token-by-token and maintains full conversation history.
- **Right panel (live stream)** — Real-time scrolling feed of transcript utterances, color-coded by speaker. Click any utterance to send it to the chat panel. Copy button on each card.

The WebSocket server on `:3001` watches `transcript.jsonl` for new lines and streams them to the browser in real time.

## Stopping

Press `Ctrl+C` in each terminal to stop the listener and the dev server.

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
│   ├── layout.tsx              ← Root layout, metadata
│   ├── page.tsx                ← Main page (chat + live stream panels)
│   └── globals.css             ← Tailwind styles + color variables
├── server/                     ← Backend services (TypeScript)
│   ├── ws-server.ts            ← WebSocket server (:3001)
│   ├── transcript-watcher.ts   ← chokidar watcher for transcript.jsonl
│   ├── claude-conversation.ts  ← Anthropic SDK multi-turn + streaming
│   └── context-loader.ts       ← Reads src/context/* at startup
├── components/                 ← React components
│   ├── chat-panel.tsx          ← Left panel (chat interface)
│   ├── chat-message.tsx        ← Message bubble
│   ├── chat-input.tsx          ← Text input + Send button
│   ├── live-stream.tsx         ← Right panel (scrolling transcript)
│   └── chat-card.tsx           ← Utterance card (clickable, color-coded)
├── hooks/
│   └── use-copy-clipboard.ts   ← Copy utterance text to clipboard
├── lib/
│   └── utils.ts                ← Utility functions
├── src/
│   ├── listener.py             ← Mic capture → Deepgram → transcript.jsonl
│   └── context/                ← Spec files loaded at session start
├── _specs/                     ← Project specs and architecture docs
├── transcript.jsonl            ← Live transcript (gitignored)
├── .env                        ← API keys (gitignored)
├── .env.example
├── package.json
├── requirements.txt
├── tsconfig.json
└── next.config.js
```

## Architecture

See [`_specs/SPEC__architecture.md`](_specs/SPEC__architecture.md) for the full systems architecture: data flow diagrams, component internals, latency breakdown, and implementation status.

## Troubleshooting

### "Error: DEEPGRAM_API_KEY not set in .env"

Make sure `.env` exists and contains your key.

### "No module named 'sounddevice'"

```bash
pip install -r requirements.txt
```

If `sounddevice` fails, make sure PortAudio is installed:

```bash
brew install portaudio  # macOS
```

### "Error: failed to connect to Deepgram"

Check that your API key is valid and has streaming permissions at [console.deepgram.com](https://console.deepgram.com).

### Frontend not showing utterances

- Make sure `listener.py` is running and writing to `transcript.jsonl`
- Check the browser console for WebSocket connection errors
- Verify the dev server is running on port 3000 and the WebSocket server on port 3001
