"use client"

import { useEffect, useRef } from "react"
import { ChatCard } from "./chat-card"

interface Utterance {
  id: string
  speaker: string
  text: string
  timestamp: number
}

interface LiveStreamProps {
  utterances: Utterance[]
  speakerMap: Map<string, number>
  onUtteranceClick: (utterance: Utterance) => void
}

export function LiveStream({
  utterances,
  speakerMap,
  onUtteranceClick,
}: LiveStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el || userScrolledUp.current) return
    el.scrollTop = el.scrollHeight
  }, [utterances])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    userScrolledUp.current = !atBottom
  }

  return (
    <div className="flex h-full flex-col border-l border-steel-700">
      <div className="border-b border-steel-700 px-4 py-3">
        <h2 className="text-sm font-medium text-steel-300">Live Stream</h2>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 space-y-2 overflow-y-auto p-3"
      >
        {utterances.map((utt) => (
          <ChatCard
            key={utt.id}
            speaker={utt.speaker}
            text={utt.text}
            speakerIndex={speakerMap.get(utt.speaker) ?? 0}
            onClick={() => onUtteranceClick(utt)}
          />
        ))}
      </div>
    </div>
  )
}
