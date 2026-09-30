import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { normalizeSettings, DEFAULT_SETTINGS, applySubtitleOffset } from '../app/lib/studio-settings.ts';

void test('corrupt settings fall back safely, enums cannot select unsupported codecs or engines', () => {
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  const value = normalizeSettings({ fps: 120, aspect: 'bad', previewQuality: 'high', keepAwake: 'false', apiToken: 'secret', subtitleOffset: Infinity });
  assert.equal(value.fps, 30);
  assert.equal(value.aspect, '9:16');
  assert.equal(value.keepAwake, true);
  assert.equal(value.previewQuality, 'high');
  assert.equal(value.subtitleOffset, 0);
  assert.ok(!('apiToken' in value));
});
void test('numeric settings stay within safe bounds and accept false booleans', () => {
  const value = normalizeSettings({ snapInterval: 0, zoom: 100, subtitleOffset: -99999, keepAwake: false });
  assert.equal(value.snapInterval, 0.01);
  assert.equal(value.zoom, 5);
  assert.equal(value.subtitleOffset, -5000);
  assert.equal(value.keepAwake, false);
});
void test('subtitle offset preserves originals and clips words and lines to song boundaries', () => {
  const source = [{ text: 'hello', start: 0.1, end: 0.8, words: [{ text: 'hello', start: 0.1, end: 0.8 }] }, { text: 'bye', start: 1.5, end: 2, words: [{ text: 'bye', start: 1.5, end: 2 }] }];
  const before = structuredClone(source);
  const shifted = applySubtitleOffset(source, 2, -500);
  assert.equal(shifted[0].start, 0);
  assert.equal(shifted[0].words[0].start, 0);
  assert.equal(shifted[1].start, 1);
  assert.deepEqual(source, before);
  const late = applySubtitleOffset(source, 2, 600);
  assert.equal(late.length, 1);
  assert.ok(late.every(line => line.end > line.start && line.words.every(word => word.end > word.start)));
});
