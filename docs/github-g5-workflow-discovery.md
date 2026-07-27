# GitHub G5 workflow discovery runbook

## Purpose

Use these read-only collectors to resolve GitHub Actions evidence for the exact post-merge commit during `G5_POST_MERGE_VERIFICATION`.

This runbook does not authorize merge, deployment, release, production configuration, secret changes, migrations, or production-data operations.

## Required inputs

- repository owner and name;
- default branch, normally `main`;
- exact 40-character merge commit SHA;
- optional workflow ID or workflow file name;
- bounded polling policy from the active governance instruction.

## Primary lookup

Call `github_list_workflow_runs` with:

```json
{
  "owner": "<owner>",
  "repo": "<repo>",
  "event": "push",
  "branch": "main",
  "head_sha": "<merge_sha>",
  "page": 1,
  "per_page": 100
}
```

Add `workflow_id`, `status`, or `check_suite_id` only when the workflow or check suite is already known. Continue pagination while `has_next_page` is true.

The compatibility tool `github_get_workflow_runs` accepts the same filters, but new collectors should use `github_list_workflow_runs`.

## Bind evidence to the exact commit

For every selected run, call `github_get_workflow_run` with both `run_id` and `expected_head_sha`:

```json
{
  "owner": "<owner>",
  "repo": "<repo>",
  "run_id": 123456789,
  "expected_head_sha": "<merge_sha>"
}
```

A head-SHA mismatch is a non-retryable validation error. Do not accept the run as evidence for the requested commit.

## Inspect jobs and artifacts

Page through jobs:

```json
{
  "owner": "<owner>",
  "repo": "<repo>",
  "run_id": 123456789,
  "filter": "all",
  "page": 1,
  "per_page": 100
}
```

Page through artifacts:

```json
{
  "owner": "<owner>",
  "repo": "<repo>",
  "run_id": 123456789,
  "page": 1,
  "per_page": 100
}
```

Use `github_download_workflow_artifact_zip` only when the artifact content is required for validation.

## Check-run fallback

When the exact push-run query returns no matching workflow run, call `github_list_check_runs_for_ref` with the exact merge SHA:

```json
{
  "owner": "<owner>",
  "repo": "<repo>",
  "ref": "<merge_sha>",
  "filter": "all",
  "page": 1,
  "per_page": 100
}
```

Exact 40-character refs are filtered again client-side before evidence is returned.

## Classification rules

- Matching run or check is `queued` or `in_progress`: classify `CI_PENDING`, checkpoint, and continue bounded polling.
- Matching run or check completed successfully: record run/check IDs, URLs, exact head SHA, jobs, artifacts, and conclusion as G5 evidence.
- Matching run or check completed unsuccessfully: classify `CI_FAILED`; do not claim G5 pass.
- No matching workflow run, but exact check runs exist: use the exact check-run evidence and record that workflow-run discovery was empty.
- No matching workflow run and no exact check run: classify `CONNECTOR_OBSERVABILITY_INCOMPLETE`, not `CI_PENDING` and not `CI_PASSED`.
- GitHub returns a structured retryable error such as rate limiting or 5xx: checkpoint and retry within the bounded policy.
- GitHub returns a non-retryable structured error such as unauthorized, forbidden, not found, validation failure, or head-SHA mismatch: stop and report the exact structured error.

## Evidence record

Record at minimum:

- repository;
- branch;
- exact merge SHA;
- query filters;
- every page queried;
- workflow run ID and URL when found;
- check-run IDs and URLs when used;
- job conclusions;
- artifact names and IDs;
- final classification;
- GitHub request ID from any structured error.
