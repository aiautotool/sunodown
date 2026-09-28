import { writeFileSync } from 'node:fs';

const token = process.env.CLOUDFLARE_API_TOKEN;
const domain = process.env.PICAI_DOMAIN || 'picai.online';
if (!token) throw new Error('Missing CLOUDFLARE_API_TOKEN');

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

const zones = await cf(`/zones?name=${encodeURIComponent(domain)}&status=active&per_page=50`);
const zone = zones.result?.find((item) => item.name === domain);
if (!zone) throw new Error(`Active Cloudflare zone not accessible for ${domain}`);

const records = await cf(
  `/zones/${zone.id}/dns_records?name=${encodeURIComponent(domain)}&per_page=100`,
);

const replaceable = (records.result || []).filter((record) =>
  ['A', 'AAAA', 'CNAME'].includes(record.type),
);

writeFileSync(
  '.picai-dns-backup.json',
  JSON.stringify(
    {
      zone_id: zone.id,
      domain,
      records: replaceable.map((record) => ({
        type: record.type,
        name: record.name,
        content: record.content,
        ttl: record.ttl,
        proxied: record.proxied,
        comment: record.comment || undefined,
        tags: record.tags || undefined,
      })),
    },
    null,
    2,
  ),
);

console.log(`picai.online DNS preflight: found ${replaceable.length} apex A/AAAA/CNAME record(s).`);

for (const record of replaceable) {
  await cf(`/zones/${zone.id}/dns_records/${record.id}`, { method: 'DELETE' });
  console.log(`Removed existing apex ${record.type} record before Worker Custom Domain deploy.`);
}
