# Codex Tool Mapping

Skills and INSTRUCTIONS.md use Claude Code tool names. When you encounter these, use the Codex equivalent:

| INSTRUCTIONS references | Codex equivalent |
|---|---|
| `Read`, `Write`, `Edit` | Use native file tools |
| `Bash` (run commands) | Use native shell tools |
| `Glob`, `Grep` | Use native search tools |
| `WebSearch`, `WebFetch` | Use native web tools |
| `AskUserQuestion` | Use the structured user-input tool when available; otherwise ask conversationally |
| `Skill` (invoke a skill) | Skills load natively — follow instructions directly |
| `Agent` (dispatch sub-agent) | `spawn_agent`, then `wait_agent` when the result is required — see below |
| `mcp__plugin_onebrain_search__*` | Use the matching search MCP tools when they appear in the capability/tool list; otherwise use the documented native fallback |
| `/skill` in shared docs | Invoke as `$onebrain:skill` on Codex; keep `/skill` on Claude/Gemini |

## Sub-agent dispatch

Enable multi-agent support in `~/.codex/config.toml`:

```toml
[features]
multi_agent = true
```

When INSTRUCTIONS or a skill dispatches an agent (inbox-classifier, tag-suggester, etc.):

1. Find the agent prompt in `.claude/plugins/onebrain/agents/[name].md`
2. Fill any template variables
3. Run: `spawn_agent(agent_type="worker", message="Your task is to perform the following.\n\n<agent-instructions>\n[filled prompt]\n</agent-instructions>\n\nExecute now.")`
4. Use `wait_agent` when the result is required. Codex has no `close_agent` step.

## TodoWrite → not needed

OneBrain does not use `TodoWrite` for session tracking. Task items are written directly to vault markdown files using Obsidian task syntax (`- [ ] Task 📅 YYYY-MM-DD`).
