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

## Overlay hotkeys (current)

- **Enter**: confirms **Back on track** (only when *not* in align mode and when no control/textbox is focused).
- **Esc**: opens Snooze; when Snooze is open, **Esc** closes it.
- **1-9**: in align mode, selects the corresponding choice (disabled while typing in the custom answer box).
- **?** (usually **Shift+/**): toggles Details when available (disabled while typing or when Snooze is open).

## Screenshot harness notes

- The script launches Electron and captures a small set of known UI states.
- If screenshots fail to capture on a given machine/CI environment, describe manual reproduction steps in the PR instead.
