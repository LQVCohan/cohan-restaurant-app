# Implementation plan

1. Add focused tests for invalid review states, mismatched amount, transaction reuse, and modal amount validation.
2. Harden `transferMutation.js` state transitions and make rejection atomic.
3. Guard manual settlement by payment reference and remove duplicate order updates.
4. Surface decision errors and amount mismatches inside the open modal.
5. Review latest callers and record tests/builds that could not be run.
