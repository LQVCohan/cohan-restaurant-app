---
name: wcag-ui-audit
description: >
  Review and fix accessibility issues in web UI. Use for React/HTML/CSS components, forms, dialogs,
  tables, dashboards, color contrast, keyboard navigation, focus management, ARIA, and WCAG checks.
source: https://github.com/accesslint/claude-marketplace
related:
  - https://github.com/Community-Access/accessibility-agents
  - https://github.blog/ai-and-ml/github-copilot/building-a-general-purpose-accessibility-agent-and-what-we-learned-in-the-process/
---

# WCAG UI Audit

Use this skill for any UI work where accessibility can regress, especially forms, filters, modals, menus, tables, toasts, dashboards, and custom controls.

## Checklist

1. Semantics: prefer native HTML controls and landmarks before ARIA.
2. Keyboard: every interactive element is reachable, operable, and has visible focus.
3. Names: buttons, links, inputs, icons, and SVG-only controls have accessible names.
4. Forms: labels are explicit, errors identify the field, and helper/error text is associated.
5. Dialogs/popovers: focus moves in, is trapped when modal, Escape/close works, and focus returns.
6. Color/contrast: text and status indicators meet contrast; color is not the only signal.
7. Dynamic UI: loading, errors, toasts, and async updates use appropriate live-region or status patterns.
8. Tables/lists: headings, captions, row/column relationships, and sort state are understandable.
9. Motion: respect reduced motion and avoid animation that blocks reading or operation.
10. Mobile: touch targets are large enough and layout remains usable at narrow widths.

## Validation

Run the smallest relevant check available: component tests, browser smoke test, axe/accessibility tooling if installed, or a manual keyboard/focus review. State any checks that could not be run.
