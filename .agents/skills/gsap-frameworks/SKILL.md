# GSAP Frameworks Skill

Adapted project guidance from the official `greensock/gsap-skills` repository.

Source: https://github.com/greensock/gsap-skills
License: MIT

## Use when

Use this skill when applying GSAP in a framework environment such as React, Vue, Svelte, or vanilla modules.

## Rules for this project

- This app uses Vite + React, so motion should live in hooks or small page-level modules.
- Scope DOM selectors to the page root.
- Clean up animations and observers on unmount.
- Keep GSAP separate from GraphQL queries, routing rules, auth, cart, booking, and checkout logic.
- Prefer a tiny local loader or npm dependency, not both, unless there is a clear reason.
- For a customer homepage, prefer progressive enhancement: static page first, motion second.

## Review checklist

- Does React own the data and DOM structure?
- Does GSAP only animate rendered elements?
- Are selectors stable across responsive layouts?
- Does StrictMode cleanup work?
