# GSAP Core Skill

Adapted project guidance from the official `greensock/gsap-skills` repository.

Source: https://github.com/greensock/gsap-skills
License: MIT

## Use when

Use this skill for JavaScript UI animation in React or vanilla DOM, especially `gsap.to`, `gsap.from`, `gsap.fromTo`, easing, duration, stagger, defaults, and reduced-motion handling.

## Rules for this project

- Use GSAP as progressive enhancement; the restaurant app must still work if GSAP fails to load.
- Keep business logic in existing React components, hooks, GraphQL calls, and services.
- Prefer animating `autoAlpha`, `x`, `y`, `scale`, and `rotation`.
- Use `stagger` for hero copy, cards, shortcut tiles, and section headers.
- Use `gsap.matchMedia()` for `prefers-reduced-motion`.
- Keep motion short and useful: 0.18s to 0.65s for customer homepage interactions.
- Do not use GSAP to mutate React state.

## Recommended pattern

```js
const mm = gsap.matchMedia();
mm.add('(prefers-reduced-motion: no-preference)', () => {
  const ctx = gsap.context(() => {
    gsap.from('.target', { autoAlpha: 0, y: 20, duration: 0.5, stagger: 0.06 });
  }, rootRef);

  return () => ctx.revert();
});
```
