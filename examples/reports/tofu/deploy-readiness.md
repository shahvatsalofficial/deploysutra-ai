# DeploySutra AI - Imported OpenTofu/Terraform plan summary

**Gate:** BLOCKED (NEVER an authorization to deploy)  
Do not proceed until every reason below is resolved or consciously accepted by a human operator.

## Why

- 1 destructive change(s) on data-bearing resource types (name heuristic); restore evidence is not part of a plan

**Changes summarised:** 2  
**Destructive or replacement candidates:** 1  
**On data-bearing resource types (name heuristic):** 1

## Actions

| create | update | delete | replace | read | no-op |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | 1 | 1 | 0 | 0 |

## By resource type

| Type | create | update | delete | replace |
| --- | --- | --- | --- | --- |
| aws_db_instance | 1 | 0 | 1 | 1 |
| aws_security_group | 0 | 1 | 0 | 0 |

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

Report SHA-256 (unkeyed, tamper evidence only): `bed1b2aeef85b7b3c209777277ea0926ddfedd16b3ee2c96a56f3ad2895d8478`  
Tool: deploysutra-ai 0.2.0 by Vatsal Shah
