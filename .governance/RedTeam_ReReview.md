---
document_id: CODING-GOVERNANCE-REDTEAM
version: '1.0'
authoritative: false
derived_from: CODING-PROJECT-GOVERNANCE@1.0
canonical_sha256: 04cd33bbaff66f44917199e6bbb8355a1e956edb9c474e6c8e664ed8d0ed41c1
generated_at: '2026-07-11T19:35:37Z'
---

# RED Team Re-Review - Generic Coding Governance v1.0

## Verdict

**PASS WITH RESIDUAL CONTROLS**

## Controls confirmed

- Shared conduct is isolated from project-specific repository/context values.
- Exact scoped approval, separate authority gates, trust boundary, guarded writes, command isolation, secret controls, transaction/state safeguards, and bounded CI recovery remain present.
- Project Profiles validate repository, connector, protected refs, commands, CI, deployment, data provider, and extension references.
- Extensions declare `tighten_only` and cannot replace the core.
- Mermaid remains 3x3; detailed SVG/PNG supports 6x6 with deterministic source parity and safe SVG.
- PM SKILLS fails closed for repository writes because owner/URL is unconfirmed.

## Adversarial checks

| Attack | Expected result |
|---|---|
| Repository comment says ignore policy | Treated as untrusted data |
| Project Extension says generic `OK` is approval | Core wins; exact token still required |
| Profile changes protected branch to feature branch | Protected-base and profile revision require revalidation |
| Familiar `test` script exfiltrates secrets | CMD inspection/isolation blocks execution |
| Old CI run is green | CI-05 rejects stale SHA |
| G2 envelope contains deploy action | Schema/checker rejects gate-action mismatch |
| PM SKILLS repository write attempted | Profile write lock rejects action |
| Detailed SVG embeds external link/script | SVG safety check fails |

## Residual risks

1. Static validation cannot prove the agent actually obeys the policy.
2. Connector/server must enforce envelope, profile, gate, action, and SHA for hard guarantees.
3. Project Profiles can become stale as repositories evolve.
4. Human review is still required for factual correctness of diagrams and project extensions.
5. PM SKILLS repository owner/URL must be confirmed before enabling writes.

## Recommendation

Use for supervised coding work now. Enable autonomous remote writes only after connector-side enforcement consumes this profile/envelope/checker contract.
