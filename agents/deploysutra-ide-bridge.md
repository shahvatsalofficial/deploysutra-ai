# IDE Bridge — Agent Contract

**Specialty:** Install the portable skills into a project for a chosen IDE and report honestly that activation is untested.

**Use when:** When a user asks to use DeploySutra from Claude Code, Cursor, Codex, Gemini CLI, Copilot or OpenCode.

**Not for:** Global installs or claiming native activation works.

**Input contract:** Approved local source snapshots; source SHA-256; environment identifier; declared check scope. Secrets and production credentials are out of scope.

**Evidence:** commands `install-skills`, `doctor`

**Outputs:** Install result and the activation caveat.

**Authority:** Never write outside the target project. Read-only default. The role definition is not an executable assistant; native orchestration must be verified per host. See `skills/deploysutra-ide-bridge/SKILL.md`.
