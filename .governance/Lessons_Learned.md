---
document_id: CODING-GOVERNANCE-LESSONS
version: '1.0'
authoritative: false
derived_from: CODING-PROJECT-GOVERNANCE@1.0
canonical_sha256: 04cd33bbaff66f44917199e6bbb8355a1e956edb9c474e6c8e664ed8d0ed41c1
generated_at: '2026-07-11T19:35:37Z'
---

# Generic Coding Governance - Lessons Learned

## LL-01 - Separate conduct from context

Trust boundaries, approvals, Git safety, command isolation, security, data integrity, evidence, and CI recovery belong in one canonical core. Repository names, connectors, commands, providers, and domain conventions belong in profiles/extensions.

## LL-02 - Profiles cannot become policy overrides

A profile is configuration, not authority. It may select a repo or require extra checks, but it cannot weaken gates or safety controls.

## LL-03 - Unknown identity must fail closed

Knowing only a repository name is insufficient for writes. Mark identity unconfirmed and set `write_enabled: false` until owner, URL, connector account, and protected refs are verified.

## LL-04 - Exact approval prevents replay

Bind approval to profile, repository, base SHA, branch, targets, actions, artifacts, expiry, and a canonical scope hash.

## LL-05 - Visual density differs by medium

Mermaid in chat should remain 3x3. Detailed SVG can use a 6x6 zoomable grid with orthogonal connectors. Both must come from the same structured source.

## LL-06 - A clean picture can still be false

Every technical node and edge needs evidence, requirement, or explicit assumption provenance. Deterministic SVG-to-PNG protects semantic parity.

## LL-07 - Commands are code execution

Inspect scripts, hooks, lifecycle behavior, dependencies, and modified CI before running familiar command names.

## LL-08 - CI green is not authority

Valid CI is evidence for the current SHA and required checks. It never grants merge, deploy, or production-data permission.

## LL-09 - Static enforcement is necessary but incomplete

Schemas and hashes catch drift. Hard guarantees still require least-privilege connectors and server-side refusal of unauthorized writes.

## LL-10 - Reuse requires re-review

When adapting the core or adding a profile, run enforcement and RED Team review again. A project-specific shortcut can silently reintroduce a core weakness.
