import { WebSocketServer, WebSocket } from "ws"
import { watchTranscript, type Utterance } from "./transcript-watcher"
import { UtteranceConsolidator } from "./utterance-consolidator"
import { ClaudeConversation } from "./claude-conversation"

const PORT = 3001

const wss = new WebSocketServer({ port: PORT })
const conversation = new ClaudeConversation()

// Store utterances so we can look them up by id
const utterances = new Map<string, Utterance>()

// Track whether Claude is currently streaming a response
let isClaudeBusy = false

// Auto-watch: automatically send non-Flavio utterances to Claude
let autoWatch = true

// Flavio's speaker label (detected from first "message" or configurable)
const FLAVIO_SPEAKERS = new Set(["Speaker_0"])

function broadcast(data: object) {
  const message = JSON.stringify(data)
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}

function broadcastUtterance(utterance: Utterance) {
  utterances.set(utterance.id, utterance)
  broadcast({
    type: "utterance",
    speaker: utterance.speaker,
    text: utterance.text,
    timestamp: utterance.timestamp,
    id: utterance.id,
  })
}

async function sendToClaudeAndBroadcast(content: string) {
  if (isClaudeBusy) return
  isClaudeBusy = true
  broadcast({ type: "claude_busy", busy: true })
  try {
    await conversation.sendMessage(
      content,
      (delta) => broadcast({ type: "claude_chunk", delta }),
      () => {
        broadcast({ type: "claude_done" })
        isClaudeBusy = false
        broadcast({ type: "claude_busy", busy: false })
      },
    )
  } catch {
    isClaudeBusy = false
    broadcast({ type: "claude_busy", busy: false })
  }
}

// Consolidator groups same-speaker utterances before broadcasting
const consolidator = new UtteranceConsolidator((utterance) => {
  broadcastUtterance(utterance)

  // Auto-watch: if the utterance is from the interviewer (not Flavio),
  // automatically send it to Claude for analysis
  if (autoWatch && !FLAVIO_SPEAKERS.has(utterance.speaker)) {
    const content = conversation.focusUtterance(
      utterance.speaker,
      utterance.text,
    )
    sendToClaudeAndBroadcast(content)
  }
})

// Watch transcript.jsonl for new utterances — feed through consolidator
watchTranscript((utterance) => {
  consolidator.add(utterance)
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

  // Send current auto-watch state
  ws.send(JSON.stringify({ type: "auto_watch", enabled: autoWatch }))

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString())

      if (msg.type === "focus") {
        const utt = utterances.get(msg.id)
        if (!utt) return
        const content = conversation.focusUtterance(utt.speaker, utt.text)
        await sendToClaudeAndBroadcast(content)
      }

      if (msg.type === "message") {
        await sendToClaudeAndBroadcast(msg.text)
      }

      if (msg.type === "stop") {
        conversation.stop()
        isClaudeBusy = false
      }

      if (msg.type === "set_auto_watch") {
        autoWatch = !!msg.enabled
        broadcast({ type: "auto_watch", enabled: autoWatch })
        console.log(`Auto-watch ${autoWatch ? "enabled" : "disabled"}`)
      }

      if (msg.type === "set_flavio_speaker") {
        // Allow the UI to tell us which speaker is Flavio
        FLAVIO_SPEAKERS.add(msg.speaker)
        console.log(`Flavio speakers: ${[...FLAVIO_SPEAKERS].join(", ")}`)
      }
    } catch (err) {
      console.error("WebSocket message error:", err)
    }
  })

  ws.on("close", () => {
    console.log("Client disconnected")
  })
})

console.log(`WebSocket server running on ws://localhost:${PORT}`)
