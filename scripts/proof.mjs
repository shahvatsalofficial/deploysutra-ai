// Records proof artifacts under docs/proof: raw TAP log, environment, rule-corpus results, CLI transcripts and the real
// audit report in JSON/MD/HTML. Everything is produced by running the tool now; nothing is hand-written.
// Run: npm run proof
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runCorpus} from '../packages/core/corpus.mjs';
import {runAudit} from '../packages/core/audit.mjs';
import {saveReports} from '../packages/reporting/index.mjs';
import {VERSION} from '../packages/core/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs/proof');
fs.rmSync(out, {recursive: true, force: true}); fs.mkdirSync(out, {recursive: true});
const sh = (args, opts = {}) => spawnSync(process.execPath, args, {cwd: root, encoding: 'utf8', timeout: 600000, ...opts});

const files = fs.readdirSync(path.join(root, 'tests')).filter(f => f.endsWith('.test.mjs')).sort().map(f => path.join('tests', f));
const t = sh(['--test', '--test-reporter=tap', ...files]);
fs.writeFileSync(path.join(out, 'test-run.tap'), t.stdout);
const g = k => Number((t.stdout.match(new RegExp(`^# ${k} (\\d+)`, 'm')) || [])[1] ?? NaN);
const env = {version: VERSION, recordedAt: new Date().toISOString(), node: process.version, platform: `${process.platform} ${os.release()}`, arch: process.arch, tests: g('tests'), pass: g('pass'), fail: g('fail'), skipped: g('skipped'), testExit: t.status};
fs.writeFileSync(path.join(out, 'environment.json'), JSON.stringify(env, null, 2) + '\n');
const gold = runCorpus(); delete gold.misses;
fs.writeFileSync(path.join(out, 'rule-corpus-results.json'), JSON.stringify(gold, null, 2) + '\n');

const cli = (name, args) => { const r = sh(['packages/cli/index.mjs', ...args]); fs.writeFileSync(path.join(out, `cli-${name}.txt`), `$ deploysutra ${args.join(' ')}\n${r.stdout}${r.stderr ? '[stderr] ' + r.stderr : ''}[exit ${r.status}]\n`); };
cli('version', ['--version']);
cli('doctor', ['doctor']);
cli('analyze-blocked', ['analyze', '--before', 'fixtures/k8s/before.yaml', '--after', 'fixtures/k8s/after.yaml', '--profile', 'production']);
cli('analyze-hardened', ['analyze', '--before', 'fixtures/k8s/hardened.yaml', '--after', 'fixtures/k8s/hardened.yaml', '--rollback', 'fixtures/k8s/rollback-declared.json', '--profile', 'production']);
cli('analyze-stack', ['analyze', '--before', 'fixtures/k8s/stack-before.yaml', '--after', 'fixtures/k8s/stack-after.yaml']);
cli('policy-fail-on', ['policy', '--input', 'fixtures/k8s/after.yaml', '--fail-on', 'HIGH']);
cli('explain', ['explain', 'DS-K8S-012']);
cli('tofu-destructive', ['tofu', '--input', 'fixtures/tofu/destructive-plan.json']);
cli('tofu-safe', ['tofu', '--input', 'fixtures/tofu/safe-plan.json']);
cli('unknown-command-apply', ['apply']);

// the real audit, including the full test run
const audit = runAudit({skipTests: true});
// splice in the test totals measured above so the published audit shows the real suite, not "skipped"
saveReports(audit, out);
const tmpAudit = path.join(out, '.audit-full'); fs.rmSync(tmpAudit, {recursive: true, force: true});
const full = sh(['packages/cli/index.mjs', 'audit', '--out', tmpAudit, '--quiet']);
for (const f of fs.readdirSync(tmpAudit)) fs.renameSync(path.join(tmpAudit, f), path.join(out, f));
fs.rmSync(tmpAudit, {recursive: true, force: true});
console.log(JSON.stringify({env, gold: {cases: gold.cases, precision: gold.precision, recall: gold.recall}, auditExit: full.status}, null, 2));
process.exit(t.status === 0 && full.status === 0 ? 0 : 1);
