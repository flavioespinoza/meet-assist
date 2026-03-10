"use client"

import { Copy, Check } from "lucide-react"
import { useCopyClipboard } from "@/hooks/use-copy-clipboard"
import { cn } from "@/lib/utils"

const SPEAKER_COLORS = [
  "bg-steel-300",
  "bg-rose-300",
  "bg-sage-300",
  "bg-steel-200",
]

interface ChatCardProps {
  speaker: string
  text: string
  speakerIndex: number
  onClick: () => void
}

export function ChatCard({ speaker, text, speakerIndex, onClick }: ChatCardProps) {
  const { copied, copy } = useCopyClipboard()
  const bgColor = SPEAKER_COLORS[speakerIndex % SPEAKER_COLORS.length]

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg p-4 text-left transition-opacity hover:opacity-80 cursor-pointer",
        bgColor,
      )}
    >
      <p className="text-steel-950 text-sm leading-relaxed">{text}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-steel-800 text-xs font-medium">{speaker}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            copy(text)
          }}
          className="text-steel-700 hover:text-steel-950 transition-colors cursor-pointer"
          aria-label="Copy to clipboard"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </button>
  )
}
