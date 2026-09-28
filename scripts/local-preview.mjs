import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const clientRoot = join(root, 'dist/client');
const backendPort = 8788;
const publicPort = 3000;
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const worker = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['wrangler', 'dev', '--config', 'dist/server/wrangler.json', '--port', String(backendPort)],
  { cwd: root, env: process.env, stdio: 'inherit' },
);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (request.method === 'GET' && url.pathname.startsWith('/_next/')) {
      const relative = normalize(url.pathname).replace(/^[/\\]+/, '');
      const file = join(clientRoot, relative);
      if (file.startsWith(clientRoot) && existsSync(file) && statSync(file).isFile()) {
        response.writeHead(200, {
          'content-type': mime[extname(file)] || 'application/octet-stream',
          'cache-control': 'public, max-age=31536000, immutable',
        });
        createReadStream(file).pipe(response);
        return;
      }
    }

    let body;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      body = Buffer.concat(chunks);
    }
    const upstream = await fetch(`http://localhost:${backendPort}${url.pathname}${url.search}`, {
      method: request.method,
      headers: request.headers,
      body,
      redirect: 'manual',
    });
    const headers = new Headers(upstream.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.delete('transfer-encoding');
    response.writeHead(upstream.status, Object.fromEntries(headers));
    if (upstream.body) {
      for await (const chunk of upstream.body) response.write(chunk);
    }
    response.end();
  } catch (error) {
    response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.message : 'Local preview unavailable');
  }
});

server.listen(publicPort, 'localhost', () => {
  console.log(`Local preview ready on http://localhost:${publicPort}`);
});

const close = () => {
  server.close();
  worker.kill('SIGTERM');
};
process.once('SIGINT', close);
process.once('SIGTERM', close);
worker.once('exit', (code) => {
  if (code && code !== 0) process.exitCode = code;
});
