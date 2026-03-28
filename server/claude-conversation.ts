import Anthropic from "@anthropic-ai/sdk"
import { loadContextFiles } from "./context-loader"

interface Message {
  role: "user" | "assistant"
  content: string
}

type ChunkCallback = (delta: string) => void
type DoneCallback = () => void

const SYSTEM_PROMPT_TEMPLATE = `You are Flavio's real-time interview assistant. You run on his MacBook while calls happen on his iMac.

Your job is to help Flavio during live interviews — whether he's interviewing for a job, being interviewed by a potential client, or in a technical discussion. You help him answer questions, suggest talking points, and provide quick reference material in real-time.

You have the following project context:
{context}

You will receive:
1. Direct messages from Flavio (he's typing to you during the call)
2. Live transcript utterances from the meeting (marked as [Meeting — Speaker_N])

IMPORTANT — Handling transcript utterances:
- Transcript cards may arrive fragmented (one question split across multiple cards). Treat consecutive utterances from the same speaker as ONE thought. Wait for the full picture before responding.
- When Flavio sends you a focused transcript utterance, help him with it — suggest how to answer, provide code examples, or give key points.
- If the utterance is just a fragment or filler ("yeah", "okay", "sure", "um"), do NOT respond.
- Only respond ONCE per question/topic. Never repeat or rephrase your own answer.

Rules:
- Keep responses concise — Flavio is in a live call and reading quickly
- For coding questions: give the answer directly with a brief explanation
- For behavioral questions: suggest 2-3 key talking points
- For client discussions: help clarify scope, suggest questions to ask
- Flavio may say "stay quiet" or "I've got this" — respect that until he re-engages`

export class ClaudeConversation {
  private client: Anthropic
  private history: Message[] = []
  private systemPrompt: string
  private abortController: AbortController | null = null

  constructor() {
    this.client = new Anthropic()
    const context = loadContextFiles()
    this.systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{context}", context || "(no context files found)")
  }

  async sendMessage(
    content: string,
    onChunk: ChunkCallback,
    onDone: DoneCallback,
  ) {
    // Add user message to history before sending
    this.history.push({ role: "user", content })

    this.abortController = new AbortController()

    let fullResponse = ""

    try {
      const stream = this.client.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: this.systemPrompt,
        messages: this.history,
      })

      for await (const event of stream) {
        if (this.abortController.signal.aborted) break

        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullResponse += event.delta.text
          onChunk(event.delta.text)
        }
      }

      if (fullResponse) {
        this.history.push({ role: "assistant", content: fullResponse })
      } else {
        // No response generated (aborted before any content) — remove the dangling user message
        this.history.pop()
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        console.error("Claude API error:", err)
      }
      // On error, remove the dangling user message if no response was captured
      if (!fullResponse) {
        this.history.pop()
      }
    } finally {
      this.abortController = null
      onDone()
    }
  }

  focusUtterance(speaker: string, text: string) {
    return `[Meeting — ${speaker}]: "${text}"`
  }

  stop() {
    this.abortController?.abort()
  }
}
