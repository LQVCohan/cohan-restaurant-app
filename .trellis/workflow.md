# COHAN Development Workflow

This repository uses a lightweight Trellis workflow. `AGENTS.md` is the entry point; this file defines the task lifecycle.

## Core rules

1. Read every relevant `.agents/skills/**/SKILL.md` before editing. `ponytail` remains active unless the user explicitly disables it.
2. Trace the real flow before changing code: Mongoose/schema -> resolver/service/guard -> GraphQL operation/Apollo hook -> UI action -> tests.
3. Fix the root cause at the shared boundary. Reuse repository patterns and change the fewest files that correctly solve the task.
4. Fetch the latest file version and inspect callers/usages before each write.
5. Never commit secrets, generated uploads, local runtime state, or unreviewed dependency changes.

## Phase 1: Plan

Create or update a task under `.trellis/tasks/` for any code or repository change. Pure explanation and report-review requests do not need a task.

A lightweight task needs:

- `task.json`
- `prd.md` with scope, constraints, acceptance criteria, and out-of-scope items

A complex task additionally needs `design.md` and `implement.md`.

Before implementation, record:

- the current behavior and root cause;
- the end-to-end caller flow;
- the exact files that will change and why;
- the smallest relevant validation commands.

[workflow-state:no_task]
No active task. For a requested repository change, create a task and complete planning before editing code.
[/workflow-state:no_task]

[workflow-state:planning-inline]
Stay in planning until the real flow, root cause, file list, acceptance criteria, and validation plan are explicit.
[/workflow-state:planning-inline]

## Phase 2: Implement

Implement directly from the approved task artifacts.

- Prefer deletion or reuse over new abstraction.
- Do not patch only the reported UI symptom when the contract is wrong in schema, resolver, service, or shared helper.
- Preserve restaurant scoping, permissions, validation, audit logging, and realtime behavior.
- Keep GraphQL schema, resolver payloads, Apollo fragments, optimistic responses, and UI state aligned.
- Do not add a dependency unless the existing stack or platform cannot reasonably solve the problem.

[workflow-state:in_progress-inline]
Read the active task, relevant specs, skills, and callers. Implement the smallest root-cause fix, then run the narrowest meaningful checks.
[/workflow-state:in_progress-inline]

## Phase 3: Verify and finish

Run the smallest checks that prove the changed path, then widen only when needed:

```bash
npm run check:conflicts
npm run check:graphql
npm run test:unit
npm run test:component
npm run test:api
npm run build
```

Use targeted Vitest, backend tests, or Playwright commands when a full suite is unnecessary or unavailable.

Before finishing:

1. Review the diff for duplicated logic, contract drift, permission gaps, and unintended files.
2. Update `.trellis/spec/` only for stable project knowledge, not one-off task details.
3. Record which tests/builds ran and which did not.
4. Cite the changed files and line ranges in the final report.
5. Archive the task only after acceptance criteria are met.
