import { NextRequest, NextResponse } from 'next/server';
import {
  alignKnownLyricsGlobally,
  alignKnownLyricsToSegments,
  type KaraokeSegment,
} from '@/app/lib/karaoke-known-lyrics-align';
import {
  normalizeKaraokeTimeline,
  visibleLyricLines,
  type KaraokeLine,
} from '@/app/lib/karaoke';
import { cleanLyricsForVideo } from '@/components/v4/lyrics-clean';

export const runtime = 'edge';

const BASE_URL = 'https://editor-api-sg.capcutapi.com';
// Private signing scope used by CapCut's VOD upload client.
const VOD_REGION = 'sdwdmwlll';
const VOD_SERVICE = 'vod';
const DEVICE = {
  aid: '359289',
  app_name: 'CapCut',
  appvr: '8.7.0',
  version_name: '8.7.0',
  version_code: '8.7.0',
  channel: 'capcutpc_google',
  device_platform: 'mac',
  device_type: 'MacBookPro17,4',
  device_brand: 'MacBookPro17,4',
  os_version: '15.7.4',
  device_id: '76471456455646328721',
  iid: '76471456455646328721',
  region: 'VN',
  loc: 'VN',
  lan: 'vi-VN',
  pf: '3',
  tdid: '76471456455646328721',
} as const;

const te = new TextEncoder();

function compactJson(value: unknown) {
  return JSON.stringify(value);
}

function leftRotate(value: number, amount: number) {
  return (value << amount) | (value >>> (32 - amount));
}

function md5Bytes(input: Uint8Array) {
  const originalLength = input.length;
  const bitLength = originalLength * 8;
  const paddedLength = (((originalLength + 8) >>> 6) + 1) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[originalLength] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, bitLength >>> 0, true);
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const shifts = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const constants = Array.from({ length: 64 }, (_, i) =>
    Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0,
  );

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = Array.from({ length: 16 }, (_, i) =>
      view.getUint32(offset + i * 4, true),
    );
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f = 0, g = 0;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const nextD = c;
      c = b;
      const sum = (a + f + constants[i] + words[g]) >>> 0;
      b = (b + leftRotate(sum, shifts[i])) >>> 0;
      a = d;
      d = nextD;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  return [a0, b0, c0, d0]
    .map((n) =>
      [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
    )
    .join('');
}

function md5Text(value: string) {
  return md5Bytes(te.encode(value));
}

function crc32Hex(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

function randomHex(bytes: number) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function traceId() {
  const seed = randomHex(16);
  return `00-${seed}-${seed.slice(0, 16)}-01`;
}

function signHeader(url: string, deviceTime: string) {
  const path = url.split('?', 1)[0];
  return md5Text(
    `9e2c|${path.slice(-7)}|3|${DEVICE.appvr}|${deviceTime}|${DEVICE.tdid}|11ac`,
  );
}

function commonQuery(
  babi?: Record<string, unknown>,
  includeRegion = true,
) {
  const params = new URLSearchParams({
    app_name: DEVICE.app_name,
    device_type: DEVICE.device_type,
    os_version: DEVICE.os_version,
    channel: DEVICE.channel,
    version_name: DEVICE.version_name,
    device_brand: DEVICE.device_brand,
    device_id: DEVICE.device_id,
    iid: DEVICE.iid,
    version_code: DEVICE.version_code,
    device_platform: DEVICE.device_platform,
    aid: DEVICE.aid,
  });
  if (includeRegion) params.set('region', DEVICE.region);
  if (babi) params.set('babi_param', compactJson(babi));
  return params;
}

function baseHeaders(url: string, bodyText: string, appid = false) {
  const now = String(Math.floor(Date.now() / 1000));
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    appvr: DEVICE.appvr,
    ch: DEVICE.channel,
    'device-time': now,
    lan: DEVICE.lan,
    loc: DEVICE.loc,
    pf: DEVICE.pf,
    'sign-ver': '1',
    tdid: DEVICE.tdid,
    'x-ss-stub': md5Text(bodyText),
    'x-ss-dp': DEVICE.aid,
    'x-khronos': now,
    'x-tt-trace-id': traceId(),
    'user-agent':
      'Cronet/TTNetVersion:1d7cc3b1 2025-07-16 QuicVersion:52c2b40d 2025-04-03',
    'accept-encoding': 'gzip, deflate',
    'store-country-code': DEVICE.loc.toLowerCase(),
    'store-country-code-src': 'did',
    'is-dispatch-us-ttp': '0',
    'is-app-region-us-ttp': '0',
  };
  if (appid) {
    headers['app-sdk-version'] = DEVICE.appvr;
    headers.appid = DEVICE.aid;
  }
  headers.sign = signHeader(url, now);
  return headers;
}

async function sha256Hex(data: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

async function hmacSha256(key: Uint8Array, data: string) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', cryptoKey, te.encode(data)),
  );
}

function encodeAws(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) =>
    '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function canonicalQuery(url: string) {
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const entries = Array.from(new URL(url).searchParams.entries()).sort(
    ([ak, av], [bk, bv]) => compare(ak, bk) || compare(av, bv),
  );
  return entries.map(([k, v]) => `${encodeAws(k)}=${encodeAws(v)}`).join('&');
}

function vodDates() {
  const now = new Date();
  const iso = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  return { amzDate: iso, httpDate: now.toUTCString() };
}

async function awsAuthorization(
  method: string,
  url: string,
  body: Uint8Array,
  creds: Record<string, string>,
  amzDate: string,
) {
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${VOD_REGION}/${VOD_SERVICE}/aws4_request`;
  const signedHeaders = 'x-amz-date;x-amz-security-token';
  const canonicalHeaders =
    `x-amz-date:${amzDate}\nx-amz-security-token:${creds.session_token}\n`;
  const bodyHash = await sha256Hex(body);
  const canonicalRequest = [
    method,
    new URL(url).pathname,
    canonicalQuery(url),
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await sha256Hex(te.encode(canonicalRequest)),
  ].join('\n');

  const kDate = await hmacSha256(te.encode('AWS4' + creds.secret_access_key), dateStamp);
  const kRegion = await hmacSha256(kDate, VOD_REGION);
  const kService = await hmacSha256(kRegion, VOD_SERVICE);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = Array.from(await hmacSha256(kSigning, stringToSign), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  return `AWS4-HMAC-SHA256 Credential=${creds.access_key_id}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function vodHeaders(
  method: string,
  url: string,
  body: Uint8Array,
  creds: Record<string, string>,
) {
  const { amzDate, httpDate } = vodDates();
  return {
    Authorization: await awsAuthorization(method, url, body, creds, amzDate),
    Date: httpDate,
    'User-Agent': `BDFileUpload(${Date.now()})`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': '31536000',
    'X-Amz-Security-Token': creds.session_token,
    'accept-encoding': 'identity',
    'store-country-code': DEVICE.loc.toLowerCase(),
    'store-country-code-src': 'did',
    'is-dispatch-us-ttp': '0',
    'is-app-region-us-ttp': '0',
    tdid: DEVICE.tdid,
    pf: DEVICE.pf,
  };
}

function uploadBinaryHeaders(auth: string, crc32 = '') {
  const { httpDate } = vodDates();
  const headers: Record<string, string> = {
    Authorization: auth,
    Date: httpDate,
    'User-Agent': `BDFileUpload(${Date.now()})`,
    'accept-encoding': 'identity',
    'store-country-code': DEVICE.loc.toLowerCase(),
    'store-country-code-src': 'did',
    'is-dispatch-us-ttp': '0',
    'is-app-region-us-ttp': '0',
    tdid: DEVICE.tdid,
    pf: DEVICE.pf,
  };
  if (crc32) headers['X-Upload-Content-CRC32'] = crc32;
  return headers;
}

async function checkedJson(response: Response, label: string) {
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${label}: HTTP ${response.status} trả về dữ liệu không hợp lệ.`);
  }
  if (!response.ok) {
    throw new Error(
      `${label}: ${data?.message || data?.error || `HTTP ${response.status}`}`,
    );
  }
  const serviceError = data?.ResponseMetadata?.Error;
  if (serviceError?.Code || serviceError?.Message) {
    throw new Error(
      `${label}: ${serviceError.Code || 'CapCutError'}${
        serviceError.Message ? ` - ${serviceError.Message}` : ''
      }`,
    );
  }
  return data;
}

function objectKeys(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>).slice(0, 16)
    : [];
}

async function uploadToCapCut(audio: File) {
  const bytes = new Uint8Array(await audio.arrayBuffer());
  const partCrc32 = crc32Hex(bytes);

  const signBody = compactJson({ biz: 'cc_pc_text_recognize', key_version: 'v5' });
  const signUrl = `${BASE_URL}/lv/v1/upload_sign?${commonQuery(undefined, false)}`;
  const signResponse = await fetch(signUrl, {
    method: 'POST',
    headers: baseHeaders(signUrl, signBody, true),
    body: signBody,
  });
  const signData = await checkedJson(signResponse, 'CapCut upload_sign');
  const creds = signData?.data as Record<string, string>;
  for (const key of [
    'domain',
    'access_key_id',
    'secret_access_key',
    'session_token',
    'space_name',
  ]) {
    if (!creds?.[key]) throw new Error(`CapCut thiếu upload credential: ${key}`);
  }

  const applyParams = new URLSearchParams({
    Action: 'ApplyUploadInner',
    SpaceName: creds.space_name,
    UseQuic: 'false',
    Version: '2020-11-19',
    device_platform: 'win',
  });
  const applyUrl = `https://${creds.domain}/top/v1?${applyParams}`;
  const applyResponse = await fetch(applyUrl, {
    headers: await vodHeaders('GET', applyUrl, new Uint8Array(), creds),
  });
  const applyData = await checkedJson(applyResponse, 'CapCut ApplyUploadInner');
  const uploadAddress =
    applyData?.Result?.InnerUploadAddress ??
    applyData?.result?.inner_upload_address ??
    applyData?.data?.InnerUploadAddress ??
    applyData?.data?.inner_upload_address;
  const uploadNodes =
    uploadAddress?.UploadNodes ??
    uploadAddress?.upload_nodes ??
    uploadAddress?.Nodes ??
    uploadAddress?.nodes;
  const node = Array.isArray(uploadNodes) ? uploadNodes[0] : uploadNodes;
  const storeInfos =
    node?.StoreInfos ?? node?.store_infos ?? node?.StoreInfo ?? node?.store_info;
  const store = Array.isArray(storeInfos) ? storeInfos[0] : storeInfos;
  if (!node || !store) {
    console.error('[capcut-upload-schema]', {
      top: objectKeys(applyData),
      result: objectKeys(applyData?.Result ?? applyData?.result),
      data: objectKeys(applyData?.data),
      address: objectKeys(uploadAddress),
    });
    throw new Error('CapCut thay đổi cấu trúc upload node.');
  }

  const uploadHost = node.UploadHost as string;
  const storeUri = store.StoreUri as string;
  const uploadId = store.UploadID as string;
  const uploadAuth = store.Auth as string;
  const vid = (node.Vid || node.Vids?.[0]) as string;

  const transferParams = new URLSearchParams({
    uploadid: uploadId,
    part_number: '0',
    phase: 'transfer',
  });
  const transferUrl = `https://${uploadHost}/upload/v1/${storeUri}?${transferParams}`;
  const transferResponse = await fetch(transferUrl, {
    method: 'POST',
    headers: uploadBinaryHeaders(uploadAuth, partCrc32),
    body: bytes,
  });
  await checkedJson(transferResponse, 'CapCut upload transfer');

  const finishParams = new URLSearchParams({
    uploadmode: 'part',
    phase: 'finish',
    uploadid: uploadId,
  });
  const finishUrl = `https://${uploadHost}/upload/v1/${storeUri}?${finishParams}`;
  const finishBody = `0:${partCrc32}`;
  const finishResponse = await fetch(finishUrl, {
    method: 'POST',
    headers: uploadBinaryHeaders(uploadAuth),
    body: finishBody,
  });
  await checkedJson(finishResponse, 'CapCut upload finish');

  const commitParams = new URLSearchParams({
    Action: 'CommitUploadInner',
    SpaceName: creds.space_name,
    Version: '2020-11-19',
    device_platform: 'win',
  });
  const commitUrl = `https://${creds.domain}/top/v1?${commitParams}`;
  const commitBody = compactJson({
    Functions: [{ Input: { SnapshotTime: 0.0 }, Name: 'Snapshot' }],
    SessionKey: node.SessionKey,
  });
  const commitBytes = te.encode(commitBody);
  const commitResponse = await fetch(commitUrl, {
    method: 'POST',
    headers: await vodHeaders('POST', commitUrl, commitBytes, creds),
    body: commitBody,
  });
  const commitData = await checkedJson(commitResponse, 'CapCut CommitUploadInner');
  const result = commitData?.Result?.Results?.[0];
  const meta = result?.VideoMeta || {};
  if (!(result?.Vid || vid)) throw new Error('CapCut upload không trả về VID.');
  if (!meta.Md5) throw new Error('CapCut upload không trả về MD5.');

  return {
    vid: String(result?.Vid || vid),
    md5: String(meta.Md5),
    durationMs: Math.round(Number(meta.Duration || 0) * 1000),
  };
}

function sttTaskRequest(
  vid: string,
  md5: string,
  durationMs: number,
  language: string,
) {
  const babi = {
    feature_entrance: 'editor',
    feature_entrance_detail: 'editor-elements-captions-subtitle_recognition',
    feature_key: 'subtitle_recognition',
    scenario: 'video_editor',
  };
  const capJson = {
    adjust_endtime: 200,
    audio: vid,
    audio_type: 'vid',
    caption_type: 0,
    client_request_id: crypto.randomUUID(),
    duration: durationMs,
    enable_cache: true,
    enter_from: 'asr',
    language,
    max_lines: 1,
    md5,
    pack_options: { need_attribute: true },
    songs_info: [
      { end_time: Math.max(0, durationMs - 10.334), id: '', start_time: 0 },
    ],
    translation_language: 'vi-VN',
    use_translation: false,
    words_per_line: 15,
  };
  const body = {
    bind_id: crypto.randomUUID().toUpperCase(),
    can_queue: true,
    enter_from: 'asr',
    tasks: [
      {
        context: crypto.randomUUID(),
        payload: compactJson({ cap_json: capJson }),
        req_key: 'cc_audio_subtitle_asr',
        task_version: 'v3',
      },
    ],
  };
  const bodyText = compactJson(body);
  const url = `${BASE_URL}/lv/v1/common_task/new?${commonQuery(babi, true)}`;
  return { url, bodyText };
}

function queryTaskRequest(taskId: string, token: string, bindId = '') {
  const bodyText = compactJson({
    tasks: [
      {
        bind_id: bindId,
        id: taskId,
        req_key: 'cc_audio_subtitle_asr',
        task_version: 'v3',
        token,
      },
    ],
  });
  const url = `${BASE_URL}/lv/v1/common_task/query?${commonQuery(undefined, false)}`;
  return { url, bodyText };
}

async function runCapCutStt(
  vid: string,
  md5: string,
  durationMs: number,
  language: string,
) {
  const create = sttTaskRequest(vid, md5, durationMs, language);
  const createResponse = await fetch(create.url, {
    method: 'POST',
    headers: baseHeaders(create.url, create.bodyText),
    body: create.bodyText,
  });
  const createData = await checkedJson(createResponse, 'CapCut STT create');
  const task = createData?.data?.tasks?.[0];
  if (!task?.id || !task?.token) throw new Error('CapCut STT không tạo được task.');

  const deadline = Date.now() + 100_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1600));
    const query = queryTaskRequest(String(task.id), String(task.token));
    const response = await fetch(query.url, {
      method: 'POST',
      headers: baseHeaders(query.url, query.bodyText),
      body: query.bodyText,
    });
    const data = await checkedJson(response, 'CapCut STT query');
    const result = data?.data?.tasks?.[0];
    const status = String(result?.status ?? '').toLowerCase();
    if (['failed', 'fail', 'error', 'cancelled', 'canceled'].includes(status)) {
      throw new Error(
        `CapCut STT xử lý thất bại${result?.detail_info ? `: ${result.detail_info}` : '.'}`,
      );
    }
    // Current CapCut desktop API returns "succeed"; older captures used
    // "success". A non-empty payload is also authoritative at 100% progress.
    const completed =
      ['succeed', 'success', 'completed', 'complete', 'done'].includes(status) ||
      (Number(result?.progress) >= 100 && Boolean(result?.payload));
    if (!completed) continue;

    let payload: any = result.payload || {};
    if (typeof payload === 'string') payload = JSON.parse(payload);
    return payload;
  }
  throw new Error('CapCut STT quá thời gian xử lý.');
}

function capCutSegments(payload: any): KaraokeSegment[] {
  const utterances = Array.isArray(payload?.utterances) ? payload.utterances : [];
  return utterances
    .map((utterance: any) => {
      const text = String(utterance?.text ?? '').trim();
      const start = Number(utterance?.start_time) / 1000;
      const end = Number(utterance?.end_time) / 1000;
      const rawWords = Array.isArray(utterance?.words) ? utterance.words : [];
      const words = rawWords
        .map((word: any) => {
          const wordText = String(word?.text ?? '').trim();
          const wordStart = Number(word?.start_time) / 1000;
          const wordEnd = Number(word?.end_time) / 1000;
          return {
            text: wordText,
            start: wordStart,
            end: Math.max(wordStart + 0.01, wordEnd),
          };
        })
        .filter(
          (word: { text: string; start: number; end: number }) =>
            word.text &&
            Number.isFinite(word.start) &&
            Number.isFinite(word.end) &&
            word.end >= word.start,
        );

      return { text, start, end, words };
    })
    .filter(
      (segment: KaraokeSegment) =>
        segment.text &&
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.end > segment.start,
    );
}


function simpleTokens(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function simpleOverlap(a: string, b: string) {
  const left = simpleTokens(a);
  const right = simpleTokens(b);
  if (!left.length || !right.length) return { score: 0, matched: 0 };
  const counts = new Map<string, number>();
  for (const token of right) counts.set(token, (counts.get(token) || 0) + 1);
  let matched = 0;
  for (const token of left) {
    const count = counts.get(token) || 0;
    if (!count) continue;
    matched++;
    counts.set(token, count - 1);
  }
  const recall = matched / left.length;
  const precision = matched / right.length;
  return {
    score:
      precision + recall
        ? (2 * precision * recall) / (precision + recall)
        : 0,
    matched,
  };
}

function proportionalCueWords(text: string, start: number, end: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const span = Math.max(0.08, end - start);
  return words.map((word, index) => ({
    text: word,
    start: start + (span * index) / words.length,
    end: start + (span * (index + 1)) / words.length,
  }));
}

function buildCapCutSegmentFallback(
  lyrics: string,
  segments: KaraokeSegment[],
  duration: number,
): KaraokeLine[] {
  const lines = visibleLyricLines(lyrics);
  if (!lines.length || !segments.length) return [];

  let firstSegment = -1;
  let firstLine = -1;
  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
    let bestLine = -1;
    let bestScore = 0;
    let bestMatched = 0;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const overlap = simpleOverlap(lines[lineIndex], segments[segmentIndex].text);
      if (
        overlap.score > bestScore ||
        (overlap.score === bestScore && overlap.matched > bestMatched)
      ) {
        bestLine = lineIndex;
        bestScore = overlap.score;
        bestMatched = overlap.matched;
      }
    }
    if (bestLine >= 0 && bestMatched >= 2 && bestScore >= 0.22) {
      firstSegment = segmentIndex;
      firstLine = bestLine;
      break;
    }
  }

  if (firstSegment < 0 || firstLine < 0) return [];

  const cues: KaraokeLine[] = [];
  let lineCursor = firstLine;
  for (
    let segmentIndex = firstSegment;
    segmentIndex < segments.length && lineCursor < lines.length;
    segmentIndex++
  ) {
    const segment = segments[segmentIndex];
    let bestLine = -1;
    let bestScore = 0;
    let bestMatched = 0;
    const searchEnd = Math.min(lines.length, lineCursor + 5);

    for (let lineIndex = lineCursor; lineIndex < searchEnd; lineIndex++) {
      const overlap = simpleOverlap(lines[lineIndex], segment.text);
      if (
        overlap.score > bestScore ||
        (overlap.score === bestScore && overlap.matched > bestMatched)
      ) {
        bestLine = lineIndex;
        bestScore = overlap.score;
        bestMatched = overlap.matched;
      }
    }

    if (bestLine < 0 || bestMatched < 1 || bestScore < 0.12) continue;

    const text = lines[bestLine];
    const start = Math.max(0, segment.start - 0.02);
    const end = Math.min(
      duration,
      Math.max(start + 0.1, segment.end + 0.05),
    );
    cues.push({
      text,
      start,
      end,
      words: proportionalCueWords(text, start, end),
    });
    lineCursor = bestLine + 1;
  }

  return normalizeKaraokeTimeline(cues, duration);
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const audio = form.get('audio');
    const lyrics = form.get('lyrics');
    const requestedDuration = Number(form.get('duration'));
    const language = String(form.get('language') || 'vi-VN');

    if (!(audio instanceof File) || typeof lyrics !== 'string' || !lyrics.trim()) {
      return NextResponse.json({ error: 'Thiếu audio hoặc lyrics.' }, { status: 400 });
    }
    if (audio.size > 30 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Audio vượt quá giới hạn 30MB cho CapCut STT.' },
        { status: 413 },
      );
    }

    const cleaned = cleanLyricsForVideo(lyrics);
    const upload = await uploadToCapCut(audio);
    const durationMs =
      upload.durationMs > 0
        ? upload.durationMs
        : Math.max(1000, Math.round((requestedDuration || 10) * 1000));
    const payload = await runCapCutStt(upload.vid, upload.md5, durationMs, language);
    const segments = capCutSegments(payload);
    if (!segments.length)
      throw new Error('CapCut không trả về segment giọng hát.');

    const duration =
      Number.isFinite(requestedDuration) && requestedDuration > 0
        ? requestedDuration
        : durationMs / 1000;
    const strict = alignKnownLyricsToSegments(cleaned, segments, duration);
    const strictEnough =
      strict.matched >= Math.min(4, strict.total) &&
      strict.coverage >= 0.24;

    const global = strictEnough
      ? null
      : alignKnownLyricsGlobally(cleaned, segments, duration);

    const aligned =
      global && global.matched > strict.matched
        ? global
        : strict;

    const segmentFallback = aligned.timeline.length
      ? []
      : buildCapCutSegmentFallback(cleaned, segments, duration);
    const finalTimeline = aligned.timeline.length
      ? aligned.timeline
      : segmentFallback;

    if (!finalTimeline.length) {
      throw new Error('CapCut không trả về cue có thể ghép với lyrics.');
    }

    return NextResponse.json({
      engine: aligned.timeline.length
        ? global && aligned === global
          ? 'known-lyrics-capcut-global'
          : 'known-lyrics-capcut'
        : 'capcut-segment-fallback',
      timeline: finalTimeline,
      words: segments.reduce((sum, segment) => sum + segment.words.length, 0),
      matchedLines: aligned.timeline.length
        ? aligned.matched
        : segmentFallback.length,
      totalLines: aligned.total,
      lineAnchorCoverage: aligned.timeline.length
        ? aligned.coverage
        : segmentFallback.length / Math.max(1, aligned.total),
      firstVocalAt:
        aligned.firstVocalAt ?? segmentFallback[0]?.start ?? null,
      strictMatchedLines: strict.matched,
      globalMatchedLines: global?.matched ?? null,
      segmentFallbackLines: segmentFallback.length,
    });
  } catch (error) {
    console.error('[capcut-karaoke]', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'CapCut STT tạm thời không khả dụng.',
      },
      { status: 502 },
    );
  }
}
