// Shared primitives: hashing, deterministic JSON, sealing, bounded safe file reads.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const VERSION = '0.2.0';
export const SCHEMA_VERSION = '2.0';
export const MAX_INPUT_BYTES = 1024 * 1024;
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

/** Deterministic JSON: object keys sorted recursively, so equal content always hashes equal. */
export function canonical(value) {
  const walk = v => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, walk(v[k])]));
    return v;
  };
  return JSON.stringify(walk(value));
}

/** Seal a report with an unkeyed SHA-256 digest. This is tamper evidence only, never a signature. */
export function seal(report) {
  const {integrity, ...content} = report;
  return {...content, integrity: {algorithm: 'SHA-256', digest: sha256(canonical(content)), meaning: 'Unkeyed integrity checksum, NOT a signature or proof of authenticity'}};
}

export function verify(report) {
  if (!report || typeof report !== 'object' || !report.integrity?.digest) return false;
  const {integrity, ...body} = report;
  return sha256(canonical(body)) === integrity.digest;
}

/** Read one regular, non-symlink file <= 1 MiB whose parent chain contains no symlink. */
export function safeFile(file) {
  const abs = path.resolve(file);
  const stat = fs.lstatSync(abs);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_INPUT_BYTES) throw new Error('Input must be a regular non-symlink file <= 1 MiB');
  for (let dir = path.dirname(abs); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    if (fs.lstatSync(dir).isSymbolicLink()) throw new Error('Input may not traverse a symlink directory');
  }
  return {file: abs, text: fs.readFileSync(abs, 'utf8')};
}

/** Strip control characters and cap length so untrusted text cannot forge report structure. */
export function clean(value, max = 200) {
  const s = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Display path that never leaks absolute locations outside the working directory. */
export function displayPath(abs) {
  const rel = path.relative(process.cwd(), abs);
  return rel.startsWith('..') || path.isAbsolute(rel) ? path.basename(abs) : rel.split(path.sep).join('/');
}
