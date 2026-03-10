"use client"

import { cn } from "@/lib/utils"

interface ChatMessageProps {
  role: "user" | "assistant" | "transcript"
  content: string
  speaker?: string
}

export function ChatMessage({ role, content, speaker }: ChatMessageProps) {
  if (role === "transcript") {
    return (
      <div className="mx-4 my-2">
        <div className="rounded-lg border border-steel-600 bg-steel-800/50 p-3">
          <span className="text-steel-400 text-xs font-medium">
            Meeting — {speaker}
          </span>
          <p className="mt-1 text-sm text-steel-200">&ldquo;{content}&rdquo;</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "mx-4 my-2 flex",
        role === "user" ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3 text-sm leading-relaxed",
          role === "user"
            ? "bg-steel-600 text-white"
            : "bg-steel-800 text-steel-100",
        )}
      >
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  )
}
