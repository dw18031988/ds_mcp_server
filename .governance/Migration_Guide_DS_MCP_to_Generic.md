# Migration Guide: DS MCP v2.1 to Generic Coding Governance v1.0

## Objective

Move shared conduct out of a DS MCP-specific policy into one reusable canonical core while retaining DS MCP as a Project Profile and Extension.

## Mapping

| DS MCP v2.1 | Generic v1.0 |
|---|---|
| Canonical DS MCP policy | `Coding_Project_Governance_v1.0.md` |
| Hardcoded repo/connector/URL | `projects/ds-mcp/project-profile.yaml` |
| DS MCP architecture invariants | `projects/ds-mcp/project-extension.md` |
| Compact reminder | `Coding_Project_Governance_v1.0_Compact.md` |
| DS checker | `enforce_coding_policy_v1_0.py` |
| DS approval schema | Generic envelope plus `project_profile` |
| Mermaid/SVG shared 3x3 | Mermaid 3x3; detailed SVG/PNG 6x6 |

## Migration steps

1. Upload the generic canonical core and checker once to the ChatGPT coding workspace.
2. For each project, upload exactly one profile and its extensions.
3. Put the project-specific bootstrap in Project Instructions.
4. Remove hardcoded repo/context fields from any copied core policy.
5. Verify the profile and canonical hash at every policy boot.
6. Do not migrate historical DS MCP approvals; issue new generic approval envelopes.
7. Keep DS MCP v2.1 archived for audit, but do not load both policies as co-authoritative.

## Compatibility note

DS MCP rule IDs are intentionally retained where the conduct is unchanged. New `PROFILE-*` rules govern cross-project configuration. Canonical generic SHA: `04cd33bbaff66f44917199e6bbb8355a1e956edb9c474e6c8e664ed8d0ed41c1`.
