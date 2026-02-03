# Coach overlay

This folder contains the Electron overlay UI.

## Common commands

From this directory:

- Run the overlay locally:
  - `npm install`
  - `npm start`

- Run unit tests:
  - `npm test`

- Capture deterministic screenshots (used in PRs when overlay UI/UX changes):
  - `npm run screenshot`

The screenshot script writes PNGs into `overlay/screenshots/`.

Notes:
- The script launches Electron and captures a small set of known UI states.
- If screenshots fail to capture on a given machine/CI environment, describe manual reproduction steps in the PR instead.
