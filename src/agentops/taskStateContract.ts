import type { TaskState, TaskTransition } from "./types.js";
import { availableTaskTransitions, nextTaskState } from "./taskMachine.js";

export const TASK_STATE_CONTRACT_VERSION = "1.0.0" as const;

export const TASK_STATES: readonly TaskState[] = [
  "draft",
  "ready",
  "blocked",
  "agent_running",
  "pending_review",
  "pending_approval",
  "write_running",
  "validation_running",
  "completed",
  "failed",
  "cancelled"
];

export type TaskStateContract = {
  version: typeof TASK_STATE_CONTRACT_VERSION;
  authority: "ds-mcp-state-engine";
  states: Array<{
    state: TaskState;
    terminal: boolean;
    transitions: Array<{
      transition: TaskTransition;
      to_state: TaskState;
    }>;
  }>;
};

export function getTaskStateContract(): TaskStateContract {
  return {
    version: TASK_STATE_CONTRACT_VERSION,
    authority: "ds-mcp-state-engine",
    states: TASK_STATES.map((state) => ({
      state,
      terminal: availableTaskTransitions(state).length === 0,
      transitions: availableTaskTransitions(state).map((transition) => ({
        transition,
        to_state: nextTaskState(state, transition) as TaskState
      }))
    }))
  };
}
