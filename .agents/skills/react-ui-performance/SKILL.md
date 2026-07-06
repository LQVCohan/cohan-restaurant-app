---
name: react-ui-performance
description: >
  Keep COHAN React 19 and Vite interfaces fast and responsive while building or
  redesigning UI. Use for components, Apollo-driven screens, long lists, charts,
  maps, 3D views, animations, bundle size, rendering, and interaction latency.
license: MIT
metadata:
  author: vercel
  version: "1.0.0-cohan"
source: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
---

# React UI Performance

This is a COHAN-focused adaptation of Vercel's React best-practices skill.
Read the upstream skill again when doing a dedicated performance audit.

## Project profile

- React 19 + Vite.
- Apollo Client for GraphQL data.
- SCSS/Tailwind/Ant Design for UI.
- Framer Motion and GSAP are already installed.
- Skip Next.js, React Server Components, server actions, and SWR-only advice unless the stack changes.

## Priority order

1. Remove avoidable request and render waterfalls.
2. Avoid loading heavy UI code before the user needs it.
3. Reduce unnecessary subscriptions and re-renders.
4. Keep rendering and animation compositor-friendly.
5. Apply micro-optimizations only after a measured need.

## Rules

- Start independent async work together and await it together.
- Reuse Apollo caching/deduplication; do not add a second fetching library.
- Dynamically import heavy maps, 3D, editors, and report/chart panels only when the route or interaction needs them.
- Preload heavy routes or modules on meaningful hover/focus only when it improves a measured path.
- Do not define components inside components.
- Derive values during render instead of mirroring them with effects.
- Keep effect dependencies primitive and specific.
- Use functional state updates when the next value depends on the previous value.
- Use lazy state initialization for expensive initial calculations.
- Use `startTransition` or `useDeferredValue` for non-urgent expensive updates, not for actions that must feel immediate.
- Do not add `memo` or `useMemo` around trivial expressions; isolate genuinely expensive work first.
- Use `content-visibility` or virtualization for proven long-list bottlenecks, reusing installed tools before adding dependencies.
- Animate wrappers rather than complex SVG internals; prefer transform and opacity.
- Use passive listeners for scroll/touch observation when cancellation is unnecessary.
- Keep content visible and usable if animation or lazy loading fails.
- Preserve keyboard access, focus, reduced motion, error handling, and data correctness while optimizing.

## Validation

Use the narrowest proof available: targeted component test, React Profiler evidence,
bundle/build output, or a browser smoke check. Do not claim a performance improvement
without a measured before/after signal.
