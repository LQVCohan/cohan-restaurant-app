# Staff emergency contact contract fix

## Current behavior

The final add-employee mutation fails GraphQL validation because the modal sends `emergencyContact` while `CreateUserInput` does not define it. When the three contact fields are empty, Apollo serializes the unconditional object as `{}`.

## Root cause

1. The UI and GraphQL response use one primary `emergencyContact`.
2. The Staff Mongoose discriminator persists `emergencyContacts` as an array.
3. The create schema omits the singular input field.
4. The staff domain wrapper forwards the singular field unchanged; strict Mongoose persistence does not map it into the array.
5. The update wrapper reads a nonexistent singular model field and the staff DTO does not map the primary array item back to the singular response field.

## Scope

- Add optional `emergencyContact: EmergencyContactInput` to `CreateUserInput`.
- Omit an empty contact object in the add modal.
- Normalize a singular input into the primary element of `emergencyContacts` for create and update.
- Preserve non-primary existing contacts during an update.
- Map the primary stored contact back to the existing `emergencyContact` response field.
- Extend focused schema and resolver tests.

## Acceptance criteria

- Creating staff without emergency contact sends no empty object and passes GraphQL validation.
- Creating staff with a contact persists one primary `emergencyContacts` entry.
- Updating the primary contact preserves its existing relation and any secondary contacts.
- Staff GraphQL output exposes the primary stored contact as `emergencyContact`.
- No database migration or second contact authority is introduced.

## Validation

- Run focused staff schema and business-context tests when a runnable checkout is available.
- Re-fetch and review each changed file on main.

## Out of scope

- A full multi-contact editor.
- Migrating unrelated legacy user documents.
