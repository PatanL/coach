# Heartbeat checklist

If there is an open “agent” task:
1) Pick ONE smallest task.
2) Implement on a branch.
3) Run tests and lint.
4) If green: open PR + message summary, commands, and results.
5) If red: fix or stop + message failing output and hypothesis.

If no tasks:
- Run a quick health sweep: flaky tests, dependency alerts, TODO hotspots.
- Propose 1-2 high-value next tasks, don’t implement.

Always:
- Keep user data privacy and consent explicit.
- Avoid large dependency bumps unless requested.
