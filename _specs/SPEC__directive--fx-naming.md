# SPEC: Directive — FX Naming Convention

<!-- - **Type:** `directive`
- **Subtype:** `commandment_god`
- **Target:** God Commandment #6 in `~/.claude/CLAUDE.md`
- **Boundaries:** Between `## 🚨 GOD COMMANDMENT #6:` and `## 🚨 GOD COMMANDMENT #7:`
- **Method:** Full block replacement
- **Trigger:** "sync naming conventions" -->

v9 | Mar 11 2026 - 09:45 PM (MST)

`FX` is a naming convention built for AI agents. It works for humans too, but the primary purpose is AI — preventing agents from confusing themselves at the first level of classification, where the most damage happens. Inspired by two standards: the [US National CAD Standard (NCS)](https://www.nationalcadstandard.org/ncs6/content.php) discipline designators (`A` = Architectural, `S` = Structural, `E` = Electrical) and CSS [BEM](https://getbem.com/) (`block__element--modifier`).

**The five positions:**

- **F** — **Flavio Class** — document type (`SPEC`, `DOC`, `TASK`, `NOTES`, `TEMPLATE`, `MODE`)
- **B** — **Block** — project alias (`acme`, `nova`, `bolt`, etc.)
- **E** — **Element** — document subtype or tech stack (`directive`, `workflow`, `node`, `react`)
- **M** — **Modifier** — specific topic (optional)
- **X** — **Extra** — task IDs, versions, language markers (optional)

```txt
{F}__{B}--{E}--{M}__{X}.md
```

### Why AI Needs This

AI agents are sensitive to information order. Stanford's [Lost in the Middle](https://cs.stanford.edu/~nfliu/papers/lost-in-the-middle.arxiv2023.pdf) found 30%+ performance loss based on where critical information appears in context. Agents are also people pleasers — they execute flawed requests rather than ask clarifying questions, even when the request is architecturally impossible. Give an agent "red light component" and it commits to assumptions about "red" and "light" before it even knows what kind of component you want.

`FX` eliminates that by forcing classification first. The first characters of every filename — `SPEC__`, `DOC__`, `TASK__` — act as a behavioral gate. `SPEC` locks the agent into specification mode. `DOC` locks it into documentation mode. `TASK` locks it into execution mode. The agent knows what type of work it is doing before it encounters any project-specific detail. Each position narrows the scope further: type → project → category → topic. By the time the agent has the full picture, it arrived there through a structured funnel — not guesswork.

`FX` also sorts itself. Here's what a project looks like with FX naming:

```txt
acme-project/
├── docs/
│   ├── DOC__acme--incident--api-outage.md
│   ├── DOC__acme--incident--deploy-rollback.md
│   ├── DOC__acme--session--2026-03-08.md
│   └── DOC__acme--session--2026-03-10.md
└── specs/
    ├── SPEC__acme--directive--code-review.md
    ├── SPEC__acme--engine--data-pipeline.md
    ├── SPEC__acme--workflow--onboarding.md
    └── SPEC__acme--workflow--release-cycle.md
```

All `DOC__` files cluster together. All `SPEC__` files cluster together. Within each cluster, the project alias (`acme`) groups by project, then the subtype (`incident`, `session`, `directive`, `workflow`) groups by category. A human scanning this directory reads it like a sentence: "a spec, for acme, about a workflow, specifically the release cycle." An AI agent parses the same structure programmatically and knows exactly what it is looking at before opening the file.

---

## The Format

```txt
{F}__{B}--{E}--{M}__{X}.md
```

| Position | Name | What it tells you | Required |
|----------|------|-------------------|----------|
| **F** | Flavio Class | WHAT kind of document | Yes |
| **B** | Block | Project alias OR document subtype/tech stack | Yes |
| **E** | Element | The topic | Yes |
| **M** | Modifier | Specifics (date, variant, scope) | No |
| **X** | Extra | Project scope, version, task ID, model identifier | No |

### Separators

| Symbol | Meaning | Example |
|--------|---------|---------|
| `__` | FX separator — between F↔B and before X | `SPEC__node--api-server__ts.md` |
| `--` | Within-group separator — between B↔E, E↔M | `SPEC__node--api-server--v2.md` |
| `_` | Compound word within a single position | `sol_bot`, `git_hook`, `model_a` |

**The `__` (double underscore) is sacred.** It ONLY appears in two places: after F and before X. Everything between the two `__` separators is the B-E-M chain connected by `--`.

### Minimum viable filename

Only F, B, and E are required:

```txt
SPEC__directive--fx-naming.md        ← F__B--E
DOC__session--2026-03-10.md          ← F__B--E (date IS the element here)
TASK__acme--orchestrator.md          ← F__B--E
```

With modifier:

```txt
SPEC__react--tailwind--card-grid.md  ← F__B--E--M
DOC__session--2026-03-10--morning.md ← F__B--E--M
```

With extra:

```txt
SPEC__node--api-server__ts.md                      ← F__B--E__X
TASK__acme--orchestrator__model_a--6661.md          ← F__B--E__X (compound X)
SPEC__directive--fx-naming__acme.md                 ← F__B--E__X (project scope)
```

---

## F — Flavio Class

The F position is ALWAYS uppercase. It tells you what kind of document you're looking at.

| F Class | Means | When to use |
|---------|-------|-------------|
| `SPEC` | Specification | A spec for building something or defining rules |
| `DOC` | Documentation | Session logs, reports, reference docs |
| `TASK` | Task document | Task docs with project alias |
| `NOTES` | Notes | Brain dumps, working notes, brainstorming |
| `TEMPLATE` | Template | Fill-in-the-blank forms, reusable structures |
| `MODE` | SuperWhisper mode | AI system prompts for SuperWhisper speech-to-text (`.xml`) |

### The B Rule

**B = project alias. Always.**

Every project is a GitHub project with a unique name. Every spec, doc, task, and note belongs to a project. B is the 4-letter alias for that project.

```txt
{F}__{project}--{subtype}--{topic}__{X}.md
```

- ✅ **B** = project alias (`acme`, `nova`, `bolt`, `apex`, etc.)
- ✅ **E** = document subtype or tech stack (`directive`, `workflow`, `engine`, `node`, `react`, etc.)
- ✅ **M** = topic (the actual subject of the document)
- ✅ **TASK** is the one exception: E = topic directly (TASK itself IS the subtype — skip the extra layer)

#### Why B = project alias

Everything in this naming convention lives inside a GitHub project. That's the highest classification. We already know we're in a project, so we don't need to say "project" again in the filename — we skip straight to the next level down. The filename carries its identity everywhere — in search results, in cross-project references, in chat, in logs. If you're looking at another project's specs, the filename tells you exactly whose spec it is without checking the directory.

**Search grouping:** search `SPEC__` across all projects → results group by project name alphabetically. All the `acme` specs cluster together, all the `nova` specs cluster together. Sorted. Grouped. Done.

#### Project examples

```txt
SPEC__acme--workflow--deploy-checklist.md    ← B=acme, E=workflow, M=deploy-checklist
SPEC__acme--engine--data-pipeline.md         ← B=acme, E=engine, M=data-pipeline
SPEC__acme--directive--code-review.md        ← B=acme, E=directive, M=code-review
SPEC__nova--directive--quality-checks.md     ← B=nova, E=directive, M=quality-checks
SPEC__bolt--node--api-server.md              ← B=bolt, E=node, M=api-server
DOC__acme--incident--api-outage.md           ← B=acme, E=incident, M=api-outage
DOC__acme--session--2026-03-10.md            ← B=acme, E=session, M=2026-03-10
TASK__acme--orchestrator.md                  ← B=acme, E=orchestrator (TASK skips subtype)
NOTES__acme--spec--deploy-checklist.md       ← B=acme, E=spec, M=deploy-checklist
NOTES__nova--task-ideas--phase-2.md          ← B=nova, E=task-ideas, M=phase-2
```

#### The one exception: global files

Files that belong to NO single project — universal rules, cross-project templates — use B = document type instead of a project alias.

```txt
SPEC__directive--fx-naming.md                ← global rule, no project owner
SPEC__template--how-to-write-a-spec.md       ← global template
```

#### Why TASK skips the subtype layer

TASK's F class already tells you the subtype — it's a task. Adding E=task would be redundant:

```txt
❌ TASK__acme--task--orchestrator.md    ← "task task" is redundant
✅ TASK__acme--orchestrator.md          ← TASK is the subtype, E is the topic
```

---

## E-Level Subtypes

E is always a subtype. There are two kinds: **document subtypes** and **tech subtypes**. Both go in the E position.

### Document Subtypes

What kind of document is it? These describe the structure or purpose.

| Subtype | Means | You know it's... |
|---------|-------|-----------------|
| `directive` | Rule / convention / binding instruction | A law agents must follow |
| `template` | Fill-in-the-blank form / process guide | A reusable form |
| `watcher` | File watcher / daemon | A background process |
| `engine` | Processing engine / pipeline | A data pipeline |
| `workflow` | Multi-step process / playbook | A sequence of actions |
| `prompt` | LLM prompt / initial instruction | Text you feed to an AI |
| `schema` | Data structure / API contract | Shape of data |
| `session` | Session log / conversation record | A timestamped session |
| `incident` | Post-mortem / problem report | A documented problem and fix |

### Directive Sync Subtypes

Specs with E = `directive` have an additional **sync subtype** declared in their SYNC DIRECTIVE header. This determines WHERE changes sync to.

| Sync subtype | Sync target | Scope |
|---------|------------|-------|
| `commandment_god` | `~/.claude/CLAUDE.md` (global) | All projects, all instances, all machines |
| `commandment_local` | `{project-root}/.claude/CLAUDE.md` (local) | That project only |

**The sync subtype is declared in the SYNC DIRECTIVE block at the top of each directive spec.**

#### `commandment_god`

Global rules. Lives in the central config repo's `_specs/`. Syncs to `~/.claude/CLAUDE.md` which every Claude instance on every machine reads.

SYNC DIRECTIVE example:

```txt
> **SYNC DIRECTIVE**
> **Subtype:** `commandment_god`
> **Target:** God Commandment #6 in `~/.claude/CLAUDE.md`
> **Boundaries:** Delete everything between `## 🚨 GOD COMMANDMENT #6:` and `## 🚨 GOD COMMANDMENT #7:`
> **Method:** Complete removal and paste. Full block replacement every time.
```

#### `commandment_local`

Project-specific rules. Lives in a project's `_specs/`. Syncs to that project's `.claude/CLAUDE.md`.

SYNC DIRECTIVE example:

```txt
> **SYNC DIRECTIVE**
> **Subtype:** `commandment_local`
> **Target:** Pre-Flight Checklist section in `.claude/CLAUDE.md`
> **Boundaries:** Delete everything between `## Pre-Flight Checklist` and the next `## ` heading
> **Method:** Complete removal and paste. Full block replacement every time.
```

#### Auto-Sync Rules

**If you modify a `directive` spec during a session, you MUST sync it before the session ends. Automatically. No asking.**

- ✅ `commandment_god` → full block replacement in `~/.claude/CLAUDE.md`
- ✅ `commandment_local` → full block replacement in `{project-root}/.claude/CLAUDE.md`
- ✅ Read the SYNC DIRECTIVE at the top of the spec — it tells you the subtype and exactly where to paste
- ✅ Full block replacement — delete the entire target section, paste the full spec content
- ❌ Do NOT ask Flavio "should I sync?" — if you changed a directive, the sync happens
- ❌ Do NOT forget — this is not optional, not a reminder, it's a rule

#### Who Triggers the Sync

| Who made the change | What happens |
|---------------------|-------------|
| Claude (any instance) edits the spec | Claude auto-syncs to the target. No asking. |
| Flavio edits the spec manually | Flavio tells Claude to sync. Claude executes. |

---

### Tech Subtypes

What tech stack is it? All at the same level — no hierarchy. React and Next.js sit next to TypeScript and Python, not under them.

**Base languages:**

| Subtype | Means | You know it's... |
|---------|-------|-----------------|
| `typescript` | TypeScript project | TS runtime / toolchain |
| `python` | Python script / service | Python runtime |
| `java` | Java application | JVM runtime |
| `cpp` | C++ application | C++ compiled |

**Node/JS ecosystem:**

| Subtype | Means | You know it's... |
|---------|-------|-----------------|
| `node` | Node.js service (vanilla TS) | Backend runtime |
| `express` | Express API server | Node framework |
| `fastify` | Fastify API server | Node framework |

**Frontend / UI:**

| Subtype | Means | You know it's... |
|---------|-------|-----------------|
| `react` | React component / UI piece | Frontend component |
| `next` | Next.js app (TS + Tailwind) | Fullstack framework |
| `flutter` | Flutter app (Dart) | Cross-platform UI |

**Testing:**

| Subtype | Means | You know it's... |
|---------|-------|-----------------|
| `playwright` | Playwright test / UI automation | Browser testing |

**Infrastructure:**

| Subtype | Means | You know it's... |
|---------|-------|-----------------|
| `docker` | Container config | Infrastructure |

### Compound Subtypes

When a subtype is multi-word, use single underscore `_` (NOT double `__`, NOT dash `-`):

```txt
sol_bot     ← SoulBot
git_hook    ← Git hook
git_action  ← GitHub Action
```

This keeps compound subtypes distinct from the FX separator (`__`) and the within-group separator (`--`).

### Growing the Subtype List

This list grows organically. Only add a subtype when you actually use that tech or document type. No need to predefine every framework.

---

## E — Element

What E means depends on whether B is a project alias or a document type. Always kebab-case.

**When B = project alias** (project-specific): E = document subtype or tech stack

```txt
SPEC__acme--workflow--deploy-checklist.md    ← E = workflow (the subtype)
SPEC__acme--engine--data-pipeline.md         ← E = engine (the subtype)
SPEC__bolt--node--api-server.md              ← E = node (the tech)
TASK__acme--orchestrator.md                  ← E = orchestrator (the topic — TASK skips subtype)
```

**When B = document type/tech** (global): E = topic

```txt
SPEC__directive--fx-naming.md          ← E = fx-naming (the topic)
SPEC__react--tailwind--card-grid.md    ← E = tailwind (the topic)
DOC__session--2026-03-10.md            ← E = 2026-03-10 (the topic)
```

---

## M — Modifier

Specifics. Always kebab-case. Optional. What M contains depends on the B scope:

**When B = project alias**: M = topic (the actual subject of the document)

```txt
SPEC__acme--workflow--deploy-checklist.md    ← M = deploy-checklist (the topic)
SPEC__acme--engine--data-pipeline.md         ← M = data-pipeline (the topic)
DOC__acme--incident--api-outage.md           ← M = api-outage (the topic)
```

**When B = document type/tech**: M = specifics (date, variant, version, scope)

```txt
SPEC__react--tailwind--card-grid.md    ← M = card-grid (specifics)
DOC__session--2026-03-10--morning.md   ← M = morning (specifics)
TASK__acme--orchestrator--phase-2.md   ← M = phase-2 (specifics)
```

---

## X — Extra

Extra context that lives OUTSIDE the B-E-M chain. Separated by `__` (double underscore). Optional.

### When to use X

| Use case | Example |
|----------|---------|
| **Language/runtime** | `__ts`, `__js` |
| **Project scope** (spec lives outside its project) | `__acme`, `__nova` |
| **Task ID** (external platform runtime ID) | `__6661` |
| **Model identifier** (A/B testing) | `__model_a--6661` |
| **Archival version** (browser AI tools — no Git access) | `__v1`, `__v2` |

### X rules

- ✅ Unversioned = current. Only archived copies get `__v1`, `__v2`. This exists because claude.ai and gemini.google.com can't access private GitHub repos — no git history, so old versions need physical archives
- ✅ `__ts` is default for all projects — only mark `__js` as the exception
- ✅ X is compound — it can have its own internal BEM: `__model_a--6661`
- ✅ Project scope in X only when the file lives OUTSIDE its project (e.g., an acme spec in another repo)
- ❌ Do NOT put the project name in X if the file is inside that project's directory — that's redundant

### Task Lifecycle (X in action)

```txt
TASK__acme--orchestrator.md                         ← Base (locked and loaded)
TASK__acme--orchestrator__6661.md                    ← Sprint (task ID in X)
TASK__acme--orchestrator__model_a--6661.md           ← A/B split (model + task ID)
TASK__acme--orchestrator__model_b--6661.md
TASK__acme--orchestrator__model_a--7771.md           ← Second run (new task ID)
```

---

## File Type Applicability

**FX applies to:** `.md`, `.json`, `.pdf`, and `.xml` files.

- ✅ Markdown docs, specs, notes, templates → FX naming
- ✅ JSON config/schema files that are project-specific → FX naming
- ✅ PDF documents (exported specs, reports) → FX naming
- ✅ XML mode files (SuperWhisper system prompts) → FX naming (`MODE__` prefix)

**FX does NOT apply to tech product files.**

TypeScript files, React components, Python scripts, config files generated by tooling — these follow their own naming conventions, not FX. A React component is `card-grid.tsx`, not `SPEC__react--hook--copy-to-clipboard.ts`. A Next.js page is `page.tsx`, not `DOC__next--page.tsx`.

The distinction: FX names **documentation about** a technology. The technology's own files follow the rules below.

```txt
✅ FX:  SPEC__bolt--react--card-grid.md         ← a SPEC about a React component
❌ FX:  card-grid.tsx                           ← the actual React component (follows TS/TSX conventions)

✅ FX:  SPEC__acme--engine--data-pipeline.md    ← a SPEC about an engine
❌ FX:  data-pipeline.ts                        ← the actual engine code (follows TS conventions)
```

### TypeScript / TSX File Naming

**ALL `.ts` and `.tsx` file names use kebab-case. No exceptions.**

| Type | File name (kebab-case) | Identifier in code |
|------|----------------------|-------------------|
| Components | `card-grid.tsx` | `CardGrid` (PascalCase) |
| Hooks | `use-copy-to-clipboard.ts` | `useCopyToClipboard()` (camelCase) |
| Utilities | `remove-duplicates.ts` | `removeDuplicates()` (camelCase) |
| Types | `meeting-types.ts` | `MeetingCardProps` (PascalCase) |
| Constants | `app-config.ts` | `MAX_RETRIES` (UPPER_SNAKE_CASE) |
| Routes | `page.tsx` (Next.js default) | — |
| CSS modules | `card-grid.module.css` | — |

**File names and identifiers are DIFFERENT things.** All exterior shit (file names) is kebab-case. All interior shit (functions, components, hooks, types, variables) follows React and TypeScript required naming and casing.

**Acronyms in file names** go lowercase: `ipc-links.ts`, `api-client.ts`, `html-parser.ts`. In identifiers, preserve casing: `IPCLinks`, `APIClient`, `HTMLParser`. In prose, keep the acronym uppercase: `IPC` communication, `API` endpoint.

### Inside the File — React / TypeScript Conventions

React requires specific casing for things to work. Components must be PascalCase or JSX won't render them. Hooks must start with `use` or React won't apply hook rules. These are not style preferences — they are framework requirements.

| What | Casing | Why | Example |
|------|--------|-----|---------|
| Components | PascalCase | React requires it for JSX rendering | `function CardChat() { ... }` |
| Hooks | camelCase with `use` prefix | React requires it for hook rules | `function useCopyToClipboard() { ... }` |
| Functions / variables | camelCase | TypeScript convention | `const removeDuplicates = () => { ... }` |
| Types / interfaces | PascalCase | TypeScript convention | `interface MeetingCardProps { ... }` |
| Constants | UPPER_SNAKE_CASE | Convention for immutable values | `const MAX_RETRIES = 3` |

### Exterior vs Interior — The Full Picture

```txt
src/hooks/use-copy-to-clipboard.ts          ← file name: kebab-case
  function useCopyToClipboard() { ... }     ← inside: camelCase (React hook rules)

src/components/card-chat.tsx                ← file name: kebab-case
  function CardChat() { ... }              ← inside: PascalCase (React JSX requirement)

src/utils/remove-duplicates.ts              ← file name: kebab-case
  function removeDuplicates() { ... }      ← inside: camelCase (TypeScript convention)

src/types/meeting-types.ts                  ← file name: kebab-case
  interface MeetingCardProps { ... }        ← inside: PascalCase (TypeScript convention)
```

### The `use` Prefix — Why React Got Naming Right

React hooks use the `use` prefix: `useEffect`, `useState`, `useCopyToClipboard`. That prefix is a block-level classifier. The file is `use-copy-to-clipboard.ts` (kebab-case), the function inside is `useCopyToClipboard()` (camelCase) — same prefix, different casing rules. When you organize your imports alphabetically, every hook clusters together — all the `use-*` files group up, and you can see at a glance what hooks a component depends on.

Components don't get this treatment. A component file is `card-grid.tsx` (kebab-case), the identifier inside is `CardGrid` (PascalCase), but there's no universal prefix that groups them in imports. Hooks have `use`. It's like FX's F position — it's the first thing you read, and it tells you what you're looking at.

Now think about it — why would you call a hook a "hook"? Sounds too much like hooker. But `use`? "Use my titties, my ass, my pussy" — that's the TNA right there. `use` is the verb that says "I need this." `useCopyToClipboard` — I need clipboard access. `useAuth` — I need auth. The prefix carries intent, not just classification. React figured out that naming things by what you DO with them (use) is more powerful than naming them by what they ARE (hook).

That's the same philosophy behind FX. The filename tells you what the document IS (F), who it belongs to (B), what kind (E), and what about (M). You read the name, you know the purpose. No opening the file. No guessing.

---

## Directory Naming

**All directories use kebab-case. No exceptions.**

- ✅ Format: `lowercase-dash-lowercase` (e.g., `my-project`, `docs`, `tribal-knowledge`)
- ✅ Applies to ALL directories — project roots, subdirectories, everything
- ❌ Do NOT use FX naming for directories
- ❌ Do NOT use underscores, camelCase, PascalCase, or UPPER_CASE for directory names

**Exception — task directories:**

Subdirectories inside `tasks/` directories can be named anything — they follow whatever naming God Flavio gives them:

- ✅ `acme-project/tasks/*`
- ✅ `nova-agent/tasks/*`
- ✅ `bolt-runner/tasks/*`

**Exception — `_` and `__` prefixed directories:**

Any directory starting with `_` or `__` can be named anything. (e.g., `_flavio`, `_mail`, `__temp`)

**Standard `_` directories for every project:**

| Directory | Purpose | Who writes |
|-----------|---------|------------|
| `_docs/` | Project-specific documentation | Claude + Flavio |
| `_specs/` | Project-specific specs | Claude + Flavio |
| `_notes/` | Flavio's personal notes | **Flavio ONLY** — do NOT touch unless directly told |
| `_modes/` | SuperWhisper mode configs (`MODE__*.xml` + `MODE__*.md` examples) | Claude + Flavio |

---

## ALL CAPS Exceptions

These files keep their ALL CAPS names. Do NOT rename them to FX:

- ✅ `CLAUDE.md` — Claude Code convention
- ✅ `README.md` — GitHub convention
- ✅ `LICENSE.md` — GitHub convention
- ✅ `CONTRIBUTING.md` — GitHub convention
- ✅ `CHANGELOG.md` — GitHub convention
- ✅ `TEMP.md` — Personal scratch/temp notes
- ✅ `NOTES.md` — Personal notes (standalone, no FX needed)

---

## Spec Header Convention

Every spec file — line 3 is ALWAYS the version + timestamp:

- ✅ Line 1 = `# SPEC: {Type} — {Topic}`
- ✅ Line 2 = blank
- ✅ Line 3 = `v{N} | {Mon DD YYYY} - {HH:MM} {AM/PM} (MST)`

```txt
# SPEC: Directive — FX Naming

v2 | Mar 10 2026 - 02:31 PM (MST)
```

- ✅ Version increments when the spec is updated
- ✅ Timestamp is the time of the update, zero-padded, 12-hour, MST
- ❌ Do NOT leave line 3 as a placeholder — fill it in immediately on creation

---

## Working Notes

Working notes for a spec in progress use `NOTES__` prefix:

**Global (central config repo):**

```txt
NOTES__spec--fx-naming.md
NOTES__spec--chat-log-watcher.md
```

**Project-specific (inside a project):**

```txt
NOTES__acme--spec--deploy-checklist.md
NOTES__nova--task-ideas--phase-2.md
```

- ✅ `SPEC__` = finished/active spec
- ✅ `NOTES__` with B=project → brainstorming for that project
- ✅ `NOTES__` with B=subject → brainstorming for a global topic
- ❌ Do NOT use `DOC__spec--` — specs are not docs

---

## External Task Conventions

**Project prefixes for external task tracking:**

| Project | Prefix | Description |
|---------|--------|-------------|
| Acme | `acme_` | Code review evaluation |
| Nova | `nova_` | Task creation for benchmarks |
| Bolt | `bolt_` | Model response pair evaluation |

**Submission format:**

```txt
{project}_{task-id}__submission--{YYYY-MM-DD}--{HHMM}-mst.md
```

**Examples:**

```txt
acme_review-13652__submission--2026-02-02--2347-mst.md
acme_audit-130__assessment.md
nova_task-0042__submission--2026-01-15--0900-mst.md
bolt_pair-7891__submission--2026-02-02--2200-mst.md
```

---

## Date/Time Formatting Rules

- ✅ Always zero-pad single digits: `04` not `4`, `09` not `9`
- ✅ Dates: `Feb 04 2026` (no commas)
- ✅ Times: `04:47 PM (MST)` (zero-padded, 12-hour, timezone in parentheses)
- ✅ Full format: `Feb 04 2026 - 04:47 PM (MST)`
- ❌ Never: `4:47`, `Feb 4`, `9:05` — always `04:47`, `Feb 04`, `09:05`

```bash
date +"%Y-%m-%d--%H%M-mst"
```

---

## Why FX?

Files group together when sorted alphabetically. The F class clusters all docs of the same kind.

**Inside a project directory** (e.g., `acme-project/specs/`):

```txt
DOC__acme--incident--api-outage--2026-02-04.md
DOC__acme--session--2026-03-10.md

SPEC__acme--directive--code-review.md
SPEC__acme--engine--data-pipeline.md
SPEC__acme--workflow--deploy-checklist.md

TASK__acme--orchestrator.md
TASK__acme--orchestrator__model_a--6661.md
TASK__acme--scheduler.md
```

**Inside a global config repo** (cross-project specs):

```txt
SPEC__directive--fx-naming.md
SPEC__template--how-to-write-a-spec.md

TEMPLATE__assessment.md
TEMPLATE__feedback.md
```

An AI agent reads `SPEC__acme--engine--data-pipeline.md` and immediately knows:

- **F** = SPEC → it's a specification
- **B** = acme → it belongs to the Acme project
- **E** = engine → it's a processing engine/pipeline
- **M** = data-pipeline → specifically the data pipeline

No ambiguity. No guessing. The filename IS the documentation.

---

## File Rename Rules

**When migrating existing files to FX:**

### What to Rename

- ✅ Old BEM files → FX format
- ✅ Task docs with old naming → FX format with project alias in B
- ✅ Templates → `TEMPLATE__` prefix
- ✅ Generic docs → `DOC__` prefix

### What NOT to Rename

- ❌ Tech product files (`.ts`, `.tsx`, `.py`, `.css`, etc.) — they follow platform conventions
- ❌ Files in `node_modules/`, `.git/`, or vendor directories
- ❌ ALL CAPS exception files (CLAUDE.md, README.md, TEMP.md, NOTES.md)

### How to Rename

```bash
# Always use git mv to preserve history
git mv OLD_NAME.md SPEC__directive--new-name.md

# Never do this (loses git history)
mv OLD_NAME.md SPEC__directive--new-name.md
```

### Migration Checklist

Before renaming any file:

- [ ] File is `.md`, `.json`, or `.pdf` (FX-applicable types only)
- [ ] File is not in ALL CAPS exception list
- [ ] New name follows FX format: `{F}__{B}--{E}--{M}__{X}.md`
- [ ] External task files have project prefix (`acme_`, `nova_`, `bolt_`)
- [ ] All references in other files identified and updated
- [ ] Using `git mv` (not `mv`)
