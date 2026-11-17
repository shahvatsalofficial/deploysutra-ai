// Strict, deliberately small YAML subset with exact source maps. NOT a general YAML parser.
// Supported: block mappings, block sequences, scalars, quoted strings, `[]`/`{}`, one-line scalar flow sequences,
// comments, and multi-document streams separated by `---`.
// Rejected (explicit error, never silently skipped): tabs, odd indentation, anchors/aliases, tags, merge keys,
// block scalars (| >), nested flow collections, Helm/Go templates, `...` document ends, duplicate or unsafe keys.

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const QUOTED = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*')\s*(?:#.*)?$/;

function scalar(raw, line) {
  const v = raw.trim();
  if (v.startsWith('"') || v.startsWith("'")) {
    const m = v.match(QUOTED);
    if (!m) throw new Error(`Unterminated or malformed quoted value at line ${line}`);
    const q = m[1];
    if (q[0] === '"') { try { return JSON.parse(q); } catch { throw new Error(`Unsupported escape in quoted value at line ${line}`); } }
    return q.slice(1, -1).replaceAll("''", "'");
  }
  if (v === '[]') return [];
  if (v === '{}') return Object.create(null);
  if (/^[&*!]/.test(v) || /^<<$/.test(v)) throw new Error(`Unsupported YAML syntax (anchor, alias or tag) at line ${line}`);
  if (/\{\{|\}\}/.test(v)) throw new Error(`Unsupported YAML syntax (template) at line ${line}`);
  if (/^[|>]/.test(v)) throw new Error(`Unsupported YAML syntax (block scalar) at line ${line}`);
  if (v.startsWith('[')) {
    if (!v.endsWith(']') || /[[{]/.test(v.slice(1, -1))) throw new Error(`Unsupported flow collection at line ${line}`);
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    const parts = []; let cur = ''; let q = null;
    for (const ch of inner) {
      if (q) { cur += ch; if (ch === q) q = null; } else if (ch === '"' || ch === "'") { q = ch; cur += ch; } else if (ch === ',') { parts.push(cur); cur = ''; } else cur += ch;
    }
    if (q) throw new Error(`Unterminated quote in flow sequence at line ${line}`);
    parts.push(cur);
    return parts.map(p => scalar(p, line));
  }
  if (v.startsWith('{')) throw new Error(`Unsupported flow mapping at line ${line}`);
  const bare = v.replace(/\s+#.*$/, '');
  if (/^(true|false)$/i.test(bare)) return bare.toLowerCase() === 'true';
  if (/^(null|~)$/i.test(bare)) return null;
  if (/^-?\d+(\.\d+)?$/.test(bare)) return Number(bare);
  return bare;
}

/** Tokenise to logical lines, splitting the stream into documents. */
function tokenise(text) {
  const docs = [[]];
  text.replaceAll('\r\n', '\n').split('\n').forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim() || /^\s*#/.test(raw)) return;
    if (/\t/.test(raw)) throw new Error(`Unsupported YAML construct (tab) at line ${line}`);
    if (/^\.\.\.\s*$/.test(raw)) throw new Error(`Unsupported YAML construct (document end) at line ${line}`);
    if (/^---\s*(#.*)?$/.test(raw)) { if (docs.at(-1).length) docs.push([]); return; }
    if (/^---\s/.test(raw)) throw new Error(`Unsupported YAML construct (inline document content) at line ${line}`);
    const indent = raw.match(/^ */)[0].length;
    if (indent % 2 !== 0) throw new Error(`Unsupported YAML indentation (odd) at line ${line}`);
    if (/\{\{|\}\}/.test(raw)) throw new Error(`Unsupported YAML syntax (template) at line ${line}`);
    if (/<<:/.test(raw)) throw new Error(`Unsupported YAML syntax (merge key) at line ${line}`);
    docs.at(-1).push({indent, value: raw.slice(indent), line});
  });
  return docs.filter(d => d.length);
}

function parseTokens(lines) {
  const map = new Map(); // dotted path -> 1-based source line
  let pos = 0;
  function node(expected, p) {
    if (pos >= lines.length || lines[pos].indent !== expected) throw new Error(`Invalid YAML indentation at line ${lines[pos]?.line ?? 'end'}`);
    const seq = lines[pos].value.startsWith('- ') || lines[pos].value === '-';
    const out = seq ? [] : Object.create(null);
    while (pos < lines.length && lines[pos].indent === expected) {
      const item = lines[pos];
      if (seq) {
        if (!(item.value.startsWith('- ') || item.value === '-')) throw new Error(`Mixed sequence/mapping at line ${item.line}`);
        const content = item.value.slice(2);
        const ip = p ? `${p}.${out.length}` : String(out.length);
        map.set(ip, item.line);
        if (!content.trim()) {
          pos++;
          if (pos >= lines.length || lines[pos].indent <= expected) throw new Error(`Empty sequence item at line ${item.line}`);
          out.push(node(lines[pos].indent, ip));
        } else if (/^[\w.\/-]+:(?:\s|$)/.test(content)) {
          lines[pos] = {indent: expected + 2, value: content, line: item.line}; // inline mapping continues at indent+2
          out.push(node(expected + 2, ip));
        } else { pos++; out.push(scalar(content, item.line)); }
      } else {
        const m = item.value.match(/^([\w.\/-]+):(?:\s+(.*)|\s*)$/);
        if (!m) throw new Error(`Unsupported YAML mapping line ${item.line}`);
        const key = m[1];
        if (UNSAFE_KEYS.has(key)) throw new Error(`Unsafe YAML key at line ${item.line}`);
        if (Object.hasOwn(out, key)) throw new Error(`Duplicate key ${key} at line ${item.line}`);
        const kp = p ? `${p}.${key}` : key;
        map.set(kp, item.line);
        pos++;
        if (m[2] !== undefined && m[2].trim() && !m[2].trim().startsWith('#')) out[key] = scalar(m[2], item.line);
        else if (pos < lines.length && lines[pos].indent > expected) out[key] = node(lines[pos].indent, kp);
        else out[key] = null;
      }
      if (pos < lines.length && lines[pos].indent > expected) throw new Error(`Unexpected indentation at line ${lines[pos].line}`);
    }
    return out;
  }
  const value = node(lines[0].indent, '');
  if (pos !== lines.length) throw new Error(`Unsupported YAML document at line ${lines[pos].line}`);
  return {value, map};
}

/** Parse a stream into documents: [{value, map, startLine}]. */
export function parseYAMLDocuments(text) {
  const docs = tokenise(text);
  if (!docs.length) throw new Error('Empty manifest');
  return docs.map(tokens => ({startLine: tokens[0].line, ...parseTokens(tokens)}));
}

/** Parse exactly one document and return its value (kept for API compatibility). */
export function parseLimitedYAML(text) {
  const docs = parseYAMLDocuments(text);
  if (docs.length > 1) throw new Error('Unsupported: multiple YAML documents (use readManifests)');
  return docs[0].value;
}
