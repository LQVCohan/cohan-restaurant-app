# Brand member invitation flow

## Problem

Business-owner registration currently activates and signs in the account immediately. The Brand screen can only attach an already compatible account by user ID, so a public Customer account cannot become a Brand administrator or branch manager through the intended flow.

## Scope

- New business owners create the Brand, owner membership, and first restaurant atomically but remain `pending` until email verification.
- Brand owners can invite Brand administrators or branch managers.
- Brand administrators can invite branch managers only.
- Existing Manager accounts and public Customer accounts can be invited.
- A new manager-capable account can be created in `pending` state from an invitation email.
- Accepting an invitation activates the membership; an existing Customer is promoted to global Manager only at that point, while a new account is verified and receives its chosen password.
- Employee/staff creation and occupational roles are not changed.

## Invariants

- Public Customer registration remains Customer-only.
- Brand administrator means global `manager` account plus BrandMembership `admin`; it is not System Admin.
- Branch manager means global `manager` account plus BrandMembership `manager` with exactly one restaurant ID.
- Only Brand owner or System Admin may invite a Brand administrator.
- Brand owner/admin may invite a branch manager.
- An active branch manager remains unique per restaurant.
- Invitation tokens are stored as hashes, expire, and are single-use.
- Brand membership is the relationship source of truth; no member array is added to Brand.

## Flow

### Business owner registration

1. Create pending manager-capable User.
2. Create Brand, owner membership, and optional first restaurant in one transaction.
3. Send the existing account-verification email.
4. Return no access token.
5. Existing verification activates the User; the user then signs in normally.

### Brand invitation

1. Authorized actor chooses Brand role and branch scope.
2. Actor selects an existing compatible account or enters a new email.
3. Backend creates or reuses the User, stores an `invited` BrandMembership, hashes a one-use token, and sends an invitation email.
4. Recipient opens the invitation link.
5. New account supplies a password; an existing Customer or Manager confirms the invitation.
6. Backend verifies the token, promotes an existing Customer to global Manager only after confirmation, then activates the membership and activates/verifies a new account.

## Validation

- Allow Customer accounts for Brand admin/manager invitations but do not promote them before acceptance; reject operational Staff, HR, Accountant, and System Admin accounts.
- Reject Brand admin invitation from non-owner Brand administrators.
- Reject manager invitation without exactly one Brand restaurant.
- Reject an invitation that would replace an active manager implicitly.
- Reject expired, invalid, or already-used invitation tokens.

## Tests

- Business-owner registration returns pending User and no access token.
- Owner can invite admin; Brand admin cannot invite another admin.
- Owner/admin can invite manager with one available restaurant.
- New invited user is pending and becomes active after acceptance/password setup.
- Existing compatible user becomes an active member after acceptance.
- Existing Customer promotion occurs only on acceptance; operational-role incompatibility and manager-scope conflicts remain blocked.
