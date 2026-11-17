# Change blast radius questions

- Replica count changed: verify availability and service scaling
- Update strategy changed: confirm the surge/unavailable behaviour is safe for this service
- Workload image changed: check health signals, compatibility, and rollout readiness
- Privilege-related field changed: confirm the container really needs it
- Service identity changed: independently verify RBAC and external permissions
- High-risk static rule triggered; deployment approval must remain blocked
