import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMessageHandler } from "../message-handler"
import type { Utterance } from "../transcript-watcher"

/**
 * Fake ClaudeConversation that simulates slow streaming.
 * Each sendMessage takes `delayMs` to complete and streams
 * chunks one at a time via onChunk before calling onDone.
 */
function createFakeConversation(delayMs = 100) {
  let abortController: AbortController | null = null
  let sendCount = 0
  let completeCount = 0

  const fake = {
    get sendCount() { return sendCount },
    get completeCount() { return completeCount },

    async sendMessage(
      content: string,
      onChunk: (delta: string) => void,
      onDone: () => void,
    ) {
      sendCount++
      abortController = new AbortController()
      const signal = abortController.signal

      // Simulate streaming in small chunks with delay
      const words = content.split(" ")
      for (const word of words) {
        if (signal.aborted) break
        await new Promise((r) => setTimeout(r, delayMs / words.length))
        if (signal.aborted) break
        onChunk(word + " ")
      }

      if (!signal.aborted) {
        completeCount++
      }
      onDone()
    },

    focusUtterance(speaker: string, text: string) {
      return `[Meeting — ${speaker}]: "${text}"`
    },

    stop() {
      abortController?.abort()
    },
  }

  return fake
}

describe("no-double-answer guard", () => {
  let conversation: ReturnType<typeof createFakeConversation>
  let handler: ReturnType<typeof createMessageHandler>
  let broadcasted: object[]
  let broadcast: (data: object) => void
  let utterances: Map<string, Utterance>

  beforeEach(() => {
    conversation = createFakeConversation(80)
    handler = createMessageHandler(conversation as any)
    broadcasted = []
    broadcast = (data) => broadcasted.push(data)
    utterances = new Map()
  })

  it("sends exactly one complete response for a single message", async () => {
    await handler({ type: "message", text: "What is JavaScript?" }, utterances, broadcast)

    const doneEvents = broadcasted.filter((e: any) => e.type === "claude_done")
    const chunkEvents = broadcasted.filter((e: any) => e.type === "claude_chunk")

    expect(doneEvents).toHaveLength(1)
    expect(chunkEvents.length).toBeGreaterThan(0)
    expect(conversation.completeCount).toBe(1)
    expect(conversation.sendCount).toBe(1)
  })

  it("aborts the first response when a second message arrives — only the second completes", async () => {
    // Fire first message (don't await — it's still streaming)
    const first = handler({ type: "message", text: "first question that takes a while to answer" }, utterances, broadcast)

    // Small delay then fire second message before first finishes
    await new Promise((r) => setTimeout(r, 10))
    const second = handler({ type: "message", text: "second question" }, utterances, broadcast)

    await Promise.all([first, second])

    // Only ONE request should have fully completed (the second one)
    // The first was aborted before it could finish
    expect(conversation.completeCount).toBe(1)
    expect(conversation.sendCount).toBe(2)

    // Every claude_done is paired properly — the frontend resets on each one
    const doneEvents = broadcasted.filter((e: any) => e.type === "claude_done")
    expect(doneEvents.length).toBeGreaterThanOrEqual(2)
  })

  it("aborts the first response when a focus arrives mid-stream — no double answer", async () => {
    utterances.set("utt_001", {
      id: "utt_001",
      speaker: "Speaker_1",
      text: "Tell me about React hooks",
      timestamp: Date.now() / 1000,
    })

    // Fire a typed message (still streaming)
    const first = handler({ type: "message", text: "explain closures" }, utterances, broadcast)

    await new Promise((r) => setTimeout(r, 10))

    // Click a transcript card before the first response finishes
    const second = handler({ type: "focus", id: "utt_001" }, utterances, broadcast)

    await Promise.all([first, second])

    // Only the second (focus) request should complete fully
    expect(conversation.completeCount).toBe(1)
    expect(conversation.sendCount).toBe(2)
  })

  it("rapid-fire three messages — only the last one completes", async () => {
    const p1 = handler({ type: "message", text: "question one is quite long" }, utterances, broadcast)
    await new Promise((r) => setTimeout(r, 5))
    const p2 = handler({ type: "message", text: "question two is also long" }, utterances, broadcast)
    await new Promise((r) => setTimeout(r, 5))
    const p3 = handler({ type: "message", text: "question three" }, utterances, broadcast)

    await Promise.all([p1, p2, p3])

    // Only the last request should fully complete
    expect(conversation.completeCount).toBe(1)
    expect(conversation.sendCount).toBe(3)
  })

  it("stop message kills in-flight response", async () => {
    const first = handler({ type: "message", text: "long answer please" }, utterances, broadcast)

    await new Promise((r) => setTimeout(r, 10))
    await handler({ type: "stop" }, utterances, broadcast)

    await first

    // The response was stopped — should NOT have completed
    expect(conversation.completeCount).toBe(0)
  })

  it("sequential messages (not overlapping) each get their own complete response", async () => {
    await handler({ type: "message", text: "first" }, utterances, broadcast)
    await handler({ type: "message", text: "second" }, utterances, broadcast)

    expect(conversation.completeCount).toBe(2)
    expect(conversation.sendCount).toBe(2)

    const doneEvents = broadcasted.filter((e: any) => e.type === "claude_done")
    expect(doneEvents).toHaveLength(2)
  })
})
