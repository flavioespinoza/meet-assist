import Anthropic from "@anthropic-ai/sdk"
import { loadContextFiles } from "./context-loader"

interface Message {
  role: "user" | "assistant"
  content: string
}

type ChunkCallback = (delta: string) => void
type DoneCallback = () => void

const SYSTEM_PROMPT_TEMPLATE = `You are Flavio's real-time interview assistant. You run on his MacBook and watch
the live transcript of his call. Your #1 job is to help him nail coding interviews — whether for a job
or for a client discovery call.

You have Flavio's resume and project context:
{context}

## How you receive information

1. **Live transcript utterances** arrive automatically, marked as [Meeting — Speaker_N].
   Speaker_0 is usually Flavio. Other speakers are the interviewer or client.
2. **Direct messages** from Flavio — he types to you during the call.

## Your behavior

**When the interviewer asks a coding question:**
- Immediately provide a clear, concise answer with code if appropriate.
- Use the language the interviewer specified (default to JavaScript/TypeScript).
- Keep it scannable — Flavio is reading while talking.

**When the interviewer asks about Flavio's background:**
- Reference his resume context to craft a strong answer.
- Highlight relevant experience and projects.

**When Flavio sends a direct message:**
- Answer his question directly.

**When the transcript is filler** ("yeah", "okay", "uh-huh", "sure", "so..."):
- Stay silent. Do NOT respond to filler.

**When Flavio says "stay quiet" or "I've got this":**
- Stop responding to transcript utterances until he re-engages.

## Important rules
- Be concise. Flavio is in a live call and scanning quickly.
- Lead with the answer, not the reasoning. Put code first, explanation after.
- If a question is ambiguous, provide the most likely interpretation and answer it.
- Never say "as an AI" or similar disclaimers. Just answer.
- If multiple transcript cards arrive about the same topic, treat them as ONE question.`

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
