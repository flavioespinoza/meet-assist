#!/usr/bin/env bash
#
# watcher.sh — Watches transcript.jsonl for new lines and feeds them
# to Claude Code for real-time responses.
#
# Usage: ./src/watcher.sh
#
# Protocol commands (type in the terminal while watcher is running):
#   STOP   — Ignore last input, reset context
#   EXPAND — Give full explanation of last response
#   [text] — Manual input override

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TRANSCRIPT_FILE="${PROJECT_ROOT}/transcript.jsonl"
CONTEXT_DIR="${PROJECT_ROOT}/src/context"

# Create transcript file if it doesn't exist
touch "$TRANSCRIPT_FILE"

# Track line count for tailing new lines only
LAST_LINE=0
if [ -f "$TRANSCRIPT_FILE" ]; then
    LAST_LINE=$(wc -l < "$TRANSCRIPT_FILE" | tr -d ' ')
fi

echo "=== meet-assist watcher ==="
echo "Watching: $TRANSCRIPT_FILE"
echo "Starting from line: $LAST_LINE"
echo ""
echo "Protocol commands:"
echo "  STOP   — Reset, ignore last input"
echo "  EXPAND — Full explanation of last response"
echo "  [text] — Manual input override"
echo ""
echo "Waiting for new utterances..."

# Build context preamble from spec files
CONTEXT=""
for f in "$CONTEXT_DIR"/*; do
    if [ -f "$f" ]; then
        CONTEXT="${CONTEXT}\n--- $(basename "$f") ---\n$(cat "$f")\n"
    fi
done

LAST_RESPONSE=""

process_utterance() {
    local line="$1"
    local speaker text

    speaker=$(echo "$line" | python3 -c "import sys,json; print(json.load(sys.stdin)['speaker'])" 2>/dev/null || echo "unknown")
    text=$(echo "$line" | python3 -c "import sys,json; print(json.load(sys.stdin)['text'])" 2>/dev/null || echo "")

    if [ -z "$text" ]; then
        return
    fi

    echo ""
    echo "────────────────────────────────────"
    echo "[$speaker]: $text"
    echo "────────────────────────────────────"

    # Only generate responses for questions/requirements from the interviewer
    # Skip conversational filler and Flavio's own speech
    local prompt
    prompt="You are a real-time meeting assistant. You have the following project context:
${CONTEXT}

A speaker just said:
[$speaker]: $text

Rules:
1. If this is conversational filler (greetings, 'yeah', 'okay', 'sure', 'right'), respond with just: [no response needed]
2. If the speaker is asking a technical question or stating a requirement, give a concise, specific answer.
3. Keep responses SHORT — this is a teleprompter. 2-4 sentences max.
4. Reference specific details from the project context when relevant.
5. Format for quick reading — no markdown headers, no bullet lists longer than 3 items."

    LAST_RESPONSE=$(echo "$prompt" | claude --print 2>/dev/null || echo "[Claude unavailable]")

    if [ "$LAST_RESPONSE" != "[no response needed]" ] && [ "$LAST_RESPONSE" != "[Claude unavailable]" ]; then
        echo ""
        echo ">>> Claude:"
        echo "$LAST_RESPONSE"
        echo ""
    fi
}

handle_command() {
    local cmd="$1"
    case "$cmd" in
        STOP)
            echo "[STOP] Resetting — ignoring last input."
            LAST_RESPONSE=""
            ;;
        EXPAND)
            if [ -n "$LAST_RESPONSE" ]; then
                local expand_prompt="Expand on this previous response with full detail:\n\n$LAST_RESPONSE"
                echo ""
                echo ">>> Claude (expanded):"
                echo "$expand_prompt" | claude --print 2>/dev/null || echo "[Claude unavailable]"
                echo ""
            else
                echo "[EXPAND] No previous response to expand."
            fi
            ;;
        *)
            # Manual input — send directly to Claude
            local manual_prompt="You are a real-time meeting assistant. Context:\n${CONTEXT}\n\nManual input from user: $cmd\n\nRespond concisely (2-4 sentences)."
            echo ""
            echo ">>> Claude (manual):"
            echo "$manual_prompt" | claude --print 2>/dev/null || echo "[Claude unavailable]"
            echo ""
            ;;
    esac
}

# Read user commands in background
read_commands() {
    while IFS= read -r cmd; do
        if [ -n "$cmd" ]; then
            handle_command "$cmd"
        fi
    done
}
read_commands &
CMD_PID=$!

cleanup() {
    kill "$CMD_PID" 2>/dev/null || true
    echo "Watcher stopped."
    exit 0
}
trap cleanup SIGINT SIGTERM

# Watch for new lines in transcript.jsonl using polling
# (fswatch can be used as a drop-in replacement on macOS)
while true; do
    CURRENT_LINES=$(wc -l < "$TRANSCRIPT_FILE" | tr -d ' ')
    if [ "$CURRENT_LINES" -gt "$LAST_LINE" ]; then
        # Process each new line
        tail -n +"$((LAST_LINE + 1))" "$TRANSCRIPT_FILE" | head -n "$((CURRENT_LINES - LAST_LINE))" | while IFS= read -r line; do
            if [ -n "$line" ]; then
                process_utterance "$line"
            fi
        done
        LAST_LINE=$CURRENT_LINES
    fi
    sleep 0.5
done
