// Assessment: two-snapshot comparison, rollback evidence model, imported IaC plan summaries, gate computation.
// The gate can only ever be BLOCKED or HUMAN_REVIEW_REQUIRED. There is no READY state by design.
import {safeFile, seal, clean, sha256, SCHEMA_VERSION, VERSION} from './util.mjs';
import {checkPolicies, identityKey, identityOf, PROFILES, RULES_VERSION} from './rules.mjs';
import {diffManifests, classifyChange} from './manifest.mjs';
import {buildBlastMap, impactedBy} from './blast.mjs';

const fileLevel = d => { const {document, ...s} = d.source; return s; };
const rid = v => { const i = identityOf(v); return `${i.kind}/${i.namespace}/${i.name}`; };
const asSet = x => (Array.isArray(x) ? x : [x]);

export function inspectRollback(evidence) {
  const supplied = Boolean(evidence) && typeof evidence === 'object' && !Array.isArray(evidence);
  const e = supplied ? evidence : {};
  const checks = [
    ['prior_revision', Boolean(e.previousRevision), 'Evidence of known previous deployable revision'],
    ['backup_verified', e.backupVerified === true, 'Independent backup validity evidence'],
    ['restore_test', e.restoreTestPassed === true, 'Actual successful restore test evidence'],
    ['rollback_procedure', Boolean(e.rollbackProcedure), 'Documented rollback sequence'],
    ['operator_approval', e.operatorApprovalVerified === true, 'Independent authorized operator approval evidence']
  ];
  return {
    source: supplied ? 'user-supplied metadata' : 'not supplied',
    checks: checks.map(([id, ok, description]) => ({id, status: ok ? 'DECLARED_NOT_VERIFIED' : 'MISSING', description})),
    ready: false,
    reason: 'Rollback readiness is not established by declarations alone; a restore drill and human sign-off are required'
  };
}

export function loadRollback(file) {
  if (!file) return null;
  const f = safeFile(file);
  let v;
  try { v = JSON.parse(f.text); } catch { throw new Error('Rollback evidence is not valid JSON'); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Rollback evidence must be a JSON object');
  return v;
}

const sig = f => `${f.id}|${f.resource}|${f.field}`;

/**
 * Compare two desired-state snapshots (single documents or arrays from readManifests).
 * opts.profile: development | staging | production (explicit choice recorded in the report).
 */
export function assess(beforeIn, afterIn, rollbackEvidence, opts = {}) {
  const before = asSet(beforeIn); const after = asSet(afterIn);
  const profileName = opts.profile || 'staging';
  if (!Object.hasOwn(PROFILES, profileName)) throw new Error(`Unknown profile ${clean(profileName, 30)}. Allowed: ${Object.keys(PROFILES).join(', ')}`);
  const profile = {name: profileName, selection: opts.profile ? 'explicit' : 'default', blockOn: PROFILES[profileName].blockOn};
  if (before.length === 1 && after.length === 1 && identityKey(before[0].value) !== identityKey(after[0].value)) throw new Error('Mismatched Kubernetes resource identity (kind/namespace/name)');
  const bMap = new Map(before.map(d => [identityKey(d.value), d])); const aMap = new Map(after.map(d => [identityKey(d.value), d]));
  const diffs = []; const resources = []; const removed = [];
  for (const [k, a] of aMap) {
    const b = bMap.get(k);
    if (!b) { diffs.push({id: `DS-DIFF-${sha256(rid(a.value)+'|add').slice(0, 9)}`, resource: rid(a.value), path: '(resource)', label: 'resource added', risk: 'other', change: 'resource-added', before: '[absent]', after: '[present]', redacted: false, source: a.source.path, line: a.lineMap?.get('kind') ?? null, lineConfidence: a.lineMap?.get('kind') ? 'exact' : 'unknown', evidence: 'static-manifest-diff', scope: 'desired-state-only'}); resources.push({resource: rid(a.value), status: 'added'}); continue; }
    const d = diffManifests(b, a); diffs.push(...d); resources.push({resource: rid(a.value), status: d.length ? 'changed' : 'unchanged', diffCount: d.length});
  }
  for (const [k, b] of bMap) if (!aMap.has(k)) {
    removed.push(b); resources.push({resource: rid(b.value), status: 'removed'});
    diffs.push({id: `DS-DIFF-${sha256(rid(b.value)+'|rm').slice(0, 9)}`, resource: rid(b.value), path: '(resource)', label: 'resource removed', risk: 'other', change: 'resource-removed', before: '[present]', after: '[absent]', redacted: false, source: b.source.path, line: b.lineMap?.get('kind') ?? null, lineConfidence: b.lineMap?.get('kind') ? 'exact' : 'unknown', evidence: 'static-manifest-diff', scope: 'desired-state-only'});
  }
  const baseline = before.flatMap(checkPolicies); const candidate = after.flatMap(checkPolicies);
  const baseSigs = new Set(baseline.map(sig));
  const tagged = candidate.map(f => ({...f, status: baseSigs.has(sig(f)) ? 'persistent' : 'new'}));
  for (const b of removed) tagged.push({id: 'DS-K8S-019', severity: 'MEDIUM', title: 'Resource removed from desired state', message: `${rid(b.value)} exists BEFORE but not AFTER`, field: 'metadata.name', resource: rid(b.value), source: b.source.path, line: b.lineMap?.get('metadata.name') ?? null, lineConfidence: b.lineMap?.get('metadata.name') ? 'exact' : 'unknown', evidence: 'static-rule', requirement: 'Confirm deletion is intended and data is backed up', status: 'new'});
  tagged.sort((a, b) => a.id.localeCompare(b.id) || a.resource.localeCompare(b.resource) || String(a.field).localeCompare(String(b.field)));
  const newly = tagged.filter(f => f.status === 'new'); const persistent = tagged.filter(f => f.status === 'persistent');
  const rollback = inspectRollback(rollbackEvidence);
  const reasons = [];
  for (const f of tagged) if (profile.blockOn.includes(f.severity)) reasons.push(`${f.status === 'new' ? 'New' : 'Persistent'} ${f.severity} finding ${f.id} on ${f.resource}`);
  const missing = rollback.checks.filter(c => c.status === 'MISSING');
  if (missing.length) reasons.push(`Rollback evidence missing: ${missing.map(c => c.id).join(', ')}`);
  const blastMap = buildBlastMap(after.length ? after : before);
  const changedIds = resources.filter(r => r.status !== 'unchanged').map(r => r.resource);
  const single = after.length === 1;
  const report = {
    schemaVersion: SCHEMA_VERSION, product: 'DeploySutra AI', productVersion: VERSION, rulesVersion: RULES_VERSION, scope: 'OFFLINE_STATIC_K8S', profile,
    source: {before: before[0] ? fileLevel(before[0]) : null, after: after[0] ? fileLevel(after[0]) : null},
    identity: single ? {kind: after[0].value.kind, name: after[0].value.metadata.name, namespace: after[0].value.metadata.namespace || 'default'} : null,
    resourceCounts: {before: before.length, after: after.length, added: resources.filter(r => r.status === 'added').length, removed: removed.length, changed: resources.filter(r => r.status === 'changed').length},
    resources: resources.sort((a, b) => a.resource.localeCompare(b.resource)),
    diffs, policyFindings: tagged, newPolicyFindings: newly, persistentPolicyFindings: persistent,
    blastMap, impactedByChange: impactedBy(blastMap, changedIds),
    blastRadius: classifyChange(diffs, tagged.filter(f => profile.blockOn.includes(f.severity))), rollback,
    gate: reasons.length ? 'BLOCKED' : 'HUMAN_REVIEW_REQUIRED', gateReasons: reasons,
    checks: {manifestParsing: 'VERIFIED_STATIC', policyRules: 'VERIFIED_STATIC', environmentDrift: 'NOT_TESTED', liveRBAC: 'NOT_TESTED', clusterDryRun: 'NOT_RUN', workloadHealth: 'NOT_RUN', realRollback: 'NOT_RUN', humanApproval: 'NOT_VERIFIED'},
    limitations: [
      'This compares two local desired-state snapshots, not observed live drift.',
      'The built-in YAML parser supports a strict subset (no anchors, tags, templates, block scalars or nested flow collections); unsupported syntax fails loudly.',
      'Policy checks are heuristic static rules, not authoritative validation, admission control or compliance certification.',
      'Admission mutation, defaulting, controllers, image tag drift and real traffic exposure are not modelled.',
      'Dependency edges come only from the supplied manifests; anything else is reported UNKNOWN.',
      'No Kubernetes/cloud connection, deployment, destructive command, or rollback was executed.'
    ]
  };
  return seal(report);
}

// ---- imported OpenTofu / Terraform plan summary ----------------------------------------------------------------
const ACTIONS = ['create', 'update', 'delete', 'no-op', 'read', 'forget'];
const SENSITIVE_SECTIONS = ['prior_state', 'planned_values', 'configuration', 'variables', 'output_changes', 'resource_drift', 'checks'];
const DATA_BEARING = /(db|database|rds|sql|dynamo|bucket|s3|volume|disk|ebs|storage|efs|cluster|kms|key|secret|vault|queue|topic|redis|cache|snapshot|backup)/i;
const MAX_CHANGES = 1000;

export function inspectTofuPlan(plan) {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.resource_changes)) throw new Error('OpenTofu/Terraform plan JSON requires resource_changes array');
  const slice = plan.resource_changes.slice(0, MAX_CHANGES);
  const entries = slice.map(c => {
    const t = String(c?.type ?? 'unknown');
    const type = /^[A-Za-z][A-Za-z0-9_.-]{0,89}$/.test(t) ? t : '[unrecognized resource type]';
    const actions = Array.isArray(c?.change?.actions) ? c.change.actions.filter(x => ACTIONS.includes(x)) : [];
    const replace = actions.includes('delete') && actions.includes('create');
    return {type, actions, replace, danger: actions.includes('delete') || replace};
  });
  const counts = {create: 0, update: 0, delete: 0, no_op: 0, read: 0, forget: 0, replace: 0};
  const byType = {};
  for (const e of entries) {
    const bt = (byType[e.type] ||= {create: 0, update: 0, delete: 0, replace: 0});
    for (const a of e.actions) { const k = a.replace('-', '_'); if (counts[k] !== undefined) counts[k]++; if (bt[a] !== undefined) bt[a]++; }
    if (e.replace) { counts.replace++; bt.replace++; }
  }
  const dataBearing = entries.filter(e => e.danger && DATA_BEARING.test(e.type)).length;
  const truncated = plan.resource_changes.length > MAX_CHANGES;
  const ignoredSections = SENSITIVE_SECTIONS.filter(k => Object.hasOwn(plan, k));
  return seal({
    schemaVersion: SCHEMA_VERSION, product: 'DeploySutra AI', productVersion: VERSION, scope: 'IMPORTED_TOFU_PLAN_ACTIONS_ONLY',
    formatVersion: /^\d+\.\d+$/.test(String(plan.format_version || '')) ? String(plan.format_version) : 'unknown',
    changeCount: entries.length, totalChangesInInput: plan.resource_changes.length, truncated, counts,
    byType: Object.fromEntries(Object.keys(byType).sort().map(k => [k, byType[k]])), resourceTypes: [...new Set(entries.map(e => e.type))].sort(),
    dangerousChangeCount: entries.filter(e => e.danger).length, dataBearingDestructiveCount: dataBearing,
    ignoredSensitiveSections: ignoredSections,
    gate: dataBearing > 0 ? 'BLOCKED' : 'HUMAN_REVIEW_REQUIRED',
    gateReasons: dataBearing > 0 ? [`${dataBearing} destructive change(s) on data-bearing resource types (name heuristic); restore evidence is not part of a plan`] : [],
    checks: {planAuthenticity: 'NOT_VERIFIED', dryRunExecutedHere: 'NOT_RUN', providerPermissions: 'NOT_TESTED', rollback: 'NOT_TESTED', planCompleteness: truncated ? 'PARTIAL_TRUNCATED' : 'VERIFIED_STATIC'},
    limitations: [
      'Source plan input may contain secrets; only resource type and action summaries are retained in output. Resource addresses, values, providers and state are discarded.',
      'Data-bearing detection is a resource-type name heuristic, not knowledge of what the resource stores.',
      'No plan was executed or confirmed against a live workspace.',
      ...(truncated ? [`Input had ${plan.resource_changes.length} changes; only the first ${MAX_CHANGES} were summarised.`] : [])
    ]
  });
}
