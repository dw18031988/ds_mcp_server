# GWC Submodule Setup — DS MCP

## Purpose

This repository is governed by GWC. The recommended local/repo path is:

```text
.gwc/gwc
```

Do not copy GWC files manually into the connector source. Use a Git submodule so the governance version is pinned by commit.

## Add the submodule

Run from the DS MCP repository root:

```bash
git submodule add https://github.com/nhatnguyenquang1838-coder/gwc.git .gwc/gwc
git add .gitmodules .gwc/gwc
git commit -m "Add GWC governance submodule"
```

## Clone with submodules

```bash
git clone --recurse-submodules <ds-mcp-repo-url>
```

If the repository is already cloned:

```bash
git submodule update --init --recursive
```

## Update pinned GWC version

```bash
cd .gwc/gwc
git checkout main
git pull
cd ../..
git add .gwc/gwc
git commit -m "Update GWC governance submodule"
```

## Agent read order

Before editing DS MCP source, agents must read:

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
12. task/source files relevant to the work
```

## Rules

```text
Govern from GWC.
Execute inside the DS MCP worktree.
Track task state through DS ADMIN.
Do not fake task state.
Do not expose or rotate secrets without G6.
Open Draft PR only after validation.
User reviews after CI passes.
Do not auto merge or auto deploy.
```
