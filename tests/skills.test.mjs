import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {RULES} from '../packages/core/index.mjs';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const dirs = fs.readdirSync(path.join(root, 'skills')).filter(d => fs.existsSync(path.join(root, 'skills', d, 'SKILL.md')));
const text = d => fs.readFileSync(path.join(root, 'skills', d, 'SKILL.md'), 'utf8');
const help = spawnSync(process.execPath, [path.join(root, 'packages/cli/index.mjs'), 'help'], {encoding: 'utf8'}).stdout;
const ruleIds = new Set(RULES.map(r => r.id));

test('25 skills exist', () => assert.equal(dirs.length, 25));
for (const d of dirs) {
  test(`skill ${d}: frontmatter name matches folder`, () => assert(new RegExp(`^---\\nname: ${d}\\ndescription: .{20,}\\n---`).test(text(d))));
  test(`skill ${d}: every command it names exists in the CLI`, () => { const line = text(d).match(/^\*\*Backed by:\*\* (.*)$/m)?.[1] || ''; const cmds = [...line.matchAll(/`([a-z-]+)`/g)].map(m => m[1]); for (const c of cmds) assert(new RegExp(`^\\s{2}${c}\\b`, 'm').test(help), `${d} names unknown command ${c}`); });
  test(`skill ${d}: every rule ID it names exists`, () => { for (const id of text(d).match(/DS-K8S-\d{3}/g) || []) assert(ruleIds.has(id), `${d}: ${id}`); });
  test(`skill ${d}: has required sections and no apply instruction`, () => { const t = text(d); for (const h of ['## Use when', '## Do NOT use for', '## Guardrails', '## Process']) assert(t.includes(h), h); assert(!/^\s*\d+\.\s+Run `?(kubectl|helm|tofu|terraform) (apply|upgrade|destroy)/m.test(t)); });
}
test('every rule is referenced by at least one skill', () => { const all = dirs.map(text).join('\n'); assert.deepEqual(RULES.filter(r => !all.includes(r.id)).map(r => r.id), []); });
test('manifest lists 20 specialists with existing files and 5 capabilities', () => { const m = JSON.parse(fs.readFileSync(path.join(root, 'agents/manifest.json'), 'utf8')); assert.equal(m.roleDefinitions.filter(r => r.kind === 'specialist').length, 20); assert.equal(m.roleDefinitions.filter(r => r.kind === 'capability').length, 5); for (const r of m.roleDefinitions.filter(x => x.kind === 'specialist')) { assert(fs.existsSync(path.join(root, r.claudePath))); assert(fs.existsSync(path.join(root, r.skillPath))); assert(fs.existsSync(path.join(root, 'agents', `${r.id}.md`))); } });
test('eight workflows and ten rule files exist', () => { assert.equal(fs.readdirSync(path.join(root, 'workflows')).filter(x => x.endsWith('.md')).length, 8); assert.equal(fs.readdirSync(path.join(root, 'rules')).filter(x => x.endsWith('.md')).length, 10); });
test('no mandatory npm dependencies', () => assert(!Object.hasOwn(JSON.parse(fs.readFileSync(path.join(root, 'package.json'))), 'dependencies')));
test('package.json is publishable and consistent', () => { const p = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))); assert.equal(p.name, 'deploysutra-ai'); assert.notEqual(p.private, true); assert.equal(p.license, 'Apache-2.0'); assert(p.bin.deploysutra); for (const f of p.files) assert(fs.existsSync(path.join(root, f)), f); assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin/plugin.json'))).version, p.version); });
test('no token-shaped secrets anywhere in the repo text', () => {
  const re = /(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|npm_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
  const walk = (d, o = []) => { for (const e of fs.readdirSync(d, {withFileTypes: true})) { if (['node_modules', '.git'].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p, o); else if (/\.(md|mjs|json|ya?ml|txt|html|cff|mdc)$/.test(e.name)) o.push(p); } return o; };
  for (const f of walk(root)) { if (/audit\.mjs$|skills\.test\.mjs$/.test(f)) continue; assert(!re.test(fs.readFileSync(f, 'utf8')), f); }
});
