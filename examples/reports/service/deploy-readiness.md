# DeploySutra AI - Kubernetes desired-state review

**Gate:** BLOCKED (NEVER an authorization to deploy)  
Do not proceed until every reason below is resolved or consciously accepted by a human operator.

## Why

- New HIGH finding DS-K8S-001 on Service/default/checkout-service
- Rollback evidence missing: prior_revision, backup_verified, restore_test, rollback_procedure, operator_approval

**Profile:** staging (default; blocks on HIGH)  
**Resources:** 1 before, 1 after (0 added, 0 removed, 1 changed)  
**Source before:** fixtures/k8s/service-before.yaml (sha256 a83bb6a861b2…)  
**Source after:** fixtures/k8s/service-after.yaml (sha256 83372a0c08fb…)

## Findings

| Rule | Severity | Status | Resource | Message | Where |
| --- | --- | --- | --- | --- | --- |
| DS-K8S-001 | HIGH | new | Service/default/checkout-service | Service type LoadBalancer may create public ingress; network policies and cloud ACLs are not validated | fixtures/k8s/service-after.yaml:6 |

## Changes (desired state)

| Resource | What | Change | Before | After | Where |
| --- | --- | --- | --- | --- | --- |
| Service/default/checkout-service | service exposure (spec.type) | changed | ClusterIP | LoadBalancer | fixtures/k8s/service-after.yaml:6 |

## Blast-radius questions

- Service exposure changed: review traffic/security blast radius
- High-risk static rule triggered; deployment approval must remain blocked

## BlastMap (edges derived only from supplied manifests)

_None._

## Rollback prerequisites

- [ ] Evidence of known previous deployable revision: **MISSING**
- [ ] Independent backup validity evidence: **MISSING**
- [ ] Actual successful restore test evidence: **MISSING**
- [ ] Documented rollback sequence: **MISSING**
- [ ] Independent authorized operator approval evidence: **MISSING**

> Rollback readiness is not established by declarations alone; a restore drill and human sign-off are required

## Verification boundaries

| Check | State |
| --- | --- |
| manifestParsing | VERIFIED_STATIC |
| policyRules | VERIFIED_STATIC |
| environmentDrift | NOT_TESTED |
| liveRBAC | NOT_TESTED |
| clusterDryRun | NOT_RUN |
| workloadHealth | NOT_RUN |
| realRollback | NOT_RUN |
| humanApproval | NOT_VERIFIED |

## Limitations

- This compares two local desired-state snapshots, not observed live drift.
- The built-in YAML parser supports a strict subset (no anchors, tags, templates, block scalars or nested flow collections); unsupported syntax fails loudly.
- Policy checks are heuristic static rules, not authoritative validation, admission control or compliance certification.
- Admission mutation, defaulting, controllers, image tag drift and real traffic exposure are not modelled.
- Dependency edges come only from the supplied manifests; anything else is reported UNKNOWN.
- No Kubernetes/cloud connection, deployment, destructive command, or rollback was executed.

Report SHA-256 (unkeyed, tamper evidence only): `cc2959f1ba62cf3ab6c1592e39bd7d6fef927471a9efe9afba40bf92d180cd3a`  
Tool: deploysutra-ai 0.2.0 by Vatsal Shah
