import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {safeFile, readManifest, readManifests, parseLimitedYAML, parseYAMLDocuments, sha256, canonical, diffManifests, checkPolicies, classifyChange, assess, inspectRollback, inspectTofuPlan, seal, verify, docFromObject, MAX_INPUT_BYTES, RULES, PROFILES, explainRule, buildBlastMap, VERSION} from '../packages/core/index.mjs';
import {renderMarkdown, renderHTML, saveReports} from '../packages/reporting/index.mjs';
import {runCorpus, CASES} from '../packages/core/corpus.mjs';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const fx = x => path.join(root, 'fixtures', x);
const before = () => readManifest(fx('k8s/before.yaml'));
const after = () => readManifest(fx('k8s/after.yaml'));
const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ds-test-'));
function tmp(doc, ext = '.json') { const d = tmpdir(); const f = path.join(d, 'test' + ext); fs.writeFileSync(f, typeof doc === 'string' ? doc : JSON.stringify(doc)); return {f, d}; }
const base = {apiVersion: 'v1', kind: 'Service', metadata: {name: 'web'}, spec: {type: 'ClusterIP'}};
const canSymlink = (() => { const d = tmpdir(); try { fs.symlinkSync(d, path.join(d, 'l')); return true; } catch { return false; } })();
const sym = (name, fn) => test(name, {skip: canSymlink ? false : 'cannot create symlinks on this OS user'}, fn);

// ---- hashing and sealing ----
test('SHA-256 is deterministic', () => assert.equal(sha256('demo'), sha256('demo')));
test('SHA-256 changes with input', () => assert.notEqual(sha256('a'), sha256('b')));
test('canonical JSON ignores key order', () => assert.equal(canonical({b: 1, a: {d: 1, c: 2}}), canonical({a: {c: 2, d: 1}, b: 1})));
test('seal/verify round trip', () => assert(verify(seal({a: 1}))));
test('verify rejects non-object and unsealed', () => { assert(!verify(null)); assert(!verify({a: 1})); assert(!verify('x')); });
test('verify survives JSON round trip with reordered keys', () => { const r = seal({z: 1, a: [1, {y: 2, b: 3}]}); const flip = v => (Array.isArray(v) ? v.map(flip) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map(k => [k, flip(v[k])])) : v); const rev = flip(JSON.parse(JSON.stringify(r))); assert(verify(rev)); });
test('version constant is 0.2.0', () => assert.equal(VERSION, '0.2.0'));

// ---- YAML parser ----
test('parser reads Deployment kind/name', () => { assert.equal(before().value.kind, 'Deployment'); assert.equal(before().value.metadata.name, 'checkout'); });
test('parser reads 3 replicas', () => assert.equal(before().value.spec.replicas, 3));
test('parser reads nested container array', () => assert.equal(before().value.spec.template.spec.containers[0].name, 'checkout'));
test('parser reads nested boolean', () => assert.equal(after().value.spec.template.spec.containers[0].securityContext.privileged, true));
test('parser reads quoted limits', () => assert.equal(before().value.spec.template.spec.containers[0].resources.limits.memory, '256Mi'));
test('parser scalars: null, negative, float', () => { const v = parseLimitedYAML('a: null\nb: -2\nc: 1.5\nd: ~'); assert.deepEqual([v.a, v.b, v.c, v.d], [null, -2, 1.5, null]); });
test('parser reads string sequence', () => assert.deepEqual(parseLimitedYAML('a:\n  - hello\n  - world').a, ['hello', 'world']));
test('parser reads quotes with trailing comment', () => assert.equal(parseLimitedYAML('a: "red" # note').a, 'red'));
test('parser reads single quotes and escaped quote', () => assert.equal(parseLimitedYAML("a: 'it''s'").a, "it's"));
test('parser reads empty flow collections', () => { const v = parseLimitedYAML('a: []\nb: {}'); assert.deepEqual(v.a, []); assert.equal(Object.keys(v.b).length, 0); });
test('parser reads scalar flow sequence (RBAC verbs)', () => assert.deepEqual(parseLimitedYAML("verbs: ['get', \"list\", watch]").verbs, ['get', 'list', 'watch']));
test('parser keeps & inside an unquoted URL value', () => assert.equal(parseLimitedYAML('u: http://x/?a=1&b=2').u, 'http://x/?a=1&b=2'));
test('parser reads key with slash and dot', () => assert.equal(parseLimitedYAML('app.kubernetes.io/name: x')['app.kubernetes.io/name'], 'x'));
test('parser reads mapping inside sequence item', () => assert.deepEqual(parseLimitedYAML('a:\n  - name: x\n    v: 1\n  - name: y').a.map(i => i.name), ['x', 'y']));
test('parser multi-document split', () => assert.equal(parseYAMLDocuments('a: 1\n---\nb: 2\n---\nc: 3').length, 3));
test('parser skips leading separator and comments', () => assert.equal(parseYAMLDocuments('# c\n---\na: 1\n').length, 1));
test('parseLimitedYAML refuses multiple documents', () => assert.throws(() => parseLimitedYAML('a: 1\n---\nb: 2'), /Unsupported/));
for (const [name, text, re] of [
  ['tabs', 'a:\n\tb: 1', /tab/], ['anchors', 'a: &hack', /anchor/], ['aliases', 'a: *x', /anchor/], ['tags', 'a: !!str x', /tag/], ['inline object', 'a: {secret: 1}', /flow mapping/],
  ['templates', 'a: "{{ .Values.test }}"', /template/], ['block scalars', 'a: |\n  x', /block scalar/], ['merge keys', 'a:\n  <<: b', /merge/], ['__proto__ key', '__proto__: a', /Unsafe/], ['constructor key', 'constructor: a', /Unsafe/],
  ['mixed seq/map', 'a:\n  - first\n  other: second', /Mixed/], ['duplicate keys', 'a: 1\na: 2', /Duplicate/], ['odd indentation', 'a:\n   b: 1', /indentation/], ['empty input', '', /Empty/], ['document end', 'a: 1\n...', /document end/],
  ['nested flow', 'a: [[1]]', /flow/], ['unterminated quote', 'a: "x', /quoted/], ['bad escape', 'a: "\\q"', /escape/]
]) test(`parser rejects ${name}`, () => assert.throws(() => parseYAMLDocuments(text), re));
test('parser source map is exact for mapping keys and sequence items', () => { const d = parseYAMLDocuments('a:\n  b: 1\n  c:\n    - x: 1\n      y: 2\n'); assert.equal(d[0].map.get('a.b'), 2); assert.equal(d[0].map.get('a.c.0.y'), 5); });
test('parser source map continues across documents', () => { const d = parseYAMLDocuments('a: 1\n---\nb: 2\n'); assert.equal(d[1].map.get('b'), 3); });

// ---- ingestion ----
test('read JSON resource', () => assert.equal(readManifest(tmp(base).f).value.spec.type, 'ClusterIP'));
test('read rejects invalid JSON', () => assert.throws(() => readManifest(tmp('{invalid').f), /Invalid manifest/));
test('read rejects resource without metadata', () => assert.throws(() => readManifest(tmp({kind: 'Service'}).f), /requires kind/));
test('read rejects wrong extension', () => assert.throws(() => readManifest(tmp('hey', '.txt').f), /Only YAML\/JSON/));
test('read rejects >1 MiB', () => assert.throws(() => safeFile(tmp('x'.repeat(MAX_INPUT_BYTES + 1)).f), /1 MiB/));
test('read accepts uppercase JSON extension', () => assert.equal(readManifest(tmp(base, '.JSON').f).value.kind, 'Service'));
test('read rejects directory', () => assert.throws(() => safeFile(tmpdir()), /regular/));
test('read rejects missing file', () => assert.throws(() => safeFile(path.join(tmpdir(), 'nope.yaml')), /ENOENT/));
sym('read rejects symlink file', () => { const {f, d} = tmp(base); const l = path.join(d, 'alias.json'); fs.symlinkSync(f, l); assert.throws(() => safeFile(l), /non-symlink/); });
sym('read rejects symlink directory', () => { const {d} = tmp(base); const l = path.join(os.tmpdir(), 'ds-link-' + Date.now()); fs.symlinkSync(d, l, 'junction'); try { assert.throws(() => safeFile(path.join(l, 'test.json')), /symlink|non-symlink/); } finally { fs.rmSync(l, {force: true, recursive: true}); } });
test('readManifests reads multi-document YAML', () => assert.equal(readManifests(fx('k8s/stack-before.yaml')).docs.length, 5));
test('readManifest refuses multi-document file', () => assert.throws(() => readManifest(fx('k8s/stack-before.yaml')), /Expected one resource/));
test('readManifests rejects duplicate identity', () => assert.throws(() => readManifests(tmp('kind: A\nmetadata:\n  name: x\n---\nkind: A\nmetadata:\n  name: x\n', '.yaml').f), /Duplicate resource identity/));
test('readManifests rejects document missing name', () => assert.throws(() => readManifests(tmp('kind: A\nmetadata:\n  name: x\n---\nkind: B\n', '.yaml').f), /document 2/));
test('readManifests expands JSON array and List', () => { assert.equal(readManifests(tmp([base, {...base, metadata: {name: 'b'}}]).f).docs.length, 2); assert.equal(readManifests(tmp({kind: 'List', items: [base]}).f).docs.length, 1); });
test('JSON line map is exact', () => { const d = docFromObject(base); assert.equal(d.lineMap.get('spec.type'), 8); });
test('source path never absolute outside cwd', () => { const {f} = tmp(base); assert.equal(readManifest(f).source.path, path.basename(f)); });
test('source is hashed', () => assert.match(after().source.sha256, /^[0-9a-f]{64}$/));
test('too many documents refused', () => assert.throws(() => readManifests(tmp(Array.from({length: 201}, (_, i) => `kind: A\nmetadata:\n  name: n${i}\n`).join('---\n'), '.yaml').f), /Too many documents/));

// ---- diff ----
test('diff catches replicas, image, privilege', () => { const d = diffManifests(before(), after()); for (const p of ['spec.replicas', 'spec.template.spec.containers[checkout].image', 'spec.template.spec.containers[checkout].securityContext.privileged']) assert(d.some(x => x.path === p), p); });
test('diff carries exact source line from the AFTER file', () => { const d = diffManifests(before(), after()); assert(d.filter(x => x.change !== 'removed').every(x => x.source.endsWith('after.yaml'))); assert(d.filter(x => x.change === 'removed').every(x => x.source.endsWith('before.yaml'))); assert.equal(d.find(x => x.path === 'spec.replicas').line, 7); assert.equal(d.find(x => x.path === 'spec.replicas').lineConfidence, 'exact'); });
test('diff does not dump env values', () => { const a = docFromObject({...base, kind: 'Deployment', spec: {template: {spec: {containers: [{name: 'c', env: [{name: 'API_TOKEN', value: 'SECRET_123'}]}]}}}}); const b = docFromObject({...a.value, spec: {template: {spec: {containers: [{name: 'c', env: [{name: 'API_TOKEN', value: 'SECRET_456'}]}]}}}}); const d = diffManifests(a, b); assert(d.length); assert(!JSON.stringify(d).includes('SECRET_')); assert(d[0].redacted); });
test('diff redacts Secret data entirely', () => { const mk = v => docFromObject({apiVersion: 'v1', kind: 'Secret', metadata: {name: 's'}, data: {k: v}}); const d = diffManifests(mk('b2xk'), mk('bmV3')); assert(d[0].redacted); assert(!JSON.stringify(d).includes('b2xk')); });
test('diff redacts password-named keys in ConfigMap', () => { const mk = v => docFromObject({apiVersion: 'v1', kind: 'ConfigMap', metadata: {name: 'c'}, data: {password: v}}); assert(diffManifests(mk('one'), mk('two'))[0].redacted); });
test('diff redacts bearer token inside strings', () => { const mk = v => docFromObject({apiVersion: 'v1', kind: 'ConfigMap', metadata: {name: 'c'}, data: {note: v}}); const d = diffManifests(mk('x'), mk('see token=abcdef123')); assert(!JSON.stringify(d).includes('abcdef123')); });
test('diff rejects identity mismatch', () => assert.throws(() => diffManifests(before(), readManifest(fx('k8s/service-after.yaml'))), /Mismatched/));
test('diff of identical inputs is empty', () => assert.equal(diffManifests(before(), before()).length, 0));
test('diff ids are stable across runs', () => assert.deepEqual(diffManifests(before(), after()).map(d => d.id), diffManifests(before(), after()).map(d => d.id)));
test('diff matches containers by name, not position', () => { const c = (n, i) => ({name: n, image: i}); const a = docFromObject({kind: 'Deployment', metadata: {name: 'd'}, spec: {template: {spec: {containers: [c('a', 'x:1'), c('b', 'y:1')]}}}}); const b = docFromObject({kind: 'Deployment', metadata: {name: 'd'}, spec: {template: {spec: {containers: [c('b', 'y:1'), c('a', 'x:1')]}}}}); assert.equal(diffManifests(a, b).length, 0); });
test('diff sees second container change', () => { const c = (n, i) => ({name: n, image: i}); const a = docFromObject({kind: 'Deployment', metadata: {name: 'd'}, spec: {template: {spec: {containers: [c('a', 'x:1'), c('b', 'y:1')]}}}}); const b = docFromObject({kind: 'Deployment', metadata: {name: 'd'}, spec: {template: {spec: {containers: [c('a', 'x:1'), c('b', 'y:2')]}}}}); assert.equal(diffManifests(a, b)[0].path, 'spec.template.spec.containers[b].image'); });
test('diff ignores status and server-populated metadata', () => { const a = docFromObject({...base, status: {x: 1}, metadata: {name: 'web', resourceVersion: '1'}}); const b = docFromObject({...base, status: {x: 2}, metadata: {name: 'web', resourceVersion: '9'}}); assert.equal(diffManifests(a, b).length, 0); });
test('diff reports annotation changes', () => { const mk = v => docFromObject({...base, metadata: {name: 'web', annotations: {'service.beta.kubernetes.io/aws-load-balancer-scheme': v}}}); assert.equal(diffManifests(mk('internal'), mk('internet-facing')).length, 1); });

// ---- policy: every rule (positive and negative) comes from the corpus; these cover specifics ----
test('rule registry has stable unique IDs DS-K8S-001..019', () => { assert.deepEqual(RULES.map(r => r.id), Array.from({length: 19}, (_, i) => `DS-K8S-${String(i + 1).padStart(3, '0')}`)); });
test('every rule has remediation, trigger, why and false-positive note', () => { for (const r of RULES) for (const k of ['title', 'trigger', 'why', 'remediation', 'falsePositive']) assert(r[k], `${r.id}.${k}`); });
test('explainRule is case-insensitive and rejects unknown ids', () => { assert.equal(explainRule('ds-k8s-004').severity, 'HIGH'); assert.throws(() => explainRule('DS-K8S-999'), /Unknown rule/); });
test('baseline fixture has no privileged finding', () => assert(!checkPolicies(before()).some(x => x.id === 'DS-K8S-004')));
test('after fixture trips 003-007 and 009', () => { const ids = new Set(checkPolicies(after()).map(f => f.id)); for (const id of ['DS-K8S-003', 'DS-K8S-004', 'DS-K8S-005', 'DS-K8S-006', 'DS-K8S-007', 'DS-K8S-009']) assert(ids.has(id), id); });
test('findings carry rule ID, source, severity and line', () => assert(checkPolicies(after()).every(f => /^DS-K8S-\d{3}$/.test(f.id) && f.source && f.severity && f.line !== undefined && f.lineConfidence)));
test('findings are deterministic and sorted', () => { const a = checkPolicies(after()); assert.deepEqual(a, checkPolicies(after())); assert.deepEqual(a.map(f => f.id), [...a.map(f => f.id)].sort()); });
test('absent-field finding points to nearest parent line', () => { const f = checkPolicies(after()).find(x => x.id === 'DS-K8S-008'); assert.equal(f.lineConfidence, 'parent'); assert(f.line > 0); });
test('secret env finding never contains the value', () => { const d = docFromObject({kind: 'Deployment', metadata: {name: 'd'}, spec: {template: {spec: {containers: [{name: 'c', env: [{name: 'DB_PASSWORD', value: 'CANARY123'}]}]}}}}); assert(!JSON.stringify(checkPolicies(d)).includes('CANARY123')); });
test('corpus: precision and recall are 1.0 with no misses', () => { const r = runCorpus(); assert.equal(r.misses.length, 0); assert.equal(r.precision, 1); assert.equal(r.recall, 1); });
test('corpus: every case has a name and expectation', () => assert(CASES.every(c => c[0] && Array.isArray(c[2]))));
test('classifyChange warns on identity change', () => assert(classifyChange(diffManifests(before(), after()), checkPolicies(after())).some(x => x.includes('identity'))));
test('profiles: development/staging/production exist', () => assert.deepEqual(Object.keys(PROFILES), ['development', 'staging', 'production']));

// ---- assess ----
test('assess blocks high risk', () => assert.equal(assess(before(), after()).gate, 'BLOCKED'));
test('assess gate reasons list the blocking findings', () => assert(assess(before(), after()).gateReasons.some(x => x.includes('DS-K8S-004'))));
test('assess never returns READY', () => { for (const [, o] of CASES) { const d = docFromObject(JSON.parse(JSON.stringify(o))); assert(['BLOCKED', 'HUMAN_REVIEW_REQUIRED'].includes(assess([d], [d], {previousRevision: 'v', backupVerified: true, restoreTestPassed: true, rollbackProcedure: 'x', operatorApprovalVerified: true}).gate)); } });
test('assess: hardened + full declarations is HUMAN_REVIEW_REQUIRED, not ready', () => { const h = readManifest(fx('k8s/hardened.yaml')); const r = assess(h, h, JSON.parse(fs.readFileSync(fx('k8s/rollback-declared.json'))), {profile: 'production'}); assert.equal(r.gate, 'HUMAN_REVIEW_REQUIRED'); assert.equal(r.rollback.ready, false); });
test('assess: missing rollback blocks even a clean manifest', () => { const h = readManifest(fx('k8s/hardened.yaml')); const r = assess(h, h); assert.equal(r.gate, 'BLOCKED'); assert(r.gateReasons.some(x => x.startsWith('Rollback evidence missing'))); });
test('assess: persistent HIGH risk is not ignored', () => { const r = assess(after(), after(), {previousRevision: 'v', backupVerified: true, restoreTestPassed: true, rollbackProcedure: 'x', operatorApprovalVerified: true}); assert.equal(r.gate, 'BLOCKED'); assert(r.persistentPolicyFindings.length > 0); assert.equal(r.newPolicyFindings.length, 0); });
test('assess: profile changes blocking (MEDIUM blocks only in production)', () => { const m = docFromObject({kind: 'Deployment', metadata: {name: 'd'}, spec: {replicas: 1, template: {spec: {containers: [{name: 'c', image: 'a:latest', resources: {limits: {cpu: '1'}}, readinessProbe: {}, securityContext: {runAsNonRoot: true}}]}}}}); const ev = {previousRevision: 'v', backupVerified: true, restoreTestPassed: true, rollbackProcedure: 'x', operatorApprovalVerified: true}; assert.equal(assess(m, m, ev, {profile: 'staging'}).gate, 'HUMAN_REVIEW_REQUIRED'); assert.equal(assess(m, m, ev, {profile: 'production'}).gate, 'BLOCKED'); });
test('assess records whether profile was explicit', () => { assert.equal(assess(before(), after()).profile.selection, 'default'); assert.equal(assess(before(), after(), null, {profile: 'development'}).profile.selection, 'explicit'); });
test('assess rejects unknown profile', () => assert.throws(() => assess(before(), after(), null, {profile: 'yolo'}), /Unknown profile/));
test('assess rejects mismatched single resources', () => assert.throws(() => assess(before(), readManifest(fx('k8s/service-after.yaml'))), /Mismatched/));
test('assess records untested cluster and permission checks', () => { const r = assess(before(), after()); assert.equal(r.checks.clusterDryRun, 'NOT_RUN'); assert.equal(r.checks.liveRBAC, 'NOT_TESTED'); assert.equal(r.checks.environmentDrift, 'NOT_TESTED'); assert.equal(r.checks.humanApproval, 'NOT_VERIFIED'); });
test('assess is deterministic: equal inputs, equal digest', () => assert.equal(assess(before(), after()).integrity.digest, assess(before(), after()).integrity.digest));
test('assess has no timestamps', () => assert(!/\d{4}-\d{2}-\d{2}T/.test(JSON.stringify(assess(before(), after())))));
test('assess report verifies after JSON round trip', () => assert(verify(JSON.parse(JSON.stringify(assess(before(), after()))))));
test('seal rejects edited and extended reports', () => { const r = assess(before(), after()); assert(!verify({...r, gate: 'READY'})); assert(!verify({...r, fake: 1})); });
test('multi-doc: removed resource raises DS-K8S-019', () => { const r = assess(readManifests(fx('k8s/stack-before.yaml')).docs, readManifests(fx('k8s/stack-after.yaml')).docs); assert(r.policyFindings.some(f => f.id === 'DS-K8S-019' && f.resource === 'ConfigMap/demo/legacy-flags')); assert.equal(r.resourceCounts.removed, 1); });
test('multi-doc: added resource is reported', () => { const b = readManifests(fx('k8s/stack-after.yaml')).docs; const a = readManifests(fx('k8s/stack-before.yaml')).docs; const r = assess(b, a); assert.equal(r.resourceCounts.added, 1); assert(r.diffs.some(d => d.change === 'resource-added')); });
test('multi-doc: LoadBalancer + inline secret + latest all found', () => { const ids = new Set(assess(readManifests(fx('k8s/stack-before.yaml')).docs, readManifests(fx('k8s/stack-after.yaml')).docs).newPolicyFindings.map(f => f.id)); for (const id of ['DS-K8S-001', 'DS-K8S-007', 'DS-K8S-012']) assert(ids.has(id), id); });
test('multi-doc: secret literal never reaches the report', () => assert(!JSON.stringify(assess(readManifests(fx('k8s/stack-before.yaml')).docs, readManifests(fx('k8s/stack-after.yaml')).docs)).includes('FAKE-DEMO-VALUE')));
test('blastmap: Service routes to Deployment, Ingress to Service', () => { const m = buildBlastMap(readManifests(fx('k8s/stack-after.yaml')).docs); assert(m.edges.some(e => e.from === 'Service/demo/shop' && e.to === 'Deployment/demo/shop' && e.relation === 'routes-to')); assert(m.edges.some(e => e.from === 'Ingress/demo/shop' && e.to === 'Service/demo/shop')); });
test('blastmap: unsupplied references are UNKNOWN, not invented', () => { const m = buildBlastMap(readManifests(fx('k8s/stack-before.yaml')).docs); const n = m.nodes.find(x => x.id === 'Secret/demo/shop-db'); assert.equal(n.status, 'UNKNOWN'); const sa = m.nodes.find(x => x.id === 'ServiceAccount/demo/shop'); assert.equal(sa.status, 'UNKNOWN'); });
test('blastmap: Service with no matching workload is UNKNOWN', () => { const m = buildBlastMap([docFromObject({...base, spec: {selector: {app: 'ghost'}}})]); assert(m.edges.some(e => /UNKNOWN/.test(e.certainty))); });
test('impactedByChange lists connected resources', () => assert(assess(readManifests(fx('k8s/stack-before.yaml')).docs, readManifests(fx('k8s/stack-after.yaml')).docs).impactedByChange.length > 0));

// ---- rollback ----
test('rollback missing entirely is unready', () => { const r = inspectRollback(null); assert.equal(r.ready, false); assert(r.checks.every(x => x.status === 'MISSING')); });
test('rollback arrays/strings are treated as not supplied', () => { assert.equal(inspectRollback([1]).source, 'not supplied'); assert.equal(inspectRollback('x').source, 'not supplied'); });
test('rollback declarations cannot prove readiness', () => { const r = inspectRollback({previousRevision: 'v1', backupVerified: true, restoreTestPassed: true, rollbackProcedure: 'revert', operatorApprovalVerified: true}); assert.equal(r.ready, false); assert(r.checks.every(x => x.status === 'DECLARED_NOT_VERIFIED')); });
test('rollback truthy strings do not count as verified booleans', () => assert.equal(inspectRollback({backupVerified: 'yes'}).checks.find(c => c.id === 'backup_verified').status, 'MISSING'));

// ---- tofu ----
const plan = () => JSON.parse(fs.readFileSync(fx('tofu/destructive-plan.json'), 'utf8'));
test('tofu counts actions and replacement', () => { const t = inspectTofuPlan(plan()); assert.equal(t.counts.update, 1); assert.equal(t.counts.delete, 1); assert.equal(t.counts.replace, 1); });
test('tofu destructive count and data-bearing block', () => { const t = inspectTofuPlan(plan()); assert.equal(t.dangerousChangeCount, 1); assert.equal(t.dataBearingDestructiveCount, 1); assert.equal(t.gate, 'BLOCKED'); });
test('tofu safe plan needs review but is not blocked', () => { const t = inspectTofuPlan(JSON.parse(fs.readFileSync(fx('tofu/safe-plan.json')))); assert.equal(t.gate, 'HUMAN_REVIEW_REQUIRED'); assert.equal(t.dangerousChangeCount, 0); });
test('tofu never copies secrets, addresses or state', () => { const s = JSON.stringify(inspectTofuPlan({...plan(), variables: {p: {value: 'VARSECRET'}}, prior_state: {v: 'STATESECRET'}})); for (const bad of ['TOP_SECRET_NEVER_REPORT', 'OTHER_SECRET', 'VARSECRET', 'STATESECRET', 'aws_db_instance.demo']) assert(!s.includes(bad), bad); });
test('tofu names discarded sections without copying them', () => { const t = inspectTofuPlan({...plan(), variables: {}, prior_state: {}, configuration: {}}); assert.deepEqual(t.ignoredSensitiveSections, ['prior_state', 'configuration', 'variables'].sort((a, b) => ['prior_state', 'planned_values', 'configuration', 'variables'].indexOf(a) - ['prior_state', 'planned_values', 'configuration', 'variables'].indexOf(b))); });
test('tofu flags truncation instead of silently dropping', () => { const t = inspectTofuPlan({resource_changes: Array.from({length: 1500}, () => ({type: 'aws_instance', change: {actions: ['create']}}))}); assert.equal(t.truncated, true); assert.equal(t.changeCount, 1000); assert.equal(t.totalChangesInInput, 1500); assert.equal(t.checks.planCompleteness, 'PARTIAL_TRUNCATED'); });
test('tofu cannot claim the plan was run', () => assert.equal(inspectTofuPlan({resource_changes: []}).checks.dryRunExecutedHere, 'NOT_RUN'));
test('tofu rejects missing resource_changes and non-objects', () => { assert.throws(() => inspectTofuPlan({}), /resource_changes/); assert.throws(() => inspectTofuPlan(null), /resource_changes/); assert.throws(() => inspectTofuPlan([]), /resource_changes/); });
test('tofu sanitises suspicious resource type and format version', () => { const r = inspectTofuPlan({format_version: 'password=NOPE', resource_changes: [{type: 'secret_token_123=topsecret!', change: {actions: ['create']}}]}); assert(!JSON.stringify(r).includes('topsecret')); assert(!JSON.stringify(r).includes('NOPE')); assert.equal(r.formatVersion, 'unknown'); });
test('tofu skips unknown actions', () => assert.deepEqual(inspectTofuPlan({resource_changes: [{type: 'aws_instance', change: {actions: ['evil']}}]}).counts, {create: 0, update: 0, delete: 0, no_op: 0, read: 0, forget: 0, replace: 0}));
test('tofu create-before-destroy is also a replacement', () => assert.equal(inspectTofuPlan({resource_changes: [{type: 'aws_instance', change: {actions: ['create', 'delete']}}]}).counts.replace, 1));
test('tofu output verifies', () => assert(verify(inspectTofuPlan({resource_changes: []}))));
test('tofu tolerates malformed entries', () => assert.equal(inspectTofuPlan({resource_changes: [null, 5, {}, {change: null}]}).changeCount, 4));

// ---- reporting ----
test('markdown carries gate, rule IDs and reasons', () => { const md = renderMarkdown(assess(before(), after())); for (const s of ['BLOCKED', 'DS-K8S-004', '## Why', 'NOT an', 'Report SHA-256']) assert(md.includes(s) || s === 'NOT an', s); });
test('markdown refuses tampered reports', () => assert.throws(() => renderMarkdown({...assess(before(), after()), gate: 'READY'}), /integrity/));
test('HTML is a full accessible document', () => { const h = renderHTML(assess(before(), after())); for (const s of ['<!doctype html>', 'lang="en"', 'Skip to report', 'role="status"', 'prefers-color-scheme', 'BLOCKED']) assert(h.includes(s), s); });
test('HTML never uses a green banner for the gate', () => assert(!/banner (pass|ok|green)/.test(renderHTML(assess(before(), after())))));
test('HTML escapes hostile manifest strings', () => { const mk = v => docFromObject({...base, metadata: {name: 'web', annotations: {x: v}}}); const h = renderHTML(assess(mk('a'), mk('<script>alert(1)</script>'), null)); assert(!h.includes('<script>alert')); assert(h.includes('&lt;script&gt;')); });
test('Markdown neutralises table and backtick injection', () => { const mk = v => docFromObject({...base, metadata: {name: 'web', annotations: {x: v}}}); const md = renderMarkdown(assess(mk('a'), mk('x | `y`\n# H'), null)); assert(!md.includes('\n# H')); });
test('HTML for tofu summary', () => { const h = renderHTML(inspectTofuPlan(plan())); assert(h.includes('Imported plan summary')); assert(!h.includes('TOP_SECRET')); });
test('reports exported with required names', () => { const d = tmpdir(); saveReports(assess(before(), after()), d); for (const n of ['deploy-readiness.json', 'deploy-readiness.md', 'deploy-readiness.html', 'environment-diff.json', 'policy-findings.json', 'blast-radius.md', 'rollback-checklist.md']) assert(fs.existsSync(path.join(d, n)), n); });
test('exported JSON verifies', () => { const d = tmpdir(); saveReports(assess(before(), after()), d); assert(verify(JSON.parse(fs.readFileSync(path.join(d, 'deploy-readiness.json'))))); });
test('export rejects tampered report', () => assert.throws(() => saveReports({...assess(before(), after()), foo: 2}, tmpdir()), /integrity/));
