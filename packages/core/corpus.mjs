// Author-labelled regression corpus for the static rules. Every positive case has a matching negative twin.
// This is a regression corpus written by the tool's author, NOT an independent benchmark. It proves the rules do
// what they claim on these inputs, not that they catch every real-world misconfiguration.
import {docFromObject} from './manifest.mjs';
import {checkPolicies} from './rules.mjs';

const good = (over = {}) => ({
  name: 'app', image: 'registry.example.com/app@sha256:' + 'a'.repeat(64), resources: {limits: {cpu: '500m', memory: '256Mi'}},
  readinessProbe: {httpGet: {path: '/', port: 8080}}, securityContext: {runAsNonRoot: true, allowPrivilegeEscalation: false}, ...over
});
const workload = (kind, container, podExtra = {}, spec = {}) => ({apiVersion: kind === 'Pod' ? 'v1' : 'apps/v1', kind, metadata: {name: 'app', namespace: 'prod'}, spec: kind === 'Pod' ? {containers: [container], ...podExtra} : {replicas: 2, ...spec, template: {spec: {containers: [container], ...podExtra}}}});
const dep = (c, podExtra, spec) => workload('Deployment', c, podExtra, spec);
const svc = type => ({apiVersion: 'v1', kind: 'Service', metadata: {name: 'web'}, spec: {type, selector: {app: 'web'}, ports: [{port: 80}]}});
const ing = rules => ({apiVersion: 'networking.k8s.io/v1', kind: 'Ingress', metadata: {name: 'web'}, spec: {rules}});
const role = (kind, rules) => ({apiVersion: 'rbac.authorization.k8s.io/v1', kind, metadata: {name: 'r'}, rules});

export const CASES = [
  ['hardened deployment is clean', dep(good()), []],
  ['ClusterIP service is clean', svc('ClusterIP'), []],
  ['LoadBalancer service', svc('LoadBalancer'), ['DS-K8S-001']],
  ['NodePort service', svc('NodePort'), ['DS-K8S-001']],
  ['explicit-host ingress is clean', ing([{host: 'a.example.com'}]), []],
  ['wildcard host ingress', ing([{host: '*'}]), ['DS-K8S-002']],
  ['host-less ingress rule', ing([{http: {}}]), ['DS-K8S-002']],
  ['ingress without rules', ing([]), ['DS-K8S-002']],
  ['hostNetwork', dep(good(), {hostNetwork: true}), ['DS-K8S-003']],
  ['hostNetwork false is clean', dep(good(), {hostNetwork: false}), []],
  ['privileged container', dep(good({securityContext: {runAsNonRoot: true, privileged: true}})), ['DS-K8S-004']],
  ['privileged false is clean', dep(good({securityContext: {runAsNonRoot: true, privileged: false}})), []],
  ['allowPrivilegeEscalation true', dep(good({securityContext: {runAsNonRoot: true, allowPrivilegeEscalation: true}})), ['DS-K8S-005']],
  ['runAsUser 0', dep(good({securityContext: {runAsNonRoot: true, runAsUser: 0}})), ['DS-K8S-006']],
  ['runAsUser 10001 is clean', dep(good({securityContext: {runAsNonRoot: true, runAsUser: 10001}})), []],
  ['latest tag', dep(good({image: 'app:latest'})), ['DS-K8S-007']],
  ['untagged image', dep(good({image: 'app'})), ['DS-K8S-007']],
  ['registry port without tag', dep(good({image: 'registry.local:5000/team/app'})), ['DS-K8S-007']],
  ['registry port with tag is clean', dep(good({image: 'registry.local:5000/team/app:1.4.2'})), []],
  ['pinned tag is clean', dep(good({image: 'app:1.2.3'})), []],
  ['missing limits', dep(good({resources: {requests: {cpu: '100m'}}})), ['DS-K8S-008']],
  ['replicas zero deployment', dep(good(), {}, {replicas: 0}), ['DS-K8S-009']],
  ['replicas zero statefulset', workload('StatefulSet', good(), {}, {replicas: 0}), ['DS-K8S-009']],
  ['replicas 3 is clean', dep(good(), {}, {replicas: 3}), []],
  ['Role with wildcard verbs', role('Role', [{apiGroups: [''], resources: ['pods'], verbs: ['*']}]), ['DS-K8S-010']],
  ['ClusterRole wildcard resources', role('ClusterRole', [{apiGroups: [''], resources: ['*'], verbs: ['get']}]), ['DS-K8S-010', 'DS-K8S-018']],
  ['Role read pods is clean', role('Role', [{apiGroups: [''], resources: ['pods'], verbs: ['get', 'list']}]), []],
  ['ClusterRoleBinding', {apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'ClusterRoleBinding', metadata: {name: 'b'}, roleRef: {kind: 'ClusterRole', name: 'admin'}, subjects: []}, ['DS-K8S-011']],
  ['RoleBinding is clean', {apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'RoleBinding', metadata: {name: 'b'}, roleRef: {kind: 'Role', name: 'r'}, subjects: []}, []],
  ['inline password env', dep(good({env: [{name: 'DB_PASSWORD', value: 'hunter2-DO-NOT-LEAK'}]})), ['DS-K8S-012']],
  ['secretKeyRef env is clean', dep(good({env: [{name: 'DB_PASSWORD', valueFrom: {secretKeyRef: {name: 'db', key: 'pw'}}}]})), []],
  ['non-secret env is clean', dep(good({env: [{name: 'LOG_LEVEL', value: 'debug'}]})), []],
  ['hostPID', dep(good(), {hostPID: true}), ['DS-K8S-013']],
  ['hostIPC', dep(good(), {hostIPC: true}), ['DS-K8S-013']],
  ['hostPath volume', dep(good(), {volumes: [{name: 'v', hostPath: {path: '/var/run'}}]}), ['DS-K8S-014']],
  ['emptyDir volume is clean', dep(good(), {volumes: [{name: 'v', emptyDir: {}}]}), []],
  ['SYS_ADMIN capability', dep(good({securityContext: {runAsNonRoot: true, capabilities: {add: ['SYS_ADMIN']}}})), ['DS-K8S-015']],
  ['NET_BIND_SERVICE capability is clean', dep(good({securityContext: {runAsNonRoot: true, capabilities: {add: ['NET_BIND_SERVICE']}}})), []],
  ['missing readiness probe', dep(good({readinessProbe: undefined})), ['DS-K8S-016']],
  ['missing runAsNonRoot', dep(good({securityContext: {allowPrivilegeEscalation: false}})), ['DS-K8S-017']],
  ['pod-level runAsNonRoot is clean', dep(good({securityContext: {allowPrivilegeEscalation: false}}), {securityContext: {runAsNonRoot: true}}), []],
  ['Role reads secrets', role('Role', [{apiGroups: [''], resources: ['secrets'], verbs: ['get']}]), ['DS-K8S-018']],
  ['Role creates secrets only is clean', role('Role', [{apiGroups: [''], resources: ['secrets'], verbs: ['create']}]), []],
  ['CronJob privileged', {apiVersion: 'batch/v1', kind: 'CronJob', metadata: {name: 'cj'}, spec: {jobTemplate: {spec: {template: {spec: {containers: [good({securityContext: {runAsNonRoot: true, privileged: true}})]}}}}}}, ['DS-K8S-004']],
  ['initContainer privileged', dep(good(), {initContainers: [good({name: 'init', securityContext: {runAsNonRoot: true, privileged: true}})]}), ['DS-K8S-004']],
  ['DaemonSet hostNetwork', workload('DaemonSet', good(), {hostNetwork: true}), ['DS-K8S-003']],
  ['second container privileged', dep(good(), {containers: [good(), good({name: 'side', securityContext: {runAsNonRoot: true, privileged: true}})]}), ['DS-K8S-004']],
  ['Pod with hostNetwork', workload('Pod', good(), {hostNetwork: true}), ['DS-K8S-003']],
  ['ConfigMap is clean', {apiVersion: 'v1', kind: 'ConfigMap', metadata: {name: 'c'}, data: {a: 'b'}}, []],
  ['Secret object is clean (no rule inspects values)', {apiVersion: 'v1', kind: 'Secret', metadata: {name: 's'}, data: {a: 'YQ=='}}, []]
];

/** Run the corpus; returns precision/recall over (case, ruleId) pairs plus every miss. */
export function runCorpus() {
  let tp = 0; let fp = 0; let fn = 0; const misses = []; const covered = new Set();
  for (const [name, obj, expect] of CASES) {
    const got = new Set(checkPolicies(docFromObject(JSON.parse(JSON.stringify(obj)), 'corpus.json')).map(f => f.id));
    const want = new Set(expect);
    for (const id of want) { covered.add(id); if (got.has(id)) tp++; else { fn++; misses.push({case: name, missing: id}); } }
    for (const id of got) if (!want.has(id)) { fp++; misses.push({case: name, unexpected: id}); }
  }
  const total = CASES.length;
  return {cases: total, positiveCases: CASES.filter(c => c[2].length).length, negativeCases: CASES.filter(c => !c[2].length).length, truePositives: tp, falsePositives: fp, falseNegatives: fn, precision: tp + fp ? tp / (tp + fp) : 1, recall: tp + fn ? tp / (tp + fn) : 1, passed: total - new Set(misses.map(m => m.case)).size, rulesCovered: [...covered].sort(), misses};
}
