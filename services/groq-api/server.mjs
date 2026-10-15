import http from 'node:http';
import { pathToFileURL } from 'node:url';

const MAX_BODY = 25 * 1024 * 1024;
const ALLOWED_ORIGIN = 'https://picai.online';
export function createApiServer({ post, available = () => Boolean(process.env.GROQ_API_KEY?.trim()) }) {
  let active = 0;
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    };
    if (origin !== ALLOWED_ORIGIN && req.method !== 'GET') {
      req.resume();
      return json(403, { error: 'Origin không được phép.', code: 'ORIGIN_DENIED' });
    }
    if (origin === ALLOWED_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    const path = new URL(req.url, 'http://localhost').pathname;
    if (!['/health', '/api/karaoke/groq'].includes(path)) return json(404, { error: 'Not found' });
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.method === 'GET') return json(200, {
      available: available(), engine: 'groq-whisper-large-v3-turbo', runtime: 'vps', wordTimestamps: true,
    });
    if (req.method !== 'POST' || path !== '/api/karaoke/groq') return json(405, { error: 'Method not allowed' });
    if (Number(req.headers['content-length']) > MAX_BODY) {
      req.resume();
      return json(413, { error: 'Audio vượt giới hạn tải lên.', code: 'GROQ_FILE_TOO_LARGE' });
    }
    if (active >= 1) { req.resume(); return json(429, { error: 'API đang bận, vui lòng thử lại.', code: 'API_BUSY' }); }
    active++;
    try {
      const chunks = []; let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > MAX_BODY) { json(413, { error: 'Audio vượt giới hạn tải lên.', code: 'GROQ_FILE_TOO_LARGE' }); req.resume(); return; }
        chunks.push(chunk);
      }
      const request = new Request('http://localhost/api/karaoke/groq', {
        method: 'POST', headers: { 'content-type': req.headers['content-type'] || '' }, body: Buffer.concat(chunks),
      });
      const response = await post(request);
      res.writeHead(response.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error('Groq request failed:', error.name);
      if (!res.headersSent) json(502, { error: 'Không kết nối được API subtitle.', code: 'API_REQUEST_FAILED' });
    } finally { active--; }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { POST } = await import('./dist/route.mjs');
  const server = createApiServer({ post: POST });
  server.requestTimeout = 200_000;
  server.listen(Number(process.env.PORT || 8021), '0.0.0.0', () => console.log('Groq API ready'));
}
