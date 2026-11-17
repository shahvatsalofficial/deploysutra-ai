# No auto-deploy or auto-rollback

**Rule:** `09-operator-safety` · **Maintainer:** Vatsal Shah

No unattended apply, upgrade, rollout, downgrade, restart, reconfiguration, secret rotation or destructive infrastructure work.

**Implementation requirement:** enforce in CLI, server, host adapter and documentation as applicable. In security tests, prove unauthorized or unsupported paths are rejected rather than relying only on text instructions. Produce a stable finding if a policy is missing or untested.

**Evidence obligation:** include test output, source reference and `not_run` where a claim cannot be checked. No policy rule grants deployment authorization.
