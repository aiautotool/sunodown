from __future__ import annotations

import math
import logging
import os
import re
import shutil
import subprocess
import tempfile
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path
from threading import RLock
from typing import Any
from urllib.parse import urlparse

import requests
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

try:
    from vibes_api import VibesClient
except ImportError:  # Allows storyboard tests without the optional provider package.
    VibesClient = None  # type: ignore


app = FastAPI(title="SunoDown AI Music Video Renderer", version="1.0.0")
SECTION = re.compile(
    r"^\s*(?:\[[^\]]+\]|(?:verse|chorus|pre-chorus|bridge|outro|intro|hook|refrain|đoạn|điệp khúc|kết)(?:\s+\d+)?:?)\s*$",
    re.IGNORECASE,
)
SAFE_ASPECTS = {"9:16", "16:9", "1:1"}
RESULTS = Path(tempfile.gettempdir()) / "sunodown-results"
RESULTS.mkdir(parents=True, exist_ok=True)
EXECUTOR = ThreadPoolExecutor(max_workers=max(1, int(os.getenv("RENDER_WORKERS", "1"))))
JOBS: dict[str, Future[Path]] = {}
FAILURES: dict[str, str] = {}
JOBS_LOCK = RLock()
LOGGER = logging.getLogger("sunodown.renderer")


def public_error(error: Exception) -> str:
    detail = error.detail if isinstance(error, HTTPException) else str(error)
    message = str(detail)
    if "RATE_LIMITED" in message or "Too many requests" in message:
        return "Vibes đang giới hạn lượt tạo video (429). Vui lòng thử lại sau vài phút."
    if "401 Client Error" in message:
        return "Liên kết audio đã hết hạn. Vui lòng dán lại liên kết Suno và tạo job mới."
    return message[:500]


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


def visual_bible(title: str, lyrics: str, style: str) -> dict[str, str]:
    source = f"{title} {lyrics} {style}".lower()
    vietnamese = "vietnamese" in source or any(word in source for word in (" anh ", " em ", "mình", "bình yên"))
    cast = (
        "the same Vietnamese couple in their late twenties in every scene: "
        "a lean man with an oval face, short side-parted black hair and a charcoal linen shirt; "
        "a woman with a heart-shaped face, warm brown eyes, long straight black hair, an ivory blouse and muted-blue skirt"
        if vietnamese
        else "the same two adult protagonists in every scene: a lean man with an oval face, short dark hair and a charcoal linen shirt; "
        "a woman with a heart-shaped face, warm brown eyes, long dark hair, an ivory blouse and muted-blue skirt"
    )
    if any(word in source for word in ("rain", "mưa", "sad", "buồn", "đêm", "night")):
        world = "a quiet rain-washed city apartment and nearby streets at blue hour"
        palette = "deep blue, soft amber practical lights, gentle rain reflections"
    elif any(word in source for word in ("ocean", "sea", "biển", "shore", "sóng")):
        world = "a modest coastal home, wind-swept grass and a calm shoreline"
        palette = "sea blue, sand beige, warm late-afternoon sunlight"
    elif any(word in source for word in ("party", "dance", "club", "nhảy")):
        world = "one coherent contemporary neon city district and intimate music venue"
        palette = "magenta and cyan neon with controlled cinematic contrast"
    else:
        world = "one quiet lived-in home with a sunlit window, a small garden and the same nearby meadow"
        palette = "warm cream, muted blue, soft green and golden natural light"
    look = "cinematic live-action realism, natural skin texture, 35mm lens, shallow depth of field, restrained handheld camera"
    style_hint = " ".join((style or "").replace("\n", " ").split())[:220]
    return {"cast": cast, "world": world, "palette": palette, "look": look, "style": style_hint}


def build_storyboard(
    lyrics: str,
    style: str = "",
    duration: float = 0,
    scene_seconds: int = 5,
    max_unique_scenes: int = 12,
    title: str = "Suno music video",
) -> list[dict[str, Any]]:
    lines = clean_lines(lyrics)
    if not lines:
        raise ValueError("Lyrics are required for AI music video generation")
    scene_seconds = max(3, min(8, int(scene_seconds or 5)))
    wanted = max(1, math.ceil(max(duration, scene_seconds) / scene_seconds))
    unique = min(max(1, int(max_unique_scenes or 12)), wanted, len(lines))
    bible = visual_bible(title, lyrics, style)
    reference_prompt = (
        f"Character reference portrait for {title}. {bible['cast']}. "
        f"They stand together in {bible['world']}. {bible['palette']}. {bible['look']}. "
        "Full facial visibility, neutral natural expressions, clear wardrobe details, one coherent frame, no text, no logo."
    )
    scenes: list[dict[str, Any]] = []
    for index in range(unique):
        start_line = math.floor(index * len(lines) / unique)
        end_line = math.floor((index + 1) * len(lines) / unique)
        excerpt = " / ".join(lines[start_line:end_line])
        if not excerpt:
            break
        continuity = "Establish the recurring characters and location" if index == 0 else "Continue directly in the same story world with the exact same identities and wardrobe"
        prompt = (
            f"Scene {index + 1} of {unique} for the music video {title}. CONTINUITY LOCK: {bible['cast']}. "
            f"Never change their facial identity, age, hairstyle, body type or clothing. STORY WORLD: {bible['world']}. "
            f"Keep this exact palette: {bible['palette']}. Visual treatment: {bible['look']}. {bible['style']}. "
            f"{continuity}. Narrative beat inspired by these lyrics: {excerpt}. Translate the emotion into one simple, "
            "physically believable action and one intentional camera move. End on calm motion suitable for a seamless cut. "
            "No new lead characters, no face morphing, no wardrobe changes, no location reset, without text, logos, captions or watermarks."
        )
        scenes.append({"index": index, "start": index * scene_seconds, "duration": scene_seconds, "lyrics": excerpt, "prompt": prompt, "reference_prompt": reference_prompt})
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
    ingredient: dict[str, Any] | None = None
    ingredient_id: str | None = None
    try:
        try:
            reference = client.generate_image(
                project_id=project["id"], prompt=scenes[0]["reference_prompt"],
                aspect_ratio="1:1", resolution="720p", variations=1,
            )
            image = next(iter(reference.get("data") or []), None)
            if image and image.get("imageEntId") and image.get("url"):
                created = client.create_ingredient(
                    name=f"SunoDown cast {project['id'][-8:]}", ingredient_type="CHARACTER",
                    source_image_ent_id=image["imageEntId"], image_url=image["url"],
                    description=scenes[0]["reference_prompt"],
                )
                saved = created.get("ingredient") or created
                ingredient_id = saved.get("ingredientId") or saved.get("id")
                if ingredient_id:
                    ingredient = {"ingredientId": ingredient_id, "ingredientType": "CHARACTER", "name": saved.get("name") or "Recurring cast", "imageUrl": saved.get("imageUrl") or image["url"]}
        except Exception:
            LOGGER.warning("Could not create cast reference for %s; using prompt continuity", title, exc_info=True)
        for scene in scenes:
            batch = client.generate_video(
                project_id=project["id"], prompt=scene["prompt"], aspect_ratio=aspect,
                resolution=resolution, variations=1, ingredients=[ingredient] if ingredient else None,
                poll=True, poll_timeout=420,
            )
            content = next((item for item in batch.get("content", []) if item.get("videoUrl")), None)
            if not content:
                raise RuntimeError(f"Vibes returned no video for scene {scene['index'] + 1}")
            target = work / f"scene-{scene['index']:03d}.mp4"
            client.download_video(content["id"], str(target))
            clips.append(target)
    finally:
        if ingredient_id:
            try:
                client.delete_ingredient(ingredient_id)
            except Exception:
                LOGGER.warning("Could not delete temporary cast ingredient %s", ingredient_id)
        close = getattr(client, "close", None)
        if callable(close):
            close()
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


def render_video(payload: RenderRequest) -> Path:
    data = payload.input
    song = data.get("song") or {}
    audio_url = song.get("audio")
    lyrics = data.get("lyrics") or song.get("lyrics") or ""
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
                str(data.get("title") or song.get("title") or "Suno music video"),
            )
            clips = generated_clips(scenes, work, str(data.get("title") or song.get("title") or "Suno"), aspect, resolution)
            compose(clips, audio, output, duration)
            persistent = RESULTS / f"{payload.jobId}.mp4"
            shutil.copy2(output, persistent)
            return persistent
        except HTTPException:
            raise
        except Exception as error:
            LOGGER.exception("Render %s failed", payload.jobId)
            raise HTTPException(502, str(error)) from error


def remember_failure(job_id: str, future: Future[Path]) -> None:
    error = future.exception()
    if error is None:
        return
    with JOBS_LOCK:
        FAILURES[job_id] = public_error(error)


@app.post("/render", response_model=None)
def render(payload: RenderRequest, authorization: str | None = Header(default=None)):
    authorize(authorization)
    data = payload.input
    if data.get("mode") != "ai_music_video":
        raise HTTPException(422, "This renderer only accepts ai_music_video jobs")
    song = data.get("song") or {}
    audio_url = song.get("audio")
    lyrics = data.get("lyrics") or song.get("lyrics") or ""
    if not isinstance(audio_url, str) or not audio_url.startswith("https://"):
        raise HTTPException(422, "A public HTTPS audio URL is required")
    if not isinstance(lyrics, str) or not lyrics.strip():
        raise HTTPException(422, "Lyrics are required")
    result = RESULTS / f"{payload.jobId}.mp4"
    if result.exists():
        with JOBS_LOCK:
            JOBS.pop(payload.jobId, None)
        return FileResponse(
            result, media_type="video/mp4", filename=f"{payload.jobId}.mp4",
            background=BackgroundTask(result.unlink, missing_ok=True),
        )
    with JOBS_LOCK:
        failure = FAILURES.get(payload.jobId)
    if failure:
        return JSONResponse({"status": "failed", "jobId": payload.jobId, "error": failure})
    with JOBS_LOCK:
        future = JOBS.get(payload.jobId)
        if future is None:
            future = EXECUTOR.submit(render_video, payload)
            JOBS[payload.jobId] = future
            future.add_done_callback(lambda done: remember_failure(payload.jobId, done))
    if not future.done():
        return JSONResponse({"status": "rendering", "jobId": payload.jobId}, status_code=202)
    try:
        completed = future.result()
    except Exception as error:
        detail = public_error(error)
        with JOBS_LOCK:
            FAILURES[payload.jobId] = detail
        return JSONResponse({"status": "failed", "jobId": payload.jobId, "error": detail})
    return FileResponse(
        completed, media_type="video/mp4", filename=f"{payload.jobId}.mp4",
        background=BackgroundTask(completed.unlink, missing_ok=True),
    )
