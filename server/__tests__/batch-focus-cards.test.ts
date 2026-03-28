import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMessageHandler } from "../message-handler"
import type { Utterance } from "../transcript-watcher"

/**
 * Fake ClaudeConversation that records every message sent to it.
 * Lets us inspect exactly what text Claude received.
 */
function createFakeConversation() {
  let abortController: AbortController | null = null
  const receivedMessages: string[] = []

  const fake = {
    get receivedMessages() { return receivedMessages },
    get sendCount() { return receivedMessages.length },

    async sendMessage(
      content: string,
      onChunk: (delta: string) => void,
      onDone: () => void,
    ) {
      receivedMessages.push(content)
      abortController = new AbortController()
      const signal = abortController.signal

      // Simulate a quick response
      if (!signal.aborted) {
        onChunk("Got it.")
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

function makeUtterance(id: string, speaker: string, text: string): Utterance {
  return { id, speaker, text, timestamp: Date.now() / 1000 }
}

describe("batch focus cards — multiple cards treated as one conversation", () => {
  let conversation: ReturnType<typeof createFakeConversation>
  let handler: ReturnType<typeof createMessageHandler>
  let broadcasted: object[]
  let broadcast: (data: object) => void
  let utterances: Map<string, Utterance>

  beforeEach(() => {
    conversation = createFakeConversation()
    // Use a short 50ms batch delay for fast tests
    handler = createMessageHandler(conversation as any, 50)
    broadcasted = []
    broadcast = (data) => broadcasted.push(data)
    utterances = new Map()
  })

  it("clicking one card sends one message to Claude", async () => {
    utterances.set("utt_001", makeUtterance("utt_001", "Speaker_1", "What is a closure in JavaScript?"))

    handler({ type: "focus", id: "utt_001" }, utterances, broadcast)

    // Wait for batch timer to fire
    await new Promise((r) => setTimeout(r, 100))

    expect(conversation.sendCount).toBe(1)
    expect(conversation.receivedMessages[0]).toContain("What is a closure in JavaScript?")
  })

  it("clicking 3 cards from same speaker rapidly → ONE combined message to Claude", async () => {
    // Simulate a question split into 3 transcript cards
    utterances.set("utt_001", makeUtterance("utt_001", "Speaker_1", "Create a JavaScript function"))
    utterances.set("utt_002", makeUtterance("utt_002", "Speaker_1", "that takes in an array of numbers"))
    utterances.set("utt_003", makeUtterance("utt_003", "Speaker_1", "and removes all duplicates."))

    // Click all 3 cards rapidly (like the user selecting fragments of one question)
    handler({ type: "focus", id: "utt_001" }, utterances, broadcast)
    handler({ type: "focus", id: "utt_002" }, utterances, broadcast)
    handler({ type: "focus", id: "utt_003" }, utterances, broadcast)

    // Wait for batch timer
    await new Promise((r) => setTimeout(r, 100))

    // Claude should have received exactly ONE message with ALL three fragments
    expect(conversation.sendCount).toBe(1)

    const msg = conversation.receivedMessages[0]
    expect(msg).toContain("Create a JavaScript function")
    expect(msg).toContain("that takes in an array of numbers")
    expect(msg).toContain("and removes all duplicates.")
  })

  it("clicking 5 fragmented cards → all combined into one coherent message", async () => {
    // A long interview question broken into 5 cards by Deepgram
    utterances.set("utt_010", makeUtterance("utt_010", "Speaker_1", "So tell me about"))
    utterances.set("utt_011", makeUtterance("utt_011", "Speaker_1", "your experience with"))
    utterances.set("utt_012", makeUtterance("utt_012", "Speaker_1", "building distributed systems"))
    utterances.set("utt_013", makeUtterance("utt_013", "Speaker_1", "and how you handled"))
    utterances.set("utt_014", makeUtterance("utt_014", "Speaker_1", "scaling issues in production."))

    handler({ type: "focus", id: "utt_010" }, utterances, broadcast)
    handler({ type: "focus", id: "utt_011" }, utterances, broadcast)
    handler({ type: "focus", id: "utt_012" }, utterances, broadcast)
    handler({ type: "focus", id: "utt_013" }, utterances, broadcast)
    handler({ type: "focus", id: "utt_014" }, utterances, broadcast)

    await new Promise((r) => setTimeout(r, 100))

    expect(conversation.sendCount).toBe(1)

    const msg = conversation.receivedMessages[0]
    expect(msg).toContain("So tell me about")
    expect(msg).toContain("your experience with")
    expect(msg).toContain("building distributed systems")
    expect(msg).toContain("and how you handled")
    expect(msg).toContain("scaling issues in production.")
  })

  it("cards from different speakers are still combined when clicked together", async () => {
    // Interviewer asks, then Flavio starts answering — user clicks both
    utterances.set("utt_020", makeUtterance("utt_020", "Speaker_1", "What are React hooks?"))
    utterances.set("utt_021", makeUtterance("utt_021", "Speaker_0", "Well hooks are basically"))

    handler({ type: "focus", id: "utt_020" }, utterances, broadcast)
    handler({ type: "focus", id: "utt_021" }, utterances, broadcast)

    await new Promise((r) => setTimeout(r, 100))

    expect(conversation.sendCount).toBe(1)

    const msg = conversation.receivedMessages[0]
    expect(msg).toContain("Speaker_1")
    expect(msg).toContain("What are React hooks?")
    expect(msg).toContain("Speaker_0")
    expect(msg).toContain("Well hooks are basically")
  })

  it("cards clicked with a gap BETWEEN batches → two separate Claude requests", async () => {
    utterances.set("utt_030", makeUtterance("utt_030", "Speaker_1", "First question about arrays"))
    utterances.set("utt_031", makeUtterance("utt_031", "Speaker_1", "Second question about promises"))

    // Click first card
    handler({ type: "focus", id: "utt_030" }, utterances, broadcast)

    // Wait for batch to flush (50ms delay + buffer)
    await new Promise((r) => setTimeout(r, 100))

    // Now click second card — this is a separate question
    handler({ type: "focus", id: "utt_031" }, utterances, broadcast)

    await new Promise((r) => setTimeout(r, 100))

    // Two separate Claude calls
    expect(conversation.sendCount).toBe(2)
    expect(conversation.receivedMessages[0]).toContain("First question about arrays")
    expect(conversation.receivedMessages[1]).toContain("Second question about promises")
  })

  it("typed message cancels any pending card batch", async () => {
    utterances.set("utt_040", makeUtterance("utt_040", "Speaker_1", "some card text"))

    // Click a card (starts batch timer)
    handler({ type: "focus", id: "utt_040" }, utterances, broadcast)

    // Before timer fires, type a message directly
    await handler({ type: "message", text: "ignore that, just explain closures" }, utterances, broadcast)

    // Wait to make sure no batch fires
    await new Promise((r) => setTimeout(r, 100))

    // Only the typed message should have been sent, not the card
    expect(conversation.sendCount).toBe(1)
    expect(conversation.receivedMessages[0]).toBe("ignore that, just explain closures")
  })

  it("stop cancels pending card batch", async () => {
    utterances.set("utt_050", makeUtterance("utt_050", "Speaker_1", "some question"))

    handler({ type: "focus", id: "utt_050" }, utterances, broadcast)

    // Stop before batch fires
    await handler({ type: "stop" }, utterances, broadcast)
    await new Promise((r) => setTimeout(r, 100))

    expect(conversation.sendCount).toBe(0)
  })
})
