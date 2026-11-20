# Manager dashboard visual hierarchy

Use the existing manager sage tokens for the main actions, active work area, and current revenue series. Reduce competing gradients and accents on supporting cards. Use semantic colors for warning, error and success. Keep the prior comparison series dashed and retain the existing light and dark theme controls.

Dashboard receives the authorized restaurant data and pending counts through useDashboard. The priority section uses the existing queue counts and alert list to mark visible work. This change touches dashboard presentation and the chart styles. Verify with focused tests, build and a Chromium review of populated and clear states in both themes.

## Verification

- Passed 17 dashboard tests, GraphQL validation, conflict marker checks, and the production build.
- Verified populated and clear work states with mocked data in Chromium at 390, 1024, and 1440 px, including light and dark mode. Checked the sage current series, dashed comparison series, and contrast for the primary action and selected row labels. The primary action measured 5.70:1 in light mode and 7.29:1 in dark mode.
