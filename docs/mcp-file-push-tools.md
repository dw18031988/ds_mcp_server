# MCP file push tools

This adds two MCP write tools for pushing GPT-generated files or small edits to GitHub without relying only on full-file replacement.

## Why

`github_upsert_file` requires the model to send the full file content in one tool call. That is unsafe for large files because the tool payload can be truncated before it reaches the server.

The safer pattern is:

- Use `github_push_file` only for new or fully generated files.
- Use `github_replace_in_file` for existing large files, because GPT sends only exact `old_text` and `new_text` snippets. The MCP server reads the full file server-side, applies the replacement, and commits the complete file to GitHub.

## Tool: `github_push_file`

Create or replace a file on a guarded non-main branch.

Input:

```json
{
  "owner": "nhatnguyenquang1838-coder",
  "repo": "rental_home",
  "path": "docs/example.md",
  "branch": "fix/example-file",
  "message": "docs: add example",
  "content": "# Example\n"
}
```

For binary or pre-encoded content:

```json
{
  "owner": "nhatnguyenquang1838-coder",
  "repo": "rental_home",
  "path": "docs/example.bin",
  "branch": "fix/example-file",
  "message": "docs: add binary example",
  "content_base64": "SGVsbG8="
}
```

Provide exactly one of `content` or `content_base64`.

## Tool: `github_replace_in_file`

Apply one or more exact text replacements to an existing UTF-8 file. The MCP server reads the target file, applies replacements, and commits it.

Input:

```json
{
  "owner": "nhatnguyenquang1838-coder",
  "repo": "rental_home",
  "path": "src/features/tenants/TenantDetailPage.tsx",
  "branch": "fix/tenant-active-contract-fallback",
  "message": "fix: remove active contract fallback",
  "replacements": [
    {
      "old_text": "const activeTenantContract = useMemo(\n    () => tenantContracts.find((item) => item.status === \"ACTIVE\") ?? tenantContracts[0] ?? null,\n    [tenantContracts],\n  );",
      "new_text": "const activeTenantContract = useMemo(\n    () => tenantContracts.find((item) => item.status === \"ACTIVE\") ?? null,\n    [tenantContracts],\n  );"
    }
  ]
}
```

Optional optimistic locking:

```json
{
  "expected_sha": "805c54e9332076efedd0340b12952a92a7482d9a"
}
```

## Guardrails

- Repo must be in `GITHUB_ALLOWED_REPOS`.
- Target branch must not be `main`, `master`, `production`, or `prod`.
- Target branch must use an allowed prefix from `GITHUB_ALLOWED_BRANCH_PREFIXES`.
- Path must be relative and must not contain `..` or backslashes.
- `github_replace_in_file` fails if `old_text` is not found.
- `github_replace_in_file` can use `expected_sha` to prevent editing stale file content.

## Recommended usage

For `TenantDetailPage.tsx` and other large files, use `github_replace_in_file`, not `github_upsert_file`.
