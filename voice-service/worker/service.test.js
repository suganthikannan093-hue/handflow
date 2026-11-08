import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { resetLimits } from './index.js';
const origin = 'https://suganthikannan093-hue.github.io';
const url = 'https://voice.example/api/transcribe';
function request(type = 'audio/webm', size = 120) {
  const body = new FormData(); body.append('file', new Blob(['x'.repeat(size)], { type }), 'thought.webm');
  return new Request(url, { method: 'POST', headers: { origin }, body });
}
test('preflight only allows the app origins', async () => {
  assert.equal((await worker.fetch(new Request(url, { method: 'OPTIONS', headers: { origin } }), {})).status, 204);
  assert.equal((await worker.fetch(new Request(url, { method: 'OPTIONS', headers: { origin: 'https://other.example' } }), {})).status, 403);
});
test('missing configuration and invalid recordings fail without an upstream call', async () => {
  assert.equal((await worker.fetch(request(), {})).status, 503);
  assert.equal((await worker.fetch(request('text/plain'), { OPENAI_API_KEY: 'test' })).status, 415);
  assert.equal((await worker.fetch(request('audio/webm', 2), { OPENAI_API_KEY: 'test' })).status, 400);
  assert.equal((await worker.fetch(new Request(url, { method: 'POST', headers: { origin, 'content-length': '2200001' } }), { OPENAI_API_KEY: 'test' })).status, 413);
});
test('forwards audio with a server key, limits requests and sanitizes upstream errors', async () => {
  resetLimits(); const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async (target, options) => {
    calls++; assert.equal(target, 'https://api.openai.com/v1/audio/transcriptions');
    assert.equal(options.headers.authorization, 'Bearer server-only');
    assert.equal(options.body.get('model'), 'gpt-4o-mini-transcribe');
    return Response.json(calls === 2 ? { error: { message: 'sensitive upstream detail' } } : { text: 'Draft the opening slide' }, { status: calls === 2 ? 429 : 200 });
  };
  try {
    const res = await worker.fetch(request(), { OPENAI_API_KEY: 'server-only' });
    assert.equal(res.headers.get('access-control-allow-origin'), origin);
    assert.deepEqual(await res.json(), { text: 'Draft the opening slide', provider: 'OpenAI' });
    const failure = await worker.fetch(request(), { OPENAI_API_KEY: 'server-only' });
    assert.equal(failure.status, 502); assert.ok(!(await failure.text()).includes('sensitive'));
    for (let i = 0; i < 18; i++) await worker.fetch(request(), { OPENAI_API_KEY: 'server-only' });
    assert.equal((await worker.fetch(request(), { OPENAI_API_KEY: 'server-only' })).status, 429);
    assert.equal(calls, 20);
  } finally { globalThis.fetch = original; }
});
