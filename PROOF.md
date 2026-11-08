# HandFlow verification record

Verified on 8 November 2026. This record separates application behavior from physical-device claims.

## Reproducible checks

| Check | Command / evidence | Scope |
|---|---|---|
| Production build | `npm run build` | TypeScript and Vite production output |
| State and continuity | `npm test` · 43 tests | Cards, notes, timer clocks, paging, habits, pinning, next-step persistence, undo and garden rewards |
| Browser workflows | `npm run test:e2e` · 7 scenarios passed | See individual tests below |
| Voice service | `cd voice-service && npm test` · 3 tests | CORS, missing configuration, formats/size, server-key forwarding, sanitized failures and per-instance limits |
| Live OpenAI request | WAV fixture → hosted `/api/transcribe` | Response: `{"text":"Draft the opening slide.","provider":"OpenAI"}` |

Browser scenarios:

- `hands.spec.ts`: emulated pinch/poke to move, park, create, pin and start/pause focus; separate left-palm pose opens the menu and observes zero additional per-frame `readPixels` calls.
- `mouse.spec.ts`: first Start is focus; task movement and undo; many-card paging; timer and board reload; 390×844 mobile HUD clearance and touch copy.
- `place.spec.ts`: IWER synthetic room contains a desk plane; MR uses alpha blending, a hit-test places the board, an anchor is saved/restored, and long-note text fits.
- `workflow.spec.ts`: real DOM composer creates a custom task, places it on the desk, saves a next-step cue, starts quiet focus, then reloads with task/cue/countdown intact. Voice UI test mocks capture and the service response to check confirmation and error recovery; it is not the live microphone proof.

## What the live voice request proves

The publicly deployed Worker can receive an actual WAV upload, authenticate to OpenAI with its server secret, and return recognized words. The phrase was synthesized as a disclosed test fixture. It does not establish microphone permission behavior on Quest. The final video separately identifies its prerecorded input fixture.

## What the emulator proves

The gesture detector is driven by emulated WebXR hand joints, including pinch hysteresis, pokes and the palm pose. The room is synthetic. MR placement and anchor restoration are emulator results.

## What is still unverified

Physical Quest frame rate, hand tracking across real lighting/hand shapes, sustained seated comfort, real-room placement and anchor relocalization. No 60/72 fps hardware result is claimed. The board is wider than the ±30° cone; the timer, stands and primary controls were designed around that reach constraint. A full manual screen-reader audit remains outstanding despite the DOM controls and announcements.

## Service and submission boundaries

HandFlow keeps workspace data locally. Explicit voice recordings are sent to OpenAI; HandFlow does not persist their audio. The service's in-memory rate limits reset with Worker instances and are not a durable account spending cap. Membership, developer-account eligibility and final Devpost submission still need the entrant's confirmation.
