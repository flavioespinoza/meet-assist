import { WebSocketServer, WebSocket } from "ws"
import { watchTranscript, type Utterance } from "./transcript-watcher"
import { ClaudeConversation } from "./claude-conversation"
import { createMessageHandler, type BroadcastFn } from "./message-handler"

const PORT = 3001

const wss = new WebSocketServer({ port: PORT })
const conversation = new ClaudeConversation()
const handler = createMessageHandler(conversation)

// Store utterances so we can look them up by id
const utterances = new Map<string, Utterance>()

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
    const msg = JSON.parse(raw.toString())
    await handler(msg, utterances, broadcast)
  })

  ws.on("close", () => {
    console.log("Client disconnected")
  })
})

console.log(`WebSocket server running on ws://localhost:${PORT}`)
