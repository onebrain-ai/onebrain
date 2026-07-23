# Install

How to install OneBrain, pick a harness, and set up optional extras.

> Part of [OneBrain docs](README.md)

## Pick Your Harness

Each harness reads OneBrain's instruction file automatically. Install it, run it inside your vault, and the plugin loads on first prompt.

| Harness | Install | Run | Reads |
|---|---|---|---|
| **Claude Code** *(recommended)* | `npm install -g @anthropic-ai/claude-code` | `claude` | `CLAUDE.md` |
| **Gemini CLI** | `npm install -g @google/gemini-cli` | `gemini` | `GEMINI.md` |
| **OpenAI Codex** | `npm install -g @openai/codex`, then `onebrain plugin install --harness codex` | `codex` | `AGENTS.md` |
| **Qwen Code** | `npm install -g @qwen-code/qwen-code` | `qwen` | `AGENTS.md` |

> Auto-checkpoint and incremental search hooks ship for Claude Code, Gemini
> CLI, and Codex. Claude invokes `/braindump`, Gemini invokes
> `/onebrain:braindump`, and Codex invokes `$onebrain:braindump`. Codex
> installation is an explicit managed opt-in. `onebrain plugin update`
> refreshes Codex only after that opt-in marker exists. To remove the managed
> installation, run `onebrain plugin uninstall --harness codex`; user Codex
> settings remain intact.

### 1. Install the OneBrain CLI

Pick the install path that fits your environment — all three converge on the same v3.x Rust binary.

```bash
# macOS (Homebrew tap — recommended)
brew tap onebrain-ai/onebrain
brew install onebrain

# Any platform via npm wrapper (postinstall downloads the platform binary)
npm install -g @onebrain-ai/cli

# Direct download — pick the matching target triple for your platform
# https://github.com/onebrain-ai/onebrain-cli/releases/latest
```

The full CLI source + release pipeline lives at [`onebrain-ai/onebrain-cli`](https://github.com/onebrain-ai/onebrain-cli). After install, use the built-in self-installer to refresh in place:

```bash
onebrain update          # prompt-and-confirm
onebrain update --check  # dry-run
```

### 2. Create and initialize your vault

```bash
mkdir my-vault && cd my-vault
onebrain init
```

### 3. Open Obsidian (optional)

File → Open Folder as Vault → select this folder

### 4. Personalize your vault

In Claude/Gemini: `/onboarding`. In Codex: `$onebrain:onboarding`.

> **Adding OneBrain to an existing vault?** `cd` into it and run `onebrain init`

### Browse in a browser — `onebrain serve`

Prefer the browser, or on a machine without Obsidian? The CLI ships a local **web UI** — nothing extra to install (it's embedded in the binary):

```bash
cd my-vault
onebrain serve --open      # → http://127.0.0.1:6789/?token=<TOKEN>
```

A file explorer, a reading view (markdown, code, PDF, Office docs, images, audio/video, Jupyter notebooks), a built-in search panel, and agent chat — over a token-gated, loopback-only vault API. See the [onebrain-cli README](https://github.com/onebrain-ai/onebrain-cli#local-web-ui) for flags + self-host (TLS) notes.

## Bring Your Own LLM

Already love Claude Code? Use it as a universal frontend. Point `ANTHROPIC_BASE_URL` at any OpenAI-compatible endpoint — Claude Code stays the harness, the LLM behind it changes per task.

```bash
# Recommended: claude-code-router handles Anthropic ↔ provider translation
npm install -g @musistudio/claude-code-router
ccr code                                    # first-run config, then launches Claude Code via the router
# (later) ccr stop                          # tear down the router before going native again

# Or direct: point ANTHROPIC_BASE_URL at any Anthropic-protocol endpoint
export ANTHROPIC_BASE_URL=https://your-router-or-anthropic-compatible-host
export ANTHROPIC_API_KEY=sk-byok-key
cd vault && claude

# Switch back to native Claude any time (manual-export route)
unset ANTHROPIC_BASE_URL ANTHROPIC_API_KEY
claude
```

| Route | What it gets you |
|---|---|
| **Local** (mlx, ollama, llama.cpp) | Cost-free routine work, full privacy. Pair with [`litellm`](https://github.com/BerriAI/litellm) or [`claude-code-router`](https://github.com/musistudio/claude-code-router). |
| **Cloud BYOK** (Claude, Gemini, GPT, Groq, OpenRouter) | Pay-as-you-go premium reasoning. One env-var swap, no code changes. |
| **Hybrid** (route by task or by cost) | Cheap models for routine, premium when it counts. |

Same vault. Same skills. Same memory. The LLM swaps; OneBrain doesn't notice.

## Personal AI OS Stack

Run OneBrain as your personal AI operating system — a complete AI environment that runs locally with no cloud infrastructure required.

**Recommended stack:**

| Surface | Role |
|------|------|
| [Claude Code](https://claude.ai/code) | Your AI agent, running in the terminal |
| [tmux](https://github.com/tmux/tmux) | Persistent sessions that survive disconnects and reboots |
| [Telegram](https://telegram.org) | Mobile access: send instructions, receive briefings from anywhere |
| [Obsidian](https://obsidian.md) *(optional)* | A vault viewer/editor UI — the vault is plain Markdown either way |

**Setting up the full stack:**

1. Install OneBrain and initialize your vault ([Get Started](#1-install-the-onebrain-cli))
2. Start a tmux session: `tmux new -s onebrain`
3. Start Claude Code in your vault directory: `claude`
4. Run `/telegram:configure` to connect Claude Code's built-in Telegram channel — no custom bot or external infra needed
5. From any device, open Telegram and send instructions directly to your OneBrain agent

### Using Obsidian? (optional)

Install these three plugins via **Settings → Community plugins → Browse**, then click **Trust author and enable plugins** when prompted:

- **Tasks** — task management with due dates
- **Dataview** — query notes like a database
- **Terminal** — run your AI agent from within Obsidian

These are recommended but optional:

- **Templater** — advanced templates
- **Calendar** — visual calendar view
- **Tag Wrangler** — manage tags across vault
- **QuickAdd** — fast capture workflows
- **Obsidian Git** — version control for your vault

#### Claude Code Skills (Optional)

For Obsidian-specific Claude Code skills (markdown, bases, canvas, and more), install the [Obsidian Skills](https://github.com/kepano/obsidian-skills) plugin separately:

```
/plugin marketplace add kepano/obsidian-skills
/plugin install obsidian@obsidian-skills
```

## Prerequisites & Detailed Setup

### Prerequisites

**Required:** [git](https://git-scm.com) — used to version-control your vault.

| Platform | Install command |
|----------|----------------|
| macOS (Homebrew) | `brew install git` |
| macOS (Xcode CLT) | `xcode-select --install` |
| Windows (winget) | `winget install --id Git.Git` |
| Windows (Chocolatey) | `choco install git` |
| Debian / Ubuntu | `sudo apt install git` |
| Fedora / RHEL | `sudo dnf install git` |
| Arch | `sudo pacman -S git` |

Verify with `git --version` before running the installer.

**Source builds (optional):** The published v3.x CLI is a self-contained Rust binary — `npm install`, `brew install`, and direct GH Release download all give you the same artifact, no build dependencies needed. Building from source requires a [Rust toolchain](https://rustup.rs) (`rustup default stable`); see [`onebrain-ai/onebrain-cli`](https://github.com/onebrain-ai/onebrain-cli#build-from-source) for instructions.

**Windows:** Git for Windows (above) includes Git Bash, which provides the `bash` environment required to run all hooks.
