# Bootstrap Trellis workflow for COHAN

## Goal

Introduce a repository-local AI engineering workflow that preserves COHAN context between sessions and makes code changes follow the real cross-layer flow.

## Requirements

- Add a root `AGENTS.md` entrypoint for coding agents.
- Add a concise Trellis workflow with planning, implementation, verification, and finish gates.
- Add backend, frontend, and cross-layer specifications based on current COHAN architecture.
- Preserve all existing `.agents/skills/` content and reference `ponytail` rather than copying it.
- Keep local developer/session state ignored.
- Disable automatic journal commits so every repository change remains reviewable.
- Make no runtime application, database, GraphQL, or dependency changes in this pilot.

## Acceptance criteria

- A new coding session can discover the workflow from `AGENTS.md`.
- The workflow explicitly requires schema -> resolver/service -> Apollo -> UI tracing.
- Backend and frontend specs include permission, contract, state, and validation checks.
- `.trellis/.gitignore` excludes local identity and runtime files.
- Existing application build and behavior are unchanged because only documentation/configuration files are added.

## Out of scope

- Vendoring every Trellis CLI script, hook, skill, and platform adapter.
- Enabling Codex hooks in a developer's global configuration.
- Replacing GitHub Issues, pull requests, tests, or existing COHAN skills.
- Modifying production code.

## Follow-up after review

Run the official Trellis CLI in a disposable branch and compare its generated hooks/scripts with this pilot before adding platform automation.
