const ROOT = '[A-G](?:#|b)?';
const QUALITY =
  '(?:(?:maj|min|dim|aug|sus|add|m)?(?:2|4|5|6|7|9|11|13)?(?:maj7|m7|m9|m11|m13)?(?:[#b](?:5|9|11|13))*)?';
const CHORD = new RegExp(`^${ROOT}${QUALITY}(?:\\/${ROOT})?$`, 'i');

function isChordToken(value: string) {
  const token = value.trim().replace(/[.,;:!?]+$/, '');
  if (CHORD.test(token)) return true;
  // Common chord-sheet variants: Am/C, Cmaj7/G, F#m7b5, Bbadd9, etc.
  return /^[A-G](?:#|b)?(?:(?:maj|min|dim|aug|sus|add|m)?(?:2|4|5|6|7|9|11|13)?(?:maj7|m7|m9|m11|m13)?(?:[#b](?:5|9|11|13))*)?(?:\/[A-G](?:#|b)?)?$/i.test(
    token,
  );
}
function stripBracketChord(match: string, inner: string) {
  return isChordToken(inner) ? '' : match;
}

const SECTION_LABEL =
  /^\s*[[({]?\s*(?:verse|chorus|bridge|intro|outro|pre[ -]?chorus|post[ -]?chorus|hook|instrumental|break|interlude|refrain|solo)(?:\s+\d+)?\s*[\])}]?:?\s*$/i;
const COMPLEX_BARE_CHORD =
  /^[A-G](?:#|b)?(?:(?:maj|min|dim|aug|sus|add|m)(?:2|4|5|6|7|9|11|13)?|(?:2|4|5|6|7|9|11|13))(?:[#b](?:5|9|11|13))?(?:\/[A-G](?:#|b)?)?$/;

export function isLyricSectionLabel(value: string) {
  return SECTION_LABEL.test(value.trim());
}

/** Removes guitar/piano chord notation while preserving normal lyric text and section labels. */
export function cleanLyricsForVideo(input: string | null | undefined) {
  if (!input) return '';
  return input
    .replace(/\[([^\]\n]{1,16})\]/g, stripBracketChord)
    .split(/\r?\n/)
    .map((line) => {
      // Chord-only lines: "G  Em  C  D/F#".
      const tokens = line.trim().split(/\s+/).filter(Boolean);
      if (tokens.length && tokens.every(isChordToken)) return '';
      // Common inline chord sheets may use (Am), {G7}, etc.; only remove when content is a valid chord.
      return (
        line
          .replace(/\(([^()\n]{1,16})\)/g, (m, x) => (isChordToken(x) ? '' : m))
          .replace(/\{([^{}\n]{1,16})\}/g, (m, x) => (isChordToken(x) ? '' : m))
          .split(/(\s+)/)
          .filter(
            (token) =>
              /^\s+$/.test(token) ||
              token.replace(/[.,;:!?]+$/, '') === 'Em' ||
              !COMPLEX_BARE_CHORD.test(token.replace(/[.,;:!?]+$/, '')),
          )
          .join('')
          // Do not remove unwrapped single tokens such as "Em": in Vietnamese lyrics
          // those can be real words. Bare chords are removed only when the whole
          // line is chord notation (handled above); inline chords must be bracketed.
          .replace(/[ \t]{2,}/g, ' ')
          .trim()
      );
    })
    .filter(
      (line, index, all) =>
        line !== '' ||
        (index > 0 &&
          index < all.length - 1 &&
          all[index - 1] !== '' &&
          all[index + 1] !== ''),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** One authoritative input for recognition, preview, export and downloads. */
export function lyricLinesForKaraoke(input: string | null | undefined) {
  return cleanLyricsForVideo(input)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !/^\s*\[[^\]]+]\s*$/.test(line) &&
        !isLyricSectionLabel(line) &&
        !/^[\s\p{P}\p{S}]+$/u.test(line),
    );
}
