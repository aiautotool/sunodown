import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanLyricsForVideo,
  lyricLinesForKaraoke,
} from '../components/v4/lyrics-clean.ts';
import {
  alignRoughWordsToLyrics,
  karaokeOverlayState,
  normalizeKaraokeTimeline,
} from '../app/lib/karaoke.ts';
import {
  alignKnownLyricsGlobally,
  alignKnownLyricsToSegments,
} from '../app/lib/karaoke-known-lyrics-align.ts';
import { validateKaraokeTimeline } from '../app/lib/karaoke-validation.ts';
import { refineKaraokeTimelineToRhythm } from '../app/lib/karaoke-rhythm.ts';

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


void test('known-lyrics aligner swallows hallucinated intro segments and starts on real vocal', () => {
  const aligned = alignKnownLyricsToSegments(
    'Có những năm ta từng vội vã, cứ nghĩ đời còn dài\nCó những người đi qua rồi, mới hiểu ai thương mình thôi',
    [
      {
        text: 'âm nhạc mở đầu',
        start: 2,
        end: 5,
        words: [
          { text: 'âm', start: 2, end: 2.3 },
          { text: 'nhạc', start: 2.4, end: 2.8 },
        ],
      },
      {
        text: 'yeah oh',
        start: 10,
        end: 13,
        words: [
          { text: 'yeah', start: 10, end: 10.5 },
          { text: 'oh', start: 11, end: 11.6 },
        ],
      },
      {
        text: 'Có những năm ta từng vội vã cứ nghĩ đời còn dài',
        start: 24,
        end: 29,
        words: [
          { text: 'Có', start: 24, end: 24.2 },
          { text: 'những', start: 24.2, end: 24.5 },
          { text: 'năm', start: 24.5, end: 24.8 },
          { text: 'ta', start: 24.8, end: 25.0 },
          { text: 'từng', start: 25.0, end: 25.3 },
          { text: 'vội', start: 25.3, end: 25.5 },
          { text: 'vã', start: 25.5, end: 25.8 },
        ],
      },
      {
        text: 'Có những người đi qua rồi mới hiểu ai thương mình thôi',
        start: 30,
        end: 35,
        words: [
          { text: 'Có', start: 30, end: 30.2 },
          { text: 'những', start: 30.2, end: 30.5 },
          { text: 'người', start: 30.5, end: 30.8 },
          { text: 'đi', start: 30.8, end: 31.0 },
          { text: 'qua', start: 31.0, end: 31.3 },
          { text: 'rồi', start: 31.3, end: 31.6 },
        ],
      },
    ],
    180,
  );

  assert.equal(aligned.timeline.length, 2);
  assert.ok(aligned.firstVocalAt !== null);
  assert.ok(aligned.firstVocalAt! > 23.5);
  assert.ok(aligned.timeline.every((line) => line.start > 23.5));
});

void test('known-lyrics aligner leaves unmatched lyrics as honest gaps instead of inventing intro timing', () => {
  const aligned = alignKnownLyricsToSegments(
    'Câu không hề được hát\nCâu thật sự được hát',
    [
      {
        text: 'nhạc dạo không lời',
        start: 1,
        end: 12,
        words: [],
      },
      {
        text: 'Câu thật sự được hát',
        start: 20,
        end: 23,
        words: [
          { text: 'Câu', start: 20, end: 20.2 },
          { text: 'thật', start: 20.2, end: 20.5 },
          { text: 'sự', start: 20.5, end: 20.7 },
          { text: 'được', start: 20.7, end: 21.0 },
          { text: 'hát', start: 21.0, end: 21.4 },
        ],
      },
    ],
    60,
  );

  assert.equal(aligned.timeline.length, 1);
  assert.equal(aligned.timeline[0].text, 'Câu thật sự được hát');
  assert.ok(aligned.timeline[0].start > 19.5);
});


void test('preview never shows the next lyric before its start time', () => {
  const line = {
    text: 'Câu hát thật',
    start: 25,
    end: 29,
    words: [
      { text: 'Câu', start: 25, end: 25.4 },
      { text: 'hát', start: 25.5, end: 26.1 },
      { text: 'thật', start: 26.2, end: 27 },
    ],
  };
  const before = karaokeOverlayState([line], 22);
  assert.equal(before.line, null);
  assert.equal(before.next, null);

  const active = karaokeOverlayState([line], 25.2);
  assert.equal(active.line?.text, 'Câu hát thật');
});


void test('global aligner recovers useful subtitle cues when strict local matching is too sparse', () => {
  const lyrics =
    'Có những năm ta từng vội vã cứ nghĩ đời còn dài\n' +
    'Có những người đi qua rồi mới hiểu ai thương mình thôi\n' +
    'Có những đêm ôm bao được mất sáng ra chẳng giữ được gì';

  const aligned = alignKnownLyricsGlobally(
    lyrics,
    [
      {
        text: 'la la instrumental',
        start: 2,
        end: 7,
        words: [],
      },
      {
        text: 'co nhung nam ta tung voi va cu nghi doi con dai',
        start: 23.8,
        end: 29.1,
        words: [
          { text: 'co', start: 23.8, end: 24.0 },
          { text: 'nhung', start: 24.0, end: 24.3 },
          { text: 'nam', start: 24.3, end: 24.6 },
          { text: 'ta', start: 24.6, end: 24.8 },
          { text: 'tung', start: 24.8, end: 25.1 },
          { text: 'voi', start: 25.1, end: 25.4 },
          { text: 'va', start: 25.4, end: 25.7 },
        ],
      },
      {
        text: 'co nhung nguoi di qua roi moi hieu ai thuong minh',
        start: 29.6,
        end: 35.0,
        words: [
          { text: 'co', start: 29.6, end: 29.8 },
          { text: 'nhung', start: 29.8, end: 30.1 },
          { text: 'nguoi', start: 30.1, end: 30.4 },
          { text: 'di', start: 30.4, end: 30.6 },
          { text: 'qua', start: 30.6, end: 30.9 },
          { text: 'roi', start: 30.9, end: 31.2 },
        ],
      },
      {
        text: 'co nhung dem om bao duoc mat sang ra chang giu duoc gi',
        start: 36.0,
        end: 41.5,
        words: [
          { text: 'co', start: 36.0, end: 36.2 },
          { text: 'nhung', start: 36.2, end: 36.5 },
          { text: 'dem', start: 36.5, end: 36.8 },
          { text: 'om', start: 36.8, end: 37.0 },
          { text: 'bao', start: 37.0, end: 37.3 },
        ],
      },
    ],
    180,
  );

  assert.ok(aligned.timeline.length >= 2);
  assert.ok((aligned.firstVocalAt ?? 0) > 23);
  assert.ok(aligned.timeline.every((line) => line.start > 23));
});


void test('validator never lets a cue start before its first timed word', () => {
  const report = validateKaraokeTimeline(
    [
      {
        text: 'Bắt đầu hát',
        start: 18,
        end: 22,
        words: [
          { text: 'Bắt', start: 20.2, end: 20.5 },
          { text: 'đầu', start: 20.55, end: 20.9 },
          { text: 'hát', start: 21, end: 21.5 },
        ],
      },
    ],
    30,
    { lyrics: 'Bắt đầu hát', source: 'timed' },
  );

  assert.equal(report.timeline[0].start, 20.2);
  assert.equal(report.firstVocalAt, 20.2);
  assert.ok(report.issues.some((issue) => issue.code === 'cue_before_first_word'));
});

void test('estimated timing is explicitly low-confidence fallback material', () => {
  const report = validateKaraokeTimeline(
    [
      {
        text: 'Một câu ước tính',
        start: 2,
        end: 5,
        words: [
          { text: 'Một', start: 2, end: 3 },
          { text: 'câu', start: 3, end: 4 },
          { text: 'ước', start: 4, end: 4.5 },
          { text: 'tính', start: 4.5, end: 5 },
        ],
      },
    ],
    20,
    { lyrics: 'Một câu ước tính', source: 'estimated' },
  );

  assert.equal(report.source, 'estimated');
  assert.ok(report.confidence <= 35);
});

void test('validator penalizes sparse known-lyrics alignment', () => {
  const lyrics = [
    'câu thứ nhất',
    'câu thứ hai',
    'câu thứ ba',
    'câu thứ tư',
    'câu thứ năm',
  ].join('\n');
  const report = validateKaraokeTimeline(
    [
      {
        text: 'câu thứ nhất',
        start: 12,
        end: 14,
        words: [
          { text: 'câu', start: 12, end: 12.4 },
          { text: 'thứ', start: 12.5, end: 13 },
          { text: 'nhất', start: 13.1, end: 13.8 },
        ],
      },
    ],
    60,
    { lyrics, source: 'timed' },
  );

  assert.ok(report.coverage < 0.45);
  assert.ok(report.issues.some((issue) => issue.code === 'low_lyric_coverage'));
  assert.ok(report.confidence < 60);
});


void test('rhythm bridge keeps skipped ASR word timing for a misheard lyric word', () => {
  const timeline = alignRoughWordsToLyrics(
    'xin chào em nhé',
    [
      { text: 'xin', start: 1.0, end: 1.18 },
      { text: 'la', start: 1.34, end: 1.58 },
      { text: 'em', start: 1.92, end: 2.12 },
      { text: 'nhé', start: 2.28, end: 2.55 },
    ],
    5,
  );

  const word = timeline[0]?.words.find((item) => item.text === 'chào');
  assert.ok(word);
  assert.ok(Math.abs(word.start - 1.34) < 0.03);
  assert.ok(Math.abs(word.end - 1.58) < 0.04);
});

void test('rhythm refinement snaps a word to a strong nearby onset without showing it early', () => {
  const refined = refineKaraokeTimelineToRhythm(
    [
      {
        text: 'Bắt đầu',
        start: 9.8,
        end: 10.8,
        words: [
          { text: 'Bắt', start: 10.0, end: 10.28 },
          { text: 'đầu', start: 10.42, end: 10.72 },
        ],
      },
    ],
    [
      { time: 9.82, strength: 1 },
      { time: 10.075, strength: 1 },
      { time: 10.45, strength: 0.9 },
    ],
    20,
  );

  assert.ok(refined[0].start >= 10);
  assert.ok(Math.abs(refined[0].words[0].start - 10.075) < 0.01);
  assert.ok(Math.abs(refined[0].words[1].start - 10.45) < 0.01);
});

void test('rhythm refinement preserves a real breath instead of stretching highlight', () => {
  const refined = refineKaraokeTimelineToRhythm(
    [
      {
        text: 'anh nhớ em',
        start: 1,
        end: 2.7,
        words: [
          { text: 'anh', start: 1, end: 1.2 },
          { text: 'nhớ', start: 1.9, end: 2.1 },
          { text: 'em', start: 2.3, end: 2.55 },
        ],
      },
    ],
    [{ time: 8, strength: 1 }],
    10,
  );

  assert.ok(refined[0].words[0].end <= 1.21);
  assert.ok(refined[0].words[1].start >= 1.89);
});
