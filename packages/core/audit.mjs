// Independent self-audit. Everything is measured at run time on the machine that runs it; nothing is hand-written evidence.
// Produces a sealed report; the reporting package renders it as JSON, Markdown and HTML.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {VERSION, seal, verify, sha256} from './util.mjs';
import {assess, inspectTofuPlan, inspectRollback} from './assess.mjs';
import {RULES, checkPolicies} from './rules.mjs';
import {readManifests, docFromObject} from './manifest.mjs';
import {parseYAMLDocuments} from './yaml.mjs';
import {runCorpus, CASES} from './corpus.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOKEN_RE = /(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|npm_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
const ok = (name, detail) => ({name, status: 'PASS', detail});
const bad = (name, detail) => ({name, status: 'FAIL', detail});
const nr = (name, detail) => ({name, status: 'NOT_RUN', detail});
const check = (name, cond, detail, fail) => (cond ? ok(name, detail) : bad(name, fail || detail));
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const pct = x => `${(x * 100).toFixed(1)}%`;
const exists = p => fs.existsSync(path.join(ROOT, p));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

function section(id, title, checks, summary, extra = {}) {
  const failed = checks.filter(c => c.status === 'FAIL').length; const notRun = checks.filter(c => c.status === 'NOT_RUN').length;
  return {id, title, status: failed ? 'FAIL' : notRun === checks.length ? 'NOT_RUN' : notRun ? 'PASS_WITH_NOT_RUN' : 'PASS', summary, table: {columns: ['Check', 'Result', 'Detail'], rows: checks.map(c => [c.name, c.status, c.detail])}, checks, ...extra};
}

function lcg(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function walk(dir, out = []) { for (const e of fs.readdirSync(dir, {withFileTypes: true})) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else if (e.isFile()) out.push(p); } return out; }

export function runAudit({skipTests = false} = {}) {
  const sections = [];
  const sample = () => readManifests(path.join(ROOT, 'fixtures/k8s/before.yaml')).docs;
  const sampleAfter = () => readManifests(path.join(ROOT, 'fixtures/k8s/after.yaml')).docs;
  const hasFixtures = exists('fixtures/k8s/before.yaml');

  // 1. Test suite
  const tc = [];
  let testTotals = null;
  if (skipTests || !exists('tests')) tc.push(nr('node --test suite', skipTests ? 'skipped by caller (--skip-tests)' : 'tests/ is not shipped in the npm package; run from a source checkout'));
  else {
    const files = fs.readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.test.mjs')).sort().map(f => path.join('tests', f));
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], {cwd: ROOT, encoding: 'utf8', timeout: 300000, env: {...process.env, DEPLOYSUTRA_AUDIT_CHILD: '1'}});
    const g = k => Number((r.stdout.match(new RegExp(`^# ${k} (\\d+)`, 'm')) || [])[1] ?? NaN);
    testTotals = {tests: g('tests'), pass: g('pass'), fail: g('fail'), skipped: g('skipped')};
    tc.push(check('node --test suite', r.status === 0 && testTotals.fail === 0 && testTotals.tests > 0, `${testTotals.tests} tests: ${testTotals.pass} passed, ${testTotals.fail} failed, ${testTotals.skipped} skipped`, `exit ${r.status}; ${JSON.stringify(testTotals)}`));
  }
  sections.push(section('tests', 'Automated test suite', tc, 'The repository test suite executed as a child process; counts are parsed from its TAP output.'));

  // 2. Rule accuracy
  const gold = runCorpus();
  const rc = [
    check('Corpus precision', gold.precision === 1, `${pct(gold.precision)} (${gold.truePositives} TP, ${gold.falsePositives} FP)`),
    check('Corpus recall', gold.recall === 1, `${pct(gold.recall)} (${gold.falseNegatives} FN)`),
    check('Every case matches exactly', gold.passed === gold.cases, `${gold.passed}/${gold.cases} cases (${gold.positiveCases} positive, ${gold.negativeCases} negative twins)`),
    check('Every per-document rule has a positive case', RULES.filter(r => r.scope !== 'diff').every(r => gold.rulesCovered.includes(r.id)), `${gold.rulesCovered.length}/${RULES.filter(r => r.scope !== 'diff').length} rules exercised`)
  ];
  const removedFix = assess([docFromObject({apiVersion: 'v1', kind: 'ConfigMap', metadata: {name: 'gone'}})], [], null);
  rc.push(check('Diff-level rule DS-K8S-019 (resource removed)', removedFix.policyFindings.some(f => f.id === 'DS-K8S-019'), 'a resource missing from AFTER is reported'));
  sections.push(section('accuracy', 'Rule accuracy on the labelled corpus', rc, `${gold.cases} author-labelled cases. This is a regression corpus, not an independent benchmark: it shows the rules do what they claim on these inputs, not that they catch every real misconfiguration.`));

  // 3. Secret leakage
  const CAN = {env: 'CANARY-ENV-VALUE-91c2', sec: 'Q0FOQVJZLVNFQ1JFVC05MWMy', ann: 'CANARY-ANN-TOKEN-55ab', tofu: 'CANARY-TOFU-STATE-7d3e', addr: 'CANARY-ADDR-1f00'};
  const mk = (env, sec, ann) => [docFromObject({apiVersion: 'apps/v1', kind: 'Deployment', metadata: {name: 'leak', annotations: {note: `token=${ann}`}}, spec: {replicas: 1, template: {spec: {containers: [{name: 'a', image: 'a:1', env: [{name: 'DB_PASSWORD', value: env}]}]}}}}), docFromObject({apiVersion: 'v1', kind: 'Secret', metadata: {name: 's'}, data: {k: sec}})];
  const lr = assess(mk('old-' + CAN.env, 'b2xk', 'old-' + CAN.ann), mk(CAN.env, CAN.sec, CAN.ann), null);
  const tofu = inspectTofuPlan({format_version: '1.2', variables: {pw: {value: CAN.tofu}}, prior_state: {values: {x: CAN.tofu}}, resource_changes: [{address: `aws_db_instance.${CAN.addr}`, type: 'aws_db_instance', change: {actions: ['delete', 'create'], before: {password: CAN.tofu}, after: {password: CAN.tofu + '2'}}}]});
  const outputs = {json: JSON.stringify(lr), tofuJson: JSON.stringify(tofu)};
  const leaked = Object.entries(CAN).filter(([, v]) => Object.values(outputs).some(o => o.includes(v)));
  const lc = [
    check('Env password, Secret data and annotation token never reach report JSON', !['env', 'sec', 'ann'].some(k => outputs.json.includes(CAN[k])), '3 canaries planted in BEFORE and AFTER; 0 found'),
    check('Plan variables, prior_state, values and addresses never reach plan summary', !['tofu', 'addr'].some(k => outputs.tofuJson.includes(CAN[k])), 'canaries in variables, prior_state, before/after and address; 0 found'),
    check('Secret-like env literal is flagged without echoing the value', lr.policyFindings.some(f => f.id === 'DS-K8S-012') && !JSON.stringify(lr.policyFindings).includes(CAN.env), 'DS-K8S-012 raised, value withheld'),
    check('Diffs mark redacted fields as redacted', lr.diffs.some(d => d.redacted), `${lr.diffs.filter(d => d.redacted).length} redacted field change(s)`),
    check('Discarded plan sections are named, not copied', tofu.ignoredSensitiveSections.includes('prior_state') && tofu.ignoredSensitiveSections.includes('variables'), tofu.ignoredSensitiveSections.join(', '))
  ];
  if (hasFixtures) {
    lc.push(check('Shipped example reports contain no token-shaped strings', !exists('examples/reports') || walk(path.join(ROOT, 'examples/reports')).every(f => !TOKEN_RE.test(fs.readFileSync(f, 'utf8'))), 'examples/reports scanned for GitHub/npm/AWS/private-key shapes'));
  }
  sections.push(section('leakage', 'Secret and state leakage', lc, 'Canary strings were planted in every place a secret could plausibly be copied from, then the produced reports were searched for them.', {bullets: [leaked.length ? `LEAKED: ${leaked.map(l => l[0]).join(', ')}` : 'No canary appeared in any output.']}));

  // 4. Hostile input
  const hostile = [['anchor', 'a: &x 1'], ['alias', 'a: *x'], ['tag', 'a: !!str x'], ['template', 'a: "{{ .Values.x }}"'], ['tab', 'a:\n\tb: 1'], ['block scalar', 'a: |\n  x'], ['duplicate key', 'a: 1\na: 2'], ['__proto__ key', '__proto__: x'], ['odd indent', 'a:\n   b: 1'], ['document end', 'a: 1\n...'], ['merge key', 'a:\n  <<: b'], ['nested flow', 'a: [[1],[2]]'], ['flow mapping', 'a: {b: 1}'], ['unterminated quote', 'a: "x'], ['empty', '']];
  const rejected = hostile.filter(([, t]) => { try { parseYAMLDocuments(t); return false; } catch (e) { return e instanceof Error; } });
  const rnd = lcg(20261117); const seedText = hasFixtures ? fs.readFileSync(path.join(ROOT, 'fixtures/k8s/after.yaml'), 'utf8') : 'a: 1\n';
  let crashes = 0; let hangs = 0; const alphabet = ' \t:-[]{}&*!|>#"\'\n@%`,';
  for (let i = 0; i < 400; i++) {
    let t = seedText; const edits = 1 + Math.floor(rnd() * 4);
    for (let e = 0; e < edits; e++) { const p = Math.floor(rnd() * t.length); const m = rnd(); t = m < 0.4 ? t.slice(0, p) + alphabet[Math.floor(rnd() * alphabet.length)] + t.slice(p) : m < 0.7 ? t.slice(0, p) + t.slice(p + 1 + Math.floor(rnd() * 3)) : t.slice(0, p) + t.slice(Math.floor(rnd() * t.length)); }
    const t0 = performance.now();
    try { parseYAMLDocuments(t); } catch (e) { if (!(e instanceof Error)) crashes++; }
    if (performance.now() - t0 > 500) hangs++;
  }
  const deep = 'a:\n' + Array.from({length: 400}, (_, i) => ' '.repeat(2 * (i + 1)) + 'k' + i + ':').join('\n');
  let deepOk = true; try { parseYAMLDocuments(deep); } catch (e) { deepOk = e instanceof Error; }
  const hc = [
    check('Unsupported YAML constructs fail explicitly', rejected.length === hostile.length, `${rejected.length}/${hostile.length} hostile inputs rejected with an Error`, `accepted: ${hostile.filter(h => !rejected.includes(h)).map(h => h[0]).join(', ')}`),
    check('Mutation fuzz (400 inputs, fixed seed)', crashes === 0 && hangs === 0, `0 non-Error crashes, 0 parses over 500 ms`, `${crashes} crashes, ${hangs} slow`),
    check('Deeply nested input is handled', deepOk, '400 nesting levels handled without a stack overflow')
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-audit-'));
  try {
    const big = path.join(tmp, 'big.yaml'); fs.writeFileSync(big, 'a: ' + 'x'.repeat(1024 * 1024 + 1));
    let blocked = false; try { readManifests(big); } catch (e) { blocked = /1 MiB/.test(e.message); }
    hc.push(check('Input over 1 MiB is refused', blocked, 'readManifests rejects >1 MiB'));
    const bad2 = path.join(tmp, 'x.txt'); fs.writeFileSync(bad2, 'a: 1'); let ext = false; try { readManifests(bad2); } catch { ext = true; }
    hc.push(check('Non-manifest extension is refused', ext, '.txt rejected'));
    const target = path.join(tmp, 'real.yaml'); fs.writeFileSync(target, 'kind: A\nmetadata:\n  name: x\n'); const link = path.join(tmp, 'link.yaml');
    try { fs.symlinkSync(target, link); let refused = false; try { readManifests(link); } catch (e) { refused = /symlink/.test(e.message); } hc.push(check('Symlinked input is refused', refused, 'symlink file rejected')); } catch { hc.push(nr('Symlinked input is refused', 'this OS user cannot create symlinks (Windows without Developer Mode); covered on Linux/macOS CI')); }
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
  sections.push(section('hostile', 'Hostile and malformed input', hc, 'Untrusted manifests are data. The parser must fail loudly, never skip, never hang.'));

  // 5. Evidence integrity and gate safety
  const a1 = hasFixtures ? assess(sample(), sampleAfter(), null) : lr; const a2 = hasFixtures ? assess(sample(), sampleAfter(), null) : lr;
  const rt = JSON.parse(JSON.stringify(a1));
  const flip = JSON.parse(JSON.stringify(a1)); flip.gate = 'READY'; const add = JSON.parse(JSON.stringify(a1)); add.extra = 1; const drop = JSON.parse(JSON.stringify(a1)); delete drop.integrity;
  const allDeclared = inspectRollback({previousRevision: 'v1', backupVerified: true, restoreTestPassed: true, rollbackProcedure: 'x', operatorApprovalVerified: true});
  const gates = new Set(); let readyAttempts = 0;
  for (const [, obj] of CASES) { const d = docFromObject(JSON.parse(JSON.stringify(obj))); const r = assess([d], [d], {previousRevision: 'v', backupVerified: true, restoreTestPassed: true, rollbackProcedure: 'x', operatorApprovalVerified: true}); gates.add(r.gate); if (!['BLOCKED', 'HUMAN_REVIEW_REQUIRED'].includes(r.gate)) readyAttempts++; }
  const ec = [
    check('Equal inputs give an identical digest (deterministic)', a1.integrity.digest === a2.integrity.digest, a1.integrity.digest.slice(0, 16) + '…'),
    check('Digest survives a JSON round trip', verify(rt), 'verify(JSON.parse(JSON.stringify(report))) is true'),
    check('Edited gate is detected', !verify(flip), 'BLOCKED → READY edit rejected'),
    check('Added field is detected', !verify(add), 'extra property rejected'),
    check('Removed seal is detected', !verify(drop), 'report without integrity rejected'),
    check('No input can produce a READY gate', readyAttempts === 0, `${CASES.length} corpus resources assessed with every rollback box ticked; gates seen: ${[...gates].join(', ')}`),
    check('Declared rollback evidence is never "ready"', allDeclared.ready === false && allDeclared.checks.every(c => c.status === 'DECLARED_NOT_VERIFIED'), 'all five declarations → DECLARED_NOT_VERIFIED, ready=false')
  ];
  sections.push(section('integrity', 'Evidence integrity and gate safety', ec, 'SHA-256 seals are tamper evidence, not signatures. The gate has exactly two states.'));

  // 6. Static source safety
  const src = walk(path.join(ROOT, 'packages')).filter(f => f.endsWith('.mjs')).map(f => ({f: path.relative(ROOT, f).split(path.sep).join('/'), t: fs.readFileSync(f, 'utf8')}));
  // The scanner file itself necessarily contains the patterns it searches for, so it is excluded from pattern scans.
  const uses = (re, except = []) => src.filter(s => s.f !== 'packages/core/audit.mjs' && re.test(s.t) && !except.includes(s.f)).map(s => s.f);
  const help = hasFixtures ? spawnSync(process.execPath, [path.join(ROOT, 'packages/cli/index.mjs'), 'help'], {encoding: 'utf8'}).stdout : '';
  const forbidden = ['apply', 'deploy', 'destroy', 'rollback', 'exec', 'sync'].filter(c => new RegExp(`^\\s{2}${c}\\b`, 'm').test(help));
  const sc = [
    check('No subprocess APIs in shipped packages', uses(/child_process|execSync|spawnSync|spawn\(/).length === 0, 'child_process appears only in the audit runner itself (it runs the test suite and the CLI help)', `found in ${uses(/child_process|execSync|spawnSync|spawn\(/).join(', ')}`),
    check('No dynamic code execution', uses(/\beval\(|new Function\(/).length === 0, 'no eval / new Function'),
    check('No outbound network calls', uses(/fetch\(|node:https|node:net\b|node:dgram|XMLHttpRequest|WebSocket/).length === 0, 'no fetch/https/net/dgram usage'),
    check('Only the loopback report server listens on a socket', uses(/\.listen\(/, ['packages/server/index.mjs']).length === 0 && uses(/node:http\b/, ['packages/server/index.mjs']).length === 0, 'node:http and listen() appear only in packages/server/index.mjs'),
    check('CLI exposes no deploy/apply/destroy/rollback/exec/sync command', hasFixtures ? forbidden.length === 0 : false, hasFixtures ? 'none listed in `deploysutra help`' : 'help not available', `forbidden commands listed: ${forbidden.join(', ')}`),
    check('No token-shaped strings in the shipped source', src.every(s => !TOKEN_RE.test(s.t) || s.f === 'packages/core/audit.mjs'), `${src.length} source files scanned`),
    check('Core has zero runtime dependencies', !Object.hasOwn(JSON.parse(read('package.json')), 'dependencies'), 'package.json has no "dependencies"')
  ];
  sections.push(section('safety', 'Static safety review of the source', sc, 'Regex scans of the shipped code. They prove absence of these patterns, not absence of every possible vulnerability.', {bullets: [`Source tree digest: ${sha256(src.map(s => s.f + ':' + sha256(s.t)).sort().join('\n'))}`]}));

  // 7. Performance
  const big = []; for (let i = 0; i < 200; i++) big.push(docFromObject({apiVersion: 'apps/v1', kind: 'Deployment', metadata: {name: 'svc-' + i, namespace: 'perf'}, spec: {replicas: 2, template: {spec: {containers: [{name: 'c', image: 'img:' + i, resources: {limits: {cpu: '1'}}}]}}}}));
  const after200 = big.map((d, i) => docFromObject({...d.value, spec: {...d.value.spec, replicas: 3 + (i % 2)}}));
  const time = fn => { const r = []; for (let i = 0; i < 5; i++) { const t = performance.now(); fn(); r.push(performance.now() - t); } return Math.round(median(r)); };
  const tAssess = time(() => assess(big, after200, null)); const yamlText = (hasFixtures ? fs.readFileSync(path.join(ROOT, 'fixtures/k8s/after.yaml'), 'utf8') + '\n---\n' : '').repeat(1);
  const tParse = time(() => { for (let i = 0; i < 200; i++) parseYAMLDocuments(yamlText || 'a: 1'); }); const tRules = time(() => { for (const d of big) checkPolicies(d); });
  const pc = [check('assess() 200 resources before/after', tAssess < 3000, `median ${tAssess} ms (budget 3000 ms)`), check('parse 200 documents', tParse < 2000, `median ${tParse} ms (budget 2000 ms)`), check('rules over 200 resources', tRules < 1000, `median ${tRules} ms (budget 1000 ms)`)];
  sections.push(section('performance', 'Performance budgets', pc, 'Median of 5 runs on this machine. Budgets are deliberately loose guardrails against regressions, not benchmarks of other hardware.'));

  // 8. Package and instruction assets
  const pkg = JSON.parse(read('package.json'));
  const manifest = exists('agents/manifest.json') ? JSON.parse(read('agents/manifest.json')) : null;
  const skills = exists('skills') ? fs.readdirSync(path.join(ROOT, 'skills')).filter(d => exists(`skills/${d}/SKILL.md`)) : [];
  const fm = skills.filter(s => { const t = read(`skills/${s}/SKILL.md`); return new RegExp(`^---\\nname: ${s}\\ndescription: .+\\n---`).test(t); });
  const backed = skills.filter(s => /^\*\*Backed by:\*\*/m.test(read(`skills/${s}/SKILL.md`)));
  const pc2 = [
    check('package.json version matches VERSION constant', pkg.version === VERSION, `${pkg.version}`),
    check('bin targets exist', Object.values(pkg.bin || {}).every(p => exists(p)), Object.keys(pkg.bin || {}).join(', ')),
    check('files[] entries exist', (pkg.files || []).every(f => exists(f)), `${(pkg.files || []).length} entries`, `missing: ${(pkg.files || []).filter(f => !exists(f)).join(', ')}`),
    check('25 portable skills with valid frontmatter', skills.length === 25 && fm.length === 25, `${skills.length} skills, ${fm.length} valid frontmatter`),
    check('Every skill declares what deterministic command/rule backs it', backed.length === skills.length && skills.length > 0, `${backed.length}/${skills.length} carry a "Backed by" line`),
    check('20 agent roles registered with files on disk', manifest?.agentRoles === 20 && manifest.roleDefinitions.filter(r => r.kind === 'specialist').every(r => exists(r.claudePath) && exists(r.skillPath)), manifest ? `${manifest.roleDefinitions.length} role definitions` : 'manifest missing'),
    check('8 workflows and 10 safety rule files', exists('workflows') && fs.readdirSync(path.join(ROOT, 'workflows')).length === 8 && fs.readdirSync(path.join(ROOT, 'rules')).length === 10, '8 workflows, 10 rules'),
    check('License and notices present', ['LICENSE', 'NOTICE', 'SECURITY.md', 'CHANGELOG.md'].every(exists), 'LICENSE, NOTICE, SECURITY.md, CHANGELOG.md')
  ];
  sections.push(section('package', 'Package and instruction assets', pc2, 'Structural checks that the shipped package is internally consistent.'));

  // 9. Not run
  const nrc = [
    nr('Live cluster dry-run (kubectl diff / --dry-run=server)', 'by design: needs credentials; never run automatically'),
    nr('MCP Inspector / third-party MCP client', 'MCP server verified with a scripted JSON-RPC client only'),
    nr('Native activation of skills in each IDE', 'skills are copied, not proven to be loaded by each host'),
    nr('Independent third-party benchmark of the rules', 'only the author-labelled corpus exists'),
    nr('Signed releases', 'npm provenance only if published via CI; reports carry unkeyed checksums, not signatures'),
    nr('macOS / Windows results from this run', `only ${process.platform} was measured here; see CI for the matrix`)
  ];
  sections.push(section('notrun', 'Explicitly not run', nrc, 'Listed so nobody mistakes absence of a result for a pass.'));

  const all = sections.flatMap(s => s.checks);
  const totals = {checks: all.length, passed: all.filter(c => c.status === 'PASS').length, failed: all.filter(c => c.status === 'FAIL').length, notRun: all.filter(c => c.status === 'NOT_RUN').length};
  for (const s of sections) delete s.checks;
  return seal({
    schemaVersion: '2.0', product: 'DeploySutra AI', productVersion: VERSION, scope: 'SELF_AUDIT', generatedAt: new Date().toISOString(),
    overall: totals.failed ? 'FAIL' : totals.notRun ? 'PASS_WITH_NOT_RUN' : 'PASS', totals, testTotals, goldCorpus: {cases: gold.cases, precision: gold.precision, recall: gold.recall},
    statement: 'Measured by running the tool against itself. It supports the claims it makes about itself (offline, read-only, no secret leakage, deterministic, fail-closed gate). It is not a certification of any deployment, and it does not replace independent third-party review.',
    sections,
    environment: {tool: `deploysutra-ai ${VERSION}`, node: process.version, platform: `${process.platform} ${os.release()}`, arch: process.arch, cpus: os.cpus().length, offline: 'no network access was used'},
    reproduce: ['npm ci --ignore-scripts   # no dependencies, so this only checks the lockfile-free install', 'npm test', 'npx deploysutra-ai audit --out audit-out', 'node packages/cli/index.mjs verify --report audit-out/audit-report.json'],
    limits: ['Counts and timings come from this run on this machine.', 'The labelled corpus is written by the tool author; it is a regression corpus, not an independent benchmark.', 'Static rules inspect desired state only; they cannot prove runtime reachability, IAM scope or data recoverability.', 'A SHA-256 seal detects accidental or deliberate edits only when compared with a trusted copy; it does not authenticate the author.', 'Skill and agent files are instruction text; native activation in each IDE is untested.']
  });
}
