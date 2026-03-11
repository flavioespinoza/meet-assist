# NOTES: Universal JSON Viewer — Brainstorm

**Date:** Mar 11, 2026
**Status:** Brainstorm / Pre-Spec
**Context:** meet-assist frontend, extensible to multiple projects

---

## The Ask

I want to load different types of JSON arrays and have them render as scrollable cards in the right sidebar panel. The left panel stays as a chat with Claude so we can discuss what we're viewing — sprint sessions, session logs, A/B model testing reports, anything.

The first mode is `trm2` (TerminalBench). Example JSON object:

```json
{
  "file": "getting-started/welcome.md",
  "status": 200,
  "content": "# Welcome to TerminalBench\n\nYou've joined a community of experts..."
}
```

The use case: I do A/B model testing and need to go through logs to write reports. I want Claude to help me review and discuss the content card-by-card.

Each project has specific needs. I need each project's Claude to look at its JSON arrays for sessions, A/B model testing, website JSON arrays, etc., and give me all the unique needs plus a spec or schema of the JSON objects in the different types of arrays that will be viewed in this new viewer capability.

---

## Questions for Each Project

> **Each project must answer these before we write a spec.**

1. **What files will each project provide, by filename and path?** Include cases where multiple files of the same type exist.

2. **Which fields in each file are required versus optional** for your use cases?

3. **How should conflicts be resolved** when multiple files contain the same `id` entries?

4. **Which fields should drive card titles, subtitles, and badges?**

5. **Do you require versioning for schemas and data?** If so, how will versions be expressed?

6. **Are there additional event types or metadata keys** we should normalize across projects?

7. **What format should `confidenceScore` and `outcome` take** for A/B comparisons?

8. **What is the expected refresh cadence** for local JSON sources?

9. **How should user permissions and access control be represented**, if needed?

---

## Initial Response — Architecture Brainstorm

**Current layout stays the same** — left panel is chat with Claude ("Markor"), right panel is the card sidebar. But instead of only showing live transcript utterances, the right panel becomes **mode-aware**.

### Mode: `trm2`

- You feed it a JSON array of objects (file path, status, markdown content)
- Each object renders as a scrollable card in the right sidebar
- Click a card to inject it into the chat context so you can discuss it with Markor
- You're reviewing TerminalBench session logs, doing A/B model comparisons, writing reports with Claude's help

### The Broader Pattern

| Piece | Description |
|-------|-------------|
| **Mode system** | A route or toggle that tells the right panel what kind of data to render (`live` = current transcript, `trm2` = doc review, future modes TBD) |
| **JSON loader** | Load from local `.json` files, populate the sidebar cards |
| **Card renderer** | Each mode can define how a card looks — `trm2` cards would render markdown content with a file path header and status badge |
| **Focus → Chat** | Clicking a card injects it into the left panel chat, labeled like `[trm2 — getting-started/welcome.md]` instead of `[Meeting — Speaker_N]` |
| **Left panel unchanged** | Still a conversation with Claude, full context, streaming responses |

### Open Design Questions

1. **Routing** — Separate page per mode (`/trm2`) or a mode switcher (tabs on the right panel)?
2. **Card content** — Render full markdown in the card, or show a preview/summary with expand-on-click?
3. **Status badge** — Should `"status": 200` show as a colored badge (green for 200, red for 4xx/5xx)?
4. **Report output** — When you and Markor write a report, where does it go? Exported as markdown? Saved to a file?

---

## Project Structure Requirements

Each project should have its own **homepage**. From there, some projects will include A/B model testing and some will not. For projects with A/B model testing, sessions must be organized by `taskId` because each task has a different ID. The homepage should surface `taskId`-linked session lists.

### JSON Source

- **Local files only.** Every project will provide at least:
  - `website_training.json`
  - `tasks.json`
  - `a_b_model_sessions.json` (per `taskId`)
- Some projects may supply **multiple files of the same type**
- Files use `snake_case` naming
- Multiple files per type are merged by array concatenation and deduplicated by `id` fields

### Routing

- Route per project using `projectSlug` at the root of the viewer
- Example: `/viewer/{projectSlug}/tasks`, `/viewer/{projectSlug}/sessions/{taskId}`

---

## Suggested Schemas

### `website_training.json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier |
| `name` | string | yes | Display name |
| `description` | string | yes | Summary text |
| `homepageUrl` | string | yes | Project homepage URL |
| `projectSlug` | string | yes | URL-safe project identifier |
| `createdAt` | string (ISO 8601) | yes | Creation timestamp |
| `updatedAt` | string (ISO 8601) | yes | Last update timestamp |
| `metadata` | object | no | Arbitrary key-value pairs |

### `tasks.json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `taskId` | string | yes | Unique task identifier |
| `title` | string | yes | Task title (drives card title) |
| `description` | string | yes | Task description |
| `status` | string | yes | Task status (drives badge) |
| `assignedTo` | string | no | Assignee identifier |
| `createdAt` | string (ISO 8601) | yes | Creation timestamp |
| `updatedAt` | string (ISO 8601) | yes | Last update timestamp |
| `tags` | array of strings | no | Categorization tags |
| `metadata` | object | no | Arbitrary key-value pairs |

### `a_b_model_sessions.json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | yes | Unique session identifier |
| `taskId` | string | yes | Links session to a task |
| `variant` | string | yes | A/B variant identifier (e.g., `"model_a"`, `"model_b"`) |
| `userId` | string | no | User who ran the session |
| `startedAt` | string (ISO 8601) | yes | Session start time |
| `endedAt` | string (ISO 8601) | no | Session end time |
| `durationMs` | integer | no | Duration in milliseconds |
| `events` | array of event objects | yes | Ordered list of session events |
| `outcome` | string | yes | Result of the session |
| `confidenceScore` | number | no | Confidence metric (0.0–1.0) |
| `metadata` | object | no | Arbitrary key-value pairs |

### `sessions.json` (general, non-A/B)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | yes | Unique session identifier |
| `taskId` | string | yes | Links session to a task |
| `userId` | string | no | User who ran the session |
| `startedAt` | string (ISO 8601) | yes | Session start time |
| `endedAt` | string (ISO 8601) | no | Session end time |
| `durationMs` | integer | no | Duration in milliseconds |
| `events` | array of event objects | yes | Ordered list of session events |
| `status` | string | yes | Session status |
| `metadata` | object | no | Arbitrary key-value pairs |

### Event Array Item (shared)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventType` | string | yes | Type of event |
| `timestamp` | string (ISO 8601) | yes | When the event occurred |
| `payload` | object | yes | Event-specific data |

### Metadata Field Guidance

- Flat object of arbitrary key-value pairs
- Use strings or numbers for values where possible
- Include provenance keys such as `sourceFile` and `sourceLine` when available

---

## Card Rendering Rules

- **Status badge** derived from: task `status`, session `status`, and `outcome`
- Include HTTP-style response codes where applicable (e.g., `200` = OK)
- Card fields:
  - `title` — primary display text
  - `subtitle` — secondary context
  - `timeline` — timestamps (`startedAt`, `endedAt`)
  - `badgeStatus` — derived status for color coding
  - `quickActions` — contextual actions (copy, focus, expand)

---

## Next Steps

1. **Provide actual example files** for a representative project including `website_training.json`, `tasks.json`, and `a_b_model_sessions.json`
2. **Provide any project-specific schema deviations** if they exist
3. **Answer the 9 questions above** from within each project's context
4. I will then generate the viewer schema, route structure, and card field mappings
