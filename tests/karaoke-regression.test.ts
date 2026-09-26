import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanLyricsForVideo,
  lyricLinesForKaraoke,
} from '../components/v4/lyrics-clean.ts';
import {
  alignRoughWordsToLyrics,
  normalizeKaraokeTimeline,
} from '../app/lib/karaoke.ts';

void test('removes bracketed and unambiguous bare chords from every karaoke input', () => {
  const input =
    '[Verse 1]\n[Am] Anh (Em) còn {G} yêu F#m7 em Cmaj7/G nhiều [F#7sus4] [Bmadd9]\nG  Em  C  D/F#';
  assert.deepEqual(lyricLinesForKaraoke(input), ['Anh còn yêu em nhiều']);
  assert.equal(cleanLyricsForVideo(input).includes('F#m7'), false);
  assert.equal(cleanLyricsForVideo(input).includes('Cmaj7/G'), false);
  assert.equal(cleanLyricsForVideo(input).includes('F#7sus4'), false);
  assert.equal(cleanLyricsForVideo(input).includes('Bmadd9'), false);
});

void test('never recognizes section labels as sung lyrics', () => {
  assert.deepEqual(
    lyricLinesForKaraoke(
      '[Intro]\n[Chorus]\nAnh yêu em\n(Bridge)\nInstrumental',
    ),
    ['Anh yêu em'],
  );
});

void test('keeps long ASR word duration instead of evenly retiming it', () => {
  const timeline = alignRoughWordsToLyrics(
    'Anh yêu em',
    [
      { text: 'Anh', start: 5, end: 5.2 },
      { text: 'yêu', start: 5.25, end: 7.4 },
      { text: 'em', start: 7.45, end: 7.7 },
    ],
    12,
  );
  const sustained = timeline[0].words.find((word) => word.text === 'yêu');
  assert.ok(sustained);
  assert.ok(sustained.end - sustained.start > 2);
});

void test('preserves instrumental gaps between recognized lines', () => {
  const timeline = alignRoughWordsToLyrics(
    'Câu đầu\nCâu sau',
    [
      { text: 'Câu', start: 2, end: 2.2 },
      { text: 'đầu', start: 2.25, end: 2.6 },
      { text: 'Câu', start: 8, end: 8.2 },
      { text: 'sau', start: 8.25, end: 8.6 },
    ],
    15,
  );
  assert.ok(timeline[0].end < 3);
  assert.ok(timeline[1].start > 7.8);
  assert.ok(timeline[1].start - timeline[0].end > 4);
});

void test('overlap repair clips locally without drifting later anchors', () => {
  const normalized = normalizeKaraokeTimeline(
    [
      {
        text: 'one',
        start: 1,
        end: 5,
        words: [{ text: 'one', start: 1, end: 5 }],
      },
      {
        text: 'two',
        start: 3,
        end: 4,
        words: [{ text: 'two', start: 3, end: 4 }],
      },
      {
        text: 'three',
        start: 10,
        end: 11,
        words: [{ text: 'three', start: 10, end: 11 }],
      },
    ],
    20,
  );
  assert.equal(normalized[1].start, 3);
  assert.equal(normalized[2].start, 10);
  assert.ok(normalized[0].end < normalized[1].start);
});

void test('repeated chorus remains monotonic and does not jump backward', () => {
  const words = [
    { text: 'anh', start: 2, end: 2.2 },
    { text: 'yêu', start: 2.3, end: 2.5 },
    { text: 'em', start: 2.6, end: 2.8 },
    { text: 'anh', start: 12, end: 12.2 },
    { text: 'yêu', start: 12.3, end: 12.5 },
    { text: 'em', start: 12.6, end: 12.8 },
  ];
  const timeline = alignRoughWordsToLyrics('anh yêu em\nanh yêu em', words, 20);
  assert.equal(timeline.length, 2);
  assert.ok(timeline[0].start < 3);
  assert.ok(timeline[1].start > 11);
});

void test('keeps a long intro instead of estimating lyrics near the beginning', () => {
  const timeline = alignRoughWordsToLyrics(
    'Bắt đầu hát',
    [
      { text: 'Bắt', start: 20, end: 20.2 },
      { text: 'đầu', start: 20.25, end: 20.5 },
      { text: 'hát', start: 20.55, end: 21 },
    ],
    30,
  );
  assert.ok(timeline[0].start > 19.8);
});

void test('preserves tightly spaced words in fast vocals', () => {
  const timeline = alignRoughWordsToLyrics(
    'một hai ba bốn',
    [
      { text: 'một', start: 1, end: 1.08 },
      { text: 'hai', start: 1.1, end: 1.18 },
      { text: 'ba', start: 1.2, end: 1.28 },
      { text: 'bốn', start: 1.3, end: 1.4 },
    ],
    5,
  );
  assert.ok(
    timeline[0].words.every(
      (word, index, words) => index === 0 || word.start >= words[index - 1].end,
    ),
  );
  assert.ok(timeline[0].end < 2);
});

void test('removes duet speaker labels without removing either singer lyrics', () => {
  assert.deepEqual(
    lyricLinesForKaraoke('[Singer A]\nAnh vẫn chờ\n[Singer B]\nEm vẫn đợi'),
    ['Anh vẫn chờ', 'Em vẫn đợi'],
  );
});

void test('does not accumulate drift near the end of a multi-minute song', () => {
  const lyrics = Array.from(
    { length: 20 },
    (_, index) => `dòng số ${index + 1}`,
  ).join('\n');
  const words = Array.from({ length: 20 }, (_, index) => [
    { text: 'dòng', start: 5 + index * 10, end: 5.2 + index * 10 },
    { text: 'số', start: 5.25 + index * 10, end: 5.4 + index * 10 },
    {
      text: String(index + 1),
      start: 5.45 + index * 10,
      end: 5.7 + index * 10,
    },
  ]).flat();
  const timeline = alignRoughWordsToLyrics(lyrics, words, 210);
  assert.equal(timeline.length, 20);
  assert.ok(Math.abs(timeline.at(-1)!.start - 195) < 0.2);
});
