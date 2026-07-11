# Implementation

1. Update getDefaultPathForRole so order and kitchen roles use their operational workspace.
2. Use getDefaultPathForRole in the direct /staff redirect.
3. Reorder filtered StaffLayout navigation by the resolved role's primary workspace and mark it with an accessible visual emphasis.
4. Wrap desktop navigation into labeled groups and retain mobile safe-area/overflow rules.
5. Add focused role landing and navigation regression coverage.
6. Run targeted frontend checks plus conflict/build checks when the environment is available.
