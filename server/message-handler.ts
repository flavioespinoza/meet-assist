import type { ClaudeConversation } from "./claude-conversation"
import type { Utterance } from "./transcript-watcher"

export type BroadcastFn = (data: object) => void

// How long to wait for more card clicks before sending to Claude
const FOCUS_BATCH_DELAY_MS = 600

export function createMessageHandler(
  conversation: ClaudeConversation,
  batchDelayMs = FOCUS_BATCH_DELAY_MS,
) {
  let isProcessing = false
  let focusBatch: Utterance[] = []
  let focusTimer: ReturnType<typeof setTimeout> | null = null

  function abortIfProcessing(broadcast: BroadcastFn) {
    if (isProcessing) {
      conversation.stop()
      broadcast({ type: "claude_done" })
    }
  }

  async function sendBatch(broadcast: BroadcastFn) {
    const batch = focusBatch.slice()
    focusBatch = []
    focusTimer = null

    if (batch.length === 0) return

    abortIfProcessing(broadcast)

    isProcessing = true

    // Combine all cards into one message for Claude
    const content = batch.length === 1
      ? conversation.focusUtterance(batch[0].speaker, batch[0].text)
      : batch
          .map((u) => conversation.focusUtterance(u.speaker, u.text))
          .join("\n")

    await conversation.sendMessage(
      content,
      (delta) => broadcast({ type: "claude_chunk", delta }),
      () => {
        isProcessing = false
        broadcast({ type: "claude_done" })
      },
    )
  }

  return async function handleMessage(
    msg: { type: string; id?: string; text?: string },
    utterances: Map<string, Utterance>,
    broadcast: BroadcastFn,
  ) {
    try {
      if (msg.type === "focus") {
        const utt = utterances.get(msg.id!)
        if (!utt) return

        // Add to batch and reset the timer — wait for more clicks
        focusBatch.push(utt)

        if (focusTimer) clearTimeout(focusTimer)
        focusTimer = setTimeout(() => sendBatch(broadcast), batchDelayMs)
      }

      if (msg.type === "message") {
        // Typed message flushes any pending focus batch immediately
        if (focusTimer) {
          clearTimeout(focusTimer)
          focusTimer = null
          focusBatch = []
        }

        abortIfProcessing(broadcast)

        isProcessing = true
        await conversation.sendMessage(
          msg.text!,
          (delta) => broadcast({ type: "claude_chunk", delta }),
          () => {
            isProcessing = false
            broadcast({ type: "claude_done" })
          },
        )
      }

      if (msg.type === "stop") {
        if (focusTimer) {
          clearTimeout(focusTimer)
          focusTimer = null
          focusBatch = []
        }
        conversation.stop()
        isProcessing = false
      }
    } catch (err) {
      console.error("WebSocket message error:", err)
      isProcessing = false
    }
  }
}
