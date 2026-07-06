---
name: web-design-guidelines
description: >
  Audit COHAN UI code against current web interface best practices. Use for UI reviews,
  accessibility checks, UX audits, responsive cleanup, form/table/dialog reviews, and
  before finalizing a visual redesign.
license: MIT
metadata:
  author: vercel
  version: "1.0.0"
source: https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines
---

# Web Interface Guidelines

Use this skill as the final audit layer after `frontend-design`, `taste-ui-redesign`,
`redesign-existing-projects`, and `wcag-ui-audit`.

## Workflow

1. Read the target screen and its shared layout/styles before reviewing isolated components.
2. Fetch the latest rules from:
   `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
3. Apply every relevant rule to the requested files or screen.
4. Prefer the repository's existing React, SCSS, Tailwind, Ant Design, routing, and accessibility patterns.
5. Fix shared root causes instead of repeating one-off CSS or JSX patches.
6. Report findings as `file:line - issue - smallest safe fix`.

## COHAN priorities

- Native semantic controls and visible keyboard focus.
- Explicit labels, validation, loading, empty, error, and success states.
- Responsive behavior without CSS `zoom`; fixed controls must not cover content.
- Images with dimensions and meaningful alternative text.
- Motion limited to transform/opacity and disabled for reduced-motion users.
- URL and navigation state that remain deep-linkable.
- Locale-aware date, number, currency, and time formatting.
- Touch targets and layouts usable on narrow mobile screens.
- No new dependency when the platform or an installed package already covers the need.

## Validation

Run the smallest relevant component test, accessibility/manual keyboard check, and build.
For visual changes, compare a screenshot at desktop and the affected mobile breakpoint.
State any check that could not be run.
