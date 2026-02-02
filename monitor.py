#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import os
import platform
import random
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Optional, Tuple, Dict


def is_macos() -> bool:
    return platform.system() == "Darwin"


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def run(cmd: list, timeout: Optional[int] = None) -> Tuple[int, str, str]:
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
        )
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
    except subprocess.TimeoutExpired as exc:
        out = (
            exc.stdout.decode().strip()
            if isinstance(exc.stdout, bytes)
            else (exc.stdout or "")
        )
        err = (
            exc.stderr.decode().strip()
            if isinstance(exc.stderr, bytes)
            else (exc.stderr or "timeout")
        )
        return 124, out, err


def say(text: str, voice: Optional[str] = None) -> None:
    if not is_macos():
        return
    cmd = ["say"]
    if voice:
        cmd += ["-v", voice]
    cmd += [text]
    try:
        subprocess.Popen(cmd)
    except Exception:
        pass


def notify(title: str, message: str) -> None:
    if not is_macos():
        return
    script = f'display notification "{message}" with title "{title}"'
    try:
        run(["osascript", "-e", script])
    except Exception:
        pass


def alert(title: str, message: str) -> None:
    if not is_macos():
        return
    # Non-blocking alert via notification + beep
    notify(title, message)
    try:
        run(["osascript", "-e", "beep 2"])
    except Exception:
        pass


def play_sound(sound_path: Optional[Path]) -> None:
    if sound_path and sound_path.exists() and is_macos():
        try:
            subprocess.Popen(["afplay", str(sound_path)])
        except Exception:
            pass


def frontmost_app_info() -> Tuple[str, str]:
    if not is_macos():
        return "", ""
    app_script = 'tell application "System Events" to get name of first application process whose frontmost is true'
    win_script = 'tell application "System Events" to tell (first application process whose frontmost is true) to get name of front window'
    _, app_out, _ = run(["osascript", "-e", app_script])
    _, win_out, _ = run(["osascript", "-e", win_script])
    return app_out, win_out


def screencap(out_path: Path) -> bool:
    if not is_macos():
        return False
    # Requires Screen Recording permission for the invoking terminal/app
    code, _, err = run(["screencapture", "-x", str(out_path)])
    return code == 0


def webcam_snap(out_path: Path) -> bool:
    # Uses imagesnap if available (brew install imagesnap). Requires Camera permission.
    exe = shutil.which("imagesnap")
    if not exe:
        return False
    code, _, err = run([exe, "-w", "1", str(out_path)])
    return code == 0


def timestamp() -> str:
    return dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


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


def new_capture_paths(root: Path) -> Tuple[Path, Path]:
    now = dt.datetime.now()
    day_dir = root / now.strftime("%Y-%m-%d")
    ensure_dir(day_dir)
    stamp = now.strftime("%H%M%S")
    return day_dir / f"{stamp}-screen.png", day_dir / f"{stamp}-webcam.jpg"


def prune_archive(root: Path, keep_days: int) -> None:
    if keep_days <= 0:
        return
    cutoff = dt.datetime.now() - dt.timedelta(days=keep_days)
    for path in root.iterdir():
        if not path.is_dir():
            continue
        try:
            day = dt.datetime.strptime(path.name, "%Y-%m-%d")
        except ValueError:
            continue
        if day < cutoff:
            shutil.rmtree(path, ignore_errors=True)


def frame_path(buffer_dir: Path, timestamp: dt.datetime) -> Path:
    ensure_dir(buffer_dir)
    stamp = timestamp.strftime("%Y-%m-%d_%H-%M-%S")
    return buffer_dir / f"{stamp}.png"


def trim_dir(buffer_dir: Path, keep: int, min_age_seconds: int = 0) -> None:
    if keep <= 0:
        return
    frames = sorted(buffer_dir.glob("*.png"))
    excess = len(frames) - keep
    if excess <= 0:
        return
    cutoff = dt.datetime.now().timestamp() - min_age_seconds
    removed = 0
    for path in frames:
        if removed >= excess:
            break
        try:
            if min_age_seconds > 0 and path.stat().st_mtime > cutoff:
                continue
            path.unlink()
            removed += 1
        except Exception:
            pass


def write_ndjson(path: Path, row: dict) -> None:
    ensure_dir(path.parent)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=True) + "\n")


def write_json(path: Path, data: dict) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=True, indent=2)


def daily_log_path(base_path: Path, now: dt.datetime) -> Path:
    return log_path_for_day(base_path, now.date())


def read_tail_lines(path: Path, max_lines: int) -> list:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        lines = f.readlines()
    return lines[-max_lines:]


def snapshot_drift_bundle(
    bundle_root: Path, frames_dir: Path, summaries_path: Path, now: dt.datetime
) -> Optional[Path]:
    try:
        bundle_dir = bundle_root / now.strftime("%Y-%m-%d_%H-%M")
        frames_out = bundle_dir / "frames"
        ensure_dir(frames_out)
        recent_frames = sorted(frames_dir.glob("*.png"))[-4:]
        for frame in recent_frames:
            shutil.copy2(frame, frames_out / frame.name)
        excerpt_lines = read_tail_lines(summaries_path, 6)
        if excerpt_lines:
            with (bundle_dir / "activity_excerpt.ndjson").open(
                "w", encoding="utf-8"
            ) as f:
                f.writelines(excerpt_lines)
        return bundle_dir
    except Exception:
        return None


def opencode_run(
    agent: str, message: str, files: Optional[list] = None, timeout: int = 90
) -> Tuple[int, str, str]:
    cmd = ["opencode", "run", "--agent", agent]
    if files:
        for file_path in files:
            cmd += ["-f", str(file_path)]
    cmd += ["--", message]
    return run(cmd, timeout=timeout)


def parse_monitor_output(raw: str) -> Optional[Dict[str, object]]:
    try:
        data = json.loads(raw.strip())
    except json.JSONDecodeError:
        lines = [line.strip() for line in raw.splitlines() if line.strip()]
        for line in reversed(lines):
            try:
                data = json.loads(line)
                break
            except json.JSONDecodeError:
                continue
        else:
            return None
    if not isinstance(data, dict):
        return None
    return data


def append_log(log_path: Path, row: dict) -> None:
    header = ["time", "screen_path", "webcam_path", "note"]
    ensure_dir(log_path.parent)
    write_header = not log_path.exists()
    with log_path.open("a", encoding="utf-8") as f:
        if write_header:
            f.write(",".join(header) + "\n")
        values = [row.get(k, "") for k in header]
        f.write(",".join(v.replace(",", " ") for v in values) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Lightweight macOS productivity coach")
    parser.add_argument(
        "--interval",
        type=int,
        default=60,
        help="Capture/check-in interval seconds (default 60)",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path("captures"),
        help="Archive capture root directory",
    )
    parser.add_argument(
        "--archive-captures",
        action="store_true",
        help="Enable archival captures under root directory",
    )
    parser.add_argument(
        "--archive-keep-days",
        type=int,
        default=7,
        help="Days to retain archived captures (0=keep all)",
    )
    parser.add_argument(
        "--log", type=Path, default=Path("logs/captures.csv"), help="CSV log path"
    )
    parser.add_argument(
        "--voice", type=str, default=None, help="macOS voice name for say (optional)"
    )
    parser.add_argument(
        "--no-camera", action="store_true", help="Disable webcam snapshots"
    )
    parser.add_argument("--no-say", action="store_true", help="Disable spoken prompts")
    parser.add_argument(
        "--no-notify", action="store_true", help="Disable notifications"
    )
    parser.add_argument(
        "--sound",
        type=Path,
        default=Path("Radar.mp3"),
        help="Optional sound file for alerts",
    )
    parser.add_argument(
        "--task", type=str, default="Deep work", help="Primary focus task for prompts"
    )
    parser.add_argument(
        "--hourly-break-mins",
        type=int,
        default=5,
        help="Suggest break every N minutes per hour (0=off)",
    )
    parser.add_argument(
        "--buffer-dir",
        type=Path,
        default=Path("coach/buffer/frames"),
        help="Rolling frame buffer directory",
    )
    parser.add_argument(
        "--buffer-keep",
        type=int,
        default=30,
        help="Frames to keep in buffer (default 30 ≈ 15min at 30s)",
    )
    parser.add_argument(
        "--summaries",
        type=Path,
        default=Path("coach/buffer/frame_summaries.ndjson"),
        help="Frame summary ring path",
    )
    parser.add_argument(
        "--bundle-root",
        type=Path,
        default=Path("coach/bundles/drift"),
        help="Drift bundle root directory",
    )
    parser.add_argument(
        "--emit-drift-bundle",
        action="store_true",
        help="Snapshot a drift bundle every cycle",
    )
    parser.add_argument(
        "--activity-log",
        type=Path,
        default=Path("coach/logs/activity.ndjson"),
        help="Activity log path (date suffix auto-applied)",
    )
    parser.add_argument(
        "--block-id",
        type=str,
        default=None,
        help="Optional block id for activity entries",
    )
    parser.add_argument(
        "--events-log",
        type=Path,
        default=Path("coach/logs/events.ndjson"),
        help="Events log path (date suffix auto-applied)",
    )
    parser.add_argument(
        "--analysis-timeout",
        type=int,
        default=20,
        help="Seconds to allow per analysis call",
    )
    parser.add_argument(
        "--log-keep-days",
        type=int,
        default=7,
        help="Days of log retention for daily ndjson logs",
    )
    args = parser.parse_args()

    if not is_macos():
        print("This script is optimized for macOS. Some features may be unavailable.")

    if args.archive_captures:
        ensure_dir(args.root)
    last_hour = dt.datetime.now().hour
    cycle = 0

    print("Coach running. Press Ctrl+C to stop.")

    prune_logs(args.activity_log.parent, args.activity_log.stem, args.log_keep_days)
    prune_logs(args.events_log.parent, args.events_log.stem, args.log_keep_days)

    # Rotating psychological nudges
    nudges = [
        "Identity: You are an AI research engineer. Act like it.",
        "Loss aversion: Future you loses if you drift now.",
        "Implementation: If distracted, then close tab and reopen editor.",
        "Timebox: Next 50 minutes on {task}, nothing else.",
        "Focus: One tab. One file. One thought.",
        "Compounding: This minute becomes an hour by evening.",
        "Self-image: This is what focused people do.",
        "Progress > perfection: Ship small wins.",
        "Environment: Phone away. Full-screen your tool.",
        "Breathing: Two deep breaths, then execute.",
    ]
    while True:
        start = time.time()
        cycle += 1

        now = dt.datetime.now()
        activity_log = daily_log_path(args.activity_log, now)
        events_log = daily_log_path(args.events_log, now)
        app_name, win_title = frontmost_app_info()
        buffer_frame = frame_path(args.buffer_dir, now)

        if args.archive_captures:
            screen_path, cam_path = new_capture_paths(args.root)
            screen_ok = screencap(screen_path)
            cam_ok = False
            if not args.no_camera:
                cam_ok = webcam_snap(cam_path)
            if screen_ok:
                try:
                    shutil.copy2(screen_path, buffer_frame)
                except Exception:
                    pass
            if args.archive_keep_days > 0:
                prune_archive(args.root, args.archive_keep_days)
        else:
            screen_ok = screencap(buffer_frame)
            cam_ok = False
            screen_path = buffer_frame
            cam_path = Path("")

        cam_buffer_path = buffer_frame.with_name(
            f"{buffer_frame.stem}_cam{buffer_frame.suffix}"
        )

        trim_dir(args.buffer_dir, args.buffer_keep)

        now_payload = {
            "ts": now.isoformat(),
            "app": app_name,
            "title": win_title,
            "block_id": args.block_id,
        }
        write_json(Path("coach/state/now.json"), now_payload)

        monitor_out = None
        error_reason = ""
        if screen_ok:
            code, out, err = opencode_run(
                "coach_monitor",
                "Classify focus status for this screen. Return JSON only.",
                files=[buffer_frame, Path("coach/state/now.json")],
                timeout=args.analysis_timeout,
            )
            if code != 0:
                error_reason = err or f"coach_monitor_exit_{code}"
            if code == 0:
                monitor_out = parse_monitor_output(out)
                if not monitor_out:
                    error_reason = "coach_monitor_non_json"

        status = "unsure"
        confidence = None
        reason = ""
        short_caption = None
        if monitor_out:
            status = str(monitor_out.get("status", "unsure"))
            confidence = monitor_out.get("confidence")
            reason = str(monitor_out.get("reason", ""))
            short_caption = monitor_out.get("short_caption")
        elif error_reason:
            reason = f"analysis_error:{error_reason}"

        is_off_task = (
            status == "off_task"
            and isinstance(confidence, (int, float))
            and confidence >= 0.70
        )
        summary_row = {
            "ts": now.isoformat(),
            "app": app_name,
            "title": win_title,
            "url_domain": None,
            "monitor_status": status,
            "confidence": confidence,
            "short_caption": short_caption if is_off_task else None,
        }
        write_ndjson(args.summaries, summary_row)
        write_ndjson(
            activity_log,
            {
                "ts": now.isoformat(),
                "block_id": args.block_id,
                "app": app_name,
                "title": win_title,
                "url_domain": None,
                "status": status,
                "confidence": confidence,
                "reason": reason,
                "short_caption": short_caption if is_off_task else None,
            },
        )

        cam_ok = False
        if is_off_task and not args.no_camera:
            cam_ok = webcam_snap(cam_buffer_path)

        if is_off_task:
            last_event = read_tail_lines(events_log, 1)
            event_type = "DRIFT_START"
            if last_event:
                try:
                    previous = json.loads(last_event[0])
                    if previous.get("type") == "DRIFT_START":
                        event_type = "DRIFT_PERSIST"
                except json.JSONDecodeError:
                    pass
            write_ndjson(
                events_log,
                {
                    "ts": now.isoformat(),
                    "type": event_type,
                    "event_id": str(uuid.uuid4()),
                    "block_id": args.block_id,
                    "app": app_name,
                    "url_domain": None,
                    "confidence": confidence,
                    "reason": reason,
                    "source": "monitor",
                },
            )

            if args.emit_drift_bundle:
                snapshot_drift_bundle(
                    args.bundle_root, args.buffer_dir, args.summaries, now
                )

            # Build feedback
            note_parts = []
            nudge = random.choice(nudges).format(task=args.task)
            if not args.no_say:
                say(nudge, voice=args.voice)
            if not args.no_notify:
                notify("Focus", nudge)

            if args.sound and is_off_task:
                play_sound(args.sound)

            if not screen_ok:
                note_parts.append("Screen capture failed (grant permission)")
            if not cam_ok and not args.no_camera:
                note_parts.append(
                    "Webcam capture unavailable (install imagesnap + grant camera)"
                )

            if args.archive_captures:
                append_log(
                    args.log,
                    {
                        "time": timestamp(),
                        "screen_path": str(screen_path if screen_ok else ""),
                        "webcam_path": str(cam_path if cam_ok else ""),
                        "note": "; ".join(note_parts),
                    },
                )

            # Hourly break reminder (simple heuristic)
            if args.hourly_break_mins > 0 and now.hour != last_hour:
                last_hour = now.hour
                if not args.no_say:
                    say(
                        "Good work. Take a short break: hydrate and stretch.",
                        voice=args.voice,
                    )
                if not args.no_notify:
                    notify("Break", "Hydrate, stretch, 5-minute reset.")

        # Sleep remaining time in interval
        elapsed = time.time() - start
        to_sleep = max(0, args.interval - elapsed)
        try:
            time.sleep(to_sleep)
        except KeyboardInterrupt:
            print("\nStopping coach.")
            break

    return 0


if __name__ == "__main__":
    sys.exit(main())
