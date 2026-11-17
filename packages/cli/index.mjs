#!/usr/bin/env node
// DeploySutra AI CLI. Offline, read-only analysis. There is deliberately no apply/deploy/destroy/rollback command.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {VERSION, RULES, PROFILES, RULES_VERSION, explainRule, readManifests, assess, safeFile, inspectTofuPlan, loadRollback, verify, checkPolicies} from '../core/index.mjs';
import {renderMarkdown, renderHTML, saveReports} from '../reporting/index.mjs';
import {installSkills} from './install.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const BOOL = new Set(['quiet', 'skip-tests', 'help', 'version']);
const argv = process.argv.slice(2);
let cmd = argv.shift() || 'help';
const opts = {}; const rest = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); if (BOOL.has(k)) opts[k] = true; else { const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) { console.error(`DeploySutra: Missing value for --${k}`); process.exit(1); } opts[k] = v; i++; } } else rest.push(a);
}
if (cmd === '--version' || cmd === '-v' || opts.version) cmd = 'version';
if (cmd === '--help' || cmd === '-h' || opts.help) cmd = 'help';
const need = k => { if (!opts[k]) throw new Error(`Missing --${k}`); return opts[k]; };
const json = x => process.stdout.write(JSON.stringify(x, null, 2) + '\n');
const SEV = ['LOW', 'MEDIUM', 'HIGH'];

const HELP = `DeploySutra AI ${VERSION} - human-controlled deployment risk analysis (offline, read-only)

Commands:
  analyze --before <file> --after <file> [--rollback <json>] [--profile development|staging|production] [--out <dir>] [--format md|json|html]
  policy  --input <file> [--fail-on LOW|MEDIUM|HIGH]
  rules                         list every rule ID
  explain <DS-K8S-NNN>          why a rule exists, remediation, false positives
  tofu    --input <plan.json> [--out <dir>]
  verify  --report <report.json>
  audit   [--out <dir>] [--skip-tests] [--quiet]     independent self-audit (JSON + Markdown + HTML)
  doctor
  install-skills --host claude|cursor|codex|gemini|copilot|opencode [--target <project dir, default .>]
  serve   --report <report.json> [--port 4318]       loopback read-only API (needs DEPLOYSUTRA_TOKEN)
  mcp     [--root <dir>]                             read-only MCP server over stdio
  version

Exit codes: 0 ok | 1 error | 2 BLOCKED gate (or --fail-on hit) | 3 report failed verification
No deploy/apply/cluster-write command exists. Reports never approve a deployment.`;

async function run() {
  switch (cmd) {
    case 'help': console.log(HELP); return 0;
    case 'version': console.log(VERSION); return 0;
    case 'doctor': {
      const major = Number(process.versions.node.split('.')[0]);
      json({product: 'DeploySutra AI', version: VERSION, node: process.version, nodeSupported: major >= 20, platform: process.platform, offline: true, cloudAccess: 'NOT_USED', deploymentCommandsAvailable: false, subprocessExecution: 'NONE in analysis; only the audit command runs this package own tests', rules: RULES.length, rulesVersion: RULES_VERSION, profiles: Object.keys(PROFILES), hostAdapters: 'skill-copy only; native activation unverified', apiKeyRequired: false});
      return major >= 20 ? 0 : 1;
    }
    case 'rules': json({rulesVersion: RULES_VERSION, profiles: PROFILES, rules: RULES.map(({id, severity, title, trigger}) => ({id, severity, title, trigger}))}); return 0;
    case 'explain': json(explainRule(rest[0] || need('id'))); return 0;
    case 'policy': {
      const {docs, source} = readManifests(need('input'));
      const findings = docs.flatMap(checkPolicies);
      json({source, resources: docs.length, findings});
      const t = opts['fail-on']; if (t) { if (!SEV.includes(t)) throw new Error('--fail-on must be LOW, MEDIUM or HIGH'); return findings.some(f => SEV.indexOf(f.severity) >= SEV.indexOf(t)) ? 2 : 0; }
      return 0;
    }
    case 'analyze': {
      const before = readManifests(need('before')).docs; const after = readManifests(need('after')).docs;
      const r = assess(before, after, loadRollback(opts.rollback), {profile: opts.profile});
      if (opts.out) console.log('Reports saved: ' + saveReports(r, opts.out));
      else if (opts.format === 'json') json(r); else if (opts.format === 'html') console.log(renderHTML(r)); else console.log(renderMarkdown(r));
      return r.gate === 'BLOCKED' ? 2 : 0;
    }
    case 'tofu': {
      let plan; try { plan = JSON.parse(safeFile(need('input')).text); } catch (e) { throw new Error(`Cannot read plan: ${e.message}`); }
      const r = inspectTofuPlan(plan);
      if (opts.out) { saveReports(r, opts.out); console.log('Report saved: ' + path.resolve(opts.out)); } else json(r);
      return r.gate === 'BLOCKED' ? 2 : 0;
    }
    case 'verify': {
      let r; try { r = JSON.parse(safeFile(need('report')).text); } catch (e) { throw new Error(`Cannot read report: ${e.message}`); }
      const ok = verify(r); json({valid: ok, kind: 'unkeyed-hash-check-only', meaning: 'Detects edits when compared with a trusted copy. Not proof of who produced the report.'}); return ok ? 0 : 3;
    }
    case 'audit': {
      const {runAudit} = await import('../core/audit.mjs');
      const r = runAudit({skipTests: Boolean(opts['skip-tests'])});
      if (opts.out) saveReports(r, opts.out);
      if (!opts.quiet) console.log(`Audit ${r.overall}: ${r.totals.passed} passed, ${r.totals.failed} failed, ${r.totals.notRun} not run of ${r.totals.checks}${opts.out ? `. Reports in ${path.resolve(opts.out)} (audit-report.md / .html / .json)` : ''}`);
      return r.overall === 'FAIL' ? 1 : 0;
    }
    case 'install-skills': json(installSkills({host: need('host'), target: opts.target || '.', root: repoRoot})); return 0;
    case 'serve': {
      const {startServer} = await import('../server/index.mjs');
      const s = await startServer({file: need('report'), port: Number(opts.port || 4318)});
      console.log(`Serving read-only on http://127.0.0.1:${s.address().port} (Authorization: Bearer <DEPLOYSUTRA_TOKEN>)`);
      return null;
    }
    case 'mcp': {
      const {serveMcp} = await import('../server/mcp.mjs');
      serveMcp(path.resolve(opts.root || '.'));
      return null;
    }
    default: throw new Error(`Unknown command ${String(cmd).slice(0, 40)}. Run "deploysutra help".`);
  }
}
try { const code = await run(); if (typeof code === 'number') process.exitCode = code; } catch (e) { console.error('DeploySutra:', e.message); process.exitCode = 1; }
