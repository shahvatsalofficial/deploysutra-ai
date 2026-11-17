# Workflow Reference

Eight detailed operational checklists live in `workflows/` and are driven by DeploySutra Prime: (1) input scope, (2) static diff, (3) policy/permission audit, (4) sanitized IaC plan import, (5) blast-radius assessment, (6) rollout/health review, (7) rollback evidence and (8) release audit. Each workflow is human-controlled and distinguishes executed static checks from pending operations. These are documented workflows; the starter's CLI implements the offline analysis subset, not a remote workflow orchestrator.
