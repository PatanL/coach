#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import os
import subprocess
import time
import uuid
from collections import deque
from pathlib import Path
from typing import Optional, Tuple, List

try:
    from coach import voice
except ImportError:
    import sys

    sys.path.append(str(Path(__file__).resolve().parents[1]))
    try:
        from coach import voice
    except ImportError:
        voice = None

EVENT_TYPES = {
    "DRIFT_START",
    "DRIFT_PERSIST",
    "RECOVER_TRIGGER",
    "BLOCK_BOUNDARY",
    "STUCK",
    "ALIGN_REQUIRED",
    "ALIGN_ANSWER",
    "BLOCK_START",
    "BLOCK_END",
    "LATE",
    "OFF_SCHEDULE",
    "HABIT_DUE",
    "HABIT_ESCALATE",
    "HABIT_DONE",
    "SCHEDULE_COMMITTED",
    "SCHEDULE_UPDATED",
}

ALIGN_QUESTIONS = [
    {
        "id": "start_time",
        "text": "Start time today?",
        "choices": ["09:00", "09:30", "10:00", "10:30"],
    },
    {
        "id": "end_time",
        "text": "End time today?",
        "choices": ["17:00", "18:00", "19:00", "20:00"],
    },
    {
        "id": "focus_block",
        "text": "Primary focus block?",
        "choices": ["Eval harness", "Research", "Features", "Bugfix"],
    },
    {
        "id": "break_cadence",
        "text": "Break cadence?",
        "choices": ["60m", "90m", "120m"],
    },
    {
        "id": "gym_today",
        "text": "Gym today?",
        "choices": ["Yes", "No"],
    },
    {
        "id": "meditate",
        "text": "Meditation today?",
        "choices": ["Yes", "No"],
    },
]


def run(cmd: list) -> Tuple[int, str, str]:
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    out, err = proc.communicate()
    return proc.returncode, out.strip(), err.strip()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def read_json(path: Path) -> Optional[dict]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def read_alignment(path: Path) -> dict:
    data = read_json(path) or {"step": 0, "answers": {}}
    if "step" not in data:
        data["step"] = 0
    if "answers" not in data:
        data["answers"] = {}
    return data


def read_off_schedule_state(path: Path) -> dict:
    return read_json(path) or {
        "block_id": None,
        "since": None,
        "last_emitted": None,
        "recover_triggered": False,
    }


def read_habit_state(path: Path) -> dict:
    return read_json(path) or {
        "block_id": None,
        "due_at": None,
        "escalated": False,
        "done": False,
    }


def read_align_prompted(path: Path) -> dict:
    return read_json(path) or {"question_id": None, "prompted_at": None}


def read_current_block_state(path: Path) -> dict:
    return read_json(path) or {"block_id": None, "block_type": None, "block_name": None}


def block_overlay_payload(
    block: dict, level: str, headline: str, human_line: str, next_action: str
) -> dict:
    return {
        "ts": dt.datetime.now().isoformat(),
        "cmd_id": ensure_uuid(),
        "source_event_id": None,
        "source": "runner",
        "level": level,
        "style_id": "calm",
        "headline": headline,
        "human_line": human_line,
        "diagnosis": "",
        "next_action": next_action,
        "block_id": block.get("id"),
        "block_name": block.get("title", ""),
    }


def log_path_for_day(path: Path, day: dt.date) -> Path:
    stamp = day.isoformat()
    return path.with_name(f"{path.stem}_{stamp}{path.suffix}")


def prune_logs(log_dir: Path, stem: str, keep_days: int) -> None:
    if keep_days <= 0:
        return
    cutoff = dt.datetime.now().date() - dt.timedelta(days=keep_days)
    for path in log_dir.glob(f"{stem}_*.ndjson"):
        suffix = path.stem[len(stem) + 1 :]
        try:
            stamp = dt.datetime.strptime(suffix, "%Y-%m-%d").date()
        except ValueError:
            continue
        if stamp < cutoff:
            try:
                path.unlink()
            except Exception:
                pass


def daily_log_path(base_path: Path, now: dt.datetime) -> Path:
    return log_path_for_day(base_path, now.date())


def minutes_between(start: dt.datetime, end: dt.datetime) -> int:
    return max(0, int((end - start).total_seconds() // 60))


def add_minutes(ts: dt.datetime, minutes: int) -> dt.datetime:
    return ts + dt.timedelta(minutes=minutes)


def format_time(ts: dt.datetime) -> str:
    return ts.strftime("%H:%M")


def parse_minutes(value: str, fallback: int) -> int:
    try:
        return int(value.replace("m", ""))
    except Exception:
        return fallback


def remaining_blocks(schedule: dict, now: dt.datetime) -> list:
    remaining = []
    for block in schedule.get("blocks", []):
        end = parse_time(block.get("end", ""), now.date())
        if not end:
            continue
        if end > now:
            remaining.append(block)
    return remaining


def schedule_to_yaml(schedule: dict) -> str:
    lines = [
        f"timezone: {schedule.get('timezone', 'America/Los_Angeles')}",
        f"day: {schedule.get('day', dt.date.today().isoformat())}",
        "blocks:",
    ]
    for block in schedule.get("blocks", []):
        lines.append(f"  - id: {block.get('id', '')}")
        lines.append(f'    start: "{block.get("start", "")}"')
        lines.append(f'    end: "{block.get("end", "")}"')
        lines.append(f"    type: {block.get('type', '')}")
        if block.get("habit_kind"):
            lines.append(f"    habit_kind: {block.get('habit_kind')}")
        lines.append(f"    title: {block.get('title', '')}")
        lines.append(f"    intent: {block.get('intent', '')}")
    return "\n".join(lines) + "\n"


def apply_recover_fallback(schedule: dict, now: dt.datetime) -> str:
    shift_minutes = 30
    updated = {
        "timezone": schedule.get("timezone", "America/Los_Angeles"),
        "day": schedule.get("day", now.date().isoformat()),
        "blocks": [],
    }
    for block in schedule.get("blocks", []):
        start = parse_time(block.get("start", ""), now.date())
        end = parse_time(block.get("end", ""), now.date())
        if start and end and end > now:
            start = add_minutes(start, shift_minutes)
            end = add_minutes(end, shift_minutes)
            updated_block = dict(block)
            updated_block["start"] = format_time(start)
            updated_block["end"] = format_time(end)
        else:
            updated_block = dict(block)
        updated["blocks"].append(updated_block)
    return schedule_to_yaml(updated)


def parse_schedule_value(value: str) -> str:
    if "#" in value:
        value = value.split("#", 1)[0]
    return value.strip().strip('"')


def build_daily_schedule(answers: dict) -> str:
    day = dt.date.today()
    start_time = answers.get("start_time", "09:00")
    end_time = answers.get("end_time", "17:00")
    focus_block = answers.get("focus_block", "Focus")
    break_cadence = parse_minutes(answers.get("break_cadence", "90m"), 90)
    gym_today = answers.get("gym_today", "No") == "Yes"
    meditate_today = answers.get("meditate", "No") == "Yes"

    start_dt = parse_time(start_time, day) or parse_time("09:00", day)
    end_dt = parse_time(end_time, day) or parse_time("17:00", day)
    if not start_dt or not end_dt or end_dt <= start_dt:
        start_dt = parse_time("09:00", day)
        end_dt = parse_time("17:00", day)
    if not start_dt or not end_dt:
        return ""

    blocks = []
    cursor = start_dt
    focus_cycle = 0

    session_end = end_dt
    gym_duration = 10
    gym_start = None
    if gym_today:
        gym_start = add_minutes(end_dt, -gym_duration)
        if gym_start > start_dt:
            session_end = gym_start
        else:
            gym_start = None

    if meditate_today:
        meditate_end = add_minutes(cursor, 10)
        blocks.append(
            {
                "id": f"meditation_{day.isoformat()}",
                "start": format_time(cursor),
                "end": format_time(meditate_end),
                "type": "habit",
                "habit_kind": "meditation",
                "title": "Meditation",
                "intent": "10 minute reset",
            }
        )
        cursor = meditate_end

    while cursor < session_end:
        next_work_end = min(add_minutes(cursor, break_cadence), session_end)
        blocks.append(
            {
                "id": f"work_{focus_cycle}",
                "start": format_time(cursor),
                "end": format_time(next_work_end),
                "type": "coding",
                "title": focus_block,
                "intent": f"Focus on {focus_block}",
            }
        )
        cursor = next_work_end
        focus_cycle += 1
        if cursor >= session_end:
            break
        break_end = min(add_minutes(cursor, 10), session_end)
        if break_end > cursor:
            blocks.append(
                {
                    "id": f"break_{focus_cycle}",
                    "start": format_time(cursor),
                    "end": format_time(break_end),
                    "type": "habit",
                    "habit_kind": "break",
                    "title": "Break",
                    "intent": "Stand and stretch",
                }
            )
        cursor = break_end

        if cursor >= session_end:
            break
        water_end = min(add_minutes(cursor, 2), session_end)
        if water_end > cursor:
            blocks.append(
                {
                    "id": f"water_{focus_cycle}",
                    "start": format_time(cursor),
                    "end": format_time(water_end),
                    "type": "habit",
                    "habit_kind": "water",
                    "title": "Water",
                    "intent": "Drink water",
                }
            )
        cursor = water_end

    if gym_start:
        gym_end = add_minutes(gym_start, gym_duration)
        blocks.append(
            {
                "id": f"gym_{day.isoformat()}",
                "start": format_time(gym_start),
                "end": format_time(gym_end),
                "type": "habit",
                "habit_kind": "gym",
                "title": "Gym",
                "intent": "Workout",
            }
        )

    lines = [f"timezone: America/Los_Angeles", f"day: {day.isoformat()}", "blocks:"]
    for block in blocks:
        lines.append(f"  - id: {block['id']}")
        lines.append(f'    start: "{block["start"]}"')
        lines.append(f'    end: "{block["end"]}"')
        lines.append(f"    type: {block['type']}")
        if block.get("habit_kind"):
            lines.append(f"    habit_kind: {block['habit_kind']}")
        lines.append(f"    title: {block['title']}")
        lines.append(f"    intent: {block['intent']}")
    return "\n".join(lines) + "\n"


def read_schedule(path: Path) -> Optional[dict]:
    if not path.exists():
        return None
    data: dict = {"blocks": []}
    data_blocks: List[dict] = data["blocks"]
    current_block: Optional[dict] = None
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        if not line or line.strip().startswith("#"):
            continue
        if line.strip() == "blocks: []":
            data["blocks"] = []
            data_blocks = data["blocks"]
            continue
        if line.strip() == "blocks:":
            data["blocks"] = []
            data_blocks = data["blocks"]
            continue
        if ":" in line and not line.startswith(" "):
            key, value = line.split(":", 1)
            key_name = key.strip()
            data[key_name] = parse_schedule_value(value)
            continue
        if line.lstrip().startswith("-"):
            entry = line.lstrip()[1:].strip()
            if not entry.startswith("id:"):
                continue
            current_block = {}
            data_blocks.append(current_block)
            key, value = entry.split(":", 1)
            current_block[key.strip()] = parse_schedule_value(value)
            continue
        if current_block is not None and ":" in line:
            key, value = line.strip().split(":", 1)
            current_block[key.strip()] = parse_schedule_value(value)
    return data


def write_schedule(path: Path, schedule: dict) -> None:
    lines = []
    lines.append(f"timezone: {schedule.get('timezone', 'America/Los_Angeles')}")
    lines.append(f"day: {schedule.get('day', '')}")
    lines.append("blocks:")
    for block in schedule.get("blocks", []):
        lines.append(f"  - id: {block.get('id')}")
        lines.append(f'    start: "{block.get("start")}"')
        lines.append(f'    end: "{block.get("end")}"')
        lines.append(f"    type: {block.get('type')}")
        if block.get("habit_kind"):
            lines.append(f"    habit_kind: {block.get('habit_kind')}")
        lines.append(f"    title: {block.get('title')}")
        lines.append(f"    intent: {block.get('intent')}")
        allowed = block.get("allowed_apps")
        if allowed:
            lines.append(f"    allowed_apps: {allowed}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def is_today(schedule: dict) -> bool:
    try:
        return schedule.get("day") == dt.date.today().isoformat()
    except Exception:
        return False


def parse_time(value: str, day: dt.date) -> Optional[dt.datetime]:
    try:
        hour, minute = [int(part) for part in value.split(":")]
        return dt.datetime.combine(day, dt.time(hour=hour, minute=minute))
    except Exception:
        return None


def current_block(schedule: dict, now: dt.datetime) -> Optional[dict]:
    blocks = schedule.get("blocks", [])
    for block in blocks:
        start = parse_time(block.get("start", ""), now.date())
        end = parse_time(block.get("end", ""), now.date())
        if not start or not end:
            continue
        if start <= now < end:
            return block
    return None


def schedule_needs_alignment(schedule_path: Path) -> bool:
    schedule = read_schedule(schedule_path)
    if not schedule:
        return True
    return not is_today(schedule)


def read_tail_lines(path: Path, max_lines: int) -> list:
    if not path.exists():
        return []
    return path.read_text(encoding="utf-8").splitlines()[-max_lines:]


def append_ndjson(path: Path, row: dict) -> None:
    ensure_dir(path.parent)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=True) + "\n")


def append_overlay_cmd(path: Path, payload: dict) -> None:
    ensure_dir(path.parent)
    path.write_text("", encoding="utf-8")
    append_ndjson(path, payload)
    history_path = path.with_name(
        path.stem.replace("overlay_cmd", "overlay_cmd_history") + path.suffix
    )
    append_ndjson(history_path, payload)


def write_json(path: Path, data: dict) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(data, ensure_ascii=True, indent=2), encoding="utf-8")


def ensure_uuid() -> str:
    return str(uuid.uuid4())


def tail_file(path: Path, offset: int) -> Tuple[int, list]:
    if not path.exists():
        return offset, []
    with path.open("r", encoding="utf-8") as f:
        f.seek(offset)
        data = f.read()
        new_offset = f.tell()
    if data and not data.endswith("\n"):
        return offset, []
    lines = [line for line in data.splitlines() if line.strip()]
    return new_offset, lines


def append_event(path: Path, payload: dict) -> None:
    append_ndjson(path, payload)


def read_last_activity(path: Path) -> Optional[dict]:
    lines = read_tail_lines(path, 1)
    if not lines:
        return None
    try:
        return json.loads(lines[0])
    except json.JSONDecodeError:
        return None


def parse_json_from_text(raw: str) -> Optional[dict]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        lines = [line.strip() for line in raw.splitlines() if line.strip()]
        for line in reversed(lines):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
    return None


def call_coach_plan(message: str, files: Optional[list] = None) -> Optional[dict]:
    cmd = ["opencode", "run", "--agent", "coach_plan"]
    if files:
        for file_path in files:
            cmd += ["-f", str(file_path)]
    cmd += ["--", message]
    code, out, err = run(cmd)
    if code != 0:
        if err:
            print(f"coach_plan error: {err}")
        return None
    return parse_json_from_text(out)


def build_prompt(
    event_line: str,
    activity_lines: list,
    now_payload: dict,
    last_action: Optional[dict],
) -> str:
    return (
        "You are coach_plan. Do not call tools. Output JSON only.\n"
        "Return an object with keys: overlay (object), hud_text (string), notification_text (string), speech_text (string).\n"
        "overlay must include: level, style_id, headline, human_line, diagnosis, next_action, block_id, block_name.\n"
        "Use context to reference the current task or distraction path.\n"
        "If you cannot infer details, default to level A (unless it was mentioned to force level B), style_id 'calm', and short text.\n"
        "Use the attached files for context (event, activity tail, now, last action, goals).\n"
        f"Event line: {event_line}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Coach event runner")
    parser.add_argument(
        "--events-log",
        type=Path,
        default=Path("coach/logs/events.ndjson"),
        help="Events log path (date suffix auto-applied)",
    )
    parser.add_argument(
        "--schedule",
        type=Path,
        default=Path("coach/state/schedule.yaml"),
        help="Schedule file path",
    )
    parser.add_argument(
        "--align-state",
        type=Path,
        default=Path("coach/state/align_state.json"),
        help="Alignment state path",
    )
    parser.add_argument(
        "--activity-log",
        type=Path,
        default=Path("coach/logs/activity.ndjson"),
        help="Activity log path (date suffix auto-applied)",
    )
    parser.add_argument(
        "--overlay-actions",
        type=Path,
        default=Path("coach/logs/overlay_actions.ndjson"),
        help="Overlay action log path (date suffix auto-applied)",
    )
    parser.add_argument(
        "--overlay-cmd",
        type=Path,
        default=Path("coach/logs/overlay_cmd.ndjson"),
        help="Overlay command output path (date suffix auto-applied)",
    )
    parser.add_argument(
        "--hud",
        type=Path,
        default=Path("coach/hud/COACH_HUD.md"),
        help="HUD output path",
    )
    parser.add_argument(
        "--cooldown-seconds",
        type=int,
        default=60,
        help="Minimum seconds between nudges (0=disable)",
    )
    parser.add_argument(
        "--align-min-interval",
        type=int,
        default=10,
        help="Seconds between alignment overlay prompts",
    )
    parser.add_argument(
        "--max-per-hour",
        type=int,
        default=0,
        help="Max nudges per hour (0=disable)",
    )
    parser.add_argument(
        "--pause-mins",
        type=int,
        default=15,
        help="Pause duration minutes",
    )
    parser.add_argument(
        "--max-seconds",
        type=int,
        default=0,
        help="Exit after N seconds (0=run forever)",
    )
    parser.add_argument(
        "--log-keep-days",
        type=int,
        default=7,
        help="Days of log retention for daily ndjson logs",
    )
    args = parser.parse_args()

    events_offset = 0
    actions_offset = 0
    last_nudge = None
    pause_until = None
    nudge_times = deque()
    last_align_prompt = None

    now = dt.datetime.now()
    current_day = now.date()
    events_log = daily_log_path(args.events_log, now)
    activity_log = daily_log_path(args.activity_log, now)
    overlay_actions_log = daily_log_path(args.overlay_actions, now)
    overlay_cmd_log = daily_log_path(args.overlay_cmd, now)
    speech_log = daily_log_path(Path("coach/logs/speech.ndjson"), now)
    ensure_dir(events_log.parent)
    ensure_dir(activity_log.parent)
    ensure_dir(overlay_actions_log.parent)
    ensure_dir(overlay_cmd_log.parent)
    ensure_dir(speech_log.parent)
    if not overlay_actions_log.exists():
        overlay_actions_log.write_text("", encoding="utf-8")
    if not overlay_cmd_log.exists():
        overlay_cmd_log.write_text("", encoding="utf-8")
    if not speech_log.exists():
        speech_log.write_text("", encoding="utf-8")

    print("Runner active. Watching for events.")
    start_time = dt.datetime.now()

    prune_logs(args.activity_log.parent, args.activity_log.stem, args.log_keep_days)
    prune_logs(args.events_log.parent, args.events_log.stem, args.log_keep_days)
    prune_logs(args.overlay_cmd.parent, args.overlay_cmd.stem, args.log_keep_days)
    prune_logs(
        args.overlay_actions.parent, args.overlay_actions.stem, args.log_keep_days
    )
    prune_logs(speech_log.parent, "speech", args.log_keep_days)

    current_block_path = Path("coach/state/current_block.json")
    goals_path = Path("coach/state/goals.json")

    while True:
        actions_offset, action_lines = tail_file(overlay_actions_log, actions_offset)
        for line in action_lines:
            try:
                action = json.loads(line)
            except json.JSONDecodeError:
                continue
            if action.get("action") == "pause_15":
                pause_until = dt.datetime.now() + dt.timedelta(minutes=args.pause_mins)
            if action.get("action") == "align_choice":
                align_state = read_alignment(args.align_state)
                qid = action.get("question_id")
                if qid:
                    align_state["answers"][qid] = action.get("value")
                for idx, q in enumerate(ALIGN_QUESTIONS):
                    if q["id"] not in align_state["answers"]:
                        align_state["step"] = idx
                        break
                else:
                    align_state["step"] = len(ALIGN_QUESTIONS)
                write_json(args.align_state, align_state)
                append_event(
                    events_log,
                    {
                        "ts": dt.datetime.now().isoformat(),
                        "type": "ALIGN_ANSWER",
                        "event_id": ensure_uuid(),
                        "question_id": qid,
                        "answer": action.get("value"),
                        "source": "overlay",
                    },
                )
                last_align_prompt = None
                write_json(
                    Path("coach/state/align_prompted.json"),
                    {"question_id": None, "prompted_at": None},
                )
            if action.get("action") == "back_on_track":
                habit_state_path = Path("coach/state/last_habit.json")
                habit_state = read_habit_state(habit_state_path)
                schedule = read_schedule(args.schedule) or {"blocks": []}
                current = (
                    current_block(schedule, dt.datetime.now()) if schedule else None
                )
                if (
                    current
                    and current.get("type") == "habit"
                    and action.get("block_id")
                    and action.get("block_id") == habit_state.get("block_id")
                    and not habit_state.get("done")
                ):
                    append_event(
                        events_log,
                        {
                            "ts": dt.datetime.now().isoformat(),
                            "type": "HABIT_DONE",
                            "event_id": ensure_uuid(),
                            "source": "overlay",
                        },
                    )
                    habit_state["done"] = True
                    write_json(habit_state_path, habit_state)
                else:
                    append_event(
                        events_log,
                        {
                            "ts": dt.datetime.now().isoformat(),
                            "type": "NUDGE_ACK",
                            "event_id": ensure_uuid(),
                            "source": "overlay",
                        },
                    )
            if action.get("action") == "recover":
                schedule_before = (
                    args.schedule.read_text(encoding="utf-8")
                    if args.schedule.exists()
                    else ""
                )
                schedule = read_schedule(args.schedule) or {"blocks": []}
                remaining = remaining_blocks(schedule, dt.datetime.now())
                activity_tail = read_tail_lines(activity_log, 5)
                off_state = read_off_schedule_state(
                    Path("coach/state/off_schedule_state.json")
                )
                current_block_state = read_current_block_state(
                    Path("coach/state/current_block.json")
                )
                recover_context = {
                    "now": dt.datetime.now().isoformat(),
                    "remaining_blocks": remaining,
                    "activity_tail": activity_tail,
                    "off_schedule_state": off_state,
                    "last_habit": read_habit_state(Path("coach/state/last_habit.json")),
                    "current_block": current_block_state,
                }
                Path("coach/state/recover_context.json").write_text(
                    json.dumps(recover_context, ensure_ascii=True, indent=2),
                    encoding="utf-8",
                )
                recover_prompt = (
                    "RECOVER_MODE: Update schedule YAML based on remaining blocks. "
                    "Overlay must state what changed."
                )
                response = call_coach_plan(
                    recover_prompt,
                    files=[
                        args.schedule,
                        Path("coach/state/recover_context.json"),
                        Path("coach/state/now.json"),
                        Path("coach/state/last_habit.json"),
                        Path("coach/state/off_schedule_state.json"),
                        Path("coach/state/current_block.json"),
                        goals_path,
                    ],
                )
                revised_yaml = None
                if isinstance(response, dict):
                    revised_yaml = response.get("revised_schedule_yaml")
                if not revised_yaml and schedule.get("blocks"):
                    revised_yaml = apply_recover_fallback(schedule, dt.datetime.now())
                if revised_yaml:
                    args.schedule.write_text(revised_yaml, encoding="utf-8")
                    append_event(
                        events_log,
                        {
                            "ts": dt.datetime.now().isoformat(),
                            "type": "SCHEDULE_UPDATED",
                            "event_id": ensure_uuid(),
                            "source": "runner",
                        },
                    )
                    overlay = (
                        response.get("overlay") if isinstance(response, dict) else None
                    )
                    if isinstance(overlay, dict):
                        overlay_payload = {
                            "ts": dt.datetime.now().isoformat(),
                            "cmd_id": ensure_uuid(),
                            "source_event_id": None,
                            "source": "runner",
                            **overlay,
                        }
                    else:
                        overlay_payload = {
                            "ts": dt.datetime.now().isoformat(),
                            "cmd_id": ensure_uuid(),
                            "source_event_id": None,
                            "source": "runner",
                            "level": "B",
                            "style_id": "calm",
                            "headline": "New plan accepted",
                            "human_line": "Schedule updated.",
                            "diagnosis": "",
                            "next_action": "Resume the next block.",
                            "block_id": None,
                            "block_name": "",
                        }
                    append_overlay_cmd(overlay_cmd_log, overlay_payload)
                    Path("coach/state/schedule.before.yaml").write_text(
                        schedule_before, encoding="utf-8"
                    )

        now = dt.datetime.now()
        if now.date() != current_day:
            current_day = now.date()
            events_log = daily_log_path(args.events_log, now)
            activity_log = daily_log_path(args.activity_log, now)
            overlay_actions_log = daily_log_path(args.overlay_actions, now)
            overlay_cmd_log = daily_log_path(args.overlay_cmd, now)
            speech_log = daily_log_path(Path("coach/logs/speech.ndjson"), now)
            actions_offset = 0
            events_offset = 0
            ensure_dir(events_log.parent)
            ensure_dir(activity_log.parent)
            ensure_dir(overlay_actions_log.parent)
            ensure_dir(overlay_cmd_log.parent)
            ensure_dir(speech_log.parent)
            if not overlay_actions_log.exists():
                overlay_actions_log.write_text("", encoding="utf-8")
            if not overlay_cmd_log.exists():
                overlay_cmd_log.write_text("", encoding="utf-8")
            if not speech_log.exists():
                speech_log.write_text("", encoding="utf-8")

        if pause_until and now < pause_until:
            time.sleep(0.5)
            continue

        schedule = read_schedule(args.schedule)

        if schedule and is_today(schedule):
            block = current_block(schedule, now)
            habit_state_path = Path("coach/state/last_habit.json")
            off_state_path = Path("coach/state/off_schedule_state.json")

            if block:
                current_state = read_current_block_state(current_block_path)
                if current_state.get("block_id") != block.get("id"):
                    if current_state.get("block_id"):
                        append_event(
                            events_log,
                            {
                                "ts": now.isoformat(),
                                "type": "BLOCK_END",
                                "event_id": ensure_uuid(),
                                "block_id": current_state.get("block_id"),
                                "block_name": current_state.get("block_name"),
                                "source": "runner",
                            },
                        )
                    append_event(
                        events_log,
                        {
                            "ts": now.isoformat(),
                            "type": "BLOCK_START",
                            "event_id": ensure_uuid(),
                            "block_id": block.get("id"),
                            "block_name": block.get("title"),
                            "source": "runner",
                        },
                    )
                    if block.get("type") in ["coding", "research", "admin"]:
                        overlay_payload = block_overlay_payload(
                            block,
                            "A",
                            "Start now",
                            f"Begin {block.get('title', 'work')}",
                            block.get("intent", "Start now"),
                        )
                        append_overlay_cmd(overlay_cmd_log, overlay_payload)
                    elif block.get("type") == "habit":
                        overlay_payload = block_overlay_payload(
                            block,
                            "A",
                            "Do it now",
                            block.get("title", "Habit"),
                            block.get("intent", "Do it now"),
                        )
                        append_overlay_cmd(overlay_cmd_log, overlay_payload)
                    write_json(
                        current_block_path,
                        {
                            "block_id": block.get("id"),
                            "block_type": block.get("type"),
                            "block_name": block.get("title"),
                        },
                    )
            else:
                current_state = read_current_block_state(current_block_path)
                if current_state.get("block_id"):
                    append_event(
                        events_log,
                        {
                            "ts": now.isoformat(),
                            "type": "BLOCK_END",
                            "event_id": ensure_uuid(),
                            "block_id": current_state.get("block_id"),
                            "block_name": current_state.get("block_name"),
                            "source": "runner",
                        },
                    )
                    write_json(
                        current_block_path,
                        {"block_id": None, "block_type": None, "block_name": None},
                    )

            if block and block.get("type") == "habit":
                habit_state = read_habit_state(habit_state_path)
                if habit_state.get("block_id") != block.get("id"):
                    append_event(
                        events_log,
                        {
                            "ts": now.isoformat(),
                            "type": "HABIT_DUE",
                            "event_id": ensure_uuid(),
                            "block_id": block.get("id"),
                            "block_name": block.get("title"),
                            "habit_kind": block.get("habit_kind"),
                            "message": f"{block.get('title')} now.",
                            "next_action": block.get("intent", "Do it now"),
                            "source": "runner",
                        },
                    )
                    write_json(
                        habit_state_path,
                        {
                            "block_id": block.get("id"),
                            "due_at": now.isoformat(),
                            "escalated": False,
                            "done": False,
                        },
                    )
                else:
                    due_at = habit_state.get("due_at")
                    if (
                        due_at
                        and not habit_state.get("done")
                        and not habit_state.get("escalated")
                    ):
                        try:
                            due_time = dt.datetime.fromisoformat(due_at)
                            if (now - due_time).total_seconds() >= 120:
                                append_event(
                                    events_log,
                                    {
                                        "ts": now.isoformat(),
                                        "type": "HABIT_ESCALATE",
                                        "event_id": ensure_uuid(),
                                        "block_id": block.get("id"),
                                        "block_name": block.get("title"),
                                        "habit_kind": block.get("habit_kind"),
                                        "message": f"{block.get('title')} overdue.",
                                        "next_action": block.get("intent", "Do it now"),
                                        "source": "runner",
                                    },
                                )
                                habit_state["escalated"] = True
                                write_json(habit_state_path, habit_state)
                        except ValueError:
                            pass
            if block and block.get("type") in ["coding", "research", "admin"]:
                last_activity = read_last_activity(activity_log)
                if last_activity and last_activity.get("status") == "off_task":
                    off_state = read_off_schedule_state(off_state_path)
                    if off_state.get("block_id") != block.get("id"):
                        append_event(
                            events_log,
                            {
                                "ts": now.isoformat(),
                                "type": "OFF_SCHEDULE",
                                "event_id": ensure_uuid(),
                                "block_id": block.get("id"),
                                "block_name": block.get("title"),
                                "source": "runner",
                            },
                        )
                        write_json(
                            off_state_path,
                            {
                                "block_id": block.get("id"),
                                "since": now.isoformat(),
                                "last_emitted": now.isoformat(),
                                "recover_triggered": False,
                            },
                        )
                    else:
                        since = off_state.get("since")
                        if since and not off_state.get("recover_triggered"):
                            try:
                                since_time = dt.datetime.fromisoformat(since)
                                if (now - since_time).total_seconds() >= 600:
                                    append_event(
                                        events_log,
                                        {
                                            "ts": now.isoformat(),
                                            "type": "RECOVER_TRIGGER",
                                            "event_id": ensure_uuid(),
                                            "block_id": block.get("id"),
                                            "block_name": block.get("title"),
                                            "source": "runner",
                                        },
                                    )
                                    off_state["recover_triggered"] = True
                                    write_json(off_state_path, off_state)
                            except ValueError:
                                pass
                elif last_activity and last_activity.get("status") == "on_task":
                    write_json(
                        off_state_path,
                        {
                            "block_id": None,
                            "since": None,
                            "last_emitted": None,
                            "recover_triggered": False,
                        },
                    )

        if schedule_needs_alignment(args.schedule):
            align_state = read_alignment(args.align_state)
            step = align_state.get("step", 0)
            if step >= len(ALIGN_QUESTIONS):
                schedule_yaml = build_daily_schedule(align_state.get("answers", {}))
                if schedule_yaml:
                    args.schedule.parent.mkdir(parents=True, exist_ok=True)
                    args.schedule.write_text(schedule_yaml, encoding="utf-8")
                    append_event(
                        events_log,
                        {
                            "ts": now.isoformat(),
                            "type": "SCHEDULE_COMMITTED",
                            "event_id": ensure_uuid(),
                            "source": "runner",
                        },
                    )
                    args.align_state.unlink(missing_ok=True)
                    continue
                time.sleep(0.5)
                continue

            align_prompted_path = Path("coach/state/align_prompted.json")
            align_prompted = read_align_prompted(align_prompted_path)
            if align_prompted.get("question_id") == ALIGN_QUESTIONS[step]["id"]:
                prompted_at_value = align_prompted.get("prompted_at")
                if prompted_at_value:
                    try:
                        prompted_at = dt.datetime.fromisoformat(prompted_at_value)
                        if (
                            now - prompted_at
                        ).total_seconds() < args.align_min_interval:
                            time.sleep(0.5)
                            continue
                    except ValueError:
                        pass

            question = ALIGN_QUESTIONS[step]

            append_event(
                events_log,
                {
                    "ts": now.isoformat(),
                    "type": "ALIGN_REQUIRED",
                    "event_id": ensure_uuid(),
                    "question_id": question["id"],
                    "question": question["text"],
                    "choices": question["choices"],
                    "source": "runner",
                },
            )
            overlay_payload = {
                "ts": now.isoformat(),
                "cmd_id": ensure_uuid(),
                "source_event_id": None,
                "source": "runner",
                "level": "B",
                "style_id": "calm",
                "headline": "ALIGN REQUIRED",
                "human_line": question["text"],
                "diagnosis": "Answer to commit today’s schedule.",
                "next_action": "Pick one option.",
                "block_id": None,
                "block_name": "Alignment",
                "choices": question["choices"],
                "question_id": question["id"],
            }
            append_overlay_cmd(overlay_cmd_log, overlay_payload)
            write_json(args.align_state, align_state)
            write_json(
                align_prompted_path,
                {"question_id": question["id"], "prompted_at": now.isoformat()},
            )
            last_align_prompt = now
            time.sleep(0.5)
            continue

        events_offset, event_lines = tail_file(events_log, events_offset)
        if event_lines:
            print(f"runner: read {len(event_lines)} event(s)")
        for event_line in event_lines:
            try:
                event = json.loads(event_line)
            except json.JSONDecodeError:
                continue

            if event.get("type") not in EVENT_TYPES:
                continue

            if event.get("type") == "OFF_SCHEDULE":
                overlay_payload = {
                    "ts": dt.datetime.now().isoformat(),
                    "cmd_id": ensure_uuid(),
                    "source_event_id": event.get("event_id"),
                    "source": "runner",
                    "level": "B",
                    "style_id": "strict",
                    "headline": "Off schedule",
                    "human_line": "You drifted off the current block.",
                    "diagnosis": "Resume the scheduled task.",
                    "next_action": "Return to the planned work block now.",
                    "block_id": event.get("block_id"),
                    "block_name": event.get("block_name", ""),
                }
                append_overlay_cmd(overlay_cmd_log, overlay_payload)
                print("runner: OFF_SCHEDULE overlay queued")
                continue

            if event.get("type") == "HABIT_DUE":
                overlay_payload = {
                    "ts": dt.datetime.now().isoformat(),
                    "cmd_id": ensure_uuid(),
                    "source_event_id": event.get("event_id"),
                    "source": "runner",
                    "level": "A",
                    "style_id": "calm",
                    "headline": event.get("habit_kind", "Habit"),
                    "human_line": event.get("message", "Habit due"),
                    "diagnosis": "Quick habit now.",
                    "next_action": event.get("next_action", "Do it now"),
                    "block_id": event.get("block_id"),
                    "block_name": event.get("block_name", ""),
                }
                append_overlay_cmd(overlay_cmd_log, overlay_payload)
                continue

            if event.get("type") == "HABIT_ESCALATE":
                overlay_payload = {
                    "ts": dt.datetime.now().isoformat(),
                    "cmd_id": ensure_uuid(),
                    "source_event_id": event.get("event_id"),
                    "source": "runner",
                    "level": "B",
                    "style_id": "strict",
                    "headline": "Habit overdue",
                    "human_line": event.get("message", "Habit overdue"),
                    "diagnosis": "Do the habit now.",
                    "next_action": event.get("next_action", "Do it now"),
                    "block_id": event.get("block_id"),
                    "block_name": event.get("block_name", ""),
                }
                append_overlay_cmd(overlay_cmd_log, overlay_payload)
                continue

            print(f"runner: event {event.get('type')} id={event.get('event_id')}")

            now = dt.datetime.now()
            if (
                args.cooldown_seconds > 0
                and last_nudge
                and (now - last_nudge).total_seconds() < args.cooldown_seconds
            ):
                continue

            if args.max_per_hour > 0:
                while nudge_times and (now - nudge_times[0]).total_seconds() > 3600:
                    nudge_times.popleft()
                if len(nudge_times) >= args.max_per_hour:
                    continue

            activity_tail = read_tail_lines(activity_log, 5)
            now_payload = read_json(Path("coach/state/now.json")) or {}
            last_action_lines = read_tail_lines(overlay_actions_log, 1)
            last_action = None
            if last_action_lines:
                try:
                    last_action = json.loads(last_action_lines[0])
                except json.JSONDecodeError:
                    last_action = None

            context_payload = {
                "event": event,
                "activity_tail": activity_tail,
                "now": now_payload,
                "last_overlay_action": last_action,
            }
            Path("coach/runner_context.json").write_text(
                json.dumps(context_payload, ensure_ascii=True, indent=2),
                encoding="utf-8",
            )

            prompt = build_prompt(event_line, activity_tail, now_payload, last_action)
            if event.get("type") in ["DRIFT_START", "DRIFT_PERSIST"]:
                prompt = "Force level B overlay for drift.\n" + prompt
            response = call_coach_plan(
                prompt,
                files=[
                    Path("coach/state/now.json"),
                    activity_log,
                    overlay_actions_log,
                    Path("coach/runner_context.json"),
                    goals_path,
                ],
            )
            source_event_id = event.get("event_id")
            if source_event_id is None:
                print("runner: event missing event_id")
            if not response:
                print("runner: no response from coach_plan")
                continue

            overlay = response.get("overlay")
            if isinstance(overlay, dict):
                event_type = event.get("type")
                if event_type in ["DRIFT_START", "DRIFT_PERSIST"]:
                    overlay = dict(overlay)
                    overlay["level"] = "B"
                    if event_type == "DRIFT_PERSIST":
                        # Deterministic visual pattern-break in the overlay to interrupt autopilot.
                        overlay["style_id"] = "pattern_break"
                cmd_id = ensure_uuid()
                source_event_id = event.get("event_id")
                overlay_payload = {
                    "ts": dt.datetime.now().isoformat(),
                    "cmd_id": cmd_id,
                    "source_event_id": source_event_id,
                    "event_type": event_type,
                    "source": "runner",
                    **overlay,
                }
                append_overlay_cmd(overlay_cmd_log, overlay_payload)
                print(
                    f"runner: wrote overlay command source_event_id={source_event_id}"
                )

            hud_text = response.get("hud_text", "")
            if isinstance(hud_text, str) and hud_text.strip():
                args.hud.write_text(hud_text, encoding="utf-8")

            speech_text = response.get("speech_text")
            if voice and isinstance(speech_text, str) and speech_text.strip():
                print(f"runner: voice speak: {speech_text}")
                append_ndjson(
                    speech_log,
                    {
                        "ts": dt.datetime.now().isoformat(),
                        "event_id": event.get("event_id"),
                        "event_type": event.get("type"),
                        "speech_text": speech_text,
                        "headline": overlay.get("headline") if isinstance(overlay, dict) else None,
                        "block_id": overlay.get("block_id") if isinstance(overlay, dict) else None,
                        "block_name": overlay.get("block_name") if isinstance(overlay, dict) else None,
                    },
                )
                voice.speak(speech_text, intensity="urgent")

            last_nudge = dt.datetime.now()
            nudge_times.append(last_nudge)

        if (
            args.max_seconds > 0
            and (dt.datetime.now() - start_time).total_seconds() >= args.max_seconds
        ):
            if args.align_state.exists() and not args.schedule.exists():
                start_time = dt.datetime.now()
            else:
                print("Runner exiting after max-seconds")
                break

        time.sleep(0.5)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
