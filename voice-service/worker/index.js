// No API keys, raw audio, or transcripts are written to logs or persistent storage.
const allowed = new Set(['https://suganthikannan093-hue.github.io', 'http://127.0.0.1:5174', 'http://127.0.0.1:5176', 'http://localhost:5173']);
const buckets = new Map();
let daily = { date: '', count: 0 };
export function resetLimits() { buckets.clear(); daily = { date: '', count: 0 }; }
function permit(ip) {
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  if (day !== daily.date) daily = { date: day, count: 0 };
  for (const [key, value] of buckets) if (now - value.at > 3600000) buckets.delete(key);
  const bucket = buckets.get(ip) || { at: now, count: 0 };
  if (bucket.count >= 20 || daily.count >= 100 || buckets.size > 2000) return false;
  bucket.count++; buckets.set(ip, bucket); daily.count++; return true;
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    const same = origin === new URL(request.url).origin;
    const cors = allowed.has(origin) || same;
    const headers = { 'content-type': 'application/json', 'cache-control': 'no-store', 'vary': 'Origin', 'x-content-type-options': 'nosniff', ...(cors ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, GET, OPTIONS', 'access-control-allow-headers': 'content-type' } : {}) };
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
    const path = new URL(request.url).pathname;
    if (request.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers });
    if (request.method === 'GET' && (path === '/' || path === '/api/status')) return json({ service: 'HandFlow Voice', ready: !!env.OPENAI_API_KEY, provider: 'OpenAI', model: env.TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe', recordingLimitSeconds: 20, audioStored: false });
    if (path !== '/api/transcribe') return json({ error: 'Not found' }, 404);
    if (!cors) return json({ error: 'Open voice from the HandFlow app.' }, 403);
    if (request.method !== 'POST') return json({ error: 'Use POST' }, 405);
    if (!env.OPENAI_API_KEY) return json({ error: 'Voice is not configured. Type your thought instead.' }, 503);
    if (Number(request.headers.get('content-length')) > 2_200_000) return json({ error: 'Recording too large. Keep it under 20 seconds.' }, 413);
    try {
      // Bound streaming bodies too, before multipart parsing.
      const reader = request.body?.getReader();
      if (!reader) return json({ error: 'No recording supplied.' }, 400);
      const chunks = []; let total = 0;
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        total += value.byteLength;
        if (total > 2_200_000) { await reader.cancel(); return json({ error: 'Recording too large. Keep it under 20 seconds.' }, 413); }
        chunks.push(value);
      }
      const form = await new Response(new Blob(chunks), { headers: { 'content-type': request.headers.get('content-type') || '' } }).formData();
      const audio = form.get('file');
      if (!audio || typeof audio === 'string' || audio.size < 100) return json({ error: 'No audio recorded. Try again or type.' }, 400);
      if (!/^(audio\/(webm|mp4|mpeg|wav|x-wav|ogg)|video\/webm)(;|$)/.test(audio.type)) return json({ error: 'Unsupported recording format.' }, 415);
      const ip = request.headers.get('cf-connecting-ip') || 'local';
      if (!permit(ip)) return json({ error: 'Voice limit reached. Type your thought instead.' }, 429);
      const upstream = new FormData();
      upstream.append('file', audio, audio.name || 'thought.webm');
      upstream.append('model', env.TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe');
      upstream.append('response_format', 'json');
      upstream.append('prompt', 'HandFlow workspace. Tasks, notes, next step, park a task, start focus, review my day.');
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: upstream, signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) return json({ error: response.status === 429 ? 'OpenAI voice is busy or out of credits. Type your thought instead.' : 'Voice service could not transcribe. Try again or type.', upstreamStatus: response.status }, 502);
      const data = await response.json();
      return json({ text: String(data.text || '').trim().slice(0, 400), provider: 'OpenAI' });
    } catch (error) {
      return json({ error: error?.name === 'TimeoutError' ? 'Voice took too long. Try again or type.' : 'Could not read the recording. Try again or type.' }, 400);
    }
  },
};
