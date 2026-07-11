# Requirements Document

## Introduction

The DW AgentOps Tasks Control Admin page already provides four mobile modes (`Progress`, `Tasks`, `Assign`, and `Flow`), task list and graph views, task details, bulk operations, workflow management, and configuration controls. However, the current `Progress` mode primarily shows basic counters followed by task-creation forms, while the full Tasks mode places a large bulk toolbar before the task list. This makes it difficult for an operator to answer the most important operational questions quickly: how much work is complete, what needs attention, and which task should be inspected next.

This specification refines the existing static Admin UI under `public/admin/` into a progress-first experience. It uses current task records and lifecycle states, preserves existing API and workflow contracts, and avoids inventing progress percentages, due dates, assignment data, or blocker details that the backend does not provide.

Non-goals:

- Do not change backend REST or MCP API contracts.
- Do not change Supabase schema, migrations, workflow states, State Engine transitions, leases, claims, or audit behavior.
- Do not replace the current static HTML/CSS/JavaScript Admin architecture with React or another framework.
- Do not rewrite workflow management or the task dependency graph engine.
- Do not register DS Admin tasks, deploy, merge, or modify production data as part of this specification PR.

## Glossary

| Term | Definition |
|---|---|
| Actionable Total | Total task count minus cancelled tasks; used as the denominator for overall completion. |
| Attention Item | A task that is blocked, failed, waiting for review or approval, or idle beyond the configured display threshold. |
| Canonical Progress | Progress derived only from fields and states returned by the existing task API. |
| Progress Preview | A bounded, prioritized subset of tasks shown in the Progress mode. |
| Raw State | The task `state` value returned by the existing API, such as `ready` or `validation_running`. |
| Normalized Group | A presentation-only grouping of raw states into Done, Running, Blocked, Ready, Draft, or Cancelled. |
| Idle Task | A non-terminal task with a valid `updated_at` older than the display threshold. It is not equivalent to overdue. |
| Contextual Bulk Toolbar | Bulk controls that become prominent only after one or more tasks are selected. |
| Existing Modes | The current mobile navigation modes: Progress, Tasks, Assign, and Flow. |

## Requirements

### Requirement 1: Progress-first Default Experience

**User Story:** As an AgentOps operator, I want the default Admin view to summarize delivery progress before administrative forms, so that I can understand execution status immediately.

#### Acceptance Criteria

1. WHEN the Admin page opens on a mobile viewport THEN the system SHALL keep `Progress` as the default active mode.
2. WHEN Progress mode renders THEN the system SHALL place overall completion, state counters, attention summary, and a bounded task preview before task-creation or bulk-creation forms.
3. WHEN the Admin page renders on desktop THEN the system SHALL keep progress information visually primary without removing access to creation, task, detail, graph, or workflow controls.
4. WHEN the existing Progress, Tasks, Assign, and Flow navigation is refined THEN the system SHALL preserve keyboard and pointer access to every mode.
5. WHEN the viewport is 360px or wider THEN the first visible Progress content SHALL NOT require horizontal scrolling.

### Requirement 2: Deterministic Progress Summary

**User Story:** As an AgentOps operator, I want progress calculated from existing task states, so that the dashboard presents defensible operational information.

#### Acceptance Criteria

1. WHEN tasks are loaded THEN the system SHALL calculate `actionable_total` as total tasks minus tasks in `cancelled` state.
2. WHEN `actionable_total` is greater than zero THEN the system SHALL calculate overall completion as `completed_count / actionable_total` and round only for display.
3. IF `actionable_total` is zero THEN the system SHALL display `0%` and SHALL NOT divide by zero.
4. WHEN raw states are summarized THEN the system SHALL map `completed` to Done; `agent_running`, `write_running`, and `validation_running` to Running; `blocked` and `failed` to Blocked/Attention; `ready`, `pending_review`, and `pending_approval` to Ready/Waiting; `draft` to Draft; and `cancelled` to Cancelled.
5. WHEN an unknown raw state is returned THEN the system SHALL preserve the raw label and SHALL NOT count it as completed.
6. WHEN no canonical per-task percentage field exists THEN the system SHALL NOT fabricate a task-level percentage or progress bar.
7. WHEN the overall progress indicator is rendered THEN the system SHALL expose an accessible text equivalent such as `32 of 59 actionable tasks completed, 54 percent`.

### Requirement 3: Needs-attention Queue

**User Story:** As an AgentOps operator, I want a concise list of tasks needing intervention, so that I can focus on blockers and waiting work before browsing the full queue.

#### Acceptance Criteria

1. WHEN a task is in `blocked` or `failed` state THEN the system SHALL classify it as an attention item with the highest display priority.
2. WHEN a task is in `pending_review` or `pending_approval` state THEN the system SHALL classify it as waiting for human action.
3. WHEN a non-terminal task has a valid `updated_at` older than 48 hours THEN the system MAY label it `idle > 48h`.
4. IF a task lacks a valid `updated_at` THEN the system SHALL NOT classify it as idle based on an assumed timestamp.
5. IF the API does not provide a due date or SLA THEN the system SHALL NOT label a task overdue.
6. WHEN attention items are displayed THEN the system SHALL show a bounded list and provide a path to the matching task in the full Tasks mode.
7. WHEN there are no attention items THEN the system SHALL render a clear healthy empty state rather than leaving the section blank.

### Requirement 4: Scannable Task Preview and Task Cards

**User Story:** As an AgentOps operator, I want task cards ordered around actionable information, so that I can scan the queue without long technical identifiers dominating the view.

#### Acceptance Criteria

1. WHEN a task card renders THEN the system SHALL prioritize title, normalized status, priority, agent or run cue when available, and last-updated information.
2. WHEN a long task ID is present THEN the system SHALL move it to secondary metadata or detail presentation while preserving access to the full value.
3. WHEN a blocked or failed task includes a usable reason in current API data THEN the system SHOULD show that reason without inventing missing context.
4. WHEN no next-step or blocker field is available THEN the system SHALL use a neutral cue such as the current state or `Open details`.
5. WHEN Progress preview tasks are sorted THEN the system SHALL prioritize blocked/failed, running, waiting/ready, draft, completed, and cancelled groups in that order, with a deterministic tie-breaker.
6. WHEN task card markup changes THEN the system SHALL preserve the current task tree, card selection, bulk checkbox enhancement, search, filters, and selected-task detail behavior.
7. WHEN the task dependency graph renders THEN the system SHALL preserve node selection and linkage behavior.

### Requirement 5: Contextual Bulk Actions and Destructive Safety

**User Story:** As an AgentOps operator, I want bulk controls to appear in context after selection, so that task progress remains visible and destructive actions are harder to trigger accidentally.

#### Acceptance Criteria

1. WHEN no tasks are selected THEN the system SHALL de-emphasize the full bulk form and show only the selection affordance and selected count needed to begin bulk work.
2. WHEN one or more tasks are selected THEN the system SHALL show a compact contextual toolbar containing the selected count and access to update, transition, link, and additional actions.
3. WHEN task selection changes THEN the contextual toolbar SHALL update without losing the existing selected-task set or hidden-selection safety.
4. WHEN bulk update, transition, or link actions execute THEN the system SHALL preserve existing request payloads and partial-success reporting unless a separately approved backend change requires otherwise.
5. WHEN bulk delete is available THEN the system SHALL place it behind a secondary or `More` action and require explicit confirmation.
6. WHEN deletion dependencies or force behavior are involved THEN the UI SHALL NOT silently escalate to force; any force path requires impact preview, stronger confirmation, audit evidence, and the applicable separate production-data authority.
7. WHEN the user cancels a destructive confirmation THEN the system SHALL perform no delete request.

### Requirement 6: Preserve and Clarify Existing Modes

**User Story:** As an AgentOps operator, I want each existing mode to have a clear purpose, so that progress, task inspection, assignment detail, and workflow management do not compete in one scroll flow.

#### Acceptance Criteria

1. WHEN Progress mode is active THEN the system SHALL focus on overall progress, attention, and preview content.
2. WHEN Tasks mode is active THEN the system SHALL retain full search, quick filters, list view, and dependency graph view.
3. WHEN Assign mode is active THEN the system SHALL retain selected-task details, transitions, links, and timeline behavior.
4. WHEN Flow mode is active THEN the system SHALL retain workflow creation, workflow task management, and workflow detail behavior.
5. WHEN the dependency graph remains within Tasks mode THEN it SHALL remain a secondary list/graph view and SHALL NOT render inside the initial Progress flow.
6. WHEN modes are switched THEN the system SHALL preserve selected task and filter state where current behavior supports it.
7. WHEN no selected task or workflow exists THEN the corresponding mode SHALL show an explicit empty state.

### Requirement 7: Responsive, Accessible, Loading, and Error Behavior

**User Story:** As an AgentOps operator using mobile, keyboard, or assistive technology, I want the progress dashboard to remain understandable in every state, so that I can operate it reliably.

#### Acceptance Criteria

1. WHEN the page is viewed at 360px and 390px widths THEN the system SHALL avoid horizontal overflow in progress summary, attention items, task cards, and contextual bulk controls.
2. WHEN mode controls are rendered THEN the system SHALL expose an accessible selected state and remain keyboard reachable.
3. WHEN progress is loading THEN the system SHALL show a readable loading state without presenting stale values as current.
4. WHEN `/api/tasks` fails THEN the system SHALL show a concise error state and retain access to configuration diagnostics.
5. WHEN task or link data is empty THEN the system SHALL render explicit empty states.
6. WHEN status is conveyed THEN the system SHALL include visible text and SHALL NOT rely on color alone.
7. WHEN the selected task count changes THEN the system SHALL expose the count in visible text and an accessible announcement where practical.
8. WHEN errors are rendered THEN the system SHALL preserve request IDs and safe detail when available and SHALL NOT expose bearer tokens or service credentials.

### Requirement 8: Compatibility and Scope Control

**User Story:** As a maintainer, I want the progress-first UI to reuse the current architecture and contracts, so that the improvement does not destabilize AgentOps workflows.

#### Acceptance Criteria

1. WHEN this feature is implemented THEN the system SHALL reuse the current static Admin files and existing request helpers rather than introducing a new frontend framework.
2. WHEN progress helpers are added THEN they SHALL remain presentation-only and SHALL NOT mutate task state, workflow state, links, leases, claims, or audit records.
3. WHEN existing CTA throttling behavior from `AGENTOPS-UI-01` is present THEN the system SHALL preserve it.
4. WHEN implementation is complete THEN backend API schemas, database schema, auth enforcement, route policies, and workflow transition semantics SHALL remain unchanged.
5. WHEN dependencies are considered THEN the implementation SHALL add no runtime dependency unless a new scoped approval explicitly authorizes it.
6. WHEN validation runs THEN `npm run typecheck`, `npm run build`, and `npm test` SHALL pass, or the implementer SHALL report exact blockers honestly.
7. WHEN the change is reviewed THEN the diff SHALL contain only approved Admin UI implementation and directly required tests or documentation.
