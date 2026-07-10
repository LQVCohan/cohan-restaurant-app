---
name: ui-ux-pro-max
description: >
  UI/UX design intelligence for COHAN web interfaces. Use for creating, redesigning,
  reviewing, fixing, or polishing React screens, headers, forms, dashboards, cards,
  tables, modals, responsive layouts, interaction states, accessibility, typography,
  color, motion, and perceived quality.
license: MIT
source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md
upstream-revision: 12b486b22e67f5d887962ef8351c1ac863bfaeb9
---

# UI/UX Pro Max for COHAN

Use this skill whenever a task changes how an interface looks, feels, moves, responds, or is operated. It adapts the official UI UX Pro Max priorities to COHAN's React/Vite/SCSS stack and existing manager/customer design systems.

## Precedence

1. Follow `AGENTS.md` and `.trellis/workflow.md`.
2. Keep `ponytail` active: understand the full flow, then make the smallest correct change.
3. Reuse existing components, CSS variables, spacing, icons, and page patterns before inventing new ones.
4. Use this skill to choose and verify the visual direction; do not use it to justify unrelated redesign scope.

## When to apply

Apply for:

- new or refactored pages, components, forms, tables, cards, dialogs, headers, sidebars, and charts;
- visual polish, responsive fixes, information hierarchy, or brand consistency;
- accessibility, keyboard/focus, touch behavior, loading/error/empty states, and reduced motion;
- pre-release UI review when the interface feels unclear, crowded, generic, or inconsistent.

Skip for pure backend, database, infrastructure, or non-visual performance work.

## Priority order

Review in this order. Do not trade a higher-priority requirement for decoration.

1. **Accessibility** — readable contrast, semantic controls, keyboard operation, visible focus, accessible names, logical headings.
2. **Touch and interaction** — primary targets at least 44×44 px, 8 px separation, immediate pressed/loading feedback, no hover-only actions.
3. **Performance and stability** — reserve layout space, avoid unnecessary reflow, lazy-load heavy media, keep interactions responsive.
4. **Style consistency** — one visual language, one icon family, consistent radius/elevation, no random style mixing.
5. **Layout and responsive behavior** — mobile-first, no horizontal overflow, clear content priority, stable breakpoints.
6. **Typography and color** — semantic tokens, clear type scale, tabular figures for data, WCAG AA contrast.
7. **Motion** — 150–300 ms, meaning-driven, transform/opacity preferred, honor `prefers-reduced-motion`.
8. **Forms and feedback** — visible labels, errors near the problem, progressive disclosure, clear save/cancel states.
9. **Navigation** — predictable location, back/cancel routes, no overloaded navigation.
10. **Charts and data** — labels and legends, accessible colors, never communicate meaning by color alone.

## COHAN visual direction

For restaurant operations and manager dashboards, default to **Soft UI Evolution + Minimalism + light dimensional layering**:

- Use the existing sage/green manager palette and warm neutral surfaces.
- Preserve the established background, surface, border, text, semantic-state, and shadow variables.
- Use Lucide SVG icons already installed; do not use emoji as interface icons.
- Give each screen one obvious primary action. Keep secondary actions visually subordinate.
- Group related information with spacing and shared surfaces instead of adding a card around every value.
- Use strong hierarchy: task title → operational summary → filters/actions → content.
- Prefer concise Vietnamese labels and plain action verbs.
- Use tabular numbers for KPI, prices, counts, and times to avoid visual shifting.

Do not introduce a new font, dependency, component library, or color system unless the current stack demonstrably cannot meet the requirement.

## Workflow

### 1. Audit before coding

- Identify the user role, screen's single main job, and most frequent action.
- Inspect the current screenshot or rendered state.
- Trace the real flow before editing: schema → resolver/service → GraphQL/Apollo → component state → UI action → tests.
- Inspect shared callers and styles to find the smallest root-cause boundary.
- Record what is information, what is action, and what is secondary decoration.

### 2. Choose one direction

Write a one-line direction before implementation, for example:

> Compact operational dashboard using sage surfaces, grouped KPI hierarchy, one high-contrast CTA, and progressive disclosure on mobile.

Choose one signature detail only. Do not mix glassmorphism, neumorphism, brutalism, and flat design in the same screen.

### 3. Implement with existing patterns

- Reuse repository components and tokens.
- Prefer CSS/HTML platform behavior over JavaScript and dependencies.
- Keep the DOM and visual hierarchy aligned.
- Preserve loading, empty, error, disabled, hover, active, focus, and permission states.
- Keep restaurant scoping and role/permission behavior unchanged unless the task explicitly changes it.
- Remove duplicated headings, labels, wrappers, or decorative blocks before adding new UI.

### 4. Responsive rules

Check at least 375, 768, 1024, and 1440 px; for existing COHAN mobile work also check 390×844 and 430×932 when possible.

- Mobile shows the main task and primary action first.
- Collapse or stack secondary KPI/details rather than shrinking text below readable sizes.
- Avoid fixed pixel widths that cause overflow.
- Do not use CSS `zoom` as a responsive solution.
- Inputs should remain at least 16 px on mobile to avoid browser auto-zoom.
- Fixed/sticky controls must reserve space and must not cover content.

### 5. Interaction and accessibility checks

- Native `button`, `input`, `select`, `fieldset`, `legend`, and headings before ARIA workarounds.
- Every icon-only control has an accessible name.
- Focus rings remain visible and meet contrast requirements.
- Color is never the only status signal; include icon or text.
- Async actions disable repeat submission and show progress.
- Multi-step flows always provide back/cancel routes.
- Errors identify the affected field or step, not only a generic banner.

### 6. Motion and effects

- Use subtle state transitions between 150 and 300 ms.
- Prefer `transform` and `opacity`; avoid animating layout dimensions.
- Shadows and blur must clarify elevation or dismissal, not decorate empty space.
- Add a `prefers-reduced-motion` fallback for non-trivial motion.

## Anti-patterns

Avoid:

- generic purple/blue AI gradients unrelated to the COHAN brand;
- a separate bordered card for every metric when a shared group communicates better;
- duplicate titles or step names inside content already labelled by navigation;
- tiny grey text on grey backgrounds;
- emoji icons, mixed icon sets, or inconsistent stroke weights;
- hover-only controls, hidden primary actions, or clickable elements without pointer/pressed states;
- placeholder-only form labels;
- raw color values in JSX when a repository token exists;
- oversized decorative headers that push operational content below the fold;
- copying the upstream CLI, scripts, or datasets into runtime code.

## Delivery checklist

Before finishing a UI task, verify:

- [ ] The screen's main job and primary action are immediately clear.
- [ ] Existing components/tokens were reused and the diff is minimal.
- [ ] Text contrast is readable and focus is visible.
- [ ] Touch targets and spacing are usable on phone widths.
- [ ] No horizontal overflow at required breakpoints.
- [ ] Loading, empty, error, disabled, and success states remain understandable.
- [ ] Motion is useful and reduced-motion is respected.
- [ ] No new dependency or abstraction was added without demonstrated need.
- [ ] The narrowest relevant component/build/browser check was run, or the missing check is stated explicitly.
- [ ] Final report names the visual direction, changed files/lines, and validation performed.

## Upstream research

This repository-local skill is intentionally self-contained. For broad style/category research, consult the official source at the revision recorded above, then translate findings into existing COHAN tokens and patterns. Do not copy generated recommendations directly without checking product fit, accessibility, and repository consistency.
