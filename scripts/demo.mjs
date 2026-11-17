// Offline demo: regenerates every sample report from the synthetic fixtures. No network, no cluster.
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {assess, readManifest, readManifests, inspectTofuPlan, loadRollback, verify} from '../packages/core/index.mjs';
import {saveReports} from '../packages/reporting/index.mjs';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const file = x => path.join(root, x);
const rel = x => path.relative(process.cwd(), file(x)) || x;
const r = assess(readManifest(file('fixtures/k8s/before.yaml')), readManifest(file('fixtures/k8s/after.yaml')), loadRollback(file('fixtures/k8s/rollback.json')));
const svc = assess(readManifest(file('fixtures/k8s/service-before.yaml')), readManifest(file('fixtures/k8s/service-after.yaml')));
const stack = assess(readManifests(file('fixtures/k8s/stack-before.yaml')).docs, readManifests(file('fixtures/k8s/stack-after.yaml')).docs, null, {profile: 'production'});
const h = readManifest(file('fixtures/k8s/hardened.yaml'));
const clean = assess(h, h, loadRollback(file('fixtures/k8s/rollback-declared.json')), {profile: 'production'});
const tofu = inspectTofuPlan(JSON.parse(fs.readFileSync(file('fixtures/tofu/destructive-plan.json'), 'utf8')));
const tofuSafe = inspectTofuPlan(JSON.parse(fs.readFileSync(file('fixtures/tofu/safe-plan.json'), 'utf8')));
const out = {demo: r, service: svc, stack, 'hardened-clean': clean, tofu, 'tofu-safe': tofuSafe};
for (const [name, rep] of Object.entries(out)) saveReports(rep, file(`examples/reports/${name}`));
console.log(JSON.stringify({manifestGate: r.gate, k8sFindings: r.policyFindings.length, newHighFindings: r.newPolicyFindings.filter(x => x.severity === 'HIGH').length, servicePublicRule: svc.policyFindings.some(x => x.id === 'DS-K8S-001'), stackGate: stack.gate, stackRemoved: stack.resourceCounts.removed, hardenedGate: clean.gate, tofuDangerousResources: tofu.dangerousChangeCount, tofuGate: tofu.gate, reportsVerified: Object.values(out).every(verify), wrote: Object.keys(out).map(n => rel(`examples/reports/${n}`))}, null, 2));
