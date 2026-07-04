<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/header-dark.svg">
    <img alt="OneBrain — Your AI Thinking Partner" src="assets/header-light.svg" width="640">
  </picture>
</p>

<p align="center">
  <a href="https://onebrain.run"><img alt="Website" src="https://img.shields.io/badge/onebrain.run-0a0a14?style=for-the-badge&labelColor=ff2d92"></a>
  <a href="https://x.com/onebrain_run"><img alt="@onebrain_run on X" src="https://img.shields.io/badge/follow-@onebrain__run-000000?style=for-the-badge&logo=x&logoColor=white"></a>
  <a href="https://github.com/onebrain-ai/onebrain/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/onebrain-ai/onebrain?style=for-the-badge&color=00f3ff&logo=github"></a>
</p>
<p align="center">
  <a href="https://github.com/onebrain-ai/onebrain-cli/releases/latest"><img alt="onebrain-cli release" src="https://img.shields.io/github/v/release/onebrain-ai/onebrain-cli?include_prereleases&style=for-the-badge&logo=rust&color=cb3837&label=onebrain-cli"></a>
  <a href="CHANGELOG.md"><img alt="Plugin version" src="https://img.shields.io/github/package-json/v/onebrain-ai/onebrain?filename=.claude%2Fplugins%2Fonebrain%2F.claude-plugin%2Fplugin.json&style=for-the-badge&label=plugin&color=ff2d92"></a>
  <a href="LICENSE-MIT"><img alt="License: MIT OR Apache-2.0" src="https://img.shields.io/badge/license-MIT_OR_Apache--2.0-7c3aed?style=for-the-badge"></a>
</p>

<p align="center">
  <strong>OneBrain</strong> is a free, open-source AI OS layer: persistent memory, 30 skills, and a portable vault that works with any AI harness — entirely on your machine.
</p>

<p align="center">
  <a href="#quickstart">Get Started →</a> &nbsp;·&nbsp; <a href="#commands">View Commands →</a>
</p>

---

## What is OneBrain?

> **Imagine the AI industry as the car industry.** If Anthropic, Google, and OpenAI were car makers, each would ship a complete branded car — building its own engine (the LLM), wrapping it in its own chassis and electronics (the harness: Claude Code, Gemini CLI, Codex), and selling the whole thing under its own badge.
>
> **OneBrain is not another car brand.** We don't build cars, and we don't build engines. OneBrain is the free, open-source (MIT/Apache-2.0) brain that rides in any of them:
>
> - **The plug-in ECU** — install it on any brand and you get the same skills, the same workflows, and behavior as close to identical as each harness allows. It gets the most out of whatever engine it's given — you choose the cost/quality point per task.
> - **The driver profile** — your memory, preferences, decisions, and knowledge live in your vault, not in the car. Swap cars any time — everything rides with you.
>
> *Drive whichever car you like. Your brain rides with you.*

<!-- car-analogy diagram: PR 2 -->

| In the garage | In the AI stack |
|---|---|
| Car makers — Toyota, BMW, Tesla | AI companies — Anthropic, Google, OpenAI |
| Engine | LLM — Claude, Gemini, GPT, local models |
| The complete branded car | Harness — Claude Code, Gemini CLI, Codex, Qwen |
| Plug-in ECU + control software | **OneBrain** — skills, hooks, memory system, calibration |
| Driver profile that travels with you | **Your vault** — plain Markdown you own forever |

> Pick a harness for **how it lets you work** (CLI, IDE, mobile, API). Pick OneBrain for **how it remembers you** across all of them.

---

## Quickstart

```bash
# 1. Install the CLI
brew install onebrain-ai/onebrain/onebrain
# or: npm install -g @onebrain-ai/cli

# 2. Create your vault
mkdir my-vault && cd my-vault
onebrain init

# 3. Start working — pick one
onebrain serve --open   # browser, no harness needed
claude                  # or any supported harness

# 4. Personalize (inside your harness, or the web UI chat)
/onboarding
```

Use Obsidian? Open the same folder as a vault — entirely optional. → [docs/install.md](docs/install.md)

---

## How it works

### The stack

OneBrain doesn't compete with Claude Code, Gemini CLI, or any other AI harness — **it extends them**. Whichever harness you drive, OneBrain adds the persistent memory, skill surface, and personal calibration that harnesses don't ship with. Same harness; suddenly it remembers who you are, what you're working on, and how you like to work — all while your Markdown vault stays the durable source of truth underneath.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/diagrams/harness-os-stack-dark.svg">
    <img alt="OneBrain Harness OS — 4-layer architecture: OneBrain (plugin + CLI) on top, Harness, LLM, and your Markdown vault as the source of truth at the base" src="assets/diagrams/harness-os-stack-light.svg" width="780">
  </picture>
</p>

| # | Layer | Role | What lives here |
|---|---|---|---|
| 01 | **OneBrain** | OS layer (plugin + CLI) | 30 skills · lifecycle hooks · local vault sync · indexing · checkpoints · harness routing |
| 02 | **Harness** | Agentic runtime | Bring your own — Claude Code · Gemini CLI · Codex · Qwen · ... |
| 03 | **LLM** | Intelligence source | Local (mlx, ollama) · cloud (claude, gemini, gpt) · raw API |
| 04 | **Markdown Vault** | Source of truth | Plain Markdown — notes, memory, decisions, knowledge graph |

**Extend, don't replace.** A great harness already knows how to talk to an LLM, edit files, and run shell commands. It does not know who you are, what you've decided last week, or how you prefer to work. OneBrain fills exactly that gap:

| | What OneBrain adds | Why it matters |
|---|---|---|
| 🧠 | **Memory** — Identity, preferences, decisions, project state — promoted across four tiers as it earns trust | The harness alone starts every session from zero. OneBrain doesn't. |
| ⚡ | **Skills** — 30 vault-aware verbs (`/braindump`, `/research`, `/distill`, `/learn`, `/wrapup`, …) | Pre-built workflows the harness would otherwise need you to script every time. |
| 🎯 | **Calibration** — Every correction, every preference, every learned habit tunes the agent to *you* | The longer you use it, the sharper it gets — your vault is the training data. |
| 🔀 | **Continuity** — Context lives in the vault, not the harness | Switch from Claude Code to Gemini CLI to Codex — context carries over. |

### Memory

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/diagrams/memory-tiers-dark.svg">
    <img alt="Memory tiers — four-stage persistence stack: WORKING (00-inbox + current session) at top, EPISODIC (07-logs), SEMANTIC (05-agent/MEMORY.md + memory/), and KNOWLEDGE (03-knowledge) at the base" src="assets/diagrams/memory-tiers-light.svg" width="780">
  </picture>
</p>

| Tier | Location | What it stores | Promoted by |
|------|----------|---------------|-------------|
| **Working** | `00-inbox/` + current session | Raw captures, active conversation | `/consolidate`, `/wrapup` |
| **Episodic** | `07-logs/session/` | Session summaries, decisions, action items | `/wrapup`, auto-checkpoint |
| **Semantic** (always-loaded) | `05-agent/MEMORY.md` + `05-agent/MEMORY-INDEX.md` | Identity + Active Projects + Critical Behaviors + memory file registry | `/learn`, `/onboarding` |
| **Semantic** (lazy-loaded) | `05-agent/memory/` | Behavioral patterns, domain facts — loaded on demand via MEMORY-INDEX.md | `/learn`, `/recap`, `/memory-review` |
| **Knowledge** | `03-knowledge/` | Permanent synthesized notes | `/distill` |

Full promotion rules, automatic session saving, and pause/resume → [docs/memory.md](docs/memory.md)

### The loop

OneBrain runs as a tight 3-step loop. Each cycle, both sides sharpen.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/diagrams/coevo-loop-dark.svg">
    <img alt="Co-Evolution loop — three nodes (01 CAPTURE at top, 02 EVOLVE at bottom-right, 03 WRAPUP at bottom-left) connected by curved arrows flowing clockwise" src="assets/diagrams/coevo-loop-light.svg" width="350">
  </picture>
</p>

1. **Capture** — Talk to the agent in natural language. It writes, classifies, and links your thoughts in real time. → `/braindump` · `/capture` · `/bookmark`
2. **Evolve** — `/research` and `/distill` expand your knowledge. `/learn` deepens the agent. The loop tightens. → `/research` · `/distill` · `/learn`
3. **Wrapup** — `/wrapup` consolidates the session log. `/recap` promotes lessons to memory. → `/wrapup` · `/recap`

---

<a id="commands"></a>

## Commands

Skills are organized by workflow phase. **Gemini CLI users:** prepend the `onebrain:` namespace, e.g. `/onebrain:braindump` instead of `/braindump` (a few newer skills are Claude Code-only for now — see [docs/skills.md](docs/skills.md)).

| Command | What it does |
|---------|-------------|
| `/braindump` | Dump everything on your mind — it gets classified and filed |
| `/capture` | Quick note with auto-linking to related notes |
| `/research [topic]` | Web research → structured note in your vault |
| `/consolidate` | Process inbox into permanent knowledge |
| `/distill [topic]` | Crystallize a completed topic thread into a permanent knowledge note |
| `/learn` | Teach the agent something — facts about your world or behavioral preferences |
| `/daily` | Daily briefing — surfaces tasks and last session context |
| `/wrapup` | Wrap up session — merges any auto-checkpoints and saves full summary to session log |

<details>
<summary><strong>Full command reference</strong></summary>
<br>

All 30 skills, grouped by workflow phase (INPUT, PROCESS, RECALL, MAINTAIN), with the Gemini namespacing note and per-command descriptions → [docs/skills.md](docs/skills.md)

</details>

---

## Highlights

| | Feature |
|---|---|
| 🧠 | **Persistent Memory** — remembers your name, goals, preferences, and decisions across every session → [docs/memory.md](docs/memory.md) |
| ⚡ | **30 Skills** — one number, every workflow phase covered → [docs/skills.md](docs/skills.md) |
| 🔀 | **Multi-Harness** — Claude Code, Gemini CLI, Codex, Qwen, or BYO LLM — same vault, same memory → [docs/install.md](docs/install.md) |
| 🖥️ | **Web UI built in** — `onebrain serve` opens a file explorer, reader, search, and agent chat in your browser → [docs/webui.md](docs/webui.md) |
| 🔍 | **Native search + MCP** — hybrid lex+vector search over your vault, servable over MCP (stdio) → [docs/search.md](docs/search.md) · [docs/mcp.md](docs/mcp.md) |
| 📂 | **Vault-native Markdown** — plain Markdown, no lock-in. Your data stays yours forever |
| 📓 | **Session logs & checkpoints** — every conversation saved with summaries and action items; auto-checkpoints every 15 messages or 30 min |
| 📱 | **Mobile via Telegram** — send instructions and receive briefings from anywhere → [docs/install.md](docs/install.md) |

---

## OneBrain Sync *(planned)*

One driver profile, every garage. OneBrain Sync will keep your vault, memory, and context in sync across machines — while the agent always runs locally, on your own keys. No hosted runtime. No lock-in.

## Scheduling

Run OneBrain skills automatically — daily briefings, weekly reviews, recurring maintenance — via your OS scheduler (macOS launchd; Linux + Windows coming soon), configured in `onebrain.yml`.

Full config format, preset bundles, and CLI flags → [docs/scheduling.md](docs/scheduling.md)

## Customization

Edit `05-agent/MEMORY.md` directly to update your identity, goals, or recurring context at any time. The AI picks up changes on the next session start.

The full set of AI instructions that govern your agent's behavior lives in [`.claude/plugins/onebrain/INSTRUCTIONS.md`](.claude/plugins/onebrain/INSTRUCTIONS.md). Note that `/update` will overwrite this file — add session-level customizations to your `CLAUDE.md` instead, so they survive updates.

## Docs

| Page | What's inside |
|------|---------------|
| [Install](docs/install.md) | Pick a harness, install the CLI, set up optional extras |
| [Memory](docs/memory.md) | Four-tier memory system, promotion rules, automatic session saving |
| [Skills reference](docs/skills.md) | All 30 skills grouped by workflow phase |
| [Web UI](docs/webui.md) | `onebrain serve` — embedded browser UI and JSON API |
| [Search](docs/search.md) | Native hybrid (lex + vector) search over your vault |
| [MCP Server](docs/mcp.md) | Serve OneBrain over the Model Context Protocol |
| [Scheduling](docs/scheduling.md) | Recurring and one-shot skill scheduling |
| [Vault Structure](docs/vault-structure.md) | Folder layout and task syntax |
| [CLI Command Map](docs/cli.md) | Every top-level `onebrain` command |

Questions or gaps? [Open an issue](https://github.com/onebrain-ai/onebrain/issues).

## Contributing

Pull requests welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Licensed under either of [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE) at your option — the permissive dual license used across OneBrain.
