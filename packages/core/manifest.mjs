// Manifest ingestion (bounded, symlink-refusing) and semantic desired-state diff with redaction.
import path from 'node:path';
import {safeFile, sha256, clean, displayPath} from './util.mjs';
import {parseYAMLDocuments, parseLimitedYAML} from './yaml.mjs';
import {identityKey} from './rules.mjs';

export const MAX_DOCS = 200;
export {parseLimitedYAML};

/** Exact line map for a JSON document (parse validity is checked separately with JSON.parse). */
export function jsonLineMap(text) {
  const map = new Map(); let i = 0; let line = 1;
  const ws = () => { while (i < text.length && /\s/.test(text[i])) { if (text[i] === '\n') line++; i++; } };
  const str = () => { let s = ''; i++; while (i < text.length && text[i] !== '"') { if (text[i] === '\\') { s += text[i] + text[i + 1]; i += 2; } else s += text[i++]; } i++; return s; };
  const val = p => {
    ws(); const c = text[i];
    if (c === '{') { i++; ws(); if (text[i] === '}') { i++; return; } for (;;) { ws(); const l = line; const k = str(); ws(); i++; const kp = p ? `${p}.${k}` : k; map.set(kp, l); val(kp); ws(); if (text[i] === ',') { i++; continue; } i++; return; } }
    if (c === '[') { i++; ws(); if (text[i] === ']') { i++; return; } for (let n = 0; ; n++) { ws(); const ip = p ? `${p}.${n}` : String(n); map.set(ip, line); val(ip); ws(); if (text[i] === ',') { i++; continue; } i++; return; } }
    if (c === '"') { str(); return; }
    while (i < text.length && !/[,\]}\s]/.test(text[i])) i++;
  };
  val('');
  return map;
}

const validResource = v => v && typeof v === 'object' && !Array.isArray(v) && typeof v.kind === 'string' && v.metadata && typeof v.metadata.name === 'string' && v.metadata.name;

/** Read a manifest file that may hold several YAML documents or a JSON object/array/List. */
export function readManifests(file) {
  const {file: abs, text} = safeFile(file);
  if (!/\.(yaml|yml|json)$/i.test(abs)) throw new Error('Only YAML/JSON Kubernetes manifest files supported');
  const source = {path: displayPath(abs), sha256: sha256(text), bytes: Buffer.byteLength(text)};
  let raw;
  try {
    if (/\.json$/i.test(abs)) {
      const json = JSON.parse(text); const lm = jsonLineMap(text);
      if (Array.isArray(json)) raw = json.map((value, n) => ({value, map: new Map([...lm].filter(([k]) => k === String(n) || k.startsWith(n + '.')).map(([k, l]) => [k === String(n) ? '' : k.slice(String(n).length + 1), l]))}));
      else if (json && json.kind === 'List' && Array.isArray(json.items)) raw = json.items.map((value, n) => ({value, map: new Map([...lm].filter(([k]) => k.startsWith(`items.${n}.`)).map(([k, l]) => [k.slice(`items.${n}.`.length), l]))}));
      else raw = [{value: json, map: lm}];
    } else raw = parseYAMLDocuments(text);
  } catch (e) { throw new Error(`Invalid manifest: ${e.message}`); }
  if (raw.length > MAX_DOCS) throw new Error(`Too many documents (${raw.length} > ${MAX_DOCS})`);
  const seen = new Set();
  const docs = raw.map((r, n) => {
    if (!validResource(r.value)) throw new Error(`Manifest requires kind and metadata.name (document ${n + 1})`);
    const key = identityKey(r.value);
    if (seen.has(key)) throw new Error(`Duplicate resource identity ${clean(key, 120)}`);
    seen.add(key);
    return {value: r.value, lineMap: r.map, source: {...source, document: n + 1}, text};
  });
  return {docs, source};
}

/** Read a file that must contain exactly one resource (the single-document API). */
export function readManifest(file) {
  const {docs} = readManifests(file);
  if (docs.length !== 1) throw new Error(`Expected one resource, found ${docs.length}; use readManifests`);
  return docs[0];
}

/** Build an in-memory document from an object (used by the audit corpus and tests). */
export function docFromObject(obj, name = 'memory.json') {
  const text = JSON.stringify(obj, null, 2) + '\n';
  if (!validResource(obj)) throw new Error('Manifest requires kind and metadata.name');
  return {value: JSON.parse(text), lineMap: jsonLineMap(text), source: {path: name, sha256: sha256(text), bytes: Buffer.byteLength(text), document: 1}, text};
}

// ---- semantic diff ---------------------------------------------------------------------------------------------
const IGNORED = /^(status|metadata\.(resourceVersion|uid|creationTimestamp|generation|managedFields|selfLink|ownerReferences))(\.|$)/;
const SECRET_KEY = /^(password|passwd|token|apikey|api_key|secret|privatekey|private_key|accesskey|access_key|clientsecret)$/i;
const SECRETY = /(pass(word|wd)?|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential)/i;
const LABELS = [
  [/\.replicas$/, 'replicas'], [/strategy\.type$/, 'update strategy'], [/serviceAccountName$/, 'service identity'], [/hostNetwork$/, 'host networking'],
  [/\.image$/, 'container image'], [/^spec\.type$/, 'service exposure'], [/nodePort$/, 'node port'], [/rules\[\d*\]?.*host$/, 'ingress hostname'],
  [/privileged$/, 'privileged container'], [/allowPrivilegeEscalation$/, 'privilege escalation'], [/runAsUser$/, 'run-as user'], [/resources\.limits/, 'resource limit'], [/resources\.requests/, 'resource request']
];
const RISK = [[/\.image$/, 'image'], [/serviceAccountName$/, 'identity'], [/\.replicas$/, 'scale'], [/^spec\.type$|nodePort$|\.hostNetwork$|\.host$/, 'exposure'], [/privileged$|allowPrivilegeEscalation$|runAsUser$|capabilities/, 'privilege'], [/^rules|roleRef|subjects/, 'rbac'], [/strategy/, 'rollout']];

function leafValue(v) {
  if (v === undefined) return '[absent]';
  if (v === null) return null;
  if (typeof v === 'string') return clean(v.replace(/(bearer\s+|token=|password=|secret=)\S+/gi, '$1[REDACTED]'), 120);
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  return Array.isArray(v) ? '[]' : '{}';
}

function flatten(root, kind) {
  const out = new Map();
  const walk = (v, labelPath, numPath, redact) => {
    if (IGNORED.test(labelPath)) return;
    if (Array.isArray(v) && v.length) {
      const names = v.map(e => (e && typeof e === 'object' && typeof e.name === 'string' && e.name ? e.name : null));
      const named = names.every(Boolean) && new Set(names).size === names.length;
      v.forEach((e, i) => walk(e, `${labelPath}[${named ? names[i] : i}]`, numPath ? `${numPath}.${i}` : String(i), redact));
    } else if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length) {
      for (const k of Object.keys(v).sort()) {
        let red = redact || SECRET_KEY.test(k);
        if (kind === 'Secret' && !labelPath && /^(data|stringData|binaryData)$/.test(k)) red = true;
        const env = labelPath.match(/env\[([^\]]+)\]$/);
        if (k === 'value' && env && SECRETY.test(env[1])) red = true;
        walk(v[k], labelPath ? `${labelPath}.${k}` : k, numPath ? `${numPath}.${k}` : k, red);
      }
    } else out.set(labelPath, {value: v, numPath, redact});
  };
  walk(root, '', '', false);
  return out;
}

const labelFor = p => (LABELS.find(([re]) => re.test(p)) || [null, p])[1];
const riskFor = p => (RISK.find(([re]) => re.test(p)) || [null, 'other'])[1];

/** Diff two documents of the same identity. Values are redacted where sensitive; never raw secrets. */
export function diffManifests(before, after) {
  if (identityKey(before.value) !== identityKey(after.value)) throw new Error('Mismatched Kubernetes resource identity (kind/namespace/name)');
  const kind = after.value.kind; const resource = `${kind}/${after.value.metadata.namespace || 'default'}/${after.value.metadata.name}`;
  const a = flatten(before.value, kind); const b = flatten(after.value, kind);
  const out = [];
  for (const p of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const x = a.get(p); const y = b.get(p);
    if (x && y && JSON.stringify(x.value) === JSON.stringify(y.value)) continue;
    const redacted = Boolean(x?.redact || y?.redact);
    const side = y ? after : before; const num = (y || x).numPath;
    const exact = side.lineMap?.get(num);
    out.push({
      id: `DS-DIFF-${sha256(`${resource}|${p}`).slice(0, 9)}`, resource, path: p, label: labelFor(p), risk: riskFor(p),
      change: !x ? 'added' : !y ? 'removed' : 'changed',
      before: redacted ? '[redacted]' : leafValue(x?.value), after: redacted ? '[redacted]' : leafValue(y?.value), redacted,
      source: side.source.path, line: exact ?? null, lineConfidence: exact ? 'exact' : 'unknown', evidence: 'static-manifest-diff', scope: 'desired-state-only'
    });
  }
  return out;
}

/** Plain-language blast-radius questions derived from the changes. Questions, not conclusions. */
export function classifyChange(diffs, findings = []) {
  const w = new Set();
  for (const d of diffs) {
    if (d.risk === 'image') w.add('Workload image changed: check health signals, compatibility, and rollout readiness');
    if (d.risk === 'identity') w.add('Service identity changed: independently verify RBAC and external permissions');
    if (d.risk === 'scale') w.add('Replica count changed: verify availability and service scaling');
    if (d.path === 'spec.type') w.add('Service exposure changed: review traffic/security blast radius');
    if (d.risk === 'rbac') w.add('RBAC rules changed: review the exact verbs/resources granted and who is bound');
    if (d.risk === 'privilege') w.add('Privilege-related field changed: confirm the container really needs it');
    if (d.risk === 'rollout') w.add('Update strategy changed: confirm the surge/unavailable behaviour is safe for this service');
  }
  if (findings.some(f => f.severity === 'HIGH')) w.add('High-risk static rule triggered; deployment approval must remain blocked');
  return [...w];
}
