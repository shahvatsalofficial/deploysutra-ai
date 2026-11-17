# Evidence, provenance, and truth semantics

Every static check should cite its local manifest source and SHA-256 digest, and where possible the key line number. The currently implemented outputs distinguish: `VERIFIED_STATIC` (code parsed/check ran locally), `NOT_RUN` (no external check), `NOT_TESTED` (unavailable/no validation), `DECLARED_NOT_VERIFIED` (user supplied information without independent proof), and blocked gates. `BLOCKED` is a review signal and prevents automatic promotion; no gate is an authorization to deploy.

`integrity.digest` is an unkeyed SHA-256 checksum over the report body. It detects changed bytes when compared against the originally trusted checksum; it does not prove who created the report, prevent attackers from regenerating a digest, or certify a result.

Plan JSON may contain plaintext secrets. The imported plan action reporter deliberately retains only resource types and action counts. Never put actual provider resource addresses or `before`/`after` state in output by default. Source input should not be sent to external LLMs without an explicit privacy and retention decision.

Real rollback requires evidence of a successful restore drill, environment scope, timing, prior artifact versions, independent approval and failure modes. A checked box in a supplied JSON document is just a declaration.

## Six evidence states (v0.2)
`VERIFIED_STATIC` (computed over the supplied files), `EXECUTED_VERIFIED` (a separately recorded tool result; never produced by this CLI), `DECLARED_NOT_VERIFIED`, `NOT_TESTED`, `NOT_RUN`, `FAILED`. Reports never collapse a mix into "passed". `lineConfidence` is `exact` (parser source map), `parent` (nearest existing ancestor of an absent field, for example missing limits) or `unknown`; lines are never invented.

## Deterministic digests
The seal is SHA-256 over a canonical JSON form (object keys sorted recursively), so equal content always gives the same digest regardless of key order or a JSON round trip. Analysis reports carry no timestamps. The self-audit report records `generatedAt` because it measures a moment.
