# Unify the add employee modal UI

## Current behavior and root cause

The add-employee screen passes `onClose` to the shared `Modal` while rendering its own header, body scroll container, and footer. The screen already passes `showCloseButton={false}`, but the shared modal did not implement that prop. It therefore created an empty default header and close button before the employee form header. The result was a duplicated top strip, two close controls, nested spacing, a blue local palette that conflicted with the manager sage/warm-neutral system, and no modal-specific phone layout.

## End-to-end flow traced

1. `Staff` discriminator stores department, title, employment, salary, shift, and emergency-contact data.
2. GraphQL `createStaff` resolves and validates the active Brand/Restaurant context, delegates account creation, and synchronizes `BrandMembership`.
3. `useStaffManagement` sends `CreateUserInput` through the `createStaff` mutation and refetches the scoped staff list.
4. `StaffManagement` opens `AddEmployeeModal`, which validates the selected restaurant against the active business before forwarding data.
5. `EmployeeFormModal` collects the three-step form, validates each step, preserves safe draft fields, and submits the existing payload.

The GraphQL contract, permission checks, restaurant scope, mutation payload, form logic, and refetch behavior are correct and remain unchanged.

## Implemented scope

- Implement `showCloseButton` at the shared `Modal` boundary so existing callers can own their header without receiving a duplicate empty header.
- Preserve the employee modal's three steps, validation, draft restoration, salary reference, role resolution, submit payload, and close protection.
- Replace the local blue visual layer with COHAN manager surfaces: warm neutral paper, sage primary actions, restrained status colors, consistent radius and elevation.
- Make the form body the only scroll region and keep the action footer visible without covering content.
- Add responsive rules for desktop, tablet, and phone widths without CSS zoom; stack form fields and keep touch targets readable on phones.
- Add a focused shared-modal regression test for hidden default close controls and titled headers.

## Acceptance criteria

- Passing `showCloseButton={false}` without a title no longer renders an empty shared header.
- A caller-supplied close control remains the only close control in the add-employee modal.
- A titled shared modal may hide its close button without losing the title/header.
- The employee form uses the manager sage/warm-neutral visual system across header, steps, fields, cards, feedback, and footer.
- The modal has one constrained scroll region, a stable footer, visible focus styling, and reduced-motion handling.
- At phone widths the modal uses the shared bottom-sheet layout, form grids stack, department choices use two columns, and controls retain readable sizes.
- Staff schema, resolver, BrandMembership synchronization, Apollo mutation, restaurant scope, and submit payload are unchanged.

## Out of scope

- Schema, resolver, model, permissions, BrandMembership, staff mutation, or Apollo contract changes.
- Rewriting the existing form JSX, department option data, icon content, or employee-form validation tests.
- New dependencies, font systems, or a broader staff-page redesign.

## Validation plan

- Focused test: `npx vitest run src/components/common/Modal.test.jsx src/components/Dashboard_Manager/Staff/components/modals/EmployeeFormModal/EmployeeFormModal.test.jsx`.
- Build: `npm run build` when an executable repository environment is available.
- Manual visual checks at 390×844, 430×932, 768, 1024, and 1440 px when a browser runtime is available.

## Validation status

The regression test was added, but no test, build, CI workflow, or browser viewport check was executed in the connector-only environment.
