"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { ChatPanel, type ChatMsg } from "@/components/chat-panel"
import { LiveStream } from "@/components/live-stream"

interface Utterance {
  id: string
  speaker: string
  text: string
  timestamp: number
}

export default function Home() {
  const [utterances, setUtterances] = useState<Utterance[]>([])
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [streamingContent, setStreamingContent] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [speakerMap, setSpeakerMap] = useState<Map<string, number>>(new Map())
  const wsRef = useRef<WebSocket | null>(null)

  const assignSpeakerIndex = useCallback(
    (speaker: string) => {
      setSpeakerMap((prev) => {
        if (prev.has(speaker)) return prev
        const next = new Map(prev)
        next.set(speaker, next.size)
        return next
      })
    },
    [],
  )

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001")
    wsRef.current = ws

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === "utterance") {
        assignSpeakerIndex(data.speaker)
        setUtterances((prev) => {
          if (prev.some((u) => u.id === data.id)) return prev
          return [
            ...prev,
            {
              id: data.id,
              speaker: data.speaker,
              text: data.text,
              timestamp: data.timestamp,
            },
          ]
        })
      }

      if (data.type === "claude_chunk") {
        setStreamingContent((prev) => prev + data.delta)
      }

      if (data.type === "claude_done") {
        setStreamingContent((prev) => {
          // Only commit to messages if there's actual content (not an aborted stream)
          if (prev.trim()) {
            setMessages((msgs) => [
              ...msgs,
              { role: "assistant", content: prev },
            ])
          }
          return ""
        })
        setIsStreaming(false)
      }
    }

    ws.onclose = () => {
      console.log("WebSocket disconnected")
    }

    return () => {
      ws.close()
    }
  }, [assignSpeakerIndex])

  function sendMessage(text: string) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    setMessages((prev) => [...prev, { role: "user", content: text }])
    setIsStreaming(true)
    wsRef.current.send(JSON.stringify({ type: "message", text }))
  }

  function handleUtteranceClick(utterance: Utterance) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    setMessages((prev) => [
      ...prev,
      {
        role: "transcript",
        content: utterance.text,
        speaker: utterance.speaker,
      },
    ])
    setIsStreaming(true)
    wsRef.current.send(JSON.stringify({ type: "focus", id: utterance.id }))
  }

  return (
    <main className="flex h-screen">
      <div className="flex w-4/5 flex-col">
        <ChatPanel
          messages={messages}
          streamingContent={streamingContent}
          onSend={sendMessage}
          isStreaming={isStreaming}
        />
      </div>
      <div className="w-1/5">
        <LiveStream
          utterances={utterances}
          speakerMap={speakerMap}
          onUtteranceClick={handleUtteranceClick}
        />
      </div>
    </main>
  )
}
