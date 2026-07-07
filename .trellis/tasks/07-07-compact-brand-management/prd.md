# Compact restaurant chain management layout

## Current behavior

The manager chain-management page now has aligned company/branch panels and a clear member filter toolbar. Two usability gaps remain:

1. The existing-member filters always occupy vertical space even when the user is only adding a member.
2. Adding a member still requires pasting an opaque Mongo account ID. The generic `users` query cannot be reused because it is restricted to system administrators, while `addBrandMember` is available to actors who pass `canManageBrand`.

## End-to-end flow reviewed

1. `User` stores the searchable account identity (`fullName`, `username`, `email`, `userType`, `status`, `deletedAt`).
2. `BrandMembership` stores brand role and restaurant scope.
3. `brand.graphql` currently exposes `brandMembers` and `addBrandMember`, but no safe brand-scoped candidate lookup.
4. The brand resolver protects membership writes with `canManageBrand` and validates the selected `userId` before upserting membership.
5. `BrandManagement` currently stores a raw `member.userId` entered by hand and passes it to `addBrandMember`.
6. The page-scoped compact stylesheet controls the filter/add-member layout.

The root fix is a small brand-scoped candidate query guarded by the same permission boundary as the mutation, then a native collapsible filter area and a search-plus-select account picker in the existing form.

## Scope

- Make `Tìm và lọc thành viên` collapsible with native `<details>`; keep it open initially.
- Add `BrandMemberCandidate` and `brandMemberCandidates(brandId, search, limit)` to the brand GraphQL contract.
- Require `canManageBrand` for candidate lookup.
- Search active non-customer business accounts by full name, username, email, or exact account ID.
- Exclude deleted accounts and accounts already in the selected brand.
- Limit and sort candidate results server-side.
- Replace raw-ID entry with a name/account search field and a select box.
- Keep the selected candidate ID as the existing `addBrandMember` mutation input.
- Preserve role, branch scope, manager uniqueness, permissions, and status behavior.
- Reuse current React, Apollo, SCSS, and manager palette; add no dependency.

## Acceptance criteria

- The member filter panel can be opened and collapsed from its summary row.
- Existing-member search and role/branch filters continue to work when open.
- Entering fewer than two candidate-search characters does not query or offer ambiguous results.
- Searching a name returns matching active business accounts that are not already brand members.
- Candidate options show a readable name plus email/username and account ID context.
- Selecting an option sets the exact `userId` sent to `addBrandMember`.
- Changing the candidate search clears a stale previous selection.
- Loading, no-result, and query-error states are visible without alerts or modals.
- The picker and add-member controls wrap without horizontal overflow at desktop, tablet, 430px, and 390px widths.
- No existing mutation or membership validation rule is weakened.

## Out of scope

- Creating a new user from this screen.
- Fuzzy/phonetic search, pagination, or external search services.
- Editing an existing member's role/scope from the add-member form.
- Changing owner transfer rules or shared manager layout components.

## Validation plan

- Add a focused brand resolver test for permission, search filter, existing-member exclusion, limit, and safe result mapping.
- Update `BrandManagement.test.jsx` for collapsed filters, candidate search/select, and mutation variables.
- Run the targeted frontend component test, targeted backend resolver test, GraphQL check, and frontend production build when execution is available.
- Review desktop and 390/430px layouts when an authenticated browser environment is available.
