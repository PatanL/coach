import asyncio
import subprocess
import tempfile

try:
    import edge_tts

    HAS_EDGE_TTS = True
except ImportError:
    HAS_EDGE_TTS = False


def play_audio(path: str) -> None:
    try:
        subprocess.Popen(
            ["afplay", "-t", "20", path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass


def say_macos(text: str) -> None:
    try:
        subprocess.Popen(["say", "-v", "Fred", text])
    except Exception:
        pass


async def _generate_edge_audio(
    text: str, voice: str, output_path: str, rate: str
) -> None:
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(output_path)


def speak(text: str, intensity: str = "urgent") -> None:
    if not text or not text.strip():
        return

    if HAS_EDGE_TTS:
        try:
            voice_name = "en-US-ChristopherNeural"
            rate = "+15%" if intensity == "urgent" else "+0%"

            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as handle:
                temp_path = handle.name

            asyncio.run(_generate_edge_audio(text, voice_name, temp_path, rate))
            play_audio(temp_path)
            return
        except Exception as exc:
            print(f"Edge TTS failed, falling back to macOS: {exc}")

    say_macos(text)
