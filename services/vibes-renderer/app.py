from __future__ import annotations

import math
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

try:
    from vibes_api import VibesClient
except ImportError:  # Allows storyboard tests without the optional provider package.
    VibesClient = None  # type: ignore


app = FastAPI(title="SunoDown AI Music Video Renderer", version="1.0.0")
SECTION = re.compile(r"^\s*\[[^\]]+\]\s*$")
SAFE_ASPECTS = {"9:16", "16:9", "1:1"}


class RenderRequest(BaseModel):
    jobId: str
    input: dict[str, Any]


def authorize(value: str | None) -> None:
    expected = os.getenv("RENDER_SERVICE_TOKEN", "")
    if expected and value != f"Bearer {expected}":
        raise HTTPException(401, "Invalid renderer token")


def clean_lines(lyrics: str) -> list[str]:
    return [
        line.strip()
        for line in lyrics.replace("\r", "").split("\n")
        if line.strip() and not SECTION.match(line)
    ]


def build_storyboard(
    lyrics: str,
    style: str = "",
    duration: float = 0,
    scene_seconds: int = 5,
    max_unique_scenes: int = 12,
) -> list[dict[str, Any]]:
    lines = clean_lines(lyrics)
    if not lines:
        raise ValueError("Lyrics are required for AI music video generation")
    scene_seconds = max(3, min(8, int(scene_seconds or 5)))
    wanted = max(1, math.ceil(max(duration, scene_seconds) / scene_seconds))
    unique = min(max(1, int(max_unique_scenes or 12)), wanted, len(lines))
    visual_style = (style or "cinematic music video, coherent visual story").strip()[:600]
    scenes: list[dict[str, Any]] = []
    for index in range(unique):
        start_line = math.floor(index * len(lines) / unique)
        end_line = math.floor((index + 1) * len(lines) / unique)
        excerpt = " / ".join(lines[start_line:end_line])
        if not excerpt:
            break
        prompt = (
            f"Cinematic music video scene inspired by these lyrics: {excerpt}. "
            f"Visual direction: {visual_style}. Express the emotion visually without text, logos, "
            "captions or watermarks. Natural motion, intentional camera movement, consistent characters "
            "and color palette, seamless ending suitable for cutting to the next scene."
        )
        scenes.append({"index": index, "start": index * scene_seconds, "duration": scene_seconds, "lyrics": excerpt, "prompt": prompt})
    return scenes


def run(*args: str) -> None:
    subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return max(0.1, float(result.stdout.strip()))


def download(url: str, target: Path) -> None:
    host = (urlparse(url).hostname or "").lower()
    allowed = {item.strip().lower() for item in os.getenv("AUDIO_SOURCE_HOSTS", "suno.aiautotool.com,localhost").split(",") if item.strip()}
    if host not in allowed:
        raise ValueError(f"Audio source host is not allowed: {host}")
    with requests.get(url, stream=True, timeout=600, headers={"User-Agent": "SunoDown-Renderer/1.0"}) as response:
        response.raise_for_status()
        with target.open("wb") as handle:
            for chunk in response.iter_content(1024 * 1024):
                if chunk:
                    handle.write(chunk)


def mock_clip(target: Path, index: int, aspect: str, seconds: int) -> None:
    size = {"9:16": "720x1280", "1:1": "720x720", "16:9": "1280x720"}[aspect]
    colors = ["0x24104f", "0x063b48", "0x581c3d", "0x12315c", "0x4a2807"]
    run(
        "ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c={colors[index % len(colors)]}:s={size}:r=24:d={seconds}",
        "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-t", str(seconds), str(target),
    )


def generated_clips(scenes: list[dict[str, Any]], work: Path, title: str, aspect: str, resolution: str) -> list[Path]:
    if os.getenv("MOCK_VIBES", "").lower() in {"1", "true", "yes"}:
        clips = []
        for scene in scenes:
            target = work / f"scene-{scene['index']:03d}.mp4"
            mock_clip(target, scene["index"], aspect, scene["duration"])
            clips.append(target)
        return clips
    session = os.getenv("VIBES_META_SESSION", "")
    if not session or VibesClient is None:
        raise RuntimeError("VIBES_META_SESSION is not configured")
    client = VibesClient(meta_session=session, auto_refresh=True, background_refresh=True)
    project = client.create_project(name=f"SunoDown - {title[:60]}")
    clips: list[Path] = []
    try:
        for scene in scenes:
            batch = client.generate_video(
                project_id=project["id"], prompt=scene["prompt"], aspect_ratio=aspect,
                resolution=resolution, variations=1, poll=True, poll_timeout=420,
            )
            content = next((item for item in batch.get("content", []) if item.get("videoUrl")), None)
            if not content:
                raise RuntimeError(f"Vibes returned no video for scene {scene['index'] + 1}")
            target = work / f"scene-{scene['index']:03d}.mp4"
            client.download_video(content["id"], str(target))
            clips.append(target)
    finally:
        client.close()
    return clips


def compose(clips: list[Path], audio: Path, output: Path, duration: float) -> None:
    if not clips:
        raise RuntimeError("No generated clips to compose")
    clip_span = sum(probe_duration(clip) for clip in clips)
    repetitions = max(1, math.ceil(duration / max(clip_span, 0.1)))
    concat = output.parent / "concat.txt"
    concat.write_text("".join(f"file '{clip.as_posix()}'\n" for _ in range(repetitions) for clip in clips), encoding="utf-8")
    run(
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-i", str(audio),
        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(output),
    )


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": bool(shutil.which("ffmpeg") and shutil.which("ffprobe")),
        "ffmpeg": bool(shutil.which("ffmpeg")),
        "vibesConfigured": bool(os.getenv("VIBES_META_SESSION")),
        "mock": os.getenv("MOCK_VIBES", "").lower() in {"1", "true", "yes"},
    }


@app.post("/render")
def render(payload: RenderRequest, authorization: str | None = Header(default=None)) -> FileResponse:
    authorize(authorization)
    data = payload.input
    if data.get("mode") != "ai_music_video":
        raise HTTPException(422, "This renderer only accepts ai_music_video jobs")
    song = data.get("song") or {}
    audio_url = song.get("audio")
    lyrics = data.get("lyrics") or song.get("lyrics") or ""
    if not isinstance(audio_url, str) or not audio_url.startswith("https://"):
        raise HTTPException(422, "A public HTTPS audio URL is required")
    aspect = data.get("aspect") if data.get("aspect") in SAFE_ASPECTS else "9:16"
    resolution = data.get("resolution") if data.get("resolution") in {"480p", "720p"} else "720p"
    with tempfile.TemporaryDirectory(prefix=f"sunodown-{payload.jobId[:8]}-") as temp:
        work = Path(temp)
        audio = work / "audio.m4a"
        output = work / "result.mp4"
        try:
            download(audio_url, audio)
            duration = float(data.get("duration") or song.get("duration") or probe_duration(audio))
            scenes = build_storyboard(
                lyrics, data.get("style") or song.get("style") or song.get("tags") or "",
                duration, data.get("sceneSeconds", 5), data.get("maxUniqueScenes", 12),
            )
            clips = generated_clips(scenes, work, str(data.get("title") or song.get("title") or "Suno"), aspect, resolution)
            compose(clips, audio, output, duration)
            persistent = Path(tempfile.gettempdir()) / f"sunodown-result-{payload.jobId}.mp4"
            shutil.copy2(output, persistent)
            return FileResponse(
                persistent, media_type="video/mp4", filename=f"{payload.jobId}.mp4",
                background=BackgroundTask(persistent.unlink, missing_ok=True),
            )
        except HTTPException:
            raise
        except Exception as error:
            raise HTTPException(502, str(error)) from error
