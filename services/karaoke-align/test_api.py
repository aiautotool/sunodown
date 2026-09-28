"""Contract tests without downloading an ASR model. Run: python -m unittest test_api."""
import importlib.util
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

fake_whisper = types.ModuleType("faster_whisper")
fake_whisper.WhisperModel = lambda *args, **kwargs: object()
spec = importlib.util.spec_from_file_location("align_test_app", Path(__file__).with_name("main.py"))
api = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {"faster_whisper": fake_whisper}), patch.dict(os.environ, {"KARAOKE_ALIGN_TOKEN": "test-token", "DISABLE_DEMUCS": "1"}):
    spec.loader.exec_module(api)


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(api.app)
        self.headers = {"Authorization": "Bearer test-token"}
        self.words = [
            {"text": "Xin", "norm": "xin", "start": 0.1, "end": 0.4, "confidence": 0.9},
            {"text": "chào", "norm": "chào", "start": 0.4, "end": 0.9, "confidence": 0.9},
        ]

    def post(self, **data):
        return self.client.post("/api/karaoke/align", headers=self.headers,
                                files={"audio": ("karaoke-7.wav", b"test-audio", "audio/wav")},
                                data={"duration": "24", "language": "vi", **data})

    def test_curl_contract_without_lyrics(self):
        with patch.object(api, "transcribe_words", return_value=self.words):
            response = self.post()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["lines"][0]["text"], "Xin chào")
        self.assertEqual(response.json()["words"][1]["end"], 0.9)

    def test_optional_lyrics(self):
        with patch.object(api, "transcribe_words", return_value=self.words):
            response = self.post(lyrics="[Verse]\nXin chào")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["meta"]["match_rate"], 1)

    def test_auth(self):
        self.headers = {}
        self.assertEqual(self.post().status_code, 401)

    def test_invalid_duration(self):
        for duration in ["nan", "inf", "-1", "0"]:
            self.assertEqual(self.post(duration=duration).status_code, 400)

    def test_busy(self):
        with api.inference_lock:
            self.assertEqual(self.post().status_code, 429)

    def test_no_speech(self):
        with patch.object(api, "transcribe_words", return_value=[]):
            self.assertEqual(self.post().status_code, 422)
        self.assertFalse(api.inference_lock.locked())

    def test_empty_audio(self):
        response = self.client.post("/api/karaoke/align", headers=self.headers,
                                    files={"audio": ("empty.wav", b"", "audio/wav")})
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
