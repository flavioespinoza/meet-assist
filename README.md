# meet-assist

Real-time call assistant that listens to a meeting, transcribes with speaker diarization via Deepgram, and feeds the live transcript to Claude for real-time answers.

## Structure

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
└── _specs/
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
