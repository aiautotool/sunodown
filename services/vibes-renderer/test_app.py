from app import build_storyboard, clean_lines, visual_bible


def test_clean_lines_removes_section_labels():
    assert clean_lines("[Verse]\nHello world\n\n[Chorus]\nSing again") == ["Hello world", "Sing again"]


def test_storyboard_is_bounded_and_contains_visual_guardrails():
    lyrics = "\n".join(f"line {index}" for index in range(30))
    scenes = build_storyboard(lyrics, "dreamy neon", duration=180, scene_seconds=5, max_unique_scenes=12)
    assert len(scenes) == 12
    assert scenes[0]["duration"] == 5
    assert "dreamy neon" in scenes[0]["prompt"]
    assert "without text" in scenes[0]["prompt"]
    assert "CONTINUITY LOCK" in scenes[0]["prompt"]
    assert "Never change their facial identity" in scenes[1]["prompt"]
    assert scenes[0]["reference_prompt"] == scenes[-1]["reference_prompt"]


def test_visual_bible_matches_lyrics_but_locks_cast():
    bible = visual_bible("Bình Yên", "Anh và em bên cửa sổ", "Vietnamese acoustic ballad")
    assert "Vietnamese couple" in bible["cast"]
    assert "sunlit window" in bible["world"]
