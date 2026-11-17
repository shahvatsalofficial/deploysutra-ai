# Audit reports (Markdown + HTML + JSON)

Every report DeploySutra writes comes in three forms of the **same sealed content**:

| File | For | Notes |
|---|---|---|
| `*.html` | People: reviewers, managers, auditors | Self-contained, no JavaScript, no external assets, light/dark, print-friendly, keyboard accessible. Gate colours are red (BLOCKED), amber (HUMAN_REVIEW_REQUIRED), grey (unknown). Never green. |
| `*.md` | Pull requests, tickets, chat, docs sites | Table-safe: pipes, backticks and newlines from manifests are neutralised. |
| `*.json` | Machines and CI | Schema: `schemas/report.schema.json`. Deterministic for equal inputs (no timestamps in analysis reports). |

## Two kinds of report

1. **Deployment review** (`deploysutra analyze … --out dir`) writes `deploy-readiness.{json,md,html}` plus `environment-diff.json`, `policy-findings.json`, `blast-radius.md`, `rollback-checklist.md`.
2. **Independent self-audit** (`deploysutra audit --out dir`) writes `audit-report.{json,md,html}`. It runs the tool against itself and records what *was measured on your machine, just now*.

Plan summaries (`deploysutra tofu … --out dir`) use the same three formats.

## What the self-audit measures

| Section | What is actually done |
|---|---|
| Automated test suite | Runs `node --test` as a child process and parses the TAP counts. Reported `NOT_RUN` from an npm install (tests are not shipped) or with `--skip-tests`. |
| Rule accuracy | Runs the 50-case labelled corpus: precision, recall, every rule exercised, positive and negative twins. |
| Secret and state leakage | Plants canary strings in env vars, Secret data, annotations, plan variables, prior state and resource addresses, then searches every produced report for them. |
| Hostile and malformed input | 15 hostile YAML constructs must be rejected; 400 seeded mutation-fuzz inputs must never crash or hang; 1 MiB limit, extension and symlink refusal. |
| Evidence integrity and gate safety | Determinism, JSON round-trip, tamper detection (edited, extended, unsealed), and a check that no input in the corpus can ever produce anything but BLOCKED or HUMAN_REVIEW_REQUIRED, even with every rollback box ticked. |
| Static safety review | Regex scans of the shipped source: no subprocess APIs, no `eval`, no outbound network, sockets only in the loopback server, no deploy/apply command in the CLI, no token-shaped strings, zero dependencies. |
| Performance budgets | Median of 5 runs for 200 resources; loose guardrails against regressions. |
| Package and instruction assets | Version consistency, `bin` and `files` exist, 25 skills with frontmatter and a "Backed by" line, 20 agents, 8 workflows, 10 rules, legal files. |
| Explicitly not run | Live cluster dry run, MCP Inspector, native IDE activation, independent benchmark, signing, other operating systems. |

## What it does not prove

- The corpus is written by the author. It is a regression corpus, not an independent benchmark.
- A pass is not a certification of any deployment and does not replace third-party review.
- The SHA-256 seal detects edits only when compared with a trusted copy. It does not identify who produced a report.
- Counts and timings are from one machine; the CI matrix covers Ubuntu, Windows and macOS on Node 20, 22 and 24.

## Verify it yourself

```bash
npx deploysutra-ai audit --out audit-out
npx deploysutra-ai verify --report audit-out/audit-report.json
```

The recorded run shipped with this version lives in `docs/proof/` (raw TAP log, environment, corpus results, CLI transcripts, and the audit report in all three formats).
