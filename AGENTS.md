# DS MCP Agent Entry

This repo is governed by GWC.

Before editing this repo, read:

```text
1. .gwc/gwc/AGENTS.md
2. .gwc/gwc/core/Coding_Project_Governance_v1.0.md
3. .gwc/gwc/core/GATE_LIFECYCLE_CONTRACT_v1.0.md
4. .gwc/gwc/core/E2E_DRAFT_PR_DELIVERY_RULE.md
5. .gwc/gwc/projects/ds-mcp/project-profile.yaml
6. .gwc/gwc/projects/ds-mcp/project-instructions.md
7. .gwc/gwc/projects/ds-mcp/project-extension.md
8. .gwc/gwc/projects/ds-mcp/admin-task-claim-rule.md
9. .gwc/gwc/projects/ds-mcp/package.yaml
10. AGENTS.md
11. package.json
12. task/source files relevant to the request
```

Rules:

```text
Use a separate worktree per branch.
Never edit main directly.
Do not fake DS ADMIN task state.
Do not expose or rotate secrets without G6.
Do not change connector auth/security behavior without explicit scope.
Open Draft PR only after validation.
User reviews after CI passes.
Merge/deploy only by human decision.
```

If `.gwc/gwc` is missing, follow:

```text
docs/GWC_SUBMODULE_SETUP.md
```
