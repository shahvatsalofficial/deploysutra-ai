# DeploySutra AI - Independent self-audit

**Overall:** PASS_WITH_NOT_RUN  
**Checks:** 42 passed, 0 failed, 7 not run of 49  
**Generated:** 2026-11-17T17:13:23.810Z

> Measured by running the tool against itself. It supports the claims it makes about itself (offline, read-only, no secret leakage, deterministic, fail-closed gate). It is not a certification of any deployment, and it does not replace independent third-party review.

## Automated test suite

**Status:** PASS

The repository test suite executed as a child process; counts are parsed from its TAP output.

| Check | Result | Detail |
| --- | --- | --- |
| node --test suite | PASS | 312 tests: 308 passed, 0 failed, 4 skipped |

## Rule accuracy on the labelled corpus

**Status:** PASS

50 author-labelled cases. This is a regression corpus, not an independent benchmark: it shows the rules do what they claim on these inputs, not that they catch every real misconfiguration.

| Check | Result | Detail |
| --- | --- | --- |
| Corpus precision | PASS | 100.0% (32 TP, 0 FP) |
| Corpus recall | PASS | 100.0% (0 FN) |
| Every case matches exactly | PASS | 50/50 cases (31 positive, 19 negative twins) |
| Every per-document rule has a positive case | PASS | 18/18 rules exercised |
| Diff-level rule DS-K8S-019 (resource removed) | PASS | a resource missing from AFTER is reported |

## Secret and state leakage

**Status:** PASS

Canary strings were planted in every place a secret could plausibly be copied from, then the produced reports were searched for them.

| Check | Result | Detail |
| --- | --- | --- |
| Env password, Secret data and annotation token never reach report JSON | PASS | 3 canaries planted in BEFORE and AFTER; 0 found |
| Plan variables, prior_state, values and addresses never reach plan summary | PASS | canaries in variables, prior_state, before/after and address; 0 found |
| Secret-like env literal is flagged without echoing the value | PASS | DS-K8S-012 raised, value withheld |
| Diffs mark redacted fields as redacted | PASS | 2 redacted field change(s) |
| Discarded plan sections are named, not copied | PASS | prior_state, variables |
| Shipped example reports contain no token-shaped strings | PASS | examples/reports scanned for GitHub/npm/AWS/private-key shapes |

- No canary appeared in any output.

## Hostile and malformed input

**Status:** PASS_WITH_NOT_RUN

Untrusted manifests are data. The parser must fail loudly, never skip, never hang.

| Check | Result | Detail |
| --- | --- | --- |
| Unsupported YAML constructs fail explicitly | PASS | 15/15 hostile inputs rejected with an Error |
| Mutation fuzz (400 inputs, fixed seed) | PASS | 0 non-Error crashes, 0 parses over 500 ms |
| Deeply nested input is handled | PASS | 400 nesting levels handled without a stack overflow |
| Input over 1 MiB is refused | PASS | readManifests rejects >1 MiB |
| Non-manifest extension is refused | PASS | .txt rejected |
| Symlinked input is refused | NOT_RUN | this OS user cannot create symlinks (Windows without Developer Mode); covered on Linux/macOS CI |

## Evidence integrity and gate safety

**Status:** PASS

SHA-256 seals are tamper evidence, not signatures. The gate has exactly two states.

| Check | Result | Detail |
| --- | --- | --- |
| Equal inputs give an identical digest (deterministic) | PASS | 29ec76d7a2a7beb0… |
| Digest survives a JSON round trip | PASS | verify(JSON.parse(JSON.stringify(report))) is true |
| Edited gate is detected | PASS | BLOCKED → READY edit rejected |
| Added field is detected | PASS | extra property rejected |
| Removed seal is detected | PASS | report without integrity rejected |
| No input can produce a READY gate | PASS | 50 corpus resources assessed with every rollback box ticked; gates seen: HUMAN_REVIEW_REQUIRED, BLOCKED |
| Declared rollback evidence is never "ready" | PASS | all five declarations → DECLARED_NOT_VERIFIED, ready=false |

## Static safety review of the source

**Status:** PASS

Regex scans of the shipped code. They prove absence of these patterns, not absence of every possible vulnerability.

| Check | Result | Detail |
| --- | --- | --- |
| No subprocess APIs in shipped packages | PASS | child_process appears only in the audit runner itself (it runs the test suite and the CLI help) |
| No dynamic code execution | PASS | no eval / new Function |
| No outbound network calls | PASS | no fetch/https/net/dgram usage |
| Only the loopback report server listens on a socket | PASS | node:http and listen() appear only in packages/server/index.mjs |
| CLI exposes no deploy/apply/destroy/rollback/exec/sync command | PASS | none listed in 'deploysutra help' |
| No token-shaped strings in the shipped source | PASS | 14 source files scanned |
| Core has zero runtime dependencies | PASS | package.json has no "dependencies" |

- Source tree digest: 266d433d40ce61447e05709655d006c58cd701c4d58ebf2ad857f754d4476c97

## Performance budgets

**Status:** PASS

Median of 5 runs on this machine. Budgets are deliberately loose guardrails against regressions, not benchmarks of other hardware.

| Check | Result | Detail |
| --- | --- | --- |
| assess() 200 resources before/after | PASS | median 37 ms (budget 3000 ms) |
| parse 200 documents | PASS | median 12 ms (budget 2000 ms) |
| rules over 200 resources | PASS | median 1 ms (budget 1000 ms) |

## Package and instruction assets

**Status:** PASS

Structural checks that the shipped package is internally consistent.

| Check | Result | Detail |
| --- | --- | --- |
| package.json version matches VERSION constant | PASS | 0.2.0 |
| bin targets exist | PASS | deploysutra, deploysutra-ai |
| files[] entries exist | PASS | 21 entries |
| 25 portable skills with valid frontmatter | PASS | 25 skills, 25 valid frontmatter |
| Every skill declares what deterministic command/rule backs it | PASS | 25/25 carry a "Backed by" line |
| 20 agent roles registered with files on disk | PASS | 25 role definitions |
| 8 workflows and 10 safety rule files | PASS | 8 workflows, 10 rules |
| License and notices present | PASS | LICENSE, NOTICE, SECURITY.md, CHANGELOG.md |

## Explicitly not run

**Status:** NOT_RUN

Listed so nobody mistakes absence of a result for a pass.

| Check | Result | Detail |
| --- | --- | --- |
| Live cluster dry-run (kubectl diff / --dry-run=server) | NOT_RUN | by design: needs credentials; never run automatically |
| MCP Inspector / third-party MCP client | NOT_RUN | MCP server verified with a scripted JSON-RPC client only |
| Native activation of skills in each IDE | NOT_RUN | skills are copied, not proven to be loaded by each host |
| Independent third-party benchmark of the rules | NOT_RUN | only the author-labelled corpus exists |
| Signed releases | NOT_RUN | npm provenance only if published via CI; reports carry unkeyed checksums, not signatures |
| macOS / Windows results from this run | NOT_RUN | only win32 was measured here; see CI for the matrix |

## Environment

| Key | Value |
| --- | --- |
| tool | deploysutra-ai 0.2.0 |
| node | v24.15.0 |
| platform | win32 10.0.26300 |
| arch | x64 |
| cpus | 14 |
| offline | no network access was used |

## Reproduce

```bash
npm ci --ignore-scripts   # no dependencies, so this only checks the lockfile-free install
```

```bash
npm test
```

```bash
npx deploysutra-ai audit --out audit-out
```

```bash
node packages/cli/index.mjs verify --report audit-out/audit-report.json
```

## Honest limits

- Counts and timings come from this run on this machine.
- The labelled corpus is written by the tool author; it is a regression corpus, not an independent benchmark.
- Static rules inspect desired state only; they cannot prove runtime reachability, IAM scope or data recoverability.
- A SHA-256 seal detects accidental or deliberate edits only when compared with a trusted copy; it does not authenticate the author.
- Skill and agent files are instruction text; native activation in each IDE is untested.

Report SHA-256 (unkeyed, tamper evidence only): `a2e809705de4ae230feb3187542cdb68dea8ac5d377e574e4670724258bad6ed`
