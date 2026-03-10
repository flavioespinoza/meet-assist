import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Meet Assist",
  description: "Live meeting assistant with Claude",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-steel-950 text-white min-h-screen">{children}</body>
    </html>
  )
}
