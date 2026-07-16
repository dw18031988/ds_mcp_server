import assert from "node:assert/strict";
import test from "node:test";
import { getTaskStateContract } from "../src/agentops/taskStateContract.js";

test("task state contract exposes every legal transition", () => {
  const contract = getTaskStateContract();
  assert.equal(contract.version, "1.0.0");
  assert.equal(contract.authority, "ds-mcp-state-engine");

  const byState = new Map(contract.states.map((entry) => [entry.state, entry]));
  assert.deepEqual(byState.get("draft")?.transitions, [
    { transition: "SUBMIT", to_state: "ready" },
    { transition: "CANCEL", to_state: "cancelled" }
  ]);
  assert.deepEqual(byState.get("validation_running")?.transitions, [
    { transition: "VALIDATION_PASSED", to_state: "completed" },
    { transition: "VALIDATION_FAILED", to_state: "pending_review" },
    { transition: "CANCEL", to_state: "cancelled" }
  ]);
  assert.equal(byState.get("completed")?.terminal, true);
  assert.equal(byState.get("cancelled")?.terminal, true);
});
