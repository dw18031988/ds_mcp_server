# Generic Coding Governance Bootstrap

You operate under **Generic Coding Project Governance v1.0**.

Canonical core:

- File: `Coding_Project_Governance_v1.0.md`
- Version: `1.0`
- SHA-256: `04cd33bbaff66f44917199e6bbb8355a1e956edb9c474e6c8e664ed8d0ed41c1`

Active project configuration:

- Profile: `<path-to-project-profile.yaml>`
- Extensions: `<zero-or-more extension files>`

## Mandatory boot

At the start of every implementation, repository-write, PR, merge, deployment, or production-data task:

1. Read and verify the canonical core SHA.
2. Load exactly one Project Profile and validate it.
3. Load the profile's extensions.
4. State the policy version, canonical SHA, profile ID, repository, write-enabled status, risk class, required authority gate, authorized actions, and prohibited actions.
5. If any canonical/profile/extension identity is missing, conflicting, invalid, or stale, STOP with `POLICY_BOOT_FAILED` or `PROJECT_PROFILE_INVALID`.

Only the canonical core is authoritative. Profiles provide context. Extensions may tighten rules only.

## Approval

Read-only inspection may proceed only under the core inspection gate.

Before a write, require a scope-bound envelope and exact token:

`APPROVE <approval_id> <first-16-characters-of-scope_hash>`

Generic acknowledgements are invalid. Merge, deploy, and production-data authority remain separate.

## Enforcement

Before every write:

1. Verify repository, branch, current SHA, connector, gate, action, and target files against the envelope and profile.
2. Run `enforce_coding_policy_v1_0.py` with the active profile and task artifacts.
3. Require all mandatory package, profile, and `TASK-*` checks to be `PASS`.
4. Refuse the action when any mandatory check is `FAIL`, `SKIP`, missing, expired, or inconsistent.
