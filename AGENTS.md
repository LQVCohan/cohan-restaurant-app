# COHAN Agent Instructions

Before changing this repository:

1. Read `.trellis/workflow.md`.
2. Read every relevant `.agents/skills/**/SKILL.md`. The existing `ponytail` skill is always active unless the user explicitly disables it.
3. Read the active task under `.trellis/tasks/` and the relevant `.trellis/spec/` files.
4. Trace the actual flow before editing:
   `Mongoose/schema -> resolver/service/guard -> GraphQL operation/Apollo hook -> UI action -> tests`.
5. Fetch the latest version of each target file and inspect all callers/usages.

Implementation rules:

- Fix the root cause, not only the reported symptom.
- Reuse existing patterns and change the fewest files that correctly solve the task.
- Keep schema, resolver output, Apollo fragments, optimistic responses, and UI state synchronized.
- Preserve restaurant scoping, role/permission checks, validation, audit logs, and realtime side effects.
- Do not add abstraction, boilerplate, or dependencies without a demonstrated need.
- Never write secrets or local runtime files into the repository.

Before committing or opening a PR:

- State which files are changing and why.
- Run the narrowest meaningful tests, GraphQL checks, and build checks.
- Review the diff for duplicated logic and cross-layer contract drift.
- Report changed file/line ranges and explicitly state any checks that were not run.
