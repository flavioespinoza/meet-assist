import type { ClaudeConversation } from "./claude-conversation"
import type { Utterance } from "./transcript-watcher"

export type BroadcastFn = (data: object) => void

export function createMessageHandler(conversation: ClaudeConversation) {
  let isProcessing = false

  return async function handleMessage(
    msg: { type: string; id?: string; text?: string },
    utterances: Map<string, Utterance>,
    broadcast: BroadcastFn,
  ) {
    try {
      if (msg.type === "focus") {
        const utt = utterances.get(msg.id!)
        if (!utt) return

        if (isProcessing) {
          conversation.stop()
          broadcast({ type: "claude_done" })
        }

        isProcessing = true
        const content = conversation.focusUtterance(utt.speaker, utt.text)
        await conversation.sendMessage(
          content,
          (delta) => broadcast({ type: "claude_chunk", delta }),
          () => {
            isProcessing = false
            broadcast({ type: "claude_done" })
          },
        )
      }

      if (msg.type === "message") {
        if (isProcessing) {
          conversation.stop()
          broadcast({ type: "claude_done" })
        }

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
        conversation.stop()
        isProcessing = false
      }
    } catch (err) {
      console.error("WebSocket message error:", err)
      isProcessing = false
    }
  }
}
