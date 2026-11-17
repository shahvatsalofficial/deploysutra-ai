# IDE portability — explicit status matrix

| Host family | Portable SKILL.md copy target | Status |
|---|---|---|
| Claude Code | `.claude/skills/<skill>/SKILL.md` | Local copy tested; native selection unverified |
| Cursor | `.cursor/skills/<skill>/SKILL.md` | Local copy tested; native selection unverified |
| Codex | `.agents/skills/<skill>/SKILL.md` | Local copy tested; native selection unverified |
| Gemini CLI | `.gemini/skills/<skill>/SKILL.md` | Local copy tested; native selection unverified |
| GitHub Copilot | `.github/skills/<skill>/SKILL.md` | Local copy tested; native selection unverified |
| OpenCode | `.opencode/skills/<skill>/SKILL.md` | Local copy tested; native selection unverified |

All use the same canonical portable files in `skills/`. These are instruction contracts, not executable agents or permission grants. Install into a user-approved project directory only; no global installer. A particular host version may use additional/alternative path conventions; verify official docs and functionality before saying integration is supported. An `AGENTS.md` fallback provides general cross-agent instructions. Future MCP server integration must use official protocol SDK, secure scopes and explicit host consent.

## MCP (optional, read-only)
```json
{"mcpServers": {"deploysutra": {"command": "npx", "args": ["-y", "deploysutra-ai", "mcp", "--root", "."]}}}
```
Six tools: `compare_manifests`, `explain_policy`, `list_policies`, `summarize_plan_actions`, `list_rollback_gaps`, `verify_evidence`. Verified with a scripted JSON-RPC client only; **not** with MCP Inspector or any specific IDE. The server cannot deploy, write files, spawn processes or reach the network.
