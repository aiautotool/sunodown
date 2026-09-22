from app import build_storyboard, clean_lines


def test_clean_lines_removes_section_labels():
    assert clean_lines("[Verse]\nHello world\n\n[Chorus]\nSing again") == ["Hello world", "Sing again"]


def test_storyboard_is_bounded_and_contains_visual_guardrails():
    lyrics = "\n".join(f"line {index}" for index in range(30))
    scenes = build_storyboard(lyrics, "dreamy neon", duration=180, scene_seconds=5, max_unique_scenes=12)
    assert len(scenes) == 12
    assert scenes[0]["duration"] == 5
    assert "dreamy neon" in scenes[0]["prompt"]
    assert "without text" in scenes[0]["prompt"]

