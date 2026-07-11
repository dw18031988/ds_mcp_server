---
extension_id: pm-skills-conventions
version: '1.0'
authoritative: false
extends_profile: pm-skills
core_policy: CODING-PROJECT-GOVERNANCE@1.0
core_sha256: 04cd33bbaff66f44917199e6bbb8355a1e956edb9c474e6c8e664ed8d0ed41c1
mode: tighten_only
source_note: PM power/skill/agent/steering/hook structure and publication-quality
  controls.
---

# PM SKILLS Project Extension

> This extension adds PM SKILLS-specific conventions and cannot weaken the generic core.

## Capability model

Preserve these boundaries:

| Artifact | Purpose |
|---|---|
| Power | A reusable domain capability or capability family |
| Skill | A bounded workflow with inputs, steps, outputs, and quality checks |
| Agent | A role/persona responsible for applying powers and skills |
| Steering | Persistent rules, standards, terminology, and constraints |
| Hook | Event-triggered automation that does not replace approval gates |

Do not collapse all five artifact types into one generic instruction file.

## Required artifact quality

- A power intended for Kiro distribution requires a valid `POWER.md`.
- A skill requires a discoverable `SKILL.md` with explicit trigger, inputs, procedure, outputs, failure handling, and examples.
- Agent, hook, steering, MCP, or installer assets must use their repository-defined paths and schemas.
- Do not claim an artifact is installed, compatible, production-ready, or discoverable until its required files and manifests exist and validation passes.
- Preserve authoritative use-case standards and trace each generated template or workflow back to its source requirement.
- Avoid duplicate skills with overlapping triggers; use a registry/router and explicit precedence.

## Five PM capability families

When the repository confirms this model, organize powers around five bounded families:

1. Strategy and portfolio.
2. Planning and delivery control.
3. Requirements, scope, and change.
4. Risk, governance, and quality.
5. Stakeholder communication, reporting, and learning.

This list is a project convention, not permission to invent missing repository structure. Verify protected-base evidence before moving files.

## Validation focus

- Markdown headings, links, examples, and references.
- JSON/YAML schema validity.
- Required manifests and discoverability.
- Trigger overlap and routing ambiguity.
- Installation paths and package completeness.
- Secret-free examples and sanitized configuration.
- Compatibility claims backed by evidence.
