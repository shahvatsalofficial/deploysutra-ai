# DeploySutra AI - Kubernetes desired-state review

**Gate:** HUMAN_REVIEW_REQUIRED (NEVER an authorization to deploy)  
Static checks found nothing that blocks under this profile. A human must still decide; this is NOT an approval to deploy.

**Profile:** production (explicit; blocks on HIGH, MEDIUM)  
**Resources:** 1 before, 1 after (0 added, 0 removed, 0 changed)  
**Source before:** fixtures/k8s/hardened.yaml (sha256 8d78592456e2…)  
**Source after:** fixtures/k8s/hardened.yaml (sha256 8d78592456e2…)

## Findings

_None._

## Changes (desired state)

_None._

## Blast-radius questions

- No changed tracked fields

## BlastMap (edges derived only from supplied manifests)

_None._

## Rollback prerequisites

- [ ] Evidence of known previous deployable revision: **DECLARED_NOT_VERIFIED**
- [ ] Independent backup validity evidence: **DECLARED_NOT_VERIFIED**
- [ ] Actual successful restore test evidence: **DECLARED_NOT_VERIFIED**
- [ ] Documented rollback sequence: **DECLARED_NOT_VERIFIED**
- [ ] Independent authorized operator approval evidence: **DECLARED_NOT_VERIFIED**

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

Report SHA-256 (unkeyed, tamper evidence only): `d03513085903b9f29db6634b629fff745c1f7bcd7eb8564c92cee647d6b5aa49`  
Tool: deploysutra-ai 0.2.0 by Vatsal Shah
