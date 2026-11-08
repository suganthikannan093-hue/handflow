# HandFlow Voice

Server-side OpenAI recorded-speech transcription, published with the Sites skill. Worker source is in `worker/index.js`. The browser never receives OPENAI_API_KEY.

Live: https://handflow-voice.adeptacorn256.chatgpt.site/api/status

- `GET /api/status`: readiness without secrets.
- `POST /api/transcribe`: multipart `file`; approved browser Origin required.
- Upload cap: 2.2 MB. App recording cap: 20 seconds. Upstream timeout: 30 seconds.
- Best-effort limits: 20 calls/IP/hour, 100 calls/day **per Worker instance**. These are not durable billing caps. Configure provider spend controls and shared quotas before a broader rollout.
- Audio and transcripts are not persisted by HandFlow. OpenAI's own data policy applies to upstream processing.
- `OPENAI_API_KEY` is a runtime secret in Sites. `.env.example` documents names only. Never embed a key in `.openai/hosting.json`, source, localStorage or the frontend config.
- Optional `TRANSCRIBE_MODEL` defaults to `gpt-4o-mini-transcribe`. Current OpenAI docs schedule its shutdown for 26 February 2027; migrate the service before that date. See https://developers.openai.com/api/docs/guides/speech-to-text.

Run `npm test` and `npm run build` here. Publish with the Sites source workflow using the existing project ID in `.openai/hosting.json`; do not create a second Site.
