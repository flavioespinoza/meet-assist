import { watch } from "chokidar"
import fs from "fs"
import path from "path"

export interface Utterance {
  speaker: string
  text: string
  timestamp: number
  id: string
}

type UtteranceCallback = (utterance: Utterance) => void

export function watchTranscript(onUtterance: UtteranceCallback) {
  const transcriptPath = path.join(process.cwd(), "transcript.jsonl")
  let lineCount = 0
  let uttCount = 0

  // Count existing lines on startup so we only emit new ones
  if (fs.existsSync(transcriptPath)) {
    const existing = fs.readFileSync(transcriptPath, "utf-8")
    lineCount = existing.split("\n").filter(Boolean).length
  }

  const watcher = watch(transcriptPath, {
    persistent: true,
    usePolling: true,
    interval: 300,
  })

  watcher.on("change", () => {
    if (!fs.existsSync(transcriptPath)) return
    const content = fs.readFileSync(transcriptPath, "utf-8")
    const lines = content.split("\n").filter(Boolean)

    // Process only new lines
    for (let i = lineCount; i < lines.length; i++) {
      try {
        const parsed = JSON.parse(lines[i])
        uttCount++
        const utterance: Utterance = {
          speaker: parsed.speaker || `Speaker_${parsed.channel || 0}`,
          text: parsed.text || parsed.transcript || "",
          timestamp: parsed.timestamp || Date.now() / 1000,
          id: `utt_${String(uttCount).padStart(3, "0")}`,
        }
        onUtterance(utterance)
      } catch {
        // skip malformed lines
      }
    }

    lineCount = lines.length
  })

  return watcher
}
