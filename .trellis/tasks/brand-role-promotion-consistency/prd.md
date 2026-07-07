# Brand role promotion consistency

## Problem

The current data model has three related but different values:

1. `User.role` controls portal access and system capabilities.
2. `User.userType` is a discriminator/legacy account type and must not override a populated current role for authorization.
3. `BrandMembership.role` plus `restaurantIds` controls authority inside one Brand.

Treating these values as one role causes two common failures:

- an account is changed from System Admin to Manager while its BrandMembership remains `admin`, so it still correctly receives Brand-wide access even though the operator expected one branch;
- a BrandMembership is changed to `manager` while the account remains System Admin or operational staff, so the account is either impossible to scope or cannot enter the manager portal.

## Invariants

- System Admin is global and cannot be restricted to one restaurant.
- Global `manager` does not grant restaurant access by itself.
- Brand `owner` and Brand `admin` have Brand-wide restaurant scope.
- Brand `manager` must have exactly one restaurant ID.
- Brand `staff` must have at least one restaurant ID.
- The frontend restaurant selector must derive its options from the active BrandMembership, even when Apollo still holds a broader cached `Brand.restaurants` list.
- An incompatible membership may always be deactivated so legacy data can be repaired.

## Compatibility matrix

| Account role | Allowed BrandMembership role | Scope |
| --- | --- | --- |
| System `admin` | `owner`, `admin` | Global system access; Brand scope is not restrictive |
| System `manager` | `owner`, `admin` | Entire Brand |
| System `manager` | `manager` | Exactly one restaurant |
| HR / accountant / operational role | `staff` | One or more restaurants |
| Customer | none | No management membership |

System `admin` + Brand `manager` is rejected because the account would still have global access. Operational staff + Brand `manager` is rejected because the account cannot enter the manager portal.

## Transition flow

### Staff to branch manager

Required final state:

- account role: `manager`;
- BrandMembership role: `manager`;
- exactly one restaurant ID;
- no other active manager may own that restaurant.

This transition crosses both system and Brand authority. The final atomic workflow must require an actor authorized to change the account role and the Brand membership.

### Branch manager to Brand admin

- keep account role `manager`;
- set BrandMembership role to `admin`;
- clear restaurant IDs.

### Brand admin to branch manager

- keep account role `manager`;
- set BrandMembership role to `manager`;
- require exactly one available restaurant.

### Manager to staff

- set BrandMembership role to `staff`;
- require one or more restaurants;
- require an explicit target operational role such as server, cashier, chef, HR, or accountant.

Do not automatically assign generic `staff`: doing so would erase the employee's actual occupational role. A future atomic transition should store or explicitly request the target operational role.

### Ownership transfer

Ownership remains a dedicated transaction:

- target membership becomes `owner`;
- previous owner becomes Brand `admin`;
- both keep Brand-wide scope;
- account role remains a manager-capable role.

## Multi-Brand rule

Never rewrite all memberships from one global role change. One account can hold different roles in different Brands. Each membership transition must identify one membership/Brand explicitly.

A global role may only be demoted out of `manager` when the account has no remaining active `owner`, `admin`, or `manager` memberships in any Brand.

## Immediate implementation

- Current populated role takes precedence over stale `userType` for System Admin detection.
- Brand member add/update mutations reject incompatible account-role and membership-role combinations.
- Deactivation remains available for incompatible legacy memberships.
- Frontend restaurant options are intersected with membership `restaurantIds` for Brand managers and staff.
- System Admin and Brand owner/admin retain their intended broad scope.

## Follow-up implementation

Add one atomic role-transition mutation only after these inputs and permissions are finalized:

- membership ID;
- target BrandMembership role;
- target restaurant IDs;
- explicit target account role when crossing manager/staff portal boundaries;
- conflict validation;
- transaction, audit log, cache refresh, and session notification.

Until that mutation exists, system-role changes and BrandMembership changes must remain visibly separate operations and incompatible combinations must fail rather than silently granting broad access.
