import Anthropic from "@anthropic-ai/sdk"
import { loadContextFiles } from "./context-loader"

interface Message {
  role: "user" | "assistant"
  content: string
}

type ChunkCallback = (delta: string) => void
type DoneCallback = () => void

const SYSTEM_PROMPT_TEMPLATE = `You are a real-time meeting assistant. Flavio is on a call with Trajan.
You are running on Flavio's MacBook while the call happens on his iMac.

You have the following project context:
{context}

You will receive:
1. Direct messages from Flavio (he's typing to you during the call)
2. Live transcript utterances from the meeting (marked as [Meeting — Speaker_N])

Rules:
- When Flavio sends you a focused transcript utterance, help him with it
- When Flavio asks you a direct question, answer it
- You can proactively flag important things from the transcript
- Keep responses concise — Flavio is in a live call and reading quickly
- If the transcript is just filler ("yeah", "okay", "sure"), don't respond to it
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

      this.history.push({ role: "assistant", content: fullResponse })
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        console.error("Claude API error:", err)
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
