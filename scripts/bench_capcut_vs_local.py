#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import os
import re
import statistics
import tempfile
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

import requests
from faster_whisper import WhisperModel

SONG_URL=os.getenv("SONG_URL","https://suno.com/s/tszo0jGdVUua4rT4")
BASE_URL=os.getenv("BASE_URL","https://sunoapp.aiautotool.com").rstrip("/")
MODEL=os.getenv("BENCH_WHISPER_MODEL","medium")
LANG=os.getenv("BENCH_LANGUAGE","vi")

NONWORD=re.compile(r"[^\wÀ-ỹĐđ]+",re.UNICODE)
SECTION=re.compile(r"^\s*(?:\[[^\]]+\]|\((?:verse|chorus|bridge|intro|outro|pre[- ]?chorus|instrumental)[^)]*\))\s*$",re.I)
CHORD=re.compile(r"^\[?(?:[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:/[A-G](?:#|b)?)?)\]?$",re.I)

def norm(v:str)->str:
    return NONWORD.sub("",unicodedata.normalize("NFC",v).lower())

def sim(a:str,b:str)->float:
    aa,bb=norm(a),norm(b)
    if not aa or not bb:return 0.0
    if aa==bb:return 1.0
    return SequenceMatcher(None,aa,bb).ratio()

def clean_line(line:str)->str:
    if SECTION.match(line.strip()):return ""
    out=[]
    for token in line.strip().split():
        if CHORD.match(token): continue
        # remove attached bracketed chords while keeping lyric text
        token=re.sub(r"\[(?:[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:/[A-G](?:#|b)?)?)\]","",token,flags=re.I)
        if token.strip(): out.append(token.strip())
    return " ".join(out)

def lyric_lines(lyrics:str)->list[str]:
    return [x for raw in lyrics.replace("\r","").split("\n") if (x:=clean_line(raw))]

def resolve()->dict[str,Any]:
    r=requests.post(f"{BASE_URL}/api/resolve",json={"input":SONG_URL},timeout=45)
    r.raise_for_status()
    return r.json()

def download(song:dict[str,Any],path:Path):
    u=str(song["audio"]); url=u if u.startswith("http") else f"{BASE_URL}{u}"
    r=requests.get(url,timeout=120); r.raise_for_status(); path.write_bytes(r.content)

def local_words(path:Path):
    model=WhisperModel(MODEL,device="cpu",compute_type="int8")
    segs,_=model.transcribe(str(path),language=LANG,word_timestamps=True,vad_filter=False,condition_on_previous_text=False,beam_size=5)
    out=[]
    for seg in segs:
        for w in seg.words or []:
            t=w.word.strip()
            if t: out.append({"text":t,"start":float(w.start),"end":float(w.end)})
    return out

def align(lines:list[str],asr:list[dict[str,Any]]):
    tokens=[]; per=[]; freq={}
    for li,line in enumerate(lines):
        ids=[]
        for word in line.split():
            ids.append(len(tokens)); key=norm(word); freq[key]=freq.get(key,0)+1
            tokens.append({"text":word,"line":li,"norm":key})
        per.append(ids)
    n,m=len(tokens),len(asr); gap=-0.72
    prev=[j*gap for j in range(m+1)]
    back=[[0]*(m+1) for _ in range(n+1)]
    for j in range(1,m+1): back[0][j]=2
    for i in range(1,n+1):
        cur=[i*gap]+[0.0]*m; back[i][0]=1
        for j in range(1,m+1):
            s=sim(tokens[i-1]["text"],asr[j-1]["text"])
            rarity=1/math.sqrt(freq.get(tokens[i-1]["norm"],1))
            match=prev[j-1]+(2*s-.9)*(.72+.28*rarity)
            sl=prev[j]+gap; sa=cur[j-1]+gap
            best=max(match,sl,sa); cur[j]=best; back[i][j]=0 if best==match else (1 if best==sl else 2)
        prev=cur
    matches=[None]*n; i=n; j=m
    while i>0 or j>0:
        step=back[i][j]
        if i>0 and j>0 and step==0:
            if sim(tokens[i-1]["text"],asr[j-1]["text"])>=.58: matches[i-1]=j-1
            i-=1;j-=1
        elif i>0 and (j==0 or step==1): i-=1
        else:j-=1
    trusted=[None]*n
    for idx,ai in enumerate(matches):
        if ai is None: continue
        pa=matches[idx-1] if idx else None; na=matches[idx+1] if idx+1<len(matches) else None
        consecutive=(pa is not None and pa==ai-1) or (na is not None and na==ai+1)
        key=tokens[idx]["norm"]
        strong=len(key)>=4 and sim(tokens[idx]["text"],asr[ai]["text"])>=.88 and freq.get(key,0)==1
        if consecutive or strong: trusted[idx]=ai
    refs=[]
    for li,ids in enumerate(per):
        anchors=[trusted[x] for x in ids if trusted[x] is not None]
        if not anchors: refs.append(None); continue
        refs.append({"text":lines[li],"start":asr[anchors[0]]["start"],"end":asr[anchors[-1]]["end"],"anchors":len(anchors)})
    return refs

def call_capcut(path:Path,lyrics:str,duration:float):
    with path.open("rb") as fh:
        r=requests.post(f"{BASE_URL}/api/karaoke/capcut",files={"audio":("song.mp3",fh,"audio/mpeg")},data={"lyrics":lyrics,"duration":str(duration),"language":"vi-VN"},timeout=240)
    try: body=r.json()
    except Exception: body={"raw":r.text[:1000]}
    return r.status_code,body

def normalize_text(v:str)->str:
    return " ".join(norm(x) for x in v.split() if norm(x))

def map_timeline(lines:list[str],timeline:list[dict[str,Any]]):
    used=set(); cursor=0; out=[]
    for cue in timeline:
        txt=str(cue.get("text") or "")
        best=(-1.0,-1)
        for i in range(cursor,len(lines)):
            if i in used: continue
            score=SequenceMatcher(None,normalize_text(txt),normalize_text(lines[i])).ratio()
            if score>best[0]: best=(score,i)
        if best[0]<.58:
            for i in range(len(lines)):
                if i in used: continue
                score=SequenceMatcher(None,normalize_text(txt),normalize_text(lines[i])).ratio()
                if score>best[0]: best=(score,i)
        if best[1]>=0 and best[0]>=.58:
            used.add(best[1]); cursor=max(cursor,best[1]+1); out.append((best[1],cue,best[0]))
    return out

def main()->int:
    song=resolve(); lyrics=str(song.get("lyrics") or ""); lines=lyric_lines(lyrics); duration=float(song.get("duration") or 0)
    print(f"[bench] title={song.get('title')} id={song.get('id')} duration={duration} lyric_lines={len(lines)}")
    print("[bench] cleaned first lines:")
    for i,line in enumerate(lines[:6],1): print(i,line)
    with tempfile.TemporaryDirectory(prefix="capcut-bench-") as tmp:
        path=Path(tmp)/"song.mp3"; download(song,path)
        status,cap=call_capcut(path,lyrics,duration)
        print(f"[bench] capcut HTTP={status} engine={cap.get('engine')} timeline={len(cap.get('timeline') or [])} matched={cap.get('matchedLines')}")
        if status!=200:
            print(json.dumps(cap,ensure_ascii=False,indent=2)); return 2
        local=local_words(path)
    refs=align(lines,local)
    mapped=map_timeline(lines,cap.get("timeline") or [])
    deltas=[]; rows=[]
    for idx,cue,score in mapped:
        ref=refs[idx] if idx<len(refs) else None
        if not ref: continue
        delta=float(cue.get("start",0))-float(ref["start"]); deltas.append(delta)
        row={"line":idx+1,"text":lines[idx],"capcut_start":round(float(cue.get("start",0)),3),"local_start":round(float(ref["start"]),3),"delta":round(delta,3),"map_score":round(score,3),"local_anchors":ref["anchors"]}
        rows.append(row); print(json.dumps(row,ensure_ascii=False))
    summary={
        "title":song.get("title"),"song_id":song.get("id"),"duration":duration,
        "capcut_engine":cap.get("engine"),"capcut_timeline":len(cap.get("timeline") or []),
        "capcut_matched_lines":cap.get("matchedLines"),"capcut_first_vocal":cap.get("firstVocalAt"),
        "local_anchored_lines":sum(1 for x in refs if x),"compared":len(deltas),
        "median_delta":round(statistics.median(deltas),3) if deltas else None,
        "mean_delta":round(statistics.mean(deltas),3) if deltas else None,
        "median_abs_delta":round(statistics.median(abs(x) for x in deltas),3) if deltas else None,
    }
    print("[bench-summary]"); print(json.dumps(summary,ensure_ascii=False,indent=2))
    Path("bench-capcut.json").write_text(json.dumps({"summary":summary,"rows":rows,"capcut":cap},ensure_ascii=False,indent=2),encoding="utf-8")
    if len(deltas)<5:return 3
    if summary["median_abs_delta"] is not None and summary["median_abs_delta"]>.65:return 4
    if summary["median_delta"] is not None and summary["median_delta"]<-.55:return 5
    return 0

if __name__=="__main__":
    raise SystemExit(main())
