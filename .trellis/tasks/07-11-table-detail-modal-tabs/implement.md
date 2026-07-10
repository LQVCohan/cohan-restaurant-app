# Implementation plan

1. Add a focused modal tab enhancer that classifies the current direct sections without changing React-owned business logic.
2. Add scoped SCSS for the tab bar, contextual footer state, desktop modal grid, phone full-screen layout, focus states, and reduced motion.
3. Install the enhancer once from `src/main.jsx`.
4. Add one focused jsdom test covering default overview, section visibility, contextual save action, and keyboard tab navigation.
5. Verify imports, current callers, and the final diff; run the focused Vitest test and build when a runtime environment is available.
