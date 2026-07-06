# Current UI agent skills

## Current behavior

The repository already includes strong skills for visual direction, redesigning existing React screens, Figma implementation, WCAG review, and GSAP motion. It does not include a current broad web-interface audit skill or a React/Vite-specific UI performance skill.

## Root cause

The existing guidance covers visual quality and accessibility well, but the final review layer is split across several files and does not systematically check current interface conventions such as URL state, locale formatting, touch behavior, image loading, layout performance, or React render cost. Importing another large aesthetic skill would duplicate existing guidance, so the smallest useful change is to add only the missing audit and performance layers.

## Research and selection

The current official collections already represented in the repository are Anthropic's `frontend-design` and OpenAI's `figma-implement-design`. After reviewing current public skill collections, the missing high-signal source is Vercel's official `agent-skills` repository:

- `web-design-guidelines` provides a fresh, source-driven audit across accessibility, focus, forms, animation, typography, images, performance, navigation, theming, touch, and localization.
- `react-best-practices` provides prioritized React performance guidance. The local adaptation keeps rules applicable to COHAN's React 19 + Vite + Apollo stack and explicitly excludes Next.js-only advice.

## End-to-end flow

1. `AGENTS.md` requires the agent to read relevant files under `.agents/skills/**/SKILL.md`.
2. A future UI task activates the existing design/redesign/accessibility skill plus one of the new focused skills.
3. `web-design-guidelines` fetches the current upstream interface rules and audits the affected screen and shared styles.
4. `react-ui-performance` checks the real React/Apollo render and loading path without introducing a second data-fetching library.
5. The agent reports changed files, line ranges, and the narrowest validation performed.

No Mongoose schema, resolver, service, GraphQL operation, Apollo query, UI component, permission guard, audit log, or realtime side effect participates in this repository-guidance-only change.

## Scope

- Add a web-interface audit skill sourced from Vercel's current guidelines.
- Add a compact React UI performance skill adapted to COHAN's existing stack.
- Register both skills in `skills-lock.json` with source and local content hashes.
- Keep the existing skills unchanged.

## Files to change

- `.agents/skills/web-design-guidelines/SKILL.md`: add the final UI/UX audit workflow and COHAN priorities.
- `.agents/skills/react-ui-performance/SKILL.md`: add React 19/Vite/Apollo performance guidance.
- `skills-lock.json`: register both skills and their source paths.
- `.trellis/tasks/07-07-ui-agent-skills/task.json`: track completion state.

## Acceptance criteria

- Both new skills have valid YAML frontmatter and a clear activation scope.
- The web audit skill requires fetching the latest upstream interface guidelines.
- The React skill matches the current React 19 + Vite + Apollo project and excludes Next.js-only guidance.
- Neither skill asks for a new dependency or changes runtime behavior.
- `skills-lock.json` remains valid JSON and records both source repositories and local paths.
- Existing frontend design, redesign, WCAG, Figma, and GSAP skills remain untouched.

## Out of scope

- Redesigning any current screen.
- Adding or changing React components, SCSS, routes, GraphQL operations, backend code, tests, or dependencies.
- Copying broad third-party UI skill packs that duplicate existing repository guidance.
- Adding React View Transition guidance that requires a canary React setup outside the current stable project profile.

## Validation plan

- Parse the updated `skills-lock.json` as JSON.
- Re-fetch both new skill files and verify frontmatter, source links, and local paths.
- Review the diff for duplicated guidance and unintended runtime changes.
- Do not run the application build or test suites because only Markdown agent instructions and the JSON skill registry change.
