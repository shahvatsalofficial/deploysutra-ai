# Fail-closed deploy readiness

**Rule:** `05-risk-gate` · **Maintainer:** Vatsal Shah

If critical policy findings, unsafe permission or missing rollback are present, BLOCKED. Otherwise remain HUMAN_REVIEW_REQUIRED until authorized independent verification.

**Implementation requirement:** enforce in CLI, server, host adapter and documentation as applicable. In security tests, prove unauthorized or unsupported paths are rejected rather than relying only on text instructions. Produce a stable finding if a policy is missing or untested.

**Evidence obligation:** include test output, source reference and `not_run` where a claim cannot be checked. No policy rule grants deployment authorization.
