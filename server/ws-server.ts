import { WebSocketServer, WebSocket } from "ws"
import { watchTranscript, type Utterance } from "./transcript-watcher"
import { ClaudeConversation } from "./claude-conversation"

const PORT = 3001

const wss = new WebSocketServer({ port: PORT })
const conversation = new ClaudeConversation()

// Store utterances so we can look them up by id
const utterances = new Map<string, Utterance>()

// Prevent concurrent Claude requests — abort current before starting new
let isProcessing = false

function broadcast(data: object) {
  const message = JSON.stringify(data)
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}

// Watch transcript.jsonl for new utterances
watchTranscript((utterance) => {
  utterances.set(utterance.id, utterance)
  broadcast({
    type: "utterance",
    speaker: utterance.speaker,
    text: utterance.text,
    timestamp: utterance.timestamp,
    id: utterance.id,
  })
})

wss.on("connection", (ws) => {
  console.log("Client connected")

  // Send existing utterances to new clients
  for (const utt of utterances.values()) {
    ws.send(
      JSON.stringify({
        type: "utterance",
        speaker: utt.speaker,
        text: utt.text,
        timestamp: utt.timestamp,
        id: utt.id,
      }),
    )
  }

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString())

      if (msg.type === "focus") {
        const utt = utterances.get(msg.id)
        if (!utt) return

        // Abort any in-flight Claude response before starting a new one
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
        // Abort any in-flight Claude response before starting a new one
        if (isProcessing) {
          conversation.stop()
          broadcast({ type: "claude_done" })
        }

        isProcessing = true
        await conversation.sendMessage(
          msg.text,
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
  })

  ws.on("close", () => {
    console.log("Client disconnected")
  })
})

console.log(`WebSocket server running on ws://localhost:${PORT}`)
