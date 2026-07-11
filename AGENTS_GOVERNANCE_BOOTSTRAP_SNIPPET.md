# Governance Bootstrap — DS MCP

Before any implementation, repository write, PR mutation, merge, deployment,
configuration change, migration, or production-data action:

1. Read `.governance/Coding_Project_Governance_v1.0.md`.
2. Verify canonical SHA-256:
   `04cd33bbaff66f44917199e6bbb8355a1e956edb9c474e6c8e664ed8d0ed41c1`
3. Load `.governance/projects/ds-mcp/project-profile.yaml`.
4. Load `.governance/projects/ds-mcp/project-extension.md`.
5. Read protected-base governance declared by the active profile.
6. Run `.governance/enforce_coding_policy_v1_0.py` before every write.

Only the canonical Markdown is authoritative. The Project Profile provides
identity and project context. The Project Extension may tighten rules only.

If a required file is missing, inconsistent, stale, or has the wrong SHA, stop:

`POLICY_BOOT_FAILED`
