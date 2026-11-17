// BlastMap: qualified dependency edges derived ONLY from the supplied manifests.
// Anything referenced but not supplied is reported UNKNOWN; ownership and traffic are never invented.
import {podSpecOf, identityOf} from './rules.mjs';

const nid = (kind, ns, name) => `${kind}/${ns}/${name}`;
const nsOf = v => v.metadata.namespace || 'default';

export function buildBlastMap(docs) {
  const nodes = new Map(); const edges = [];
  const have = new Set(docs.map(d => nid(d.value.kind, nsOf(d.value), d.value.metadata.name)));
  for (const d of docs) { const i = identityOf(d.value); nodes.set(nid(i.kind, i.namespace, i.name), {id: nid(i.kind, i.namespace, i.name), kind: i.kind, status: 'SUPPLIED'}); }
  const edge = (from, kind, ns, name, relation) => {
    if (!name || typeof name !== 'string') return;
    const to = nid(kind, ns, name);
    if (!nodes.has(to)) nodes.set(to, {id: to, kind, status: 'UNKNOWN', note: 'Referenced but not in the supplied manifests; ownership and state unknown'});
    edges.push({from, to, relation, certainty: have.has(to) ? 'declared-in-manifests' : 'declared-target-not-supplied'});
  };
  const templateLabels = new Map();
  for (const d of docs) { const v = d.value; if (['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Job'].includes(v.kind)) templateLabels.set(nid(v.kind, nsOf(v), v.metadata.name), v.spec?.template?.metadata?.labels || {}); }
  for (const d of docs) {
    const v = d.value; const ns = nsOf(v); const me = nid(v.kind, ns, v.metadata.name);
    const {pod} = podSpecOf(v);
    if (pod && typeof pod === 'object') {
      edge(me, 'ServiceAccount', ns, pod.serviceAccountName, 'runs-as');
      for (const c of [...(pod.containers || []), ...(pod.initContainers || [])]) {
        for (const e of c?.env || []) { edge(me, 'ConfigMap', ns, e?.valueFrom?.configMapKeyRef?.name, 'reads-config'); edge(me, 'Secret', ns, e?.valueFrom?.secretKeyRef?.name, 'reads-secret'); }
        for (const f of c?.envFrom || []) { edge(me, 'ConfigMap', ns, f?.configMapRef?.name, 'reads-config'); edge(me, 'Secret', ns, f?.secretRef?.name, 'reads-secret'); }
      }
      for (const vol of pod.volumes || []) { edge(me, 'ConfigMap', ns, vol?.configMap?.name, 'mounts-config'); edge(me, 'Secret', ns, vol?.secret?.secretName, 'mounts-secret'); edge(me, 'PersistentVolumeClaim', ns, vol?.persistentVolumeClaim?.claimName, 'mounts-storage'); }
    }
    if (v.kind === 'Service' && v.spec?.selector && Object.keys(v.spec.selector).length) {
      let matched = false;
      for (const [id, labels] of templateLabels) if (id.split('/')[1] === ns && Object.entries(v.spec.selector).every(([k, val]) => labels[k] === val)) { edges.push({from: me, to: id, relation: 'routes-to', certainty: 'selector-matches-pod-template-labels'}); matched = true; }
      if (!matched) edges.push({from: me, to: `Pods/${ns}/selector:${Object.entries(v.spec.selector).map(([k, x]) => `${k}=${x}`).join(',')}`, relation: 'routes-to', certainty: 'UNKNOWN-no-matching-workload-supplied'});
    }
    if (v.kind === 'Ingress') {
      edge(me, 'Service', ns, v.spec?.defaultBackend?.service?.name, 'routes-to');
      for (const r of v.spec?.rules || []) for (const p of r?.http?.paths || []) edge(me, 'Service', ns, p?.backend?.service?.name, 'routes-to');
    }
    if (['RoleBinding', 'ClusterRoleBinding'].includes(v.kind)) {
      edge(me, v.roleRef?.kind || 'Role', v.kind === 'ClusterRoleBinding' ? '-' : ns, v.roleRef?.name, 'grants-role');
      for (const s of v.subjects || []) if (s?.kind === 'ServiceAccount') edge(me, 'ServiceAccount', s.namespace || ns, s.name, 'binds-subject');
    }
  }
  return {nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)), edges: edges.sort((a, b) => (a.from + a.to + a.relation).localeCompare(b.from + b.to + b.relation))};
}

/** One-hop dependants/dependencies of every changed resource. Only supplied edges are used. */
export function impactedBy(map, changedIds) {
  const out = [];
  for (const id of changedIds) {
    for (const e of map.edges) {
      if (e.to === id) out.push({changed: id, affected: e.from, relation: `${e.from.split('/')[0]} ${e.relation} this`, certainty: e.certainty});
      if (e.from === id) out.push({changed: id, affected: e.to, relation: `this ${e.relation} ${e.to.split('/')[0]}`, certainty: e.certainty});
    }
  }
  const seen = new Set();
  return out.filter(x => { const k = `${x.changed}|${x.affected}|${x.relation}`; return !seen.has(k) && seen.add(k); });
}
