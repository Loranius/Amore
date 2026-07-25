# Visual testing with Playwright

The `Visual Preview` GitHub Actions workflow builds the current branch, starts the Vite preview server, opens it in Chromium with a Pixel 8 Pro-sized viewport, and uploads screenshots plus the Playwright HTML report as an artifact.

## What is captured

- the public login screen on every run;
- the full Wishlist page and the bubble area when authenticated visual-test secrets are configured;
- traces, videos, and failure screenshots when a test fails.

## Authentication secrets

Add these repository secrets in GitHub Actions settings:

- `VISUAL_USER_NAME` — the exact user button label shown on the Amore login screen;
- `VISUAL_USER_PIN` — the eight-digit PIN for that dedicated visual-test account.

Do not commit the PIN to the repository. Without these secrets, the workflow remains successful and captures only the login screen.

## Safety and isolation

Playwright is installed only inside the visual-preview CI job with a pinned version. It is not included in the production application bundle and does not change runtime code, Supabase data, or the normal CI workflow.

Artifacts are retained for 14 days and can be downloaded from the completed GitHub Actions run.
