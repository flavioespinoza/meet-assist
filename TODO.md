# Flavio's To-Do List

## 1. Drop your resume into `src/context/`

Claude's system prompt auto-loads **every file** in `src/context/` — this is his
permanent memory. Your resume goes here so he always has it on hand.

```
src/context/resume--flavio.md       ← your latest resume (Markdown)
```

You can also put other always-on reference material here:
```
src/context/portfolio--highlights.md   ← key projects, case studies
src/context/tech-stack--summary.md     ← languages, frameworks, tools
```

> **Naming convention:** lowercase, double-dash separators. Claude loads them
> alphabetically, so prefix with numbers if order matters (e.g. `01--resume.md`).

---

## 2. Create agent modes in `src/agents/`

Agent files are **mode-specific prompts** — you swap them depending on what
kind of call you're on. Only ONE agent is active at a time.

Each agent is a Markdown file with instructions that tell Claude how to behave
for that specific call type.

### Where they go

```
src/agents/
├── job-interview.md          ← coding interview for a job
├── client-discovery.md       ← meeting with a potential client
├── client--crypto-trader.md  ← specific client: crypto trader
├── pair-programming.md       ← working session with a teammate
└── ...                       ← add as many as you need
```

### How to write one

Each agent file should include:
- **What kind of call this is** (job interview, client meeting, etc.)
- **Who the other person is** (interviewer, client name, role)
- **What Claude should focus on** (coding answers, business talk, architecture)
- **What language/framework** if relevant (JavaScript, Python, Solidity, etc.)
- **Tone** (technical, conversational, sales-oriented)

See the example files already in `src/agents/` for the format.

### How to switch agents

In the UI, there will be a mode selector (coming soon). For now, the active
agent is set by filename — edit `src/agents/_active.md` or we'll wire up the
UI toggle next.

---

## 3. Set up your `.env` on the MacBook

Make sure these are set:
```
DEEPGRAM_API_KEY=your_deepgram_key
ANTHROPIC_API_KEY=your_anthropic_key
```

---

## 4. Test the new Deepgram settings

Run `python src/listener.py` and talk for 30+ seconds. Check:
- [ ] Speaker turns come as **one card** instead of 15 fragments
- [ ] `UtteranceEnd` events show in the console (confirms Deepgram is sending them)
- [ ] Flush delay (8s fallback) only kicks in if UtteranceEnd doesn't fire

If it's still splitting too much, try bumping `utterance_end_ms` from 1500 to
2000 or 2500 in `src/listener.py` (line 46).

---

## 5. Test auto-watch mode

Run the app (`npm run dev`) and have a test call:
- [ ] Claude auto-responds to interviewer questions (no clicking needed)
- [ ] Toggle **Auto/Manual** in the Live Stream header to switch modes
- [ ] Claude stays quiet on filler ("yeah", "okay", "sure")
- [ ] Claude stops when you type "stay quiet" or "I've got this"

---

## Priority Order

1. **Resume** → drop it in `src/context/` (5 min)
2. **Test Deepgram** → run listener.py, verify fewer splits (10 min)
3. **Test auto-watch** → run full app, verify Claude watches the stream (10 min)
4. **Agent modes** → write your first agent files in `src/agents/` (when ready)
