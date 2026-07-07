# Design Document

## Overview

This design modernizes the DW AgentOps Tasks Control dashboard and adds single-flight processing behavior for state-changing CTAs. The implementation should be scoped to the dashboard surface and reusable UI helpers needed for the dashboard.

The design keeps the existing data flow and backend contracts intact. It introduces reusable UI primitives for async CTAs, status pills, technical IDs, and overview counters. It also introduces action-specific loading state so duplicate requests are ignored at the application layer even if a DOM event fires more than once.

## Architecture

```txt
DW AgentOps Tasks Control Dashboard
  -> Dashboard layout shell
     -> Overview card
        -> CounterTile
     -> Workflow card
        -> StatusPill
        -> TechnicalId
        -> AsyncButton for SUBMIT / CANCEL
     -> Selected Task card
        -> modernized inputs
        -> AsyncButton for Save token / Create / Add link
  -> Feature state
     -> form state
     -> selected task state
     -> action loading map
     -> inline/toast error state
  -> Existing request functions
     -> save token action
     -> create task action
     -> submit transition action
     -> cancel transition action
     -> add dependency link action
```

The UI layer disables the button immediately. The application layer checks a loading flag before invoking the request function. Both controls are required.

## Components and Interfaces

### AgentOpsTasksControlDashboard

Suggested path:

```txt
src/features/agentops/AgentOpsTasksControlDashboard.tsx
```

Responsibility:

- Own dashboard layout for Overview, Workflow, and Selected Task panels.
- Own form state and selected task view state.
- Wire state-changing CTAs through the async action guard.
- Render concise action-level feedback after failures.

Interface:

```ts
type AgentOpsTasksControlDashboardProps = {
  initialTaskId?: string;
};
```

Existing shared components to reuse:

- Reuse existing card, input, button, toast, or alert components if present.
- If no shared component exists, add feature-local components first and avoid global style rewrites.

### AsyncButton

Suggested path:

```txt
src/features/agentops/components/AsyncButton.tsx
```

Responsibility:

- Render a CTA in idle or processing state.
- Apply `disabled`, loading label, optional spinner, accessible loading text, reduced opacity, and blocked pointer treatment.
- Keep visual behavior consistent across Save token, Create, SUBMIT, CANCEL, and Add link.

Interface:

```ts
type AsyncButtonProps = {
  children: React.ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
};
```

### useAsyncActionGuard

Suggested path:

```txt
src/features/agentops/hooks/useAsyncActionGuard.ts
```

Responsibility:

- Maintain an action-specific loading map.
- Ignore redundant calls while an action key is already loading.
- Clear loading state in a finally-equivalent path.
- Normalize success/failure handling for state-changing dashboard actions.

Interface:

```ts
type AgentOpsActionKey =
  | 'save-token'
  | 'create-task'
  | 'submit-transition'
  | 'cancel-transition'
  | 'add-dependency-link';

type RunGuardedActionOptions<T> = {
  key: AgentOpsActionKey;
  run: () => Promise<T>;
  onSuccess?: (result: T) => void;
  onError?: (error: unknown) => void;
};

type AsyncActionGuard = {
  isLoading: (key: AgentOpsActionKey) => boolean;
  runGuarded: <T>(options: RunGuardedActionOptions<T>) => Promise<T | undefined>;
};
```

### StatusPill

Suggested path:

```txt
src/features/agentops/components/StatusPill.tsx
```

Responsibility:

- Centralize status-to-tone mapping.
- Render DRAFT, READY, CANCELLED, RUNNING, and fallback status labels consistently.
- Support active styling for RUNNING without duplicating animation rules.

Interface:

```ts
type AgentOpsStatus = 'DRAFT' | 'READY' | 'CANCELLED' | 'RUNNING' | string;

type StatusPillProps = {
  status: AgentOpsStatus;
  size?: 'sm' | 'md';
};
```

### TechnicalId

Suggested path:

```txt
src/features/agentops/components/TechnicalId.tsx
```

Responsibility:

- Render generated IDs in a monospace or technical style.
- Avoid overflow with truncation or wrapping based on available space.
- Preserve full value through tooltip/title or copy affordance if existing patterns support it.

Interface:

```ts
type TechnicalIdProps = {
  value: string;
  truncate?: boolean;
  copyable?: boolean;
};
```

### CounterTile

Suggested path:

```txt
src/features/agentops/components/CounterTile.tsx
```

Responsibility:

- Render overview metrics with prominent number and descriptive label underneath.
- Keep spacing consistent across all counter tiles.

Interface:

```ts
type CounterTileProps = {
  value: number | string;
  label: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
};
```

## Data Models

### AgentOpsActionState

```ts
type AgentOpsActionState = Record<AgentOpsActionKey, boolean>;
```

Mapping rules:

- `true` means the corresponding action is processing.
- A CTA reads only its own action key unless a full-form lock is intentionally required.
- Loading state must be set before invoking the request function.
- Loading state must be cleared after success or failure.

### ProcessingButtonViewState

```ts
type ProcessingButtonViewState = {
  disabled: boolean;
  label: string;
  ariaBusy: boolean;
  showSpinner: boolean;
};
```

Mapping rules:

- Idle Create button label is `Create`.
- Processing Create button label is `Creating...`.
- Idle Save token button label is `Save token`.
- Processing Save token button label is `Saving...`.
- Idle SUBMIT button label is `SUBMIT`.
- Processing SUBMIT button label is `Submitting...`.
- Idle CANCEL button label is `CANCEL`.
- Processing CANCEL button label is `Cancelling...`.
- Idle Add link button label is `Add link`.
- Processing Add link button label is `Adding...`.

### StatusToneModel

```ts
type StatusTone = {
  textClass: string;
  backgroundClass: string;
  borderClass?: string;
  animated?: boolean;
};
```

Mapping rules:

- DRAFT maps to subtle neutral/info.
- READY maps to success.
- CANCELLED maps to danger with soft background.
- RUNNING maps to active info or warning with optional animation.
- Unknown statuses map to neutral and preserve the status string.

### DashboardCounterModel

```ts
type DashboardCounterModel = {
  key: string;
  value: number | string;
  label: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
};
```

Mapping rules:

- Existing source values remain unchanged.
- Only presentation changes: number prominence and label placement.
- Missing or undefined values should render as safe placeholders using existing dashboard conventions.

### ActionErrorState

```ts
type ActionErrorState = {
  actionKey: AgentOpsActionKey;
  message: string;
  occurredAt: string;
} | null;
```

Mapping rules:

- Show concise failure feedback by action.
- Do not include sensitive credential values in error output.
- Clear or replace the error when a new action starts, depending on existing UX convention.

## Correctness Properties

### Single-flight CTA invariant

For a given `AgentOpsActionKey`, at most one request can be in flight at a time from the dashboard UI.

### Immediate processing invariant

The clicked CTA must enter processing state before awaiting the asynchronous request.

### Recovery invariant

Every guarded action must clear its loading flag after success or failure.

### No duplicate request invariant

If the same action is triggered while its loading flag is active, the request function must not be called again.

### Scope invariant

The UI enhancement must not change backend request payload shape, response parsing, task transition rules, or persistence schema.

### Status rendering invariant

Unknown statuses must remain visible as raw labels using a neutral style instead of disappearing or throwing a rendering error.

### Sensitive display invariant

Failure feedback and logs rendered in the browser must not display the raw REST credential value.

## Error Handling

- Use existing toast or inline alert patterns if available.
- On action failure, show one concise message tied to the failed action.
- Always clear the action-specific loading flag after failure.
- Preserve form inputs after failure unless the existing behavior intentionally resets them.
- Use a safe fallback message when an error lacks a usable message.
- Ignore redundant clicks silently or with debug-only instrumentation; do not show user-facing errors for duplicate clicks blocked by the guard.

## Testing Strategy

Required validation:

```bash
npm run typecheck
npm run build
```

Suggested tests:

- Unit test status-to-tone mapping for DRAFT, READY, CANCELLED, RUNNING, and unknown status.
- Unit test `useAsyncActionGuard` or equivalent pure guard function to prove duplicate calls are ignored while loading.
- Component test `AsyncButton` if the project already has a component testing pattern.
- Manual smoke test each affected CTA: Save token, Create, SUBMIT, CANCEL, Add link.
- Manual rapid-click test each affected CTA and confirm one request per action.
- Manual failure test with mocked or forced failure and confirm the CTA re-enables.
- Responsive smoke test desktop and narrow viewport layout.

## Implementation Constraints

- Do not touch unrelated files.
- Do not change API contracts.
- Do not change database schema.
- Do not introduce credential values into visible logs or error text.
- Reuse existing shared UI components first.
- If no shared UI primitive exists, add AgentOps-local components instead of broad global rewrites.
- Keep generated spec files in `.kiro/specs/AGENTOPS-UI-01-dashboard-cta-throttling/`.
- Run validation honestly and report any command that cannot run.
