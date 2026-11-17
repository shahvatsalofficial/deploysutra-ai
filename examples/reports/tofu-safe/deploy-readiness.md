# DeploySutra AI - Imported OpenTofu/Terraform plan summary

**Gate:** HUMAN_REVIEW_REQUIRED (NEVER an authorization to deploy)  
Static checks found nothing that blocks under this profile. A human must still decide; this is NOT an approval to deploy.

**Changes summarised:** 2  
**Destructive or replacement candidates:** 0  
**On data-bearing resource types (name heuristic):** 0

## Actions

| create | update | delete | replace | read | no-op |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | 0 | 0 | 0 | 0 |

## By resource type

| Type | create | update | delete | replace |
| --- | --- | --- | --- | --- |
| aws_instance | 1 | 0 | 0 | 0 |
| aws_s3_bucket_policy | 0 | 1 | 0 | 0 |

## Verification boundaries

| Check | State |
| --- | --- |
| planAuthenticity | NOT_VERIFIED |
| dryRunExecutedHere | NOT_RUN |
| providerPermissions | NOT_TESTED |
| rollback | NOT_TESTED |
| planCompleteness | VERIFIED_STATIC |

## Limitations

- Source plan input may contain secrets; only resource type and action summaries are retained in output. Resource addresses, values, providers and state are discarded.
- Data-bearing detection is a resource-type name heuristic, not knowledge of what the resource stores.
- No plan was executed or confirmed against a live workspace.

Report SHA-256 (unkeyed, tamper evidence only): `d65729f923524ed2882752633e47d627a2d890246e7f66d861d029c1f1c480cd`  
Tool: deploysutra-ai 0.2.0 by Vatsal Shah
