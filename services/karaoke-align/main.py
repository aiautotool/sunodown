from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from faster_whisper import WhisperModel

app = FastAPI(title="Suno Karaoke Aligner", version="1.0.0")

MODEL_NAME = os.getenv("WHISPER_MODEL", "large-v3")
DEVICE = os.getenv("WHISPER_DEVICE", "cuda")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "float16")
model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)

SECTION = re.compile(r"^\s*\[[^\]]+\]\s*$")
PUNCT = re.compile(r"[^\wÀ-ỹĐđ]+", re.UNICODE)


def normalize_word(value: str) -> str:
    value = unicodedata.normalize("NFC", value).lower()
    return PUNCT.sub("", value)


def lyric_lines(lyrics: str) -> list[str]:
    return [
        line.strip()
        for line in lyrics.replace("\r", "").split("\n")
        if line.strip() and not SECTION.match(line.strip())
    ]


def separate_vocals(source: Path, workdir: Path) -> Path:
    if os.getenv("DISABLE_DEMUCS", "0") == "1":
        return source

    output = workdir / "demucs"
    cmd = [
        "python",
        "-m",
        "demucs.separate",
        "--two-stems=vocals",
        "-n",
        os.getenv("DEMUCS_MODEL", "htdemucs"),
        "-o",
        str(output),
        str(source),
    ]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=900)
    except Exception:
        return source

    candidates = list(output.rglob("vocals.wav"))
    return candidates[0] if candidates else source


def transcribe_words(audio: Path, language: str) -> list[dict[str, Any]]:
    segments, _ = model.transcribe(
        str(audio),
        language=language or "vi",
        word_timestamps=True,
        vad_filter=False,
        condition_on_previous_text=True,
        beam_size=5,
    )

    words: list[dict[str, Any]] = []
    for segment in segments:
        for word in segment.words or []:
            text = word.word.strip()
            if not text:
                continue
            words.append(
                {
                    "text": text,
                    "norm": normalize_word(text),
                    "start": float(word.start),
                    "end": float(word.end),
                    "confidence": float(word.probability) if word.probability is not None else 0.5,
                }
            )
    return words


def flatten_lyrics(lines: list[str]) -> tuple[list[dict[str, Any]], list[list[int]]]:
    tokens: list[dict[str, Any]] = []
    line_indexes: list[list[int]] = []
    for line_i, line in enumerate(lines):
        indexes: list[int] = []
        for word in re.findall(r"\S+", line):
            indexes.append(len(tokens))
            tokens.append({"text": word, "norm": normalize_word(word), "line": line_i})
        line_indexes.append(indexes)
    return tokens, line_indexes


def similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


def monotonic_match(lyrics_tokens: list[dict[str, Any]], asr_words: list[dict[str, Any]]) -> list[int | None]:
    # Dynamic programming alignment with insert/delete/substitute penalties.
    n, m = len(lyrics_tokens), len(asr_words)
    gap = -0.72
    prev = [j * gap for j in range(m + 1)]
    back: list[list[int]] = [[0] * (m + 1) for _ in range(n + 1)]
    for j in range(1, m + 1):
        back[0][j] = 2

    for i in range(1, n + 1):
        cur = [i * gap] + [0.0] * m
        back[i][0] = 1
        for j in range(1, m + 1):
            sim = similarity(lyrics_tokens[i - 1]["norm"], asr_words[j - 1]["norm"])
            score_match = prev[j - 1] + (2.0 * sim - 0.72)
            score_skip_lyric = prev[j] + gap
            score_skip_asr = cur[j - 1] + gap
            best = max(score_match, score_skip_lyric, score_skip_asr)
            cur[j] = best
            back[i][j] = 0 if best == score_match else (1 if best == score_skip_lyric else 2)
        prev = cur

    matches: list[int | None] = [None] * n
    i, j = n, m
    while i > 0 or j > 0:
        step = back[i][j] if i >= 0 and j >= 0 else 0
        if i > 0 and j > 0 and step == 0:
            if similarity(lyrics_tokens[i - 1]["norm"], asr_words[j - 1]["norm"]) >= 0.42:
                matches[i - 1] = j - 1
            i -= 1
            j -= 1
        elif i > 0 and (j == 0 or step == 1):
            i -= 1
        else:
            j -= 1
    return matches


def interpolate_timings(
    tokens: list[dict[str, Any]],
    matches: list[int | None],
    asr_words: list[dict[str, Any]],
    duration: float,
) -> list[dict[str, Any]]:
    result: list[dict[str, Any] | None] = [None] * len(tokens)
    for i, match in enumerate(matches):
        if match is None:
            continue
        w = asr_words[match]
        result[i] = {
            "text": tokens[i]["text"],
            "start": w["start"],
            "end": w["end"],
            "confidence": w["confidence"],
        }

    anchors = [i for i, value in enumerate(result) if value is not None]
    if not anchors:
        step = max(0.08, duration / max(1, len(tokens)))
        return [
            {"text": token["text"], "start": i * step, "end": min(duration, (i + 1) * step), "confidence": 0.0}
            for i, token in enumerate(tokens)
        ]

    # Fill unmatched spans between known anchors while preserving order.
    boundaries = [-1] + anchors + [len(tokens)]
    for b in range(len(boundaries) - 1):
        left_i, right_i = boundaries[b], boundaries[b + 1]
        gap_count = right_i - left_i - 1
        if gap_count <= 0:
            continue

        left_t = result[left_i]["end"] if left_i >= 0 and result[left_i] else 0.0
        right_t = result[right_i]["start"] if right_i < len(tokens) and result[right_i] else duration
        available = max(0.04 * gap_count, right_t - left_t)
        step = available / gap_count

        for k in range(gap_count):
            idx = left_i + 1 + k
            start = left_t + step * k
            end = left_t + step * (k + 1)
            result[idx] = {
                "text": tokens[idx]["text"],
                "start": max(0.0, start),
                "end": min(duration, max(start + 0.02, end)),
                "confidence": 0.2,
            }

    clean: list[dict[str, Any]] = []
    prev_end = 0.0
    for idx, value in enumerate(result):
        assert value is not None
        start = max(prev_end, float(value["start"]))
        end = max(start + 0.02, float(value["end"]))
        clean.append({**value, "start": start, "end": min(duration, end)})
        prev_end = clean[-1]["end"]
    return clean


def build_lines(
    lines: list[str],
    line_indexes: list[list[int]],
    timed_words: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for text, indexes in zip(lines, line_indexes):
        words = [timed_words[i] for i in indexes if i < len(timed_words)]
        if not words:
            continue
        output.append(
            {
                "text": text,
                "start": words[0]["start"],
                "end": words[-1]["end"],
                "confidence": sum(w["confidence"] for w in words) / len(words),
                "words": words,
            }
        )
    return output


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "model": MODEL_NAME, "device": DEVICE}


@app.post("/align")
async def align(
    audio: UploadFile = File(...),
    lyrics: str = Form(...),
    language: str = Form("vi"),
) -> dict[str, Any]:
    lines = lyric_lines(lyrics)
    if not lines:
        raise HTTPException(status_code=400, detail="Lyrics trống.")

    suffix = Path(audio.filename or "song.mp3").suffix or ".mp3"
    with tempfile.TemporaryDirectory(prefix="suno-align-") as tmp:
        workdir = Path(tmp)
        source = workdir / f"source{suffix}"
        with source.open("wb") as target:
            shutil.copyfileobj(audio.file, target)

        vocals = separate_vocals(source, workdir)
        asr_words = transcribe_words(vocals, language)
        if not asr_words:
            raise HTTPException(status_code=422, detail="Không phát hiện được giọng hát.")

        duration = max(word["end"] for word in asr_words)
        tokens, indexes = flatten_lyrics(lines)
        matches = monotonic_match(tokens, asr_words)
        timed = interpolate_timings(tokens, matches, asr_words, duration)
        result_lines = build_lines(lines, indexes, timed)

        matched = sum(1 for value in matches if value is not None)
        return {
            "lines": result_lines,
            "meta": {
                "language": language,
                "lyrics_words": len(tokens),
                "asr_words": len(asr_words),
                "matched_words": matched,
                "match_rate": matched / max(1, len(tokens)),
                "separated_vocals": vocals != source,
            },
        }
