# GSAP React Skill

Adapted project guidance from the official `greensock/gsap-skills` repository.

Source: https://github.com/greensock/gsap-skills
License: MIT

## Use when

Use this skill when applying GSAP inside React components, hooks, or customer-facing pages.

## Rules for this project

- Prefer a dedicated hook for page-level motion, for example `useGsapHomeMotion`.
- Scope selectors with a React ref and `gsap.context()`.
- Clean up timelines, event listeners, observers, and contexts on unmount.
- Do not use GSAP selectors globally when the page can be mounted inside a layout.
- Do not use GSAP to replace React state, routing, GraphQL data loading, or form logic.
- If using a CDN fallback, fail gracefully when `window.gsap` is unavailable.
- Keep StrictMode in mind: effects can mount and clean up more than once during development.

## Recommended pattern

```js
const rootRef = useRef(null);
useEffect(() => {
  let cleanup = () => {};
  loadGsap().then((gsap) => {
    const ctx = gsap.context(() => {
      gsap.from('.card', { autoAlpha: 0, y: 16, stagger: 0.04 });
    }, rootRef);
    cleanup = () => ctx.revert();
  });
  return () => cleanup();
}, []);
```
