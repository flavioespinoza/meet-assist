# NOTE: Mercor JSON Type Registry

v1 | Mar 11 2026 - (MST)

Every type of JSON this project produces, consumes, or needs. Each type has a name, schema, and example path. This registry feeds the real-time sprint analysis tool — every type listed here is something the tool must be able to parse and display.

---

## Critical Constraint: Insightful Monitoring + Dual-Machine Split

**The MacBook runs Insightful** — a monitoring app that watches for AI usage. Flavio cannot visibly use AI on the MacBook. The MacBook is a clean room: Flavio types prompts, runs the two models (A and B), and that's it. All AI assistance, analysis, and tooling runs on the iMac where Insightful can't see it.

**This means the sprint tool runs on the iMac but consumes data generated on the MacBook.**

### Current Workflow (Manual)

```txt
MacBook (Insightful monitored)          iMac (command center)
─────────────────────────────           ─────────────────────
1. Flavio types prompt into
   Model A terminal
2. Model A works, appends to
   ~/.claude/projects/.../model_a/
   {uuid}.jsonl
3. Turn ends
                                        4. Claude on iMac runs:
                                           scp macbook:~/.claude/projects/
                                             .../{uuid}.jsonl /tmp/session-A.jsonl
                                        5. jsonl-to-json.ts converts turn data
                                        6. Claude analyzes the turn
                                        7. Claude drafts next prompt ideas
                                        8. Flavio reads on iMac, memorizes
9. Flavio types next prompt
   into MacBook terminal
```

Steps 4-7 happen manually today — Flavio tells Claude to pull and convert after each turn. The sprint tool automates this.

### Target Workflow (Automated Sprint Tool)

The sprint tool engine runs on the iMac. The MacBook runs **zero AI** — not even in the background. The only thing that may run on the MacBook is a dumb file watcher (pure file I/O, no AI, no API calls, no analysis). Insightful looks for AI tools, browsers hitting AI sites, Claude Code UI — a Node script tailing a local file is invisible to it.

**Option A: SSH tail from iMac (recommended — zero MacBook footprint)**

The iMac opens a persistent SSH stream that tails the JSONL file. Every new line appears on the iMac instantly. Nothing runs on the MacBook at all — just a standard SSH connection.

```bash
ssh macbook "tail -f ~/.claude/projects/.../{uuid}.jsonl"
```

The iMac-side tool reads from this stream, parses each JSON line, and feeds it into the UI. Near-real-time, no MacBook-side code, works with existing SSH config (`ssh macbook`).

**Option B: MacBook-side dumb watcher + WebSocket push**

A lightweight Node script on the MacBook (chokidar, same as meet-assist uses) watches the JSONL and pushes raw JSON objects over WebSocket to the iMac. No AI involved — it's a pipe, not an engine. The iMac's sprint tool receives and displays them.

```txt
MacBook                                    iMac
────────                                   ────
chokidar watcher (pure file I/O)           Browser (localhost:3000)
  ↓ new JSONL lines detected                ↑ WebSocket connection
  ↓                                          │
  └→ WebSocket push ───────────────────────→─┘
     (raw JSON objects only)
```

This is faster than Option A (no SSH overhead per line) but requires a script running on the MacBook. The script does NO analysis, NO AI calls — it just reads a file and forwards bytes. Insightful should not flag this, but Option A is safer if there's any doubt.

**Option C: Polling via scp**

The iMac periodically SSHs into the MacBook, checks the JSONL file size, and pulls new data when it grows. Simple but introduces 10-20 second latency per poll cycle.

```txt
iMac tool (every 10-20 seconds):
  1. ssh macbook "wc -c ~/.claude/projects/.../{uuid}.jsonl"
  2. If file grew since last check → scp the file
  3. Parse only new lines (track byte offset)
  4. Display new entries in the UI
```

**Option D: Shared filesystem (SMB/NFS)**

Mount a shared directory between the machines. The MacBook writes JSONL to a path the iMac can read directly. No scp, no SSH tailing. Latency depends on the mount. Requires one-time SMB/NFS setup.

**Recommendation:** Start with Option A (`ssh tail -f`). Zero MacBook footprint, instant data, no setup beyond existing SSH config. If you need structured transport (e.g., the tool wants to push converted JSON rather than raw JSONL), move to Option B — the meet-assist codebase already has the WebSocket + chokidar pattern ready to copy.

### What Can and Cannot Run on the MacBook

```txt
✅ ALLOWED on MacBook:
  - Claude Code terminals (Model A and Model B) — that's the whole point
  - A dumb file watcher (chokidar/tail) that reads JSONL — pure I/O
  - SSH daemon (already running) — so iMac can connect
  - The HTML sprint startup tool (merc-sprint.html) — static HTML, no AI

❌ NOT ALLOWED on MacBook:
  - Any AI engine, Claude instance, or LLM API call
  - Any analysis, scoring, or evaluation logic
  - Any connection to Anthropic/OpenAI/Gemini APIs
  - The sprint analysis tool itself — that's iMac only
  - Any visible AI-related UI or browser tab
```

### What the Tool Displays on the iMac

```txt
┌─────────────────────────────────┬──────────────────────┐
│  Chat (Flavio ↔ Claude)        │  Live Session Feed   │
│                                 │                      │
│  "Model A just skipped the     │  [Model A — Turn 2]  │
│   benchmark phase. It read     │  ├ user: prompt text  │
│   the prompt but only did      │  ├ assistant: ...     │
│   the filter implementation."  │  ├ tool_use: Read     │
│                                 │  ├ tool_use: Write   │
│  > "Did B do the benchmark?"   │  ├ tool_use: Bash    │
│                                 │  └ assistant: done   │
│                                 │                      │
│                                 │  [Model B — Turn 2]  │
│                                 │  ├ user: prompt text  │
│                                 │  ├ assistant: ...     │
│                                 │  ├ tool_use: Read     │
│                                 │  └ (still working...) │
│                                 │                      │
│                                 │  ⚠ ALERT: Model A   │
│                                 │    skipped Phase 2   │
└─────────────────────────────────┴──────────────────────┘
```

The left panel is a chat interface (like meet-assist) where Flavio discusses the sprint with Claude. The right panel is the live session feed — parsed JSONL entries from both models, color-coded, with automatic alerts when something looks wrong (skipped phases, excessive tool calls, subagent spawning, model ignoring instructions).

**The key insight:** This is exactly what happened on the last sprint — a model skipped Phase 2 and Flavio didn't catch it until after the sprint. The tool catches it in real time by comparing the prompt instructions against what the model actually did.

---

## Tool Modes: Mercor, Marlin, Terminus

The sprint tool has three modes. Same architecture (meet-assist pattern), same JSONL format, different workflows and session paths.

### Mode 1: Mercor Sprint

- **What:** Iterative AB model evaluation. Flavio types prompts into Model A and Model B. 95-minute sprint with multiple turns.
- **Where models run:** MacBook — two Claude Code terminals, one per model
- **Session JSONL path:** `~/.claude/projects/-Users-flavio-merc-TASK-{ID}-model-{a|b}/{uuid}.jsonl`
- **Prompt flow:** Flavio types the same prompt into both A and B terminals. Between turns, the iMac analyzes results and Gemini generates next prompts, which get humanized before Flavio types them.
- **Timer:** 95 minutes

### Mode 2: Marlin (HFI)

- **What:** Human Feedback Interface testing. A "daddy prompt" script runs in a Mac Terminal — it spins up Model A and Model B in two separate VS Code windows.
- **Where models run:** MacBook — VS Code windows (each is a clone of the repo). Insightful monitors everything, so no GitHub Copilot, no AI extensions, no browser AI tools.
- **Session start flow:**
  1. Daddy terminal runs the startup script
  2. Script creates session, spins up A and B in two VS Code windows
  3. Flavio copies Session ID for A into A's VS Code terminal
  4. Flavio copies Session ID for B into B's VS Code terminal
  5. Both models confirm ready
  6. Flavio feeds the same prompt through the daddy terminal — it routes to both A and B
  7. If one model goes sideways, Flavio keeps giving the same prompt to the one doing it right
- **Session JSONL path:** `~/.claude-hfi/projects/{project-name-encoded}/{uuid}.jsonl`
- **Key difference from Mercor:** HFI uses `~/.claude-hfi/` not `~/.claude/`. The JSONL format is the same.
- **Turns:** 4 turns (Turn 0 initial + Turns 1-3 follow-ups)
- **Timer:** 90-minute minimum (120-minute timer set)
- **Conversion tool:** `~/Portfolio/model-testing/marlin-agent/tools/jsonl-to-json.ts` (same logic as merc-task version)

### Mode 3: Terminus (Task Testing)

- **What:** Task creation for AI benchmarking. Flavio builds tasks designed to make Claude and GPT-5 fail (target: 2-3 out of 5 pass rate).
- **Where tests run:** MacBook via SSH from iMac. Five test runs against Claude, five against GPT-5.
- **Not an AB sprint:** No live prompting. Flavio designs the task on the iMac, SSHs to MacBook to run automated agent tests, then evaluates results.
- **Session data:** Standard Claude Code logs in `_logs/` (iMac side, for the design work). Test results come back from the MacBook test runs.
- **Task structure:** `~/Portfolio/term-2-task/tasks/{task-name}/`
- **What the tool does in this mode:** Displays test run results as they come in (pass/fail per run, per model). Helps Flavio assess if the task difficulty is in the sweet spot before submitting.

### Mode Comparison

| | Mercor | Marlin | Terminus |
|---|---|---|---|
| **AB testing type** | Iterative sprint | HFI session | Automated agent runs |
| **Who prompts** | Flavio types manually | Daddy terminal routes | Automated (agent runs task) |
| **Models tested** | Claude A vs Claude B | Claude A vs Claude B | Claude vs GPT-5 |
| **JSONL location** | `~/.claude/projects/` | `~/.claude-hfi/projects/` | N/A (test results) |
| **JSONL format** | Same | Same | Standard Claude Code logs |
| **Timer** | 95 min | 90 min (120 set) | No timer |
| **Turns** | Multiple (Flavio decides) | 4 fixed | 5 automated runs per model |
| **iMac role** | Analysis + humanization | Analysis + humanization | Task design + result review |

### What the Tool Needs Per Mode

**Mercor mode:** Watch `~/.claude/projects/...-model-{a|b}/` on MacBook. Display both models side by side. Alert on behavioral issues. Track turn boundaries.

**Marlin mode:** Watch `~/.claude-hfi/projects/.../` on MacBook. Same display as Mercor but account for the daddy terminal routing and the 4-turn fixed structure.

**Terminus mode:** Display test run results (pass/fail) as they complete. Show aggregate pass rates. Flag when a task is too easy (>80% pass) or too hard (<20% pass).

---

## Type 1: AB Session JSONL (Raw — MacBook)

The primary data source. Claude Code writes one JSON object per line as the model works. This is what accumulates on the MacBook during a live sprint.

**Source:** MacBook `~/.claude/projects/` directory (auto-generated by Claude Code)

**Path pattern:**

```txt
~/.claude/projects/-Users-flavio-merc-TASK-{ID}-model-{a|b}/{uuid}.jsonl
```

**Real example:**

```txt
~/.claude/projects/-Users-flavio-merc-TASK-13244-model-a/3c423438-57a9-496e-81fc-a355ccf43602.jsonl
~/.claude/projects/-Users-flavio-merc-TASK-13244-model-b/92345cc9-e91c-4b10-bb42-059eca8a97ba.jsonl
```

**Schema:** One JSON object per line. Each line has a `type` field that determines the rest of the shape.

### Entry type: `session_start`

```json
{
  "type": "session_start",
  "timestamp": "ISO 8601",
  "session_id": "uuid",
  "transcript_path": "string",
  "cwd": "/Users/flavio/mercor-task-{ID}/model_{a|b}",
  "git_metadata": {
    "base_commit": "sha string",
    "branch": "model_a | model_b",
    "timestamp": "ISO 8601"
  },
  "merged_from_sessions": ["uuid", "uuid"],
  "task_id": "TASK_{ID}",
  "model_lane": "model_a | model_b",
  "experiment_root": "/Users/flavio/mercor-task-{ID}",
  "model_name": "claude-sonnet-4-5-20250929 | string"
}
```

### Entry type: `user`

Two shapes — a direct prompt from the evaluator, or a tool result.

**User prompt:**

```json
{
  "type": "user",
  "timestamp": "ISO 8601",
  "message": {
    "role": "user",
    "content": "string (the prompt text)"
  },
  "session_id": "uuid",
  "cwd": "string",
  "uuid": "uuid",
  "task_id": "TASK_{ID}",
  "model_lane": "model_a | model_b",
  "experiment_root": "string",
  "model_name": "string",
  "original_session_id": "uuid (if merged)"
}
```

**Tool result:**

```json
{
  "type": "user",
  "timestamp": "ISO 8601",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "content": "string (tool output or error message)",
        "is_error": "boolean",
        "tool_use_id": "toolu_xxx"
      }
    ]
  },
  "session_id": "uuid",
  "cwd": "string",
  "uuid": "uuid",
  "task_id": "TASK_{ID}",
  "model_lane": "model_a | model_b",
  "model_name": "string"
}
```

### Entry type: `assistant`

```json
{
  "type": "assistant",
  "timestamp": "ISO 8601",
  "message": {
    "model": "string (model ID)",
    "id": "msg_xxx",
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "string"
      },
      {
        "type": "tool_use",
        "id": "toolu_xxx",
        "name": "Read | Edit | Write | Bash | Glob | Grep | Agent",
        "input": {}
      },
      {
        "type": "thinking",
        "thinking": "string",
        "signature": "string"
      }
    ],
    "stop_reason": "end_turn | tool_use | null",
    "stop_sequence": "string | null",
    "usage": {
      "input_tokens": "number",
      "cache_creation_input_tokens": "number",
      "cache_read_input_tokens": "number",
      "cache_creation": {
        "ephemeral_5m_input_tokens": "number",
        "ephemeral_1h_input_tokens": "number"
      },
      "output_tokens": "number",
      "service_tier": "standard | string"
    }
  },
  "session_id": "uuid",
  "cwd": "string",
  "task_id": "TASK_{ID}",
  "model_lane": "model_a | model_b",
  "model_name": "string"
}
```

**What the sprint tool needs from this type:** This is the big one. The tool watches for new lines appended to the JSONL and displays them in real time. The critical fields for sprint analysis are:

- `type` — determines what happened (user prompt vs assistant response vs tool call)
- `message.content` — the actual text or tool call details
- `message.content[].name` — which tool was used (Read, Edit, Bash, etc.)
- `message.usage` — token consumption per response
- `stop_reason` — whether the model is done or making a tool call

---

## Type 2: AB Session JSONL — Subagent

Same schema as Type 1 but lives in a subdirectory. Generated when the model spawns a subagent (Agent tool).

**Path pattern:**

```txt
~/.claude/projects/-Users-flavio-merc-TASK-{ID}-model-{a|b}/{uuid}/subagents/agent-{agent-id}.jsonl
```

**Real example:**

```txt
~/.claude/projects/-Users-flavio-merc-TASK-13244-model-b/92345cc9-e91c-4b10-bb42-059eca8a97ba/subagents/agent-a38322e2ff3a1279e.jsonl
```

**Schema:** Identical to Type 1. Every entry has `isSidechain: true` and an `agentId` field.

**What the sprint tool needs:** Flag subagent activity visually. If a model spawns a subagent, that's a behavioral observation worth noting (delegation pattern, potential for scope creep).

---

## Type 3: Converted Turn JSON (iMac)

After pulling JSONL from MacBook, the `jsonl-to-json.ts` tool slices it per turn and outputs a JSON array.

**Path pattern:**

```txt
~/Portfolio/merc-task/_local/merc-{TASK_ID}__session-{A|B}__turn-{N}.json
~/Portfolio/merc-task/_local/merc-{TASK_ID}__session-{A|B}__turn-{N}__subagent.json
```

**Real examples:**

```txt
~/Portfolio/merc-task/_local/merc-13244__session-A__turn-1.json
~/Portfolio/merc-task/_local/merc-13244__session-B__turn-1.json
~/Portfolio/merc-task/_local/merc-13244__session-B__turn-1__subagent.json
```

**Schema:** JSON array of Type 1 entries (same objects, just collected into an array and sliced to one turn).

```json
[
  { "type": "session_start", ... },
  { "type": "user", ... },
  { "type": "assistant", ... },
  { "type": "user", ... },
  ...
]
```

**What the sprint tool needs:** This is the analysis format. Gemini gets these for evaluation generation. The tool should be able to display a turn-by-turn view with entry counts, token usage totals, and tool call summaries.

---

## Type 4: Session Log JSON (Claude Code Conversations — iMac)

These are Claude Code's own session logs — the conversations between Flavio and Claude instances on the iMac. Different from AB model testing data.

**Path pattern:**

```txt
~/Portfolio/merc-task/_logs/{YYYY-MM-DD}/{instance}__{uuid-short}.json
```

**Real examples:**

```txt
~/Portfolio/merc-task/_logs/2026-03-11/claude-b__ed82d6e0.json
~/Portfolio/merc-task/_logs/2026-03-09/claude__8de0f9e5.json
```

**Schema:** JSON array of session entries.

```json
[
  {
    "type": "user | assistant | progress | file-history-snapshot | queue-operation",
    "uuid": "uuid",
    "timestamp": "ISO 8601",
    "parentUuid": "uuid | null",
    "isSidechain": "boolean",
    "userType": "string",
    "cwd": "string",
    "sessionId": "uuid",
    "version": "string",
    "gitBranch": "string",
    "message": {
      "role": "user | assistant",
      "content": "string | array"
    },
    "permissionMode": "string (user entries only)",
    "requestId": "string (assistant entries only)"
  }
]
```

**What the sprint tool needs:** This is the Flavio-Claude conversation history. Useful for recovering context ("go get your brain") but not directly part of sprint analysis.

---

## Type 5: Daily Index JSON

Registry of all Claude Code sessions for a given date.

**Path pattern:**

```txt
~/Portfolio/merc-task/_logs/{YYYY-MM-DD}/index.json
```

**Schema:**

```json
{
  "date": "YYYY-MM-DD",
  "project": "merc-task",
  "sessions": [
    {
      "file": "claude-b__ed82d6e0.json",
      "uuid": "ed82d6e0-74f7-41a9-85e5-780608d77d9a",
      "instance": "claude-b",
      "entries": 91,
      "images": 0,
      "summary": "string"
    }
  ]
}
```

**What the sprint tool needs:** Quick lookup — which instances were active today, how many entries each.

---

## Type 6: Converter State JSON

Tracks which JSONL files have already been converted to JSON. Prevents duplicate conversions.

**Path pattern:**

```txt
~/Portfolio/merc-task/_logs/{YYYY-MM-DD}/.converter-state.json
```

**Schema:**

```json
{
  "converted": {
    "{uuid}": {
      "uuid": "uuid",
      "sourceSize": 12345,
      "convertedAt": "ISO 8601"
    }
  }
}
```

**What the sprint tool needs:** Nothing directly. This is internal bookkeeping for the JSONL-to-JSON converter.

---

## Type 7: Training Website Content

Scraped pages from the platform's training website, stored as a JSON array. This is what term-2-task already has — merc-task needs its own version.

**Path pattern (target):**

```txt
~/Portfolio/merc-task/_docs/merc__training-website--all-docs.json
```

**Schema:**

```json
[
  {
    "file": "getting-started/welcome.md",
    "status": 200,
    "content": "# Welcome to Mercor\n\nFull markdown content of the page..."
  },
  {
    "file": "evaluation/scoring-rubric.md",
    "status": 200,
    "content": "# Scoring Rubric\n\n..."
  }
]
```

**Status:** Does not exist yet. Needs to be scraped from Mercor's training/documentation website.

**What the sprint tool needs:** Full-text search across all training docs. When a question comes up during a sprint ("what counts as a blocking behavioral issue?"), the tool searches this JSON and surfaces the answer.

---

## Type 8: Tribal Knowledge JSON

Screenshots and Slack messages that get OCR'd and converted to structured JSON. Currently the `tribal-knowledge/` directory exists but is empty.

**Path pattern (target):**

```txt
~/Portfolio/merc-task/tribal-knowledge/{topic-name}.json
```

**Schema (proposed):**

```json
{
  "source": "slack | screenshot | email | pdf",
  "captured_at": "ISO 8601",
  "original_file": "screenshot-2026-03-11.png",
  "content": "Full text extracted from the source",
  "tags": ["behavioral-issues", "client-directive", "scoring"],
  "context": "Description of where this came from and why it matters"
}
```

**Status:** Schema proposed, not yet implemented. When tribal knowledge starts flowing in, this is the target format.

**What the sprint tool needs:** Same as training website — full-text search. Tribal knowledge fills the gaps that official docs don't cover (Slack directives, reviewer feedback patterns, client preferences).

---

## Type 9: AirTable Submission Form Data

The evaluation form Flavio fills out after each sprint. Currently typed manually into AirTable. A JSON representation would let the sprint tool pre-populate fields.

**Path pattern (target):**

```txt
~/Portfolio/merc-task/merc-{TASK_ID}/submission.json
```

**Schema (from SPEC__merc--task-submission-form):**

```json
{
  "task_id": "TASK_{ID}",
  "general": {
    "repo_name": "string",
    "repo_url": "https://github.com/...",
    "primary_language": "C++ | TypeScript | Python | ...",
    "category": "string",
    "type": "iterative | one-shot",
    "initial_prompt": "string (min 100 words)",
    "task_goal": "string"
  },
  "behavioral_issues": [
    {
      "model": "A | B",
      "category": "string (1 of 12 categories)",
      "severity": "Blocking | Major | Minor | Observation",
      "transcript_reference": "string (quoted from session)",
      "description": "string"
    }
  ],
  "model_a": {
    "task_success": 1,
    "task_success_comments": "string",
    "interaction_quality": 1,
    "interaction_quality_comments": "string",
    "code_quality": 1,
    "code_quality_comments": "string"
  },
  "model_b": {
    "task_success": 1,
    "task_success_comments": "string",
    "interaction_quality": 1,
    "interaction_quality_comments": "string",
    "code_quality": 1,
    "code_quality_comments": "string"
  },
  "comparative": {
    "preferred_model": "A | B | tie",
    "preference_rating": "0-7",
    "preference_comments": "string"
  }
}
```

**Status:** Schema derived from the submission form spec. Not yet implemented as JSON — Flavio types into AirTable manually.

**What the sprint tool needs:** Pre-populate this from session analysis. After the sprint, the tool should have enough data from Types 1-3 to draft behavioral issues, suggest scores, and generate comment stubs for humanization.

---

## Type 10: Claude Settings JSON

Project permissions for Claude Code instances.

**Path pattern:**

```txt
~/Portfolio/merc-task/.claude/settings.json
~/Portfolio/merc-task/.claude/settings.local.json
```

**Schema:**

```json
{
  "permissions": {
    "allow": ["Bash(npm:*)", "Read", "Edit", "Write", "..."],
    "deny": ["Edit(~/.zkeys)", "Write(~/.ssh/**)"],
    "additionalDirectories": ["/Users/flavio", "/tmp"]
  }
}
```

**What the sprint tool needs:** Nothing. This is Claude Code config, not sprint data.

---

## Summary Table

| # | Type | Status | Live Sprint? | Path Pattern |
|---|------|--------|--------------|-------------|
| 1 | AB Session JSONL | Active | **YES — primary** | `~/.claude/projects/...-model-{a|b}/{uuid}.jsonl` |
| 2 | AB Subagent JSONL | Active | **YES** | `.../{uuid}/subagents/agent-{id}.jsonl` |
| 3 | Converted Turn JSON | Active | Post-turn | `_local/merc-{ID}__session-{A|B}__turn-{N}.json` |
| 4 | Session Log JSON | Active | No | `_logs/{date}/{instance}__{uuid}.json` |
| 5 | Daily Index JSON | Active | No | `_logs/{date}/index.json` |
| 6 | Converter State JSON | Active | No | `_logs/{date}/.converter-state.json` |
| 7 | Training Website JSON | **NOT YET** | Reference | `_docs/merc__training-website--all-docs.json` |
| 8 | Tribal Knowledge JSON | **NOT YET** | Reference | `tribal-knowledge/{topic}.json` |
| 9 | AirTable Submission JSON | **NOT YET** | Post-sprint | `merc-{ID}/submission.json` |
| 10 | Claude Settings JSON | Active | No | `.claude/settings.json` |

---

## What the Sprint Tool Needs in Real Time

During a live 95-minute sprint, the tool watches **Types 1 and 2** (AB Session JSONL on MacBook). Every new line appended to the JSONL triggers the tool to:

1. Parse the JSON object
2. Determine the entry type (`user`, `assistant`, `tool_use`, etc.)
3. Display it in the right panel (like meet-assist's transcript panel)
4. Flag behavioral issues automatically (model not following instructions, skipping phases, excessive tool calls, subagent spawning)
5. Track token usage and tool call counts per turn

Between turns, Types 3 and 7-8 become relevant — the converted turn data feeds Gemini for evaluation, and training docs + tribal knowledge answer "what does the rubric say about this?" questions.

After the sprint, Type 9 gets populated from everything above.
