"use client"

import { useEffect, useRef } from "react"
import { ChatMessage } from "./chat-message"
import { ChatInput } from "./chat-input"

export interface ChatMsg {
  role: "user" | "assistant" | "transcript"
  content: string
  speaker?: string
}

interface ChatPanelProps {
  messages: ChatMsg[]
  streamingContent: string
  onSend: (text: string) => void
  isStreaming: boolean
}

export function ChatPanel({
  messages,
  streamingContent,
  onSend,
  isStreaming,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, streamingContent])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-steel-700 px-4 py-3">
        <h2 className="text-sm font-medium text-steel-300">Chat with Claude</h2>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-2">
        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            role={msg.role}
            content={msg.content}
            speaker={msg.speaker}
          />
        ))}
        {isStreaming && streamingContent && (
          <ChatMessage role="assistant" content={streamingContent} />
        )}
        {isStreaming && !streamingContent && (
          <div className="mx-4 my-2 flex justify-start">
            <div className="rounded-lg bg-steel-800 px-4 py-3 text-sm text-steel-400">
              Claude is thinking...
            </div>
          </div>
        )}
      </div>
      <ChatInput onSend={onSend} disabled={isStreaming} />
    </div>
  )
}
