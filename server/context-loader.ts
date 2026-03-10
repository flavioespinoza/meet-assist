import fs from "fs"
import path from "path"

const CONTEXT_DIR = path.join(process.cwd(), "src", "context")

export function loadContextFiles(): string {
  if (!fs.existsSync(CONTEXT_DIR)) {
    return ""
  }

  const files = fs.readdirSync(CONTEXT_DIR).sort()
  const sections: string[] = []

  for (const file of files) {
    const filePath = path.join(CONTEXT_DIR, file)
    const stat = fs.statSync(filePath)
    if (stat.isFile()) {
      const content = fs.readFileSync(filePath, "utf-8")
      sections.push(`--- ${file} ---\n${content}`)
    }
  }

  return sections.join("\n\n")
}
