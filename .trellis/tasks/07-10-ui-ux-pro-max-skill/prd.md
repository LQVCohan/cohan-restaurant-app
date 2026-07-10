# UI UX Pro Max skill integration

## Current behavior

The repository already loads relevant agent guidance from `.agents/skills/**/SKILL.md`, but `ui-ux-pro-max` is not present locally or registered in `skills-lock.json`. The previous header redesign used the public skill as research only, so future agents cannot consistently invoke it from the repository.

## Root cause

The upstream skill was consulted externally but never installed into the repository's existing skill registry. `AGENTS.md` already provides the activation mechanism; the missing boundary is the local skill file and lock entry.

## Research and source

- Upstream repository: `nextlevelbuilder/ui-ux-pro-max-skill`
- Upstream path: `.claude/skills/ui-ux-pro-max/SKILL.md`
- Reviewed revision: `12b486b22e67f5d887962ef8351c1ac863bfaeb9`
- License: MIT

The upstream skill prioritizes accessibility, touch interaction, performance, style consistency, responsive layout, typography/color, motion, forms/feedback, navigation, and data visualization. For COHAN, the local integration keeps those priorities while binding them to the existing React/Vite/SCSS stack, manager sage palette, Lucide icons, and ponytail minimal-change rules.

## End-to-end flow

1. `AGENTS.md` requires agents to read every relevant `.agents/skills/**/SKILL.md`.
2. A UI creation, redesign, responsive, accessibility, or visual-review task activates `ui-ux-pro-max` together with `ponytail` and the existing focused UI skills.
3. The skill audits the current screen and real data/UI flow before choosing one visual direction.
4. Implementation reuses existing React components, SCSS variables, and manager/customer visual systems.
5. The agent validates responsive layout, keyboard focus, contrast, touch targets, loading/error states, and reduced motion, then reports changed files and checks.

No Mongoose schema, resolver, service, GraphQL operation, Apollo hook, React runtime component, stylesheet, permission guard, audit log, or realtime side effect participates in this repository-guidance-only change.

## Scope

- Add a self-contained COHAN adaptation of the official `ui-ux-pro-max` skill.
- Register the skill in `skills-lock.json` with upstream source, path, local path, and local content hash.
- Preserve all existing skills and runtime code.

## Files to change

- `.agents/skills/ui-ux-pro-max/SKILL.md`: add activation rules, workflow, COHAN defaults, anti-patterns, and validation checklist.
- `skills-lock.json`: register the new skill.
- `.trellis/tasks/07-10-ui-ux-pro-max-skill/task.json`: track task state and source revision.

## Acceptance criteria

- The new skill has valid YAML frontmatter and names the official source and MIT license.
- The skill is self-contained and does not require vendored Python scripts or datasets for normal use.
- It preserves repository precedence: `AGENTS.md`, `ponytail`, existing components/tokens, then new design decisions.
- It covers accessibility, touch targets, responsive layout, visual hierarchy, typography/color, motion, forms/feedback, and performance.
- `skills-lock.json` remains valid JSON and includes the local file hash.
- No dependency or runtime application file changes.

## Out of scope

- Copying the upstream CLI, Python scripts, generated templates, or large CSV datasets.
- Redesigning current pages as part of this task.
- Adding npm or Python dependencies.
- Replacing the existing frontend-design, taste-ui-redesign, WCAG, or performance skills.

## Validation plan

- Re-fetch the new skill and verify frontmatter, source, license, and local workflow.
- Parse the updated `skills-lock.json` as JSON.
- Confirm the registered `computedHash` matches the local skill blob SHA.
- Review the final diff for runtime files or duplicate dependencies.
- Do not run the application build or test suites because only agent Markdown and registry JSON change.
