const ROOT='[A-G](?:#|b)?';
const QUALITY='(?:maj|min|m|dim|aug|sus|add)?(?:2|4|5|6|7|9|11|13)?(?:maj7|m7|m9)?';
const CHORD=new RegExp(`^${ROOT}${QUALITY}(?:\\/${ROOT})?$`,'i');

function isChordToken(value:string){return CHORD.test(value.trim());}
function stripBracketChord(match:string,inner:string){return isChordToken(inner)?'':match;}

/** Removes guitar/piano chord notation while preserving normal lyric text and section labels. */
export function cleanLyricsForVideo(input:string|null|undefined){
 if(!input)return '';
 return input
  .replace(/\[([^\]\n]{1,16})\]/g,stripBracketChord)
  .split(/\r?\n/)
  .map(line=>{
    // Chord-only lines: "G  Em  C  D/F#".
    const tokens=line.trim().split(/\s+/).filter(Boolean);
    if(tokens.length&&tokens.every(isChordToken))return '';
    // Common inline chord sheets may use (Am), {G7}, etc.; only remove when content is a valid chord.
    return line
      .replace(/\(([^()\n]{1,16})\)/g,(m,x)=>isChordToken(x)?'':m)
      .replace(/\{([^{}\n]{1,16})\}/g,(m,x)=>isChordToken(x)?'':m)
      .replace(/[ \t]{2,}/g,' ')
      .trim();
  })
  .filter((line,index,all)=>line!==''||(index>0&&index<all.length-1&&all[index-1]!==''&&all[index+1]!==''))
  .join('\n')
  .replace(/\n{3,}/g,'\n\n')
  .trim();
}
