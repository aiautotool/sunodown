import assert from 'node:assert/strict';
import test from 'node:test';
import { requestRegeneratedSubtitle } from '../app/lib/subtitle-regeneration.ts';

void test('a busy generation cannot replace corrected cues with a cached artifact', async () => {
  const responses = [new Response(null, { status: 202 }), new Response(null, { status: 202 }), Response.json({ cached: false, subtitle: { lines: ['new cue'] } })];
  let calls = 0;
  const response = await requestRegeneratedSubtitle(async () => responses[calls++], {
    isCurrent: () => true, wait: async () => {},
  });
  assert.equal(calls, 3);
  assert.deepEqual(await response.json(), { cached: false, subtitle: { lines: ['new cue'] } });
});

void test('a song switch stops forced regeneration before another billable request', async () => {
  let current = true;
  let calls = 0;
  await assert.rejects(requestRegeneratedSubtitle(async () => {
    calls += 1;
    return new Response(null, { status: 202 });
  }, { isCurrent: () => current, wait: async () => { current = false; } }), { name: 'AbortError' });
  assert.equal(calls, 1);
});

void test('an occupied generation lock ends with an actionable timeout', async () => {
  await assert.rejects(requestRegeneratedSubtitle(async () => new Response(null, { status: 202 }), {
    isCurrent: () => true, wait: async () => {}, maxPolls: 2,
  }), /Server đang tạo subtitle/);
});

void test('provider errors reach the editor instead of falling back to stale cache', async () => {
  const response = await requestRegeneratedSubtitle(async () => Response.json({ error: 'provider_unavailable' }, { status: 503 }), {
    isCurrent: () => true, wait: async () => {},
  });
  assert.equal(response.status, 503);
});
