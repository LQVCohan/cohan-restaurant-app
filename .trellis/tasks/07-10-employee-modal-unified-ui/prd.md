# Unify the add employee modal UI

## Current behavior and root cause

The add-employee screen passes `onClose` to the shared `Modal` while rendering a second custom header, body scroll container, footer, sizing, border, and shadow. `Modal` therefore creates its own header and close button before the custom shell. The unsupported `showCloseButton={false}` prop does not suppress that header. The result is a duplicated top strip, two close controls, nested surfaces, a blue local palette that conflicts with the manager sage/warm-neutral system, and no modal-specific phone layout.

## End-to-end flow traced

1. `Staff` discriminator stores department, title, employment, salary, shift, and emergency-contact data.
2. GraphQL `createStaff` resolves and validates the active Brand/Restaurant context, delegates account creation, and synchronizes `BrandMembership`.
3. `useStaffManagement` sends `CreateUserInput` through the `createStaff` mutation and refetches the scoped staff list.
4. `StaffManagement` opens `AddEmployeeModal`, which validates the selected restaurant against the active business before forwarding data.
5. `EmployeeFormModal` collects the three-step form, validates each step, preserves safe draft fields, and submits the existing payload.

The GraphQL contract, permission checks, restaurant scope, mutation payload, and refetch behavior are correct and are out of scope for this visual task.

## Scope

- Use the shared structured `Modal.Header`, `Modal.Body`, and `Modal.Footer` API so the modal has one shell and one close control.
- Preserve all three steps, validation, draft restoration, salary reference, role resolution, submit payload, and close protection.
- Align visual tokens with COHAN manager surfaces: warm neutral paper, sage primary action, restrained status colors, consistent radius/elevation.
- Replace non-semantic clickable cards with native buttons, preserve visible focus, and provide accessible icon controls.
- Add responsive behavior for desktop and phone widths without CSS zoom or covered footer content.
- Keep the change focused on the employee modal and its component test.

## Acceptance criteria

- Only one dialog header and one accessible close button are rendered.
- The step indicator, content, and footer read as one shared modal rather than nested modal shells.
- Department and classification choices are keyboard-operable native buttons with selected state.
- Password visibility controls have accessible names and use the existing Lucide icon set.
- At phone widths the modal becomes a stable bottom sheet, form grids stack, department choices remain touch-friendly, and footer actions remain reachable without horizontal overflow.
- Existing draft, validation, restaurant scope, role resolution, salary reference, and submission tests continue to pass.
- A focused regression test verifies the single close control and structured modal composition.

## Out of scope

- Schema, resolver, model, permissions, BrandMembership, staff mutation, or Apollo contract changes.
- New dependencies, font systems, global modal redesign, or staff-page redesign outside this dialog.

## Validation plan

- `npm run test:component -- EmployeeFormModal.test.jsx` or the repository's equivalent focused Vitest command.
- `npm run build` if the environment is available.
- Manual visual checks at 390×844, 430×932, 768, 1024, and 1440 px when a browser runtime is available.
