#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import os
import re
import statistics
import tempfile
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

import requests
from faster_whisper import WhisperModel

SONG_URL = os.getenv("SONG_URL", "https://suno.com/s/tszo0jGdVUua4rT4")
BASE_URL = os.getenv("BASE_URL", "https://sunoapp.aiautotool.com").rstrip("/")
BENCH_AI_URL = os.getenv("BENCH_AI_URL", "http://127.0.0.1:8791").rstrip("/")
MODEL_NAME = os.getenv("BENCH_WHISPER_MODEL", "medium")
LANGUAGE = os.getenv("BENCH_LANGUAGE", "vi")

NONWORD = re.compile(r"[^\wÀ-ỹĐđ]+", re.UNICODE)
SECTION = re.compile(r"^\s*\[[^\]]+\]\s*$")


def norm(value: str) -> str:
    return NONWORD.sub("", unicodedata.normalize("NFC", value).lower())


def similarity(a: str, b: str) -> float:
    aa, bb = norm(a), norm(b)
    if not aa or not bb:
        return 0.0
    if aa == bb:
        return 1.0
    return SequenceMatcher(None, aa, bb).ratio()


def lyric_lines(lyrics: str) -> list[str]:
    out = []
    for raw in lyrics.replace("\r", "").split("\n"):
        line = raw.strip()
        if not line or SECTION.match(line):
            continue
        out.append(line)
    return out


def resolve_song() -> dict[str, Any]:
    r = requests.post(f"{BASE_URL}/api/resolve", json={"input": SONG_URL}, timeout=45)
    r.raise_for_status()
    return r.json()


def download_audio(song: dict[str, Any], path: Path) -> None:
    audio = str(song["audio"])
    url = audio if audio.startswith("http") else f"{BASE_URL}{audio}"
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    path.write_bytes(r.content)


def call_ai(audio_path: Path, model: str) -> dict[str, Any]:
    with audio_path.open("rb") as fh:
        r = requests.post(
            f"{BENCH_AI_URL}/transcribe?model={model}",
            files={"audio": ("song.mp3", fh, "audio/mpeg")},
            timeout=240,
        )
    r.raise_for_status()
    return r.json()


def words_from_result(payload: dict[str, Any]) -> list[dict[str, Any]]:
    result = payload.get("result") if isinstance(payload.get("result"), dict) else payload
    if not isinstance(result, dict):
        return []

    direct = result.get("words") or []
    words = []
    for item in direct:
        text = str(item.get("word") or item.get("text") or "").strip()
        start, end = item.get("start"), item.get("end")
        if text and isinstance(start, (int, float)) and isinstance(end, (int, float)):
            words.append({"text": text, "start": float(start), "end": float(end)})
    if words:
        return words

    for segment in result.get("segments") or []:
        nested = segment.get("words") or []
        for item in nested:
            text = str(item.get("word") or item.get("text") or "").strip()
            start, end = item.get("start"), item.get("end")
            if text and isinstance(start, (int, float)) and isinstance(end, (int, float)):
                words.append({"text": text, "start": float(start), "end": float(end)})
    if words:
        return words

    # Turbo may expose segment-level timing only. Use it for line-level bench.
    for segment in result.get("segments") or []:
        text = str(segment.get("text") or "").strip()
        start, end = segment.get("start"), segment.get("end")
        if not text or not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or end <= start:
            continue
        tokens = [x for x in text.split() if x]
        weights = [max(1, len(norm(x))) for x in tokens]
        total = max(1, sum(weights))
        cursor = float(start)
        span = float(end) - float(start)
        for i, token in enumerate(tokens):
            token_start = cursor
            token_end = float(end) if i == len(tokens) - 1 else min(float(end), token_start + span * weights[i] / total)
            words.append({"text": token, "start": token_start, "end": max(token_start + 0.01, token_end)})
            cursor = token_end
    return words


def local_words(audio_path: Path) -> list[dict[str, Any]]:
    model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(
        str(audio_path),
        language=LANGUAGE,
        word_timestamps=True,
        vad_filter=True,
        condition_on_previous_text=False,
        beam_size=5,
    )
    out = []
    for segment in segments:
        for word in segment.words or []:
            text = word.word.strip()
            if text:
                out.append({"text": text, "start": float(word.start), "end": float(word.end)})
    return out


def align(lines: list[str], asr: list[dict[str, Any]]) -> list[dict[str, Any] | None]:
    tokens: list[dict[str, Any]] = []
    per_line: list[list[int]] = []
    freq: dict[str, int] = {}
    for li, line in enumerate(lines):
        idxs = []
        for token in line.split():
            idxs.append(len(tokens))
            key = norm(token)
            freq[key] = freq.get(key, 0) + 1
            tokens.append({"text": token, "line": li, "norm": key})
        per_line.append(idxs)

    n, m = len(tokens), len(asr)
    gap = -0.72
    prev = [j * gap for j in range(m + 1)]
    back = [[0] * (m + 1) for _ in range(n + 1)]
    for j in range(1, m + 1):
        back[0][j] = 2

    for i in range(1, n + 1):
        cur = [i * gap] + [0.0] * m
        back[i][0] = 1
        for j in range(1, m + 1):
            sim = similarity(tokens[i - 1]["text"], asr[j - 1]["text"])
            rarity = 1 / math.sqrt(freq.get(tokens[i - 1]["norm"], 1))
            match = prev[j - 1] + (2 * sim - 0.9) * (0.72 + 0.28 * rarity)
            skip_l = prev[j] + gap
            skip_a = cur[j - 1] + gap
            best = max(match, skip_l, skip_a)
            cur[j] = best
            back[i][j] = 0 if best == match else (1 if best == skip_l else 2)
        prev = cur

    matches: list[int | None] = [None] * n
    i, j = n, m
    while i > 0 or j > 0:
        step = back[i][j]
        if i > 0 and j > 0 and step == 0:
            if similarity(tokens[i - 1]["text"], asr[j - 1]["text"]) >= 0.58:
                matches[i - 1] = j - 1
            i -= 1
            j -= 1
        elif i > 0 and (j == 0 or step == 1):
            i -= 1
        else:
            j -= 1

    trusted: list[int | None] = [None] * n
    for idx, ai in enumerate(matches):
        if ai is None:
            continue
        prev_ai = matches[idx - 1] if idx > 0 else None
        next_ai = matches[idx + 1] if idx + 1 < len(matches) else None
        consecutive = (prev_ai is not None and prev_ai == ai - 1) or (next_ai is not None and next_ai == ai + 1)
        key = tokens[idx]["norm"]
        strong_unique = len(key) >= 4 and similarity(tokens[idx]["text"], asr[ai]["text"]) >= 0.88 and freq.get(key, 0) == 1
        if consecutive or strong_unique:
            trusted[idx] = ai

    refs = []
    for li, indexes in enumerate(per_line):
        matched = [trusted[i] for i in indexes if trusted[i] is not None]
        if not matched:
            refs.append(None)
        else:
            refs.append({
                "text": lines[li],
                "start": asr[matched[0]]["start"],
                "end": asr[matched[-1]]["end"],
                "anchors": len(matched),
            })
    return refs


def main() -> int:
    song = resolve_song()
    lyrics = str(song.get("lyrics") or "")
    lines = lyric_lines(lyrics)
    duration = float(song.get("duration") or 0)
    print(f"[bench] {song.get('title')} id={song.get('id')} duration={duration} lyric_lines={len(lines)}")

    with tempfile.TemporaryDirectory(prefix="suno-ai-bench-") as tmp:
        audio_path = Path(tmp) / "song.mp3"
        download_audio(song, audio_path)

        turbo_payload = call_ai(audio_path, "turbo")
        turbo = words_from_result(turbo_payload)
        print("[bench] turbo raw result:", json.dumps(turbo_payload.get("result", {}), ensure_ascii=False)[:1800])
        local = local_words(audio_path)
        classic = []

    turbo_refs = align(lines, turbo)
    classic_refs = align(lines, classic)
    local_refs = align(lines, local)

    print("[bench] turbo words", len(turbo), "local words", len(local))
    print("[bench] turbo first:", " | ".join(x["text"] for x in turbo[:35]))
    print("[bench] local first:", " | ".join(x["text"] for x in local[:35]))

    rows = []
    turbo_deltas = []
    classic_deltas = []
    for i, text in enumerate(lines):
        tr = turbo_refs[i]
        cr = classic_refs[i]
        lr = local_refs[i]
        if not (tr or cr or lr):
            continue
        tdelta = (tr["start"] - lr["start"]) if tr and lr else None
        cdelta = (cr["start"] - lr["start"]) if cr and lr else None
        if tdelta is not None:
            turbo_deltas.append(tdelta)
        if cdelta is not None:
            classic_deltas.append(cdelta)
        row = {
            "line": i + 1,
            "text": text,
            "turbo_start": round(tr["start"], 3) if tr else None,
            "classic_start": round(cr["start"], 3) if cr else None,
            "local_start": round(lr["start"], 3) if lr else None,
            "turbo_delta": round(tdelta, 3) if tdelta is not None else None,
            "classic_delta": round(cdelta, 3) if cdelta is not None else None,
            "turbo_anchors": tr["anchors"] if tr else 0,
            "classic_anchors": cr["anchors"] if cr else 0,
            "local_anchors": lr["anchors"] if lr else 0,
        }
        rows.append(row)
        print(json.dumps(row, ensure_ascii=False))

    summary = {
        "title": song.get("title"),
        "song_id": song.get("id"),
        "duration": duration,
        "turbo_words": len(turbo),
        "classic_words": len(classic),
        "local_words": len(local),
        "turbo_anchored_lines": sum(1 for x in turbo_refs if x),
        "classic_anchored_lines": sum(1 for x in classic_refs if x),
        "local_anchored_lines": sum(1 for x in local_refs if x),
        "turbo_compared_lines": len(turbo_deltas),
        "classic_compared_lines": len(classic_deltas),
        "median_turbo_delta": round(statistics.median(turbo_deltas), 3) if turbo_deltas else None,
        "mean_turbo_delta": round(statistics.mean(turbo_deltas), 3) if turbo_deltas else None,
        "median_classic_delta": round(statistics.median(classic_deltas), 3) if classic_deltas else None,
    }
    print("[bench-summary]")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    Path("bench-ai-models.json").write_text(json.dumps({"summary": summary, "rows": rows}, ensure_ascii=False, indent=2), encoding="utf-8")

    # Candidate is accepted only if it aligns several real lyric lines and is
    # not globally early versus the independent local decoder.
    if summary["turbo_anchored_lines"] < 6:
        print("BENCH_FAIL: turbo does not recognize enough real lyric lines")
        return 2
    if summary["turbo_compared_lines"] >= 4 and summary["median_turbo_delta"] is not None and summary["median_turbo_delta"] < -0.45:
        print("BENCH_FAIL: turbo timing is globally too early")
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
