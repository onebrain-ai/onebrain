# MCP Server

`onebrain mcp` serves OneBrain over the Model Context Protocol (stdio) — search tools today, more vault tool groups to come *(planned)*.

> Part of [OneBrain docs](../README.md)

## Quick start

```bash
onebrain mcp   # runs an MCP stdio server; not meant to be invoked directly in a terminal —
               # wire it into an MCP client config instead (see below)
```

`.mcp.json` in the plugin (Claude Code wiring):

```json
{
  "search": {
    "command": "onebrain",
    "args": ["mcp"]
  }
}
```

Claude Code auto-discovers this and exposes tools under the `mcp__plugin_onebrain_search__*` namespace.

## Tools shipped today

| Group | Tools |
|---|---|
| Search | `query` (hybrid lex+vector, RRF-fused), `get` / `multi_get` (fetch indexed doc text), `status` (index health) |

*(planned)* — more vault tool groups (per the CLI's own `mcp --help` description: "search tools today, more vault tool groups to come").

## Configuration

No dedicated `onebrain.yml` block for `mcp` itself — it reads the same `search:` config (`search.collection`, embed model) documented in [search.md](search.md), since its only tool group today is search.

## Generic MCP client note

Any MCP-compatible client can launch `onebrain mcp` as a stdio server — the wiring above is Claude Code's `.mcp.json` convention, but the command itself (`onebrain mcp`) is client-agnostic. Point your client's MCP config at the `onebrain` binary with the single `mcp` argument.

## Notes

- Requires CLI ≥ 3.4.1 (`onebrain mcp` first shipped there); older CLIs lack the top-level command.
- The server key in `.mcp.json` was renamed from `qmd` to `search` during the v3.4.5 cutover — the command invoked (`onebrain mcp`) did not change, only the config key and tool namespace.
