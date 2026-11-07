// Web Speech dictation, the on-device planner, and an optional SpaceXAI call that stays off unless a key is saved locally.
export const AI_URL = 'https://api.x.ai/v1/chat/completions';
export const AI_MODEL = 'grok-4.7';
export const AI_KEY_STORAGE = 'handflow.aiKey';

interface Rec {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
}

export function recognition(): Rec | null {
  const Ctor = (window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition
    || (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = 'en-US'; rec.interimResults = false; rec.continuous = false;
  return rec;
}

/** Optional model. The key never ships in the bundle; the toggle defaults off and an empty key skips the network. */
export async function planWithModel(prompt: string, apiKey: string): Promise<string[] | null> {
  if (!apiKey.trim()) return null;
  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'Reply with JSON only: {"tasks":["short task","short task","short task"]}. Three concrete morning tasks, each under 60 characters.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? '';
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const parsed = JSON.parse(match[0]) as { tasks?: unknown };
  if (!Array.isArray(parsed.tasks)) return null;
  return parsed.tasks.map(t => String(t).trim()).filter(Boolean).slice(0, 5);
}
