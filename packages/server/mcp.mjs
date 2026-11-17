// Minimal read-only MCP server over stdio (newline-delimited JSON-RPC 2.0). No network, no writes, no SDK dependency.
// Scope is a single workspace root fixed at start-up. Tools take paths RELATIVE to that root; escapes and symlinks are refused.
// Verified with a scripted JSON-RPC client (tests/mcp.test.mjs). NOT validated with MCP Inspector or a third-party client.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {VERSION, RULES, PROFILES, explainRule, readManifests, assess, inspectTofuPlan, inspectRollback, safeFile, verify} from '../core/index.mjs';

const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const rel = {type: 'string', minLength: 1, maxLength: 260};
export const TOOLS = [
  {name: 'compare_manifests', description: 'Compare two Kubernetes manifest files inside the workspace (static, offline). Returns the gate, reasons, findings and changes. Never approves a deployment.', inputSchema: {type: 'object', properties: {before: rel, after: rel, profile: {enum: Object.keys(PROFILES)}}, required: ['before', 'after'], additionalProperties: false}},
  {name: 'explain_policy', description: 'Explain one DS-K8S rule: why it exists, trigger, remediation and known false positives.', inputSchema: {type: 'object', properties: {id: {type: 'string', pattern: '^DS-K8S-\\d{3}$'}}, required: ['id'], additionalProperties: false}},
  {name: 'list_policies', description: 'List every rule ID with severity and title, plus the available profiles.', inputSchema: {type: 'object', properties: {}, additionalProperties: false}},
  {name: 'summarize_plan_actions', description: 'Summarise an OpenTofu/Terraform plan JSON file (resource types and actions only; state values are discarded).', inputSchema: {type: 'object', properties: {plan: rel}, required: ['plan'], additionalProperties: false}},
  {name: 'list_rollback_gaps', description: 'List which rollback prerequisites are missing or merely declared, from an optional evidence JSON file.', inputSchema: {type: 'object', properties: {evidence: rel}, additionalProperties: false}},
  {name: 'verify_evidence', description: 'Check the SHA-256 seal of a DeploySutra JSON report passed as a string. Tamper evidence only, not authenticity.', inputSchema: {type: 'object', properties: {report: {type: 'string', maxLength: 4000000}}, required: ['report'], additionalProperties: false}}
];

/** Resolve a workspace-relative path; refuses absolute paths, traversal and anything outside the root. */
export function resolveInRoot(root, p) {
  if (typeof p !== 'string' || !p || p.includes('\0')) throw new Error('Invalid path');
  if (path.isAbsolute(p)) throw new Error('Absolute paths are not allowed; use a path relative to the workspace');
  const realRoot = fs.realpathSync(root);
  const abs = path.resolve(realRoot, p);
  if (abs !== realRoot && !abs.startsWith(realRoot + path.sep)) throw new Error('Path escapes the workspace');
  return abs;
}

export function handleCall(root, name, args = {}) {
  const need = (k, v) => { if (typeof v !== 'string' || !v) throw new Error(`Missing or invalid argument: ${k}`); return v; };
  switch (name) {
    case 'compare_manifests': {
      const b = readManifests(resolveInRoot(root, need('before', args.before))).docs; const a = readManifests(resolveInRoot(root, need('after', args.after))).docs;
      const r = assess(b, a, null, {profile: args.profile});
      return {gate: r.gate, gateReasons: r.gateReasons, profile: r.profile, findings: r.policyFindings.map(f => ({id: f.id, severity: f.severity, status: f.status, resource: f.resource, where: `${f.source}:${f.line ?? '?'}`, message: f.message})), changes: r.diffs.map(d => ({resource: d.resource, path: d.path, before: d.before, after: d.after})), blastRadiusQuestions: r.blastRadius, seal: r.integrity.digest, note: 'Advisory static analysis. A human decides.'};
    }
    case 'explain_policy': return explainRule(need('id', args.id));
    case 'list_policies': return {rules: RULES.map(r => ({id: r.id, severity: r.severity, title: r.title})), profiles: PROFILES};
    case 'summarize_plan_actions': {
      let plan; try { plan = JSON.parse(safeFile(resolveInRoot(root, need('plan', args.plan))).text); } catch (e) { throw new Error(`Cannot read plan: ${e.message}`); }
      const r = inspectTofuPlan(plan); return {gate: r.gate, gateReasons: r.gateReasons, counts: r.counts, byType: r.byType, dangerousChangeCount: r.dangerousChangeCount, truncated: r.truncated, discardedSections: r.ignoredSensitiveSections, seal: r.integrity.digest};
    }
    case 'list_rollback_gaps': {
      let ev = null; if (args.evidence) { try { ev = JSON.parse(safeFile(resolveInRoot(root, args.evidence)).text); } catch (e) { throw new Error(`Cannot read evidence: ${e.message}`); } }
      const r = inspectRollback(ev); return {ready: r.ready, checks: r.checks, reason: r.reason};
    }
    case 'verify_evidence': { let doc; try { doc = JSON.parse(need('report', args.report)); } catch { throw new Error('report is not valid JSON'); } return {verified: verify(doc), meaning: 'Unkeyed SHA-256 check; not proof of who produced the report'}; }
    default: throw Object.assign(new Error(`Unknown tool: ${name}`), {code: -32602});
  }
}

export function respond(root, msg) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return {jsonrpc: '2.0', id: msg?.id ?? null, error: {code: -32600, message: 'Invalid Request'}};
  const id = msg.id; const isNote = id === undefined;
  const ok = result => (isNote ? null : {jsonrpc: '2.0', id, result});
  const err = (code, message) => (isNote ? null : {jsonrpc: '2.0', id, error: {code, message}});
  switch (msg.method) {
    case 'initialize': { const want = msg.params?.protocolVersion; return ok({protocolVersion: PROTOCOLS.includes(want) ? want : PROTOCOLS[0], capabilities: {tools: {listChanged: false}}, serverInfo: {name: 'deploysutra', version: VERSION}, instructions: 'Read-only deployment risk analysis scoped to one workspace directory chosen at start-up. Results are advisory static analysis; they never approve a deployment.'}); }
    case 'notifications/initialized': case 'notifications/cancelled': return null;
    case 'ping': return ok({});
    case 'tools/list': return ok({tools: TOOLS});
    case 'tools/call': {
      const name = msg.params?.name;
      if (!TOOLS.some(t => t.name === name)) return err(-32602, `Unknown tool: ${name}`);
      try { return ok({content: [{type: 'text', text: JSON.stringify(handleCall(root, name, msg.params?.arguments || {}), null, 2)}], isError: false}); } catch (e) { return ok({content: [{type: 'text', text: `Error: ${e.message}`}], isError: true}); }
    }
    default: return err(-32601, `Method not found: ${msg.method}`);
  }
}

export function serveMcp(root, {input = process.stdin, output = process.stdout} = {}) {
  const rl = readline.createInterface({input, crlfDelay: Infinity});
  rl.on('line', line => {
    if (!line.trim()) return;
    let msg; try { msg = JSON.parse(line); } catch { output.write(JSON.stringify({jsonrpc: '2.0', id: null, error: {code: -32700, message: 'Parse error'}}) + '\n'); return; }
    const out = Array.isArray(msg) ? msg.map(m => respond(root, m)).filter(Boolean) : respond(root, msg);
    if (out && (!Array.isArray(out) || out.length)) output.write(JSON.stringify(out) + '\n');
  });
  return rl;
}
