"use client"

import { useState, useCallback } from "react"

export function useCopyClipboard(resetDelay = 2000) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), resetDelay)
      } catch {
        setCopied(false)
      }
    },
    [resetDelay],
  )

  return { copied, copy }
}
