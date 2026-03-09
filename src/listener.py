#!/usr/bin/env python3
"""
listener.py — Captures mic audio and streams to Deepgram for real-time
transcription with speaker diarization. Appends each utterance to transcript.jsonl.
"""

import json
import os
import signal
import sys
import time
from pathlib import Path

import sounddevice as sd
from deepgram import DeepgramClient, LiveTranscriptionEvents, LiveOptions
from dotenv import load_dotenv

load_dotenv()

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
if not DEEPGRAM_API_KEY:
    print("Error: DEEPGRAM_API_KEY not set in .env")
    sys.exit(1)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TRANSCRIPT_FILE = PROJECT_ROOT / "transcript.jsonl"

SAMPLE_RATE = 16000
CHANNELS = 1
BLOCKSIZE = 4096


def append_utterance(speaker: str, text: str) -> None:
    """Append a single utterance to transcript.jsonl."""
    entry = {
        "speaker": speaker,
        "text": text,
        "timestamp": int(time.time()),
    }
    with open(TRANSCRIPT_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")
    print(f"[{speaker}] {text}")


def main():
    print("meet-assist listener starting...")
    print(f"Transcript file: {TRANSCRIPT_FILE}")

    deepgram = DeepgramClient(DEEPGRAM_API_KEY)
    connection = deepgram.listen.websocket.v("1")

    def on_message(_self, result, **kwargs):
        sentence = result.channel.alternatives[0].transcript
        if not sentence.strip():
            return

        words = result.channel.alternatives[0].words
        if words and hasattr(words[0], "speaker"):
            speaker = f"Speaker_{words[0].speaker}"
        else:
            speaker = "Speaker_unknown"

        append_utterance(speaker, sentence.strip())

    def on_error(_self, error, **kwargs):
        print(f"Deepgram error: {error}")

    connection.on(LiveTranscriptionEvents.Transcript, on_message)
    connection.on(LiveTranscriptionEvents.Error, on_error)

    options = LiveOptions(
        model="nova-2",
        language="en-US",
        smart_format=True,
        diarize=True,
        punctuate=True,
        interim_results=False,
        encoding="linear16",
        sample_rate=SAMPLE_RATE,
        channels=CHANNELS,
    )

    if not connection.start(options):
        print("Error: failed to connect to Deepgram")
        sys.exit(1)

    print("Connected to Deepgram. Listening...")

    running = True

    def stop(sig, frame):
        nonlocal running
        print("\nStopping listener...")
        running = False

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    def audio_callback(indata, frames, time_info, status):
        if status:
            print(f"Audio status: {status}", file=sys.stderr)
        connection.send(indata.tobytes())

    with sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        blocksize=BLOCKSIZE,
        dtype="int16",
        callback=audio_callback,
    ):
        while running:
            time.sleep(0.1)

    connection.finish()
    print("Listener stopped.")


if __name__ == "__main__":
    main()
