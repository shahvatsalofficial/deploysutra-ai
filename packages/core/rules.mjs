// Declarative rule registry + static checks. Rule IDs are stable across semver; never reuse or renumber.
// Every check is advisory static analysis of desired state. It is NOT proof of reachability, IAM scope or runtime behaviour.
import {clean} from './util.mjs';

export const RULES_VERSION = '2.0';
export const PROFILES = {
  development: {blockOn: ['HIGH'], note: 'Only HIGH findings block. Use for throw-away environments.'},
  staging: {blockOn: ['HIGH'], note: 'Default. HIGH findings block; MEDIUM and LOW need human review.'},
  production: {blockOn: ['HIGH', 'MEDIUM'], note: 'HIGH and MEDIUM findings block.'}
};

export const RULES = [
  {id: 'DS-K8S-001', severity: 'HIGH', title: 'Public Service exposure', trigger: 'Service type LoadBalancer or NodePort', why: 'May expose the workload beyond the cluster. Real reachability depends on cloud firewalls and NetworkPolicy, which this tool does not read.', remediation: 'Confirm intended audience; prefer ClusterIP behind a reviewed Ingress; verify firewall/ACLs.', falsePositive: 'Internal load balancers (cloud annotations) are still flagged; review the annotation.'},
  {id: 'DS-K8S-002', severity: 'HIGH', title: 'Wildcard or missing Ingress host', trigger: 'Ingress with no rules, or a rule with an empty or "*" host', why: 'Catch-all routing can capture unrelated traffic.', remediation: 'Declare explicit hosts and TLS.', falsePositive: 'A deliberate default backend is flagged.'},
  {id: 'DS-K8S-003', severity: 'HIGH', title: 'Host networking', trigger: 'hostNetwork: true', why: 'Pod shares the node network namespace and can reach node-local services.', remediation: 'Remove hostNetwork or document and isolate the node pool.', falsePositive: 'CNI/monitoring agents legitimately need it.'},
  {id: 'DS-K8S-004', severity: 'HIGH', title: 'Privileged container', trigger: 'securityContext.privileged: true', why: 'Near-root access to the node.', remediation: 'Drop privileged; add only the specific capability needed.', falsePositive: 'Node-level system agents.'},
  {id: 'DS-K8S-005', severity: 'HIGH', title: 'Privilege escalation allowed', trigger: 'allowPrivilegeEscalation: true', why: 'Processes may gain more privileges than their parent.', remediation: 'Set allowPrivilegeEscalation: false.', falsePositive: 'setuid binaries that are required.'},
  {id: 'DS-K8S-006', severity: 'MEDIUM', title: 'Explicit root user', trigger: 'runAsUser: 0', why: 'Root inside the container widens the blast radius of a breakout.', remediation: 'Use a non-zero UID.', falsePositive: 'Images that must bind low ports.'},
  {id: 'DS-K8S-007', severity: 'MEDIUM', title: 'Mutable or untagged image', trigger: 'image has no tag, uses :latest, and has no @sha256 digest', why: 'The same manifest can deploy different bits over time; rollback target is ambiguous.', remediation: 'Pin an immutable digest.', falsePositive: 'None expected.'},
  {id: 'DS-K8S-008', severity: 'MEDIUM', title: 'No resource limits', trigger: 'container without resources.limits', why: 'A noisy workload can starve its node.', remediation: 'Set cpu and memory limits.', falsePositive: 'Namespaces governed by LimitRange (not read here).'},
  {id: 'DS-K8S-009', severity: 'HIGH', title: 'Scaled to zero', trigger: 'Deployment/StatefulSet replicas: 0', why: 'The service has no running instances: an outage if intended to serve traffic.', remediation: 'Confirm intent and traffic drain plan.', falsePositive: 'Deliberate pause of a batch workload.'},
  {id: 'DS-K8S-010', severity: 'HIGH', title: 'RBAC wildcard', trigger: 'Role/ClusterRole rule with "*" in verbs or resources', why: 'Grants broader access than any single task needs.', remediation: 'Enumerate the exact verbs and resources.', falsePositive: 'Break-glass admin roles.'},
  {id: 'DS-K8S-011', severity: 'HIGH', title: 'Cluster-wide binding', trigger: 'kind ClusterRoleBinding', why: 'Permissions apply in every namespace.', remediation: 'Use a namespaced RoleBinding where possible; get independent approval.', falsePositive: 'Controllers that truly need cluster scope.'},
  {id: 'DS-K8S-012', severity: 'HIGH', title: 'Secret-like literal in env', trigger: 'env var named like password/secret/token/key with an inline value', why: 'Credentials in manifests leak through Git, logs and diffs. The value is never copied into reports.', remediation: 'Use valueFrom.secretKeyRef or an external secret store; rotate the exposed value.', falsePositive: 'Names such as KEY_PREFIX that hold non-secret data.'},
  {id: 'DS-K8S-013', severity: 'HIGH', title: 'Host PID or IPC namespace', trigger: 'hostPID: true or hostIPC: true', why: 'Pod can see or signal host processes or shared memory.', remediation: 'Remove unless a node agent requires it.', falsePositive: 'Node-level diagnostics.'},
  {id: 'DS-K8S-014', severity: 'HIGH', title: 'hostPath volume', trigger: 'volume with hostPath', why: 'Mounts node filesystem paths into the pod.', remediation: 'Use PVC, emptyDir or ConfigMap.', falsePositive: 'Log collectors reading /var/log.'},
  {id: 'DS-K8S-015', severity: 'HIGH', title: 'Dangerous Linux capability added', trigger: 'capabilities.add contains ALL, SYS_ADMIN, NET_ADMIN, SYS_PTRACE or SYS_MODULE', why: 'These capabilities approximate root over parts of the node.', remediation: 'Drop ALL and add only the minimum.', falsePositive: 'Network plugins.'},
  {id: 'DS-K8S-016', severity: 'LOW', title: 'No readiness probe', trigger: 'Deployment/StatefulSet/DaemonSet container without readinessProbe', why: 'Traffic can reach pods that are not ready during rollout.', remediation: 'Add a readiness probe.', falsePositive: 'Workloads that receive no traffic.'},
  {id: 'DS-K8S-017', severity: 'LOW', title: 'Non-root not enforced', trigger: 'neither pod nor container sets runAsNonRoot: true', why: 'The image decides the user; a root image will run as root.', remediation: 'Set runAsNonRoot: true.', falsePositive: 'Images with a verified non-root USER.'},
  {id: 'DS-K8S-018', severity: 'MEDIUM', title: 'RBAC can read Secrets', trigger: 'Role/ClusterRole grants get/list/watch (or *) on secrets', why: 'Any subject bound to it can read credentials.', remediation: 'Restrict to named secrets via resourceNames or remove.', falsePositive: 'Operators that manage their own secrets.'},
  {id: 'DS-K8S-019', severity: 'MEDIUM', title: 'Resource removed from desired state', trigger: 'A resource present in BEFORE is absent from AFTER', why: 'Applying with prune would delete it; dependants may break.', remediation: 'Confirm deletion is intended and data is backed up.', falsePositive: 'Renames appear as remove + add.', scope: 'diff'}
];
const BY_ID = new Map(RULES.map(r => [r.id, r]));
export const ruleById = id => BY_ID.get(String(id).toUpperCase());
export const explainRule = id => { const r = ruleById(id); if (!r) throw new Error(`Unknown rule ${clean(id, 40)}`); return r; };

const WORKLOADS = ['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Job', 'CronJob', 'Pod'];
const SECRETY = /(pass(word|wd)?|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential|auth[_-]?key)/i;
const DANGEROUS_CAPS = new Set(['ALL', 'SYS_ADMIN', 'NET_ADMIN', 'SYS_PTRACE', 'SYS_MODULE']);

export const identityOf = v => ({kind: v.kind, name: v.metadata.name, namespace: v.metadata.namespace || 'default', group: String(v.apiVersion || '').includes('/') ? String(v.apiVersion).split('/')[0] : ''});
export const identityKey = v => { const i = identityOf(v); return `${i.group}/${i.kind}/${i.namespace}/${i.name}`; };

export function podSpecOf(v) {
  if (v.kind === 'Pod') return {pod: v.spec, base: 'spec'};
  if (v.kind === 'CronJob') return {pod: v.spec?.jobTemplate?.spec?.template?.spec, base: 'spec.jobTemplate.spec.template.spec'};
  if (WORKLOADS.includes(v.kind)) return {pod: v.spec?.template?.spec, base: 'spec.template.spec'};
  return {pod: undefined, base: ''};
}

function imageMutable(img) {
  if (typeof img !== 'string') return false;
  if (img.includes('@sha256:')) return false;
  const last = img.split('/').at(-1);
  return !last.includes(':') || last.endsWith(':latest');
}

/** Run every per-document rule. Returns findings sorted deterministically. */
export function checkPolicies(doc) {
  const d = doc.value; const out = [];
  const res = `${d.kind}/${d.metadata.namespace || 'default'}/${d.metadata.name}`;
  const add = (id, msg, field) => {
    const r = BY_ID.get(id);
    // Absent fields (e.g. missing limits) point at the nearest existing parent; confidence says so.
    let line = null; let conf = 'unknown'; const parts = field.split('.');
    for (let n = parts.length; n > 0; n--) { const l = doc.lineMap?.get(parts.slice(0, n).join('.')); if (l) { line = l; conf = n === parts.length ? 'exact' : 'parent'; break; } }
    out.push({id, severity: r.severity, title: r.title, message: msg, field, resource: res, source: doc.source.path, line, lineConfidence: conf, evidence: 'static-rule', requirement: r.remediation});
  };
  if (d.kind === 'Service' && ['LoadBalancer', 'NodePort'].includes(d.spec?.type)) add('DS-K8S-001', `Service type ${d.spec.type} may create public ingress; network policies and cloud ACLs are not validated`, 'spec.type');
  if (d.kind === 'Ingress' && (!d.spec?.rules?.length || d.spec.rules.some(x => !x?.host || x.host === '*'))) add('DS-K8S-002', 'Ingress has a wildcard or unspecified hostname', 'spec.rules');
  const {pod, base} = podSpecOf(d);
  if (pod && typeof pod === 'object') {
    if (pod.hostNetwork === true) add('DS-K8S-003', 'Host network access enabled', `${base}.hostNetwork`);
    if (pod.hostPID === true || pod.hostIPC === true) add('DS-K8S-013', 'Pod shares the host PID or IPC namespace', `${base}.${pod.hostPID === true ? 'hostPID' : 'hostIPC'}`);
    (Array.isArray(pod.volumes) ? pod.volumes : []).forEach((vol, i) => { if (vol?.hostPath) add('DS-K8S-014', 'Volume mounts a node path (hostPath)', `${base}.volumes.${i}.hostPath`); });
    const podNonRoot = pod.securityContext?.runAsNonRoot === true;
    for (const group of ['containers', 'initContainers']) {
      (Array.isArray(pod[group]) ? pod[group] : []).forEach((c, i) => {
        if (!c || typeof c !== 'object') return;
        const p = `${base}.${group}.${i}`; const sc = c.securityContext || {};
        if (sc.privileged === true) add('DS-K8S-004', 'Container is privileged', `${p}.securityContext.privileged`);
        if (sc.allowPrivilegeEscalation === true) add('DS-K8S-005', 'Privilege escalation enabled', `${p}.securityContext.allowPrivilegeEscalation`);
        if (sc.runAsUser === 0) add('DS-K8S-006', 'Container explicitly runs as UID 0', `${p}.securityContext.runAsUser`);
        if (imageMutable(c.image)) add('DS-K8S-007', 'Unpinned or latest container image', `${p}.image`);
        if (!c.resources?.limits) add('DS-K8S-008', 'Container has no declared resource limits', `${p}.resources`);
        const caps = (Array.isArray(sc.capabilities?.add) ? sc.capabilities.add : []).filter(x => DANGEROUS_CAPS.has(String(x).toUpperCase()));
        if (caps.length) add('DS-K8S-015', `Capabilities added: ${caps.map(x => clean(x, 20)).join(', ')}`, `${p}.securityContext.capabilities.add`);
        (Array.isArray(c.env) ? c.env : []).forEach((e, k) => { if (e && typeof e.name === 'string' && SECRETY.test(e.name) && typeof e.value === 'string' && e.value.length) add('DS-K8S-012', `Env var ${clean(e.name, 60)} has an inline literal value (value withheld)`, `${p}.env.${k}.value`); });
        if (group === 'containers' && !podNonRoot && sc.runAsNonRoot !== true) add('DS-K8S-017', 'runAsNonRoot is not enforced', `${p}.securityContext`);
        if (group === 'containers' && ['Deployment', 'StatefulSet', 'DaemonSet'].includes(d.kind) && !c.readinessProbe) add('DS-K8S-016', 'Container has no readinessProbe', `${p}`);
      });
    }
  }
  if (['Deployment', 'StatefulSet'].includes(d.kind) && d.spec?.replicas === 0) add('DS-K8S-009', 'Replicas set to zero; the service will have no running instances', 'spec.replicas');
  if (['Role', 'ClusterRole'].includes(d.kind)) {
    (Array.isArray(d.rules) ? d.rules : []).forEach((r, i) => {
      const verbs = Array.isArray(r?.verbs) ? r.verbs : []; const resources = Array.isArray(r?.resources) ? r.resources : [];
      if (verbs.includes('*') || resources.includes('*')) add('DS-K8S-010', 'RBAC wildcard permission detected', `rules.${i}`);
      if ((resources.includes('secrets') || resources.includes('*')) && verbs.some(v => ['get', 'list', 'watch', '*'].includes(v))) add('DS-K8S-018', 'Rule can read Secrets', `rules.${i}`);
    });
  }
  if (d.kind === 'ClusterRoleBinding') add('DS-K8S-011', 'Cluster-wide RBAC binding requires independent approval', 'roleRef');
  return out.sort((a, b) => a.id.localeCompare(b.id) || a.resource.localeCompare(b.resource) || String(a.field).localeCompare(String(b.field)));
}
