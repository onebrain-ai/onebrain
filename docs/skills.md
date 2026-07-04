# Skills reference

OneBrain ships 30 skills (plus `/help` to list them in-session) — grouped below by workflow phase.

> Part of [OneBrain docs](README.md)

Skills are organized by workflow phase. **Gemini CLI users:** prepend the `onebrain:` namespace, e.g. `/onebrain:braindump` instead of `/braindump` (avoids collisions with Gemini built-in commands like `/help` and `/tasks`). Seven newer skills are not yet available as Gemini slash commands: /pause, /resume, /search, and the four /schedule-* wizards.

## 📥 INPUT — Capture & ingest

| Command | What it does |
|---------|-------------|
| `/onboarding` | First-run setup — run this first · *first run only* |
| `/braindump` | Dump everything on your mind — it gets classified and filed |
| `/capture` | Quick note with auto-linking to related notes |
| `/bookmark [url]` | Save a URL with AI-generated name, description, and category to Bookmarks.md |
| `/summarize [url]` | Fetch a URL and save a deep summary note |
| `/import [path]` | Import local files (PDF, Word, images, scripts) into vault notes |
| `/reading-notes` | Turn a book or article into structured notes |
| `/research [topic]` | Web research → structured note in your vault |

## ⚙️ PROCESS — Synthesize & organize

| Command | What it does |
|---------|-------------|
| `/consolidate` | Process inbox into permanent knowledge |
| `/distill [topic]` | Crystallize a completed topic thread into a permanent knowledge note in `03-knowledge/` |
| `/connect` | Find connections between notes, suggest wikilinks |
| `/recap` | Cross-session synthesis — batch-promote recurring insights from session logs into `memory/` files (does NOT write to MEMORY.md) |
| `/weekly` | Review the week, surface patterns, set intentions |
| `/daily` | Daily briefing — surfaces tasks and last session context, then saves your focus as a daily note |
| `/learn` | Teach the agent something — facts about your world or behavioral preferences |

## 🔍 RECALL — Retrieve & navigate

| Command | What it does |
|---------|-------------|
| `/search` | General vault retrieval — answers what + why questions across MEMORY, sessions, plans, decisions logs, notes |
| `/tasks` | Live task dashboard in Obsidian — creates/updates `TASKS.md` with always-current query sections |
| `/moc` | Vault portal in Obsidian — creates/updates `MOC.md` with projects, areas, knowledge, tasks, and pinned links |
| `/memory-review` | Interactive review of memory files — keep, update, deprecate, or delete entries |

## 🔧 MAINTAIN — System housekeeping

| Command | What it does |
|---------|-------------|
| `/update` | Update skills, config, and plugins from GitHub |
| `/doctor` | Vault + config health check — broken links, orphan notes, stale memory entries, inbox backlog |
| `/reorganize` | Migrate flat notes into organized subfolders |
| `/clone` | Package your agent context for transfer to a new vault |
| `/help` | List all available commands with descriptions |
| `/wrapup` | Wrap up session — merges any auto-checkpoints and saves full summary to session log |
| `/pause` | Save a snapshot of long-running work mid-flight so a future session can `/resume` (does NOT end the session or clear context) |
| `/resume` | Load the latest snapshot of an active pause thread and pick up seamlessly in a fresh session |
| `/schedule-add` | Interactive wizard for adding a recurring scheduled skill |
| `/schedule-once` | One-shot wizard: schedule a skill to run once at a specific datetime |
| `/schedule-list` | Show all scheduled entries |
| `/schedule-remove` | Remove a scheduled entry |
