#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import os
import re
import statistics
import subprocess
import tempfile
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

import requests
from faster_whisper import WhisperModel

SONG_URL=os.getenv("SONG_URL","https://suno.com/s/tszo0jGdVUua4rT4")
BASE_URL=os.getenv("BASE_URL","https://sunoapp.aiautotool.com").rstrip("/")
BENCH_AI_URL=os.getenv("BENCH_AI_URL","http://127.0.0.1:8791").rstrip("/")
MODEL=os.getenv("BENCH_WHISPER_MODEL","medium")
LANG=os.getenv("BENCH_LANGUAGE","vi")
CHUNK_SIZES=[float(x) for x in os.getenv("CHUNK_SIZES","24").split(",")]
CHUNK_OVERLAPS=[float(x) for x in os.getenv("CHUNK_OVERLAPS","0,4,6").split(",")]

NONWORD=re.compile(r"[^\wÀ-ỹĐđ]+",re.UNICODE)
SECTION_LABEL=re.compile(r"^\s*(?:\[?\s*(?:verse|chorus|bridge|intro|outro|pre[- ]?chorus|instrumental|hook)(?:\s+\d+)?\s*\]?|\((?:verse|chorus|bridge|intro|outro|pre[- ]?chorus|instrumental|hook)(?:\s+\d+)?\))\s*$",re.I)
CHORD=re.compile(r"^\[?(?:[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:/[A-G](?:#|b)?)?)\]?$",re.I)

def norm(v:str)->str:
    return NONWORD.sub("",unicodedata.normalize("NFC",v).lower())

def sim(a:str,b:str)->float:
    aa,bb=norm(a),norm(b)
    if not aa or not bb:return 0.0
    if aa==bb:return 1.0
    return SequenceMatcher(None,aa,bb).ratio()

def clean_line(line:str)->str:
    line=line.strip()
    if not line or SECTION_LABEL.match(line):return ""
    out=[]
    for token in line.split():
        if CHORD.match(token):continue
        token=re.sub(r"\[(?:[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:/[A-G](?:#|b)?)?)\]","",token,flags=re.I)
        if token.strip():out.append(token.strip())
    return " ".join(out)

def lyric_lines(lyrics:str)->list[str]:
    return [x for raw in lyrics.replace("\r","").split("\n") if (x:=clean_line(raw))]

def resolve()->dict[str,Any]:
    r=requests.post(f"{BASE_URL}/api/resolve",json={"input":SONG_URL},timeout=45);r.raise_for_status();return r.json()

def download(song:dict[str,Any],path:Path):
    u=str(song["audio"]);url=u if u.startswith("http") else f"{BASE_URL}{u}"
    r=requests.get(url,timeout=120);r.raise_for_status();path.write_bytes(r.content)

def call_turbo(path:Path)->dict[str,Any]:
    with path.open("rb") as fh:
        r=requests.post(f"{BENCH_AI_URL}/transcribe?model=turbo",files={"audio":("chunk.wav",fh,"audio/wav")},timeout=240)
    r.raise_for_status();return r.json()

def words_from_result(payload:dict[str,Any],offset:float):
    result=payload.get("result") if isinstance(payload.get("result"),dict) else payload
    out=[]
    for item in result.get("words") or []:
        t=str(item.get("word") or item.get("text") or "").strip();s=item.get("start");e=item.get("end")
        if t and isinstance(s,(int,float)) and isinstance(e,(int,float)):
            out.append({"text":t,"start":float(s)+offset,"end":float(e)+offset})
    if out:return out
    for seg in result.get("segments") or []:
        nested=seg.get("words") or []
        for item in nested:
            t=str(item.get("word") or item.get("text") or "").strip();s=item.get("start");e=item.get("end")
            if t and isinstance(s,(int,float)) and isinstance(e,(int,float)):
                out.append({"text":t,"start":float(s)+offset,"end":float(e)+offset})
    return out

def transcribe_chunked(audio:Path,duration:float,chunk_size:float,overlap:float,tmp:Path):
    candidates=[];diagnostics=[]
    step=max(4.0,chunk_size-overlap)
    start=0.0;index=0
    while start<duration-.05:
        length=min(chunk_size,duration-start)
        chunk=tmp/f"chunk-{int(chunk_size)}-o{int(overlap)}-{index}.wav"
        subprocess.run([
            "ffmpeg","-hide_banner","-loglevel","error","-y",
            "-ss",f"{start:.3f}","-t",f"{length:.3f}","-i",str(audio),
            "-ac","1","-ar","16000","-c:a","pcm_s16le",str(chunk)
        ],check=True)
        payload=call_turbo(chunk)
        result=payload.get("result") or {}
        chunk_words=words_from_result(payload,start)
        for word in chunk_words:
            local_start=word["start"]-start
            local_end=word["end"]-start
            edge=min(max(0.0,local_start),max(0.0,length-local_end))
            candidates.append({**word,"edge":edge,"chunk":index})
        diagnostics.append({
            "index":index,"start":round(start,3),"duration":round(length,3),
            "words":len(chunk_words),
            "text":str(result.get("text") or "")[:220],
            "language":(result.get("transcription_info") or {}).get("language"),
            "duration_after_vad":(result.get("transcription_info") or {}).get("duration_after_vad"),
        })
        if start+length>=duration-.05:break
        start+=step;index+=1

    # Overlap produces duplicate acoustic words. Collapse near-identical
    # candidates and keep the timestamp from the chunk where the word sits
    # farthest from an edge; edge timestamps are the least trustworthy.
    candidates.sort(key=lambda w:(w["start"],w["end"]))
    merged=[]
    for word in candidates:
        key=norm(word["text"])
        duplicate=-1
        for i in range(max(0,len(merged)-12),len(merged)):
            prev=merged[i]
            if norm(prev["text"])==key and abs(prev["start"]-word["start"])<=0.75:
                duplicate=i
                break
        if duplicate>=0:
            prev=merged[duplicate]
            if word["edge"]>prev.get("edge",0)+0.15:
                merged[duplicate]=word
            elif abs(word["edge"]-prev.get("edge",0))<=0.15:
                # Similar reliability: median-ish average reduces model jitter.
                prev["start"]=(prev["start"]+word["start"])/2
                prev["end"]=(prev["end"]+word["end"])/2
                prev["edge"]=max(prev.get("edge",0),word["edge"])
        else:
            merged.append(word)
    merged.sort(key=lambda w:w["start"])
    return merged,diagnostics

def local_words(audio:Path):
    model=WhisperModel(MODEL,device="cpu",compute_type="int8")
    segs,_=model.transcribe(str(audio),language=LANG,word_timestamps=True,vad_filter=False,condition_on_previous_text=False,beam_size=5)
    out=[]
    for seg in segs:
        for w in seg.words or []:
            t=w.word.strip()
            if t:out.append({"text":t,"start":float(w.start),"end":float(w.end)})
    return out

def align(lines:list[str],asr:list[dict[str,Any]]):
    tokens=[];per=[];freq={}
    for li,line in enumerate(lines):
        ids=[]
        for word in line.split():
            ids.append(len(tokens));key=norm(word);freq[key]=freq.get(key,0)+1;tokens.append({"text":word,"line":li,"norm":key})
        per.append(ids)
    n,m=len(tokens),len(asr);gap=-.72
    prev=[j*gap for j in range(m+1)];back=[[0]*(m+1) for _ in range(n+1)]
    for j in range(1,m+1):back[0][j]=2
    for i in range(1,n+1):
        cur=[i*gap]+[0.0]*m;back[i][0]=1
        for j in range(1,m+1):
            similarity=sim(tokens[i-1]["text"],asr[j-1]["text"]);rarity=1/math.sqrt(freq.get(tokens[i-1]["norm"],1))
            prevctx=sim(tokens[i-2]["text"],asr[j-2]["text"]) if i>1 and j>1 else 0
            nextctx=sim(tokens[i]["text"],asr[j]["text"]) if i<n and j<m else 0
            match=prev[j-1]+(2*similarity-.9)*(.72+.28*rarity)+.24*max(prevctx,nextctx)
            sl=prev[j]+gap;sa=cur[j-1]+gap;best=max(match,sl,sa)
            cur[j]=best;back[i][j]=0 if best==match else (1 if best==sl else 2)
        prev=cur
    matches=[None]*n;i=n;j=m
    while i>0 or j>0:
        step=back[i][j]
        if i>0 and j>0 and step==0:
            if sim(tokens[i-1]["text"],asr[j-1]["text"])>=.58:matches[i-1]=j-1
            i-=1;j-=1
        elif i>0 and (j==0 or step==1):i-=1
        else:j-=1
    trusted=[None]*n
    for idx,ai in enumerate(matches):
        if ai is None:continue
        pa=matches[idx-1] if idx else None;na=matches[idx+1] if idx+1<len(matches) else None
        consecutive=(pa is not None and pa==ai-1) or (na is not None and na==ai+1)
        key=tokens[idx]["norm"];strong=len(key)>=4 and sim(tokens[idx]["text"],asr[ai]["text"])>=.88 and freq.get(key,0)==1
        if consecutive or strong:trusted[idx]=ai
    refs=[]
    for li,ids in enumerate(per):
        anchor_pairs=[(local_idx,trusted[global_idx]) for local_idx,global_idx in enumerate(ids) if trusted[global_idx] is not None]
        if not anchor_pairs:refs.append(None);continue
        # Reject weak lines before any timing comparison.
        density=len(anchor_pairs)/max(1,len(ids))
        if len(anchor_pairs)<3 and density<.35:
            refs.append(None);continue
        # Robust line start: fit time against normalized word position using
        # Theil-Sen-style median pair slopes, then median intercept.
        weights=[max(1,len(norm(lines[li].split()[k]))) for k in range(len(ids))]
        cumulative=[0.0]
        for w in weights[:-1]: cumulative.append(cumulative[-1]+w)
        total=max(1.0,sum(weights))
        xs=[cumulative[p]/total for p,_ in anchor_pairs]
        ys=[asr[a]["start"] for _,a in anchor_pairs]
        slopes=[]
        for a in range(len(xs)):
            for b in range(a+1,len(xs)):
                dx=xs[b]-xs[a];dt=ys[b]-ys[a]
                if dx>.04 and dt>.05:
                    slope=dt/dx
                    if .4<=slope<=18:slopes.append(slope)
        slope=statistics.median(slopes) if slopes else max(.5,asr[anchor_pairs[-1][1]]["end"]-asr[anchor_pairs[0][1]]["start"])
        intercepts=[y-slope*x for x,y in zip(xs,ys)]
        robust_start=max(0.0,statistics.median(intercepts))
        first_start=asr[anchor_pairs[0][1]]["start"]
        # Never infer more than 1.2s before the first trusted acoustic anchor.
        robust_start=max(first_start-1.2,min(first_start,robust_start))
        refs.append({
            "text":lines[li],"start":robust_start,
            "end":asr[anchor_pairs[-1][1]]["end"],"anchors":len(anchor_pairs),
            "density":density,"first_anchor":first_start,
        })
    return refs

def evaluate(lines,turbo_refs,local_refs):
    deltas=[];rows=[]
    for i,text in enumerate(lines):
        tr=turbo_refs[i];lr=local_refs[i]
        if not (tr or lr):continue
        delta=(tr["start"]-lr["start"]) if tr and lr else None
        if delta is not None:deltas.append(delta)
        rows.append({
            "line":i+1,"text":text,
            "turbo_start":round(tr["start"],3) if tr else None,
            "local_start":round(lr["start"],3) if lr else None,
            "delta":round(delta,3) if delta is not None else None,
            "turbo_anchors":tr["anchors"] if tr else 0,
            "local_anchors":lr["anchors"] if lr else 0,
            "turbo_density":round(tr["density"],3) if tr else 0,
        })
    return {
        "turbo_anchored":sum(1 for x in turbo_refs if x),
        "local_anchored":sum(1 for x in local_refs if x),
        "compared":len(deltas),
        "median_delta":round(statistics.median(deltas),3) if deltas else None,
        "median_abs_delta":round(statistics.median(abs(x) for x in deltas),3) if deltas else None,
        "mean_delta":round(statistics.mean(deltas),3) if deltas else None,
    },rows

def main():
    song=resolve();lyrics=str(song.get("lyrics") or "");lines=lyric_lines(lyrics);duration=float(song.get("duration") or 0)
    print(f"[bench] title={song.get('title')} duration={duration} cleaned_lines={len(lines)}")
    for i,line in enumerate(lines[:5],1):print("[lyric]",i,line)
    all_results={}
    refs_by_variant={}
    with tempfile.TemporaryDirectory(prefix="chunked-turbo-") as td:
        tmp=Path(td);audio=tmp/"song.mp3";download(song,audio)
        local=local_words(audio);local_refs=align(lines,local)
        print(f"[local] words={len(local)} anchored={sum(1 for x in local_refs if x)}")
        for size in CHUNK_SIZES:
            for overlap in CHUNK_OVERLAPS:
                if overlap>=size-4:continue
                turbo,diag=transcribe_chunked(audio,duration,size,overlap,tmp)
                refs=align(lines,turbo);summary,rows=evaluate(lines,refs,local_refs)
                summary.update({"chunk_size":size,"overlap":overlap,"words":len(turbo),"chunks":len(diag)})
                key=f"{size}-o{overlap}"
                all_results[key]={"summary":summary,"rows":rows,"chunks":diag}
                refs_by_variant[key]=refs
                print("[chunk-summary]",json.dumps(summary,ensure_ascii=False))
                for d in diag:print("[chunk]",json.dumps(d,ensure_ascii=False))
                for r in rows:
                    if r["delta"] is not None:print("[line]",json.dumps(r,ensure_ascii=False))
    base=refs_by_variant.get("24.0-o0.0")
    staggered=refs_by_variant.get("24.0-o4.0")
    if base and staggered:
        consensus=[]
        for idx in range(len(lines)):
            a=base[idx] if idx<len(base) else None
            b=staggered[idx] if idx<len(staggered) else None
            if a and b:
                # Two independent chunk placements heard the same lyric. Average
                # their starts only when they broadly agree; otherwise prefer
                # the denser anchor set and let the disagreement lower coverage.
                distance=abs(a["start"]-b["start"])
                if distance<=1.1:
                    merged={**a}
                    merged["start"]=(a["start"]+b["start"])/2
                    merged["end"]=(a["end"]+b["end"])/2
                    merged["anchors"]=max(a["anchors"],b["anchors"])
                    merged["density"]=max(a.get("density",0),b.get("density",0))
                    consensus.append(merged)
                else:
                    score_a=a["anchors"]*a.get("density",0)
                    score_b=b["anchors"]*b.get("density",0)
                    consensus.append(a if score_a>=score_b else b)
            else:
                consensus.append(b or a)
        summary,rows=evaluate(lines,consensus,local_refs)
        summary.update({"chunk_size":24.0,"overlap":"ensemble-0+4","words":None,"chunks":None})
        all_results["ensemble-0+4"]={"summary":summary,"rows":rows,"chunks":[]}
        print("[ensemble-summary]",json.dumps(summary,ensure_ascii=False))
        for row in rows:
            if row["delta"] is not None:print("[ensemble-line]",json.dumps(row,ensure_ascii=False))

    ranked=sorted((v["summary"] for v in all_results.values()),key=lambda s:(s["median_abs_delta"] if s["median_abs_delta"] is not None else 999,-s["compared"]))
    best=ranked[0] if ranked else {}
    result={"song":{"title":song.get("title"),"id":song.get("id"),"duration":duration},"best":best,"variants":all_results}
    Path("bench-chunked-turbo.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print("[best]",json.dumps(best,ensure_ascii=False,indent=2))
    if not best or best.get("compared",0)<5:return 2
    if best.get("median_abs_delta",99)>.65:return 3
    if best.get("median_delta",-99)<-.55:return 4
    return 0

if __name__=="__main__":
    raise SystemExit(main())
