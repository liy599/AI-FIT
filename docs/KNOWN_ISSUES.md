# Known Issues (Baseline)

This file tracks confirmed engineering gaps that block or risk production-grade delivery.

## High Priority
1. Secrets exposure risk in sample env files
- Impact: security/compliance risk
- Status: open

2. Schema lifecycle managed by runtime `db.create_all()`
- Impact: migration drift, hard rollback
- Status: open

3. Upload path boundary checks need hardening
- Impact: potential path validation bypass risk
- Status: open

## Medium Priority
4. In-memory rate limit is not multi-instance safe
- Impact: inconsistent limits under horizontal scale
- Status: open

5. Auth lifecycle lacks refresh/revocation strategy
- Impact: session control and incident response gap
- Status: open

6. CI quality gate is not enforced in repo
- Impact: regression risk
- Status: open

## Documentation / Delivery Gaps
7. User manual and test plan are not yet consolidated under `docs/`
- Impact: delivery and evaluation penalty risk
- Status: in progress

## Tracking Rules
- Every issue must include owner, target date, and verification evidence in future updates.
- Close only when code + tests + docs are all updated.
