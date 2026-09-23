import type { AlignedLyricLine, TranscriptWord } from './lyrics-alignment';
import { alignTranscriptToLyrics } from './lyrics-alignment';

export type SunoAlignedWord={word?:string;text?:string;start_s:number;end_s:number;success?:boolean;p_align?:number};
export type SunoAlignedResponse={aligned_words?:SunoAlignedWord[];aligned_lyrics?:Array<{text?:string;start_s?:number;end_s?:number;words?:SunoAlignedWord[]}>};

function validWord(w:SunoAlignedWord){return Boolean((w.word||w.text)?.trim())&&Number.isFinite(w.start_s)&&Number.isFinite(w.end_s)&&w.end_s>=w.start_s}
export function parseSunoAlignedWords(data:SunoAlignedResponse):TranscriptWord[]{return (data.aligned_words||[]).filter(validWord).map(w=>({word:(w.word||w.text||'').trim(),start:w.start_s,end:w.end_s,confidence:typeof w.p_align==='number'?w.p_align:(w.success===false?0.35:1)}))}
export function timelineFromSuno(lyrics:string,data:SunoAlignedResponse):AlignedLyricLine[]{
 const direct=(data.aligned_lyrics||[]).map(line=>{const ws=(line.words||[]).filter(validWord);const start=ws.length?ws[0].start_s:line.start_s,end=ws.length?ws[ws.length-1].end_s:line.end_s;if(!line.text||!Number.isFinite(start)||!Number.isFinite(end))return null;return {text:line.text.trim(),start:start!,end:end!,confidence:ws.length?ws.reduce((s,w)=>s+(w.p_align??(w.success===false?.35:1)),0)/ws.length:.8,words:ws.map(w=>({word:(w.word||w.text||'').trim(),start:w.start_s,end:w.end_s,confidence:w.p_align}))} as AlignedLyricLine}).filter(Boolean) as AlignedLyricLine[];
 if(direct.length)return direct;
 return alignTranscriptToLyrics(lyrics,parseSunoAlignedWords(data));
}
