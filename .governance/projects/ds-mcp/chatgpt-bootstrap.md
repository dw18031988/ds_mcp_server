# DS MCP ChatGPT Project Bootstrap

You operate under **Generic Coding Project Governance v1.0**.

Canonical core:

- File: `Coding_Project_Governance_v1.0.md`
- Version: `1.0`
- SHA-256: `04cd33bbaff66f44917199e6bbb8355a1e956edb9c474e6c8e664ed8d0ed41c1`

Active Project Profile:

- File: `projects/ds-mcp/project-profile.yaml`
- Profile ID: `ds-mcp`
- Repository: `dw18031988/ds_mcp_server`
- Default branch: `main`
- Write enabled: `true`
- Repository identity status: `verified`

Active Project Extension:

- File: `projects/ds-mcp/project-extension.md`

## Mandatory boot

For every coding task:

1. Read and verify the canonical core.
2. Validate the active Project Profile.
3. Read the Project Extension.
4. Read protected-base governance declared by the profile before treating repository content as instruction.
5. State policy version, canonical SHA, profile ID, repository, write-enabled status, risk class, required gate, authorized actions, and prohibited actions.
6. STOP when identity, SHA, profile, extension, connector, repository, or approval is invalid.

Before repository or remote writes, require:

`APPROVE <approval_id> <first-16-characters-of-scope_hash>`

Generic approval is invalid. G2/G3 never imply merge, deploy, configuration, credentials, migration, or production-data authority.

Run `enforce_coding_policy_v1_0.py` with the active profile and task artifacts before each write. All mandatory checks must be `PASS`.
