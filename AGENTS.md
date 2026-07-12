# DS MCP Agent Entry

This repo is governed by GWC.

Before editing this repo, read:

```text
1. .gwc/gwc/docs/AGENT_ENTRYPOINT.md
2. .gwc/gwc/projects/ds-mcp/project-profile.yaml
3. .gwc/gwc/projects/ds-mcp/project-instructions.md
4. .gwc/gwc/projects/ds-mcp/project-extension.md
5. .gwc/gwc/projects/ds-mcp/admin-task-claim-rule.md
6. AGENTS.md
7. package.json
8. task/source files relevant to the request
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
