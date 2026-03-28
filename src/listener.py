#!/usr/bin/env python3
"""
listener.py — Captures mic audio and streams to Deepgram for real-time
transcription with speaker diarization. Buffers fragments from the same
speaker and flushes when the speaker changes or after silence.
Appends each complete utterance to transcript.jsonl.
Uses raw websockets instead of the Deepgram SDK for reliability.
"""

import json
import os
import signal
import sys
import threading
import time
from pathlib import Path

import sounddevice as sd
import websockets.sync.client as wsc
from dotenv import load_dotenv

load_dotenv()

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
if not DEEPGRAM_API_KEY:
    print("Error: DEEPGRAM_API_KEY not set")
    sys.exit(1)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TRANSCRIPT_FILE = PROJECT_ROOT / "transcript.jsonl"

SAMPLE_RATE = 16000
CHANNELS = 1
BLOCKSIZE = 4096
DEVICE_ID = 0
FLUSH_DELAY = 5.0

DG_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?model=nova-2"
    "&language=en-US"
    "&smart_format=true"
    "&diarize=true"
    "&punctuate=true"
    "&interim_results=false"
    "&endpointing=2000"
    "&utterance_end_ms=3000"
    "&encoding=linear16"
    f"&sample_rate={SAMPLE_RATE}"
    f"&channels={CHANNELS}"
)


def append_utterance(speaker: str, text: str) -> None:
    entry = {
        "speaker": speaker,
        "text": text,
        "timestamp": int(time.time()),
    }
    with open(TRANSCRIPT_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")
    print(f"[{speaker}] {text}")


class UtteranceBuffer:
    def __init__(self):
        self.speaker = None
        self.fragments = []
        self.last_time = 0
        self.lock = threading.Lock()

    def add(self, speaker: str, text: str):
        with self.lock:
            if self.speaker and self.speaker != speaker:
                self._flush()
            self.speaker = speaker
            self.fragments.append(text)
            self.last_time = time.time()

    def check_flush(self):
        with self.lock:
            if self.fragments and (time.time() - self.last_time) >= FLUSH_DELAY:
                self._flush()

    def flush_remaining(self):
        with self.lock:
            if self.fragments:
                self._flush()

    def _flush(self):
        if not self.fragments:
            return
        full_text = " ".join(self.fragments)
        append_utterance(self.speaker, full_text)
        self.fragments = []
        self.speaker = None


def main():
    print("meet-assist listener starting...")
    print(f"Transcript file: {TRANSCRIPT_FILE}")
    print(f"Buffer flush delay: {FLUSH_DELAY}s")

    headers = {"Authorization": f"Token {DEEPGRAM_API_KEY}"}

    ws = wsc.connect(DG_URL, additional_headers=headers)
    print("Connected to Deepgram. Listening...")

    buffer = UtteranceBuffer()
    running = True

    def stop(sig, frame):
        nonlocal running
        print("\nStopping listener...")
        running = False

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    def recv_loop():
        try:
            while running:
                try:
                    raw = ws.recv(timeout=1)
                except TimeoutError:
                    continue
                msg = json.loads(raw)

                # Deepgram sends UtteranceEnd after utterance_end_ms of silence
                if msg.get("type") == "UtteranceEnd":
                    buffer.flush_remaining()
                    continue

                if msg.get("type") != "Results":
                    continue
                alt = msg["channel"]["alternatives"][0]
                text = alt.get("transcript", "").strip()
                if not text:
                    continue
                words = alt.get("words", [])
                if words and "speaker" in words[0]:
                    speaker = f"Speaker_{words[0]['speaker']}"
                else:
                    speaker = "Speaker_unknown"
                buffer.add(speaker, text)
        except Exception as e:
            if running:
                print(f"Recv error: {e}")

    def flush_loop():
        while running:
            time.sleep(0.2)
            buffer.check_flush()

    recv_thread = threading.Thread(target=recv_loop, daemon=True)
    recv_thread.start()

    flush_thread = threading.Thread(target=flush_loop, daemon=True)
    flush_thread.start()

    def audio_callback(indata, frames, time_info, status):
        if status:
            print(f"Audio status: {status}", file=sys.stderr)
        try:
            ws.send(indata.tobytes())
        except Exception:
            pass

    with sd.InputStream(
        device=DEVICE_ID,
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        blocksize=BLOCKSIZE,
        dtype="int16",
        callback=audio_callback,
    ):
        while running:
            time.sleep(0.1)

    buffer.flush_remaining()
    ws.close()
    print("Listener stopped.")


if __name__ == "__main__":
    main()