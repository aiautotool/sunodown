#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import os
import re
import statistics
import sys
import tempfile
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

import requests
from faster_whisper import WhisperModel

SONG_URL = os.getenv("SONG_URL", "https://suno.com/s/tszo0jGdVUua4rT4")
BASE_URL = os.getenv("BASE_URL", "https://sunoapp.aiautotool.com").rstrip("/")
MODEL_NAME = os.getenv("BENCH_WHISPER_MODEL", "small")
LANGUAGE = os.getenv("BENCH_LANGUAGE", "vi")
MAX_EARLY_SECONDS = float(os.getenv("MAX_EARLY_SECONDS", "0.45"))

UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", re.I)
SECTION = re.compile(r"^\s*(?:\[[^\]]+\]|\((?:verse|chorus|bridge|intro|outro|pre[- ]?chorus|instrumental)[^)]*\))\s*$", re.I)
CHORD = re.compile(r"^\[?(?:[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:/[A-G](?:#|b)?)?)\]?$", re.I)
NONWORD = re.compile(r"[^\wÀ-ỹĐđ]+", re.UNICODE)


def norm(value: str) -> str:
    value = unicodedata.normalize("NFC", value).lower()
    return NONWORD.sub("", value)


def clean_line(line: str) -> str:
    if SECTION.match(line.strip()):
        return ""
    parts = []
    for token in line.strip().split():
        if CHORD.match(token):
            continue
        token = re.sub(r"^\[[A-G][^\]]*\]$", "", token)
        if token:
            parts.append(token)
    return " ".join(parts).strip()


def lyric_lines(lyrics: str) -> list[str]:
    return [x for raw in lyrics.replace("\r", "").split("\n") if (x := clean_line(raw))]


def resolve_song() -> dict[str, Any]:
    try:
        r = requests.post(
            f"{BASE_URL}/api/resolve",
            json={"input": SONG_URL},
            timeout=45,
        )
        if r.ok:
            data = r.json()
            data["_resolved_by"] = "sunodown-production"
            return data
        print(f"[bench] production resolve failed: {r.status_code} {r.text[:300]}", file=sys.stderr)
    except Exception as exc:
        print(f"[bench] production resolve exception: {exc}", file=sys.stderr)

    page = requests.get(
        SONG_URL,
        headers={"user-agent": "Mozilla/5.0", "accept": "text/html"},
        timeout=45,
        allow_redirects=True,
    )
    page.raise_for_status()
    match = UUID_RE.search(page.url) or UUID_RE.search(page.text)
    if not match:
        raise RuntimeError("Cannot discover Suno clip id from share URL")
    clip_id = match.group(0)
    clip = requests.get(
        f"https://studio-api-prod.suno.com/api/clip/{clip_id}",
        headers={"user-agent": "Mozilla/5.0", "accept": "application/json"},
        timeout=45,
    )
    clip.raise_for_status()
    data = clip.json()
    meta = data.get("metadata") or {}
    media = data.get("media_urls") or []
    audio = None
    for item in media:
        u = item.get("url")
        typ = str(item.get("content_type", "")).lower()
        if isinstance(u, str) and ("mp3" in typ or u.lower().endswith(".mp3")):
            audio = u
            break
    audio = audio or data.get("audio_url")
    return {
        "id": clip_id,
        "title": data.get("title") or "Suno song",
        "lyrics": meta.get("prompt") or meta.get("lyrics") or data.get("lyrics") or data.get("prompt"),
        "duration": meta.get("duration") or data.get("duration"),
        "audio": audio,
        "_resolved_by": "direct-suno",
    }


def download_audio(song: dict[str, Any], target: Path) -> bytes:
    audio = song.get("audio")
    if not isinstance(audio, str) or not audio:
        raise RuntimeError("Resolved song has no audio URL")
    url = audio if audio.startswith("http") else f"{BASE_URL}{audio}"
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    target.write_bytes(r.content)
    return r.content


def call_prod_backend(audio_path: Path, lyrics: str, duration: float) -> tuple[int, dict[str, Any]]:
    with audio_path.open("rb") as fh:
        payload = {"duration": str(duration), "language": LANGUAGE}
        if lyrics:
            payload["lyrics"] = lyrics
        r = requests.post(
            f"{BASE_URL}/api/karaoke/align",
            files={"audio": ("song.mp3", fh, "audio/mpeg")},
            data=payload,
            timeout=240,
        )
    body: dict[str, Any] = {}
    try:
        body = r.json()
    except Exception:
        body = {"raw": r.text[:1000]}
    return r.status_code, body


def transcribe_local(
    audio_path: Path,
    lyrics: str = "",
    guided: bool = False,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")

    hotwords = None
    initial_prompt = None
    if guided and lyrics:
        cleaned_lines = lyric_lines(lyrics)
        prompt_text = " ".join(cleaned_lines)
        # Whisper's prompt is context, not ground truth. Keep enough lyrics to
        # bias Vietnamese song vocabulary without forcing a full fake transcript.
        initial_prompt = prompt_text[:1800]
        unique = []
        seen = set()
        for token in prompt_text.split():
            key = norm(token)
            if len(key) < 3 or key in seen:
                continue
            seen.add(key)
            unique.append(token)
        hotwords = " ".join(unique[:160])

    segments, _ = model.transcribe(
        str(audio_path),
        language=LANGUAGE,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"threshold": 0.30, "min_silence_duration_ms": 350},
        condition_on_previous_text=False,
        beam_size=5,
        initial_prompt=initial_prompt,
        hotwords=hotwords,
        hallucination_silence_threshold=1.0,
    )

    words: list[dict[str, Any]] = []
    segment_rows: list[dict[str, Any]] = []
    for segment in segments:
        segment_words = []
        for word in segment.words or []:
            text = word.word.strip()
            if not text:
                continue
            item = {
                "text": text,
                "start": float(word.start),
                "end": float(word.end),
                "probability": float(word.probability or 0),
            }
            words.append(item)
            segment_words.append(item)
        text = str(segment.text or "").strip()
        if text:
            segment_rows.append(
                {
                    "text": text,
                    "start": float(segment.start),
                    "end": float(segment.end),
                    "words": segment_words,
                }
            )
    return words, segment_rows


def similarity(a: str, b: str) -> float:
    aa, bb = norm(a), norm(b)
    if not aa or not bb:
        return 0.0
    if aa == bb:
        return 1.0
    return SequenceMatcher(None, aa, bb).ratio()


def flatten(lines: list[str]):
    tokens: list[dict[str, Any]] = []
    line_indexes: list[list[int]] = []
    freq: dict[str, int] = {}
    for line_idx, line in enumerate(lines):
        indexes = []
        for token in line.split():
            indexes.append(len(tokens))
            key = norm(token)
            freq[key] = freq.get(key, 0) + 1
            tokens.append({"text": token, "line": line_idx, "norm": key})
        line_indexes.append(indexes)
    return tokens, line_indexes, freq


def align_reference(lines: list[str], asr: list[dict[str, Any]]) -> list[dict[str, Any] | None]:
    tokens, line_indexes, freq = flatten(lines)
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
            previous_context = similarity(tokens[i - 2]["text"], asr[j - 2]["text"]) if i > 1 and j > 1 else 0
            next_context = similarity(tokens[i]["text"], asr[j]["text"]) if i < n and j < m else 0
            match = prev[j - 1] + (2 * sim - 0.9) * (0.72 + 0.28 * rarity) + 0.24 * max(previous_context, next_context)
            skip_lyric = prev[j] + gap
            skip_asr = cur[j - 1] + gap
            best = max(match, skip_lyric, skip_asr)
            cur[j] = best
            back[i][j] = 0 if best == match else (1 if best == skip_lyric else 2)
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
    for idx, asr_idx in enumerate(matches):
        if asr_idx is None:
            continue
        previous = matches[idx - 1] if idx else None
        nxt = matches[idx + 1] if idx + 1 < len(matches) else None
        consecutive = (previous is not None and previous == asr_idx - 1) or (nxt is not None and nxt == asr_idx + 1)
        key = tokens[idx]["norm"]
        strong_unique = len(key) >= 4 and similarity(tokens[idx]["text"], asr[asr_idx]["text"]) >= 0.88 and freq.get(key, 0) == 1
        if consecutive or strong_unique:
            trusted[idx] = asr_idx

    refs: list[dict[str, Any] | None] = []
    for line_idx, indexes in enumerate(line_indexes):
        matched = [trusted[i] for i in indexes if trusted[i] is not None]
        if not matched:
            refs.append(None)
            continue
        refs.append(
            {
                "index": line_idx,
                "text": lines[line_idx],
                "start": asr[matched[0]]["start"],
                "end": asr[matched[-1]]["end"],
                "anchors": len(matched),
            }
        )
    return refs


def map_backend_to_original(backend_lines: list[dict[str, Any]], original: list[str]):
    buckets: dict[str, list[int]] = {}
    for i, line in enumerate(original):
        buckets.setdefault(norm(line), []).append(i)

    used: set[int] = set()
    mapped = []
    cursor = 0
    for line in backend_lines:
        text = str(line.get("text") or "").strip()
        key = norm(text)
        candidates = [i for i in buckets.get(key, []) if i not in used and i >= cursor]
        if not candidates:
            candidates = [i for i in buckets.get(key, []) if i not in used]
        if candidates:
            index = candidates[0]
        else:
            scored = [
                (similarity(text, original[i]), i)
                for i in range(cursor, len(original))
                if i not in used
            ]
            score, index = max(scored, default=(0.0, -1))
            if score < 0.72:
                index = -1
        if index >= 0:
            used.add(index)
            cursor = max(cursor, index + 1)
        mapped.append((index, line))
    return mapped


def nearest_reference_index(refs: list[dict[str, Any] | None], start: float) -> int | None:
    candidates = [(abs(ref["start"] - start), i) for i, ref in enumerate(refs) if ref is not None]
    return min(candidates)[1] if candidates else None


def analyze(song: dict[str, Any], backend: dict[str, Any], refs: list[dict[str, Any] | None]):
    lyrics = str(song.get("lyrics") or "")
    original = lyric_lines(lyrics)
    backend_lines = backend.get("lines") or []
    rows = []
    for original_index, line in map_backend_to_original(backend_lines, original):
        if original_index < 0 or original_index >= len(refs):
            continue
        ref = refs[original_index]
        if not ref:
            continue
        bstart = float(line.get("start", 0))
        bend = float(line.get("end", bstart))
        nearest = nearest_reference_index(refs, bstart)
        rows.append(
            {
                "line": original_index + 1,
                "text": original[original_index],
                "backend_start": round(bstart, 3),
                "reference_start": round(float(ref["start"]), 3),
                "start_delta": round(bstart - float(ref["start"]), 3),
                "backend_end": round(bend, 3),
                "reference_end": round(float(ref["end"]), 3),
                "end_delta": round(bend - float(ref["end"]), 3),
                "nearest_reference_line": (nearest + 1) if nearest is not None else None,
                "line_shift": (original_index - nearest) if nearest is not None else None,
                "reference_anchors": ref["anchors"],
            }
        )

    deltas = [r["start_delta"] for r in rows]
    shifts = [r["line_shift"] for r in rows if r["line_shift"] is not None]
    summary = {
        "song_url": SONG_URL,
        "title": song.get("title"),
        "song_id": song.get("id"),
        "duration": song.get("duration"),
        "resolved_by": song.get("_resolved_by"),
        "backend_engine": (backend.get("meta") or {}).get("engine"),
        "backend_line_count": len(backend_lines),
        "reference_line_count": sum(1 for x in refs if x),
        "compared_lines": len(rows),
        "median_start_delta": round(statistics.median(deltas), 3) if deltas else None,
        "mean_start_delta": round(statistics.mean(deltas), 3) if deltas else None,
        "p90_abs_start_delta": round(sorted(abs(x) for x in deltas)[max(0, math.ceil(len(deltas) * 0.9) - 1)], 3) if deltas else None,
        "median_line_shift": statistics.median(shifts) if shifts else None,
        "early_lines": sum(1 for x in deltas if x < -MAX_EARLY_SECONDS),
        "late_lines": sum(1 for x in deltas if x > MAX_EARLY_SECONDS),
        "threshold_seconds": MAX_EARLY_SECONDS,
    }
    return summary, rows


def markdown(summary: dict[str, Any], rows: list[dict[str, Any]]) -> str:
    out = [
        "# Karaoke benchmark",
        "",
        f"- Song: {summary.get('title')} ({summary.get('song_id')})",
        f"- Backend engine: {summary.get('backend_engine')}",
    ]
    if "backend_align_http" in summary:
        out += [
            f"- Production align HTTP: {summary.get('backend_align_http')}",
            f"- Production align error: {summary.get('backend_align_error')}",
            f"- Workers AI raw words: {summary.get('backend_raw_words')}",
            f"- Workers AI anchored lines: {summary.get('workers_anchored_lines')}",
            f"- faster-whisper anchored lines: {summary.get('local_anchored_lines')}",
            f"- Turbo raw anchors: {summary.get('turbo_raw_anchored_lines')}",
            f"- Turbo guided anchors: {summary.get('turbo_guided_anchored_lines')}",
            f"- Selected local mode: {summary.get('selected_local_mode')}",
            f"- Median WorkersAI - faster-whisper start: {summary.get('median_workers_minus_local')}s",
            "",
            "| # | Workers AI | faster-whisper | Δ | WA anchors | local anchors | text |",
            "|---:|---:|---:|---:|---:|---:|---|",
        ]
        for row in rows[:100]:
            text = row["text"].replace("|", "\\|")[:80]
            out.append(
                f"| {row['line']} | {row.get('workers_start')} | {row.get('local_start')} | {row.get('workers_minus_local')} | {row.get('workers_anchors')} | {row.get('local_anchors')} | {text} |"
            )
    else:
        out += [
            f"- Compared lines: {summary.get('compared_lines')}",
            f"- Median start delta: {summary.get('median_start_delta')}s (negative = production is early)",
            f"- P90 absolute start delta: {summary.get('p90_abs_start_delta')}s",
            f"- Median line shift: {summary.get('median_line_shift')}",
            f"- Early lines beyond threshold: {summary.get('early_lines')}",
            "",
            "| # | Backend | Reference | Δ start | nearest ref line | shift | text |",
            "|---:|---:|---:|---:|---:|---:|---|",
        ]
        for row in rows[:80]:
            text = row["text"].replace("|", "\\|")[:80]
            out.append(
                f"| {row['line']} | {row['backend_start']:.3f} | {row['reference_start']:.3f} | {row['start_delta']:+.3f} | {row['nearest_reference_line']} | {row['line_shift']} | {text} |"
            )
    return "\n".join(out) + "\n"

def main() -> int:
    song = resolve_song()
    lyrics = str(song.get("lyrics") or "").strip()
    if not lyrics:
        raise RuntimeError("Song has no lyrics")
    duration = float(song.get("duration") or 0)

    with tempfile.TemporaryDirectory(prefix="sunodown-bench-") as tmp:
        audio_path = Path(tmp) / "song.mp3"
        audio_bytes = download_audio(song, audio_path)
        print(f"[bench] resolved {song.get('title')} id={song.get('id')} duration={duration}s audio={len(audio_bytes)/1024/1024:.2f}MB")
        raw_status, raw_backend = call_prod_backend(audio_path, "", duration)
        print(
            f"[bench] production raw transcription HTTP={raw_status} "
            f"engine={(raw_backend.get('meta') or {}).get('engine')} "
            f"words={len(raw_backend.get('words') or [])}"
        )
        if raw_status != 200:
            raise RuntimeError(f"production raw transcription HTTP {raw_status}: {raw_backend}")

        align_status, backend = call_prod_backend(audio_path, lyrics, duration)
        print(
            f"[bench] production lyric alignment HTTP={align_status} "
            f"engine={(backend.get('meta') or {}).get('engine')} "
            f"lines={len(backend.get('lines') or [])}"
        )

        production_words = [
            {
                "text": str(word.get("text") or word.get("word") or "").strip(),
                "start": float(word.get("start") or 0),
                "end": float(word.get("end") or 0),
                "probability": float(word.get("probability") or word.get("confidence") or 0),
            }
            for word in (raw_backend.get("words") or [])
            if str(word.get("text") or word.get("word") or "").strip()
        ]

        raw_asr, raw_segments = transcribe_local(audio_path, lyrics, guided=False)
        guided_asr, guided_segments = transcribe_local(audio_path, lyrics, guided=True)
        print(
            f"[bench] independent faster-whisper model={MODEL_NAME} "
            f"raw_words={len(raw_asr)} guided_words={len(guided_asr)}"
        )

        original_lines = lyric_lines(lyrics)
        workers_refs = align_reference(original_lines, production_words)
        raw_refs = align_reference(original_lines, raw_asr)
        guided_refs = align_reference(original_lines, guided_asr)

        workers_anchored = sum(1 for ref in workers_refs if ref)
        raw_anchored = sum(1 for ref in raw_refs if ref)
        guided_anchored = sum(1 for ref in guided_refs if ref)
        local_refs = guided_refs if guided_anchored >= raw_anchored else raw_refs
        local_asr = guided_asr if guided_anchored >= raw_anchored else raw_asr
        local_mode = "guided" if guided_anchored >= raw_anchored else "raw"

        print(
            f"[bench] anchored lyric lines workers-ai={workers_anchored} "
            f"turbo-raw={raw_anchored} turbo-guided={guided_anchored} "
            f"selected={local_mode}"
        )
        print("[bench] workers-ai first words:", " | ".join(word["text"] for word in production_words[:40]))
        print("[bench] selected first words:", " | ".join(word["text"] for word in local_asr[:60]))

        diagnostic_rows = []
        for idx, text in enumerate(original_lines):
            wr = workers_refs[idx] if idx < len(workers_refs) else None
            lr = local_refs[idx] if idx < len(local_refs) else None
            if wr or lr:
                diagnostic_rows.append({
                    "line": idx + 1,
                    "text": text,
                    "workers_start": round(wr["start"], 3) if wr else None,
                    "local_start": round(lr["start"], 3) if lr else None,
                    "workers_minus_local": round(wr["start"] - lr["start"], 3) if wr and lr else None,
                    "workers_anchors": wr["anchors"] if wr else 0,
                    "local_anchors": lr["anchors"] if lr else 0,
                })

        if align_status == 200 and backend.get("lines"):
            summary, rows = analyze(song, backend, local_refs)
        else:
            deltas = [
                row["workers_minus_local"]
                for row in diagnostic_rows
                if row["workers_minus_local"] is not None
            ]
            summary = {
                "song_url": SONG_URL,
                "title": song.get("title"),
                "song_id": song.get("id"),
                "duration": song.get("duration"),
                "resolved_by": song.get("_resolved_by"),
                "backend_engine": (raw_backend.get("meta") or {}).get("engine"),
                "backend_align_http": align_status,
                "backend_align_error": backend.get("error") or backend.get("detail"),
                "backend_raw_words": len(production_words),
                "workers_anchored_lines": workers_anchored,
                "turbo_raw_anchored_lines": raw_anchored,
                "turbo_guided_anchored_lines": guided_anchored,
                "selected_local_mode": local_mode,
                "local_anchored_lines": max(raw_anchored, guided_anchored),
                "compared_lines": len(deltas),
                "median_workers_minus_local": round(statistics.median(deltas), 3) if deltas else None,
                "mean_workers_minus_local": round(statistics.mean(deltas), 3) if deltas else None,
                "threshold_seconds": MAX_EARLY_SECONDS,
            }
            rows = diagnostic_rows

    Path("bench-result.json").write_text(
        json.dumps({"summary": summary, "rows": rows}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    Path("bench-report.md").write_text(markdown(summary, rows), encoding="utf-8")

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print("\n" + markdown(summary, rows))

    # This benchmark is intentionally strict: a global early offset or a
    # phrase-index shift means production timing is not ready to be trusted.
    if not rows:
        print("BENCH_FAIL: no comparable lyric lines", file=sys.stderr)
        return 2
    if summary.get("backend_align_http") != 200:
        print(
            f"BENCH_FAIL: production backend cannot align this real song "
            f"(HTTP {summary.get('backend_align_http')})",
            file=sys.stderr,
        )
        return 5
    median_delta = summary.get("median_start_delta")
    if median_delta is not None and median_delta < -MAX_EARLY_SECONDS:
        print(f"BENCH_FAIL: production subtitles are globally early by median {median_delta}s", file=sys.stderr)
        return 3
    if any(abs(int(row["line_shift"])) >= 1 for row in rows if row.get("line_shift") is not None):
        shifted = [row for row in rows if row.get("line_shift") not in (None, 0)]
        if len(shifted) >= max(2, math.ceil(len(rows) * 0.15)):
            print(f"BENCH_FAIL: {len(shifted)} lines map closer to the wrong reference phrase", file=sys.stderr)
            return 4
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
