"use client"

import { useState, type KeyboardEvent } from "react"
import { Send } from "lucide-react"

interface ChatInputProps {
  onSend: (text: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("")

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue("")
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex items-center gap-2 border-t border-steel-700 bg-steel-900 p-4">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        disabled={disabled}
        className="flex-1 rounded-lg border border-steel-600 bg-steel-800 px-4 py-2 text-sm text-white placeholder-steel-500 outline-none focus:border-steel-400"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="rounded-lg bg-steel-500 p-2 text-white transition-colors hover:bg-steel-400 disabled:opacity-40 cursor-pointer"
        aria-label="Send message"
      >
        <Send size={18} />
      </button>
    </div>
  )
}
