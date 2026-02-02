# Codex Coach (macOS lightweight)

This is a minimal background “accountability partner” for macOS using only built-in tools when possible.

Features
- Spoken check-ins via `say`
- Screen capture via `screencapture`
- Optional webcam snapshot via `imagesnap` (install separately)
- macOS notifications and beeps via `osascript`
- CSV log of each cycle under `logs/`
- Organized captures per day under `captures/`

Quick Start
1) macOS permissions (first run will prompt or silently fail until granted)
   - Screen Recording: System Settings → Privacy & Security → Screen Recording → allow Terminal (or your Python app)
   - Camera (optional): allow Terminal/Python
2) Optional webcam tool:
   - Install: `brew install imagesnap`
3) Run:
   - `python3 coach/monitor.py --interval 60 --task "AI research"`

Useful flags
- `--interval 60` capture/check-in every N seconds
- `--task "Deep work"` used in spoken/notification prompts
- `--voice <Name>` pick a macOS voice (e.g. `Samantha`)
- `--no-camera` skip webcam snapshots
- `--no-say` disable spoken prompts
- `--no-notify` disable notifications
- `--sound Radar.mp3` play a sound file each check-in (ships in repo)

Notes
- If screenshots or webcam snaps do not appear, check permissions.
- `imagesnap` is optional; without it, webcam shots are skipped.
- Data accumulates quickly. Periodically archive or prune `captures/`.

Security & Privacy
- All data stays local. If you later add cloud sync, encrypt and protect access.
- Consider reducing frequency or disabling webcam to balance usefulness and privacy.

Next ideas
- Idle detection (no keystrokes/active app changes → escalate prompt)
- App allow/block lists to reduce captures on approved work apps
- Simple dashboard summarizing daily adherence from `logs/` and `GOALS.md`

