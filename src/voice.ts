// Recorded voice uses a server-held key. Browser speech remains a fallback.
export interface VoiceConfig { endpoint: string }
export async function voiceConfig(): Promise<VoiceConfig> {
  try {
    const res = await fetch(new URL('voice-config.json', document.baseURI));
    const data = await res.json();
    return { endpoint: typeof data.endpoint === 'string' ? data.endpoint.replace(/\/$/, '') : '' };
  } catch { return { endpoint: '' }; }
}
interface Rec {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
}
export function recognition(): Rec | null {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = 'en-US'; rec.interimResults = false; rec.continuous = false;
  return rec;
}
export async function transcribeAudio(audio: Blob, endpoint: string): Promise<string> {
  const form = new FormData();
  form.append('file', audio, audio.type.includes('mp4') ? 'thought.mp4' : 'thought.webm');
  const res = await fetch(`${endpoint}/api/transcribe`, { method: 'POST', body: form, signal: AbortSignal.timeout(35000) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Voice service unavailable. Type your thought instead.');
  if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('No words heard. Try again or type your thought.');
  return data.text.trim().slice(0, 400);
}
export class VoiceCapture {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private stopAt = 0;
  private chunks: Blob[] = [];
  get active() { return this.recorder?.state === 'recording'; }
  async start(onAudio: (audio: Blob) => void, onError: (error: Error) => void) {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Recording unavailable here. Type your thought instead.');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    try {
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t));
      this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
      this.chunks = [];
      this.recorder.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
      this.recorder.onerror = () => { this.cleanup(); onError(new Error('Recording failed. Type your thought instead.')); };
      this.recorder.onstop = () => {
        const audio = new Blob(this.chunks, { type: this.recorder?.mimeType || 'audio/webm' });
        this.cleanup();
        if (audio.size < 100) onError(new Error('No audio recorded. Try again.'));
        else onAudio(audio);
      };
      this.recorder.start();
      this.stopAt = window.setTimeout(() => this.stop(), 20000);
    } catch (error) { this.cleanup(); throw error; }
  }
  stop() { if (this.active) this.recorder!.stop(); }
  private cleanup() { clearTimeout(this.stopAt); this.stream?.getTracks().forEach(t => t.stop()); this.stream = null; }
}
