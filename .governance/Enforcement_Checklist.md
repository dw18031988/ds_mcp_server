---
document_id: CODING-GOVERNANCE-ENFORCEMENT-CHECKLIST
version: '1.0'
authoritative: false
derived_from: CODING-PROJECT-GOVERNANCE@1.0
canonical_sha256: 04cd33bbaff66f44917199e6bbb8355a1e956edb9c474e6c8e664ed8d0ed41c1
generated_at: '2026-07-11T19:35:37Z'
---

# Generic Coding Governance - Enforcement Checklist

## A. Policy publication

- [ ] Canonical Markdown is `authoritative: true`, version `1.0`, and contains no project-specific repository/connector values.
- [ ] Compact, DOCX, profiles, extensions, machine JSON, lessons, and checklists are non-authoritative.
- [ ] Every derived artifact records the canonical SHA.
- [ ] Every Project Profile validates against `project_profile.schema.json`.
- [ ] Every Extension declares `tighten_only`, the correct profile, and the canonical SHA.
- [ ] `enforce_coding_policy_v1_0.py` reports PASS.
- [ ] RED Team review and residual risks are current.

## B. Task boot

- [ ] Canonical core SHA is verified.
- [ ] Exactly one active Project Profile is loaded.
- [ ] Repository identity, protected refs, connector, and write-enabled status are verified.
- [ ] Profile extensions are loaded and do not weaken the core.
- [ ] Agent states policy version, profile, repository, risk, required gate, authorized actions, and prohibited actions.

## C. Inspection and proposal

- [ ] G1 precedes external inspection.
- [ ] Governance is read from the protected base.
- [ ] Scope includes risk, exclusions, validation, rollback, and requested authorities.
- [ ] Change plan records evidence/requirement/assumption provenance.
- [ ] Mermaid overview complies with 3x3.
- [ ] Detailed SVG/PNG complies with 6x6, orthogonal routing, matching content, and SVG safety.
- [ ] Artifact hashes are in the approval envelope.
- [ ] Exact approval token matches the unexpired scope hash.

## D. Execution safety

- [ ] Active profile is write-enabled and repository identity is verified.
- [ ] No protected-branch direct write, force push, branch deletion, PR-base change, or unguarded overwrite.
- [ ] Commands, hooks, binaries, dependencies, and branch-modified tests/CI were inspected.
- [ ] Execution is isolated, secret-free, and network-denied unless approved.
- [ ] Transactions, state invariants, authorization, rate limits, audit, and secret handling are covered.
- [ ] Full diff is reviewed.

## E. PR and CI

- [ ] Push/PR authority exists.
- [ ] Merge/deploy/production-data gates are not inferred.
- [ ] +2 minute CI check follows every push.
- [ ] Pending CI causes no code mutation.
- [ ] Valid success matches current head SHA and all required checks/artifacts.
- [ ] Repair budgets are tracked.

## F. Completion

- [ ] Final report contains approval, profile, repository, branch, PR, head SHA, validation, CI, artifact hashes, exclusions, and residual risks.
- [ ] No claim exceeds evidence.
