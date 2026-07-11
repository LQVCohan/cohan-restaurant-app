# Implementation plan

1. Add focused failing tests for invalid review states, mismatched amount, transaction reuse, and modal amount validation.
2. Harden `transferMutation.js` state transitions and make rejection atomic.
3. Guard settlement idempotency by payment reference and remove duplicate manual order updates.
4. Surface decision errors inside the modal and align route permission.
5. Review latest callers and record tests/builds that could not be run.
