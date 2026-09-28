import { existsSync, readFileSync } from 'node:fs';

if (!existsSync('.picai-dns-backup.json')) {
  console.log('No picai DNS backup found; nothing to restore.');
  process.exit(0);
}

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error('Missing CLOUDFLARE_API_TOKEN');
const backup = JSON.parse(readFileSync('.picai-dns-backup.json', 'utf8'));

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function cf(path, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const message = body?.errors?.map((x) => x.message).join('; ') || response.statusText;
    throw new Error(`Cloudflare API ${response.status}: ${message}`);
  }
  return body;
}

for (const record of backup.records || []) {
  const payload = {
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: record.ttl,
    proxied: record.proxied,
  };
  if (record.comment) payload.comment = record.comment;
  if (record.tags) payload.tags = record.tags;

  try {
    await cf(`/zones/${backup.zone_id}/dns_records`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    console.log(`Restored apex ${record.type} record.`);
  } catch (error) {
    console.warn(`Could not restore ${record.type}: ${error instanceof Error ? error.message : error}`);
  }
}
