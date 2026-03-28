import type { Utterance } from "./transcript-watcher"

/**
 * Buffers consecutive same-speaker utterances and consolidates them
 * into a single utterance before emitting. This is the server-side
 * safety net for when Deepgram/listener.py still produces multiple
 * lines for one speaker turn.
 *
 * Flush triggers:
 *  1. Speaker changes (new speaker starts talking)
 *  2. Silence timeout (no new utterance within CONSOLIDATION_WINDOW_MS)
 */

const CONSOLIDATION_WINDOW_MS = 3000

type ConsolidatedCallback = (utterance: Utterance) => void

export class UtteranceConsolidator {
  private buffer: Utterance[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private idCounter = 0
  private onEmit: ConsolidatedCallback

  constructor(onEmit: ConsolidatedCallback) {
    this.onEmit = onEmit
  }

  add(utterance: Utterance) {
    // Different speaker? Flush the buffer first.
    if (
      this.buffer.length > 0 &&
      this.buffer[0].speaker !== utterance.speaker
    ) {
      this.flush()
    }

    this.buffer.push(utterance)
    this.resetTimer()
  }

  private resetTimer() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), CONSOLIDATION_WINDOW_MS)
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.buffer.length === 0) return

    const first = this.buffer[0]

    if (this.buffer.length === 1) {
      // Single utterance — pass through as-is
      this.onEmit(first)
    } else {
      // Consolidate multiple utterances from same speaker
      this.idCounter++
      const consolidated: Utterance = {
        speaker: first.speaker,
        text: this.buffer.map((u) => u.text).join(" "),
        timestamp: first.timestamp,
        id: `con_${String(this.idCounter).padStart(3, "0")}`,
      }
      this.onEmit(consolidated)
    }

    this.buffer = []
  }
}
