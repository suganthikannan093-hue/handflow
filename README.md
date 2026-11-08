# HandFlow · One thing, within reach.

A seated, hands-only WebXR workspace for Meta Quest: a Kanban board, task cards, pinnable sticky notes and a Pomodoro focus timer, all used by **pinching, dragging and poking**. You don't need controllers (they still work if you have them). Built for the **Meta VR Start Developer Competition 2026 – Productivity track**.

## Latest build

**Capture → place → focus → grow → return.** Give one task a place on your desk, let the backlog fade during focus, and save a concrete next step for tomorrow.

Open **Capture & desk** for custom task/note text, keyboard-operable task controls, comfort settings and a 25/5/1-minute focus selector. **Mic** now records speech through a server-side OpenAI service and shows a transcript for confirmation before applying it. The key stays on the server. A next-step cue stays attached to its task across moves, undo and reload. Completed focus earns lasting garden growth.

- [Release notes](RELEASE-NOTES.md)
- [Two-minute judge guide](JUDGE-GUIDE.md)
- [Verification evidence and limitations](PROOF.md)
- [Submission description](DEVPOST.md)
- [Voice service](voice-service/README.md)

## Stack decision
**WebXR + three.js + the WebXR Hand Input API, built with Vite + TypeScript.** Meta's **IWER** (Immersive Web Emulation Runtime, part of the Immersive Web SDK) handles desktop emulation.

Why:
- **Fastest path to judges:** a WebXR build ships as a URL. You don't need an APK, sideloading or store review. It opens in Meta Quest Browser and can be packaged as a Horizon Store web app later (see SUBMISSION.md).
- **Plain three.js instead of the full `@iwsdk/core` framework:** IWSDK is an ECS framework whose APIs are still changing quickly. HandFlow only needs pinch, poke and palm-up detection, which take about 150 lines on top of the standard `XRHand` joint API. That keeps the bundle and the risk small and the code easy for judges to read. We still use Meta's IWSDK emulator (`iwer`) so the app can be tested with an emulated Quest 3 and hands on a desktop.
- **Pure state module:** all task, note, timer and persistence logic is in `src/state.ts`. It has no three.js dependency and is fully unit-tested.

## Architecture
```
index.html            HUD overlay + "Enter VR" button, PWA manifest link
src/boot.ts           Optional IWER Quest 3 emulator when URL has ?emulate (synthetic room unless &lite), then loads main
src/state.ts          Pure model: cards, notes, timer, habits, pinning, text fit, tutorial, settings, localStorage
src/layout.ts         Seated layout kept inside about 30° either side of centre
src/main.ts           Scene, hands, MR/VR session, hit-test placement, anchors, tutorial, render loop
src/ui.ts             Canvas-texture panels (crisp rounded UI, buttons, wrapped text)
src/audio.ts          WebAudio sfx plus an optional ambient pad
src/plant.ts          Desk plant that grows as tasks are finished
src/voice.ts          Web Speech dictation and the optional SpaceXAI planner (off by default)
tests/state.test.ts   Original vitest tests
tests/features.test.ts  Pinning, habits, voice commands, tutorial, comfort
tests/e2e/hands.spec.ts Playwright test that drives IWER hand pinches
scripts/smoke.mjs     Headless smoke test (desktop mouse drag + emulated XR session)
public/               manifest.webmanifest, icon.svg
```
**Interaction system (`main.ts`)**: each frame, every input source becomes a `Pointer`:
- **Hands:** the pinch point is the midpoint of the thumb tip and index tip. A pinch starts below 2 cm and releases above 3.5 cm (hysteresis), so a grab doesn't drop while you're dragging. The poke point is the index tip, which presses a button when it enters the button's thin volume. Hits use world-space proximity, not rays, so everything is direct touch within arm's reach.
- **Controllers (optional):** ray plus trigger.
- **Mouse (desktop):** a ray through the cursor. Click counts as a pinch. Drags stay on a plane parallel to the board until the cursor is in the lower part of the view, where they move onto the desk stands.

Grabbed cards are lifted, scaled to 108% and follow the pinch. When you release one:
- Over 🗑, it's deleted.
- Over one of the three desk stands in front of the board, it stays there across sessions. A stand in reach wins over the board, because the stands sit just in front of the board face. Those stands sit inside the 30° cone. If exactly one task is out, starting focus puts that title on the timer, and finishing the block moves the task to Done.
- Over the board, it snaps to the column and slot under it (`columnForX` / `indexForY`, then `moveCard`) and animates into place.
- Anywhere else, it springs back. A task already on a stand stays on that stand.

A column shows three cards. The rest stay behind **+N more**, so a morning plan does not run off the board. Notes dropped on the board snap to a free spot that misses the cards and the other notes. A note that cannot fit there moves beside the board. A drop on the timer still pins there. A drop off to the side floats. **Undo** (or Ctrl+Z / Cmd+Z) puts the last card or note change back. Long note text wraps and the note grows so the words stay on the card. Every change is saved to `localStorage` (`handflow.v1`). A running timer stores a wall-clock end time, so a reload keeps counting.

**Mixed reality:** Enter requests `immersive-ar` (hit-test, plane detection, anchors, hands) and falls back to `immersive-vr`. The palm menu switches MR and VR. In MR, pinch in empty space to put the board on a detected desk or wall. The pose is stored as a persistent anchor when the browser allows it, and always as a saved pose.

**Habits:** Morning Plan and Wind-down Review, a streak, a plant that grows as cards reach Done and stretches and blooms during a focus block, and a daily history on device. Wind-down names any task still sitting on a desk stand. A return visit says so before you start.

**Tutorial:** six actions (pinch, drop, leave a task on a stand, create, pin, start the timer) with a payoff as soon as you finish. While a card is in your hand, a small label says Column, Stand, or Delete. The old text panel is gone.

**Voice:** tap Mic to record, then tap again to stop (20-second maximum). Recorded audio goes through the server-held OpenAI key; review and accept the transcript before applying it. “next step: …” saves a cue on the one open desk task. The local command parser also parks tasks, starts focus, finishes tasks and opens review. If cloud voice is not configured, browser speech is tried. Errors explain the text fallback in **Capture & desk**. HandFlow does not persist audio. `public/voice-config.json` contains only the endpoint URL; the old browser-local xAI planner is removed. See `voice-service/README.md` for limits and deployment.

**Accessibility:** high contrast, larger targets, look-and-hold, ambient sound, and the fps counter. Settings are saved. The session asks the headset for 72 fps.

**Seated ergonomics:** the whole workspace is one group placed 0.50 m in front of the eyes and 2 cm below eye height. The timer, button row and desk stands stay inside about 30° either side of centre. The board is about 1.5× the previous panel so the titles fit, so it is wider than that cone. It is centred and tilted slightly toward you. The timer sits above the board, with the plant beside it, and the buttons sit in one row below the board, facing you. On a narrow window the desktop camera steps back until that board fits. The plant grows and blooms while a focus block is running. **Recenter** (in the hand menu) moves the workspace back in front of your current head pose. It also recenters automatically when you enter VR. The session does not request depth sensing: the emulator's depth path reads pixels every frame and stalls the GPU.

**Hand menu:** turn your **left palm toward your face**. The palm normal comes from the wrist and the index and pinky metacarpals. A menu appears above your wrist with **Recenter · Help · Timer · Exit**. Poke it with your right index finger.

## Setup
```bash
cd /workspace/handflow
npm install
npm test          # vitest unit tests (the original 12, plus the feature tests)
npm run test:e2e  # Playwright: emulated hand pinches create, drag, pin, and run the timer
npm run build     # type-check + production build -> dist/
npm run smoke     # headless smoke test against dist/ (needs a build first)
```

## Run on desktop (testing)
```bash
npm run dev       # https://localhost:5173 (self-signed cert, accept the warning)
```
- `https://localhost:5173/` opens mouse mode. Click and drag = pinch and drag, click = poke, A/D = turn your view.
- `https://localhost:5173/?emulate` loads Meta's IWER Quest 3 emulator with hands and a synthetic home office. **Enter MR** then shows that room behind the board (passthrough), and a pinch places the board on the desk and stores an anchor. On a Quest headset the same button uses the real room. This is WebXR hit-testing, not MRUK.

## Run on Meta Quest
WebXR needs a secure context, so pick one of these:
1. **LAN + HTTPS (simplest):** run `npm run dev`. Vite prints a `Network:` URL such as `https://192.168.1.20:5173`. Open it in **Meta Quest Browser**, accept the self-signed certificate, then tap **Enter VR**.
2. **USB + adb reverse** (counts as localhost, so you don't need a certificate):
   ```bash
   HTTP_ONLY=1 npm run dev
   adb reverse tcp:5173 tcp:5173
   ```
   Then open `http://localhost:5173` on the Quest. Chrome remote debugging works at `chrome://inspect`.
3. **Deploy (required for judging):** the build uses relative paths (`base: './'`), so `dist/` works on any static host:
   - **Netlify:** `npx netlify deploy --prod --dir=dist`, or drag `dist/` onto app.netlify.com/drop.
   - **GitHub Pages:** https://suganthikannan093-hue.github.io/handflow/ is the current build, published from the `gh-pages` branch. `.github/workflows/pages.yml` can rebuild `dist/` on each push to `master` once a token with the `workflow` scope adds that file and the Pages source is GitHub Actions.
   - **Vercel / Cloudflare Pages:** set the build command to `npm run build` and the output folder to `dist`.

Turn on hand tracking on the Quest (Settings → Movement tracking → Hand and body tracking) and put the controllers down. Quest Browser switches to hands automatically.

## Demo script (hands-only, about 3 minutes, good for the video)
1. **Enter:** sit down and tap **Enter VR**. The workspace appears at arm's reach in front of you. *"No controllers — just my hands."*
2. **Tutorial:** follow the coach above the timer. Pinch, drop, create, pin, start the timer. The payoff shows your time.
3. **Move a task:** pinch **"Reply to emails"** in To Do and drag it into **Doing**. It snaps in with a chime, and the column counts update.
4. **Finish a task:** pinch **"Review pull request"** and drop it in **Done**. A completion arpeggio plays and the card gets a ✓.
5. **Create tasks:** on the row under the board, poke **Next** to change the suggestion (the label shows "Next: …"), then poke the blue **+**. A new card pops into To Do. Make two or three.
6. **Pin a note:** poke **+ Note**. A yellow sticky note appears to the left of the board. Pinch it and drop it on the board or the timer, and it pins with a red pin. Drop another one in mid-air and it floats.
7. **Focus timer:** above the board, poke **▶ Start**. The 25:00 countdown begins and the ring turns pink. Poke **⏸ Pause**, then **↺ Reset**. **⏭ Skip** switches between Focus and Break. Finished focus sessions add to 🍅×N.
8. **Delete:** drag a card onto **🗑 Drop to delete**.
9. **Hand menu:** turn your left palm up and poke **◎ Recenter** after leaning or turning. **? Help** reopens the tutorial.
10. **Persistence:** poke **⏏ Exit**, reload the page and enter again. Everything is where you left it.

Reset the demo data: `localStorage.removeItem('handflow.v1')` in the console, then reload.

## Test results
- `npm test`: the original 12 state tests, plus feature tests for pinning, long notes, streaks, the morning planner, the tutorial payoff and the 30° layout.
- `npm run test:e2e`: one Playwright test enters the IWER Quest emulator and scripts hand pinches to drag a card, create a card, pin a note, and start then stop the timer.
- `npm run build`: type-check and `dist/` for GitHub Pages (`.github/workflows/pages.yml`).

## Known limitations
- Real hand tracking is implemented against the WebXR Hand Input spec and checked in the emulator. It has not been tuned on a physical Quest. Pinch starts under 2 cm and releases over 3.5 cm. The palm menu opens when the palm normal dots the view by more than 0.55.
- Recorded dictation needs microphone/MediaRecorder support. The text composer and template planner do not need a network.
- Cloud voice requires network access and the deployed Worker. Its limits are best effort per instance, not durable billing caps. Do not put a key in the repo.
- One board, stored on the device. No cloud sync.
- Persistent anchors depend on the browser. The saved pose is the fallback, and a local-floor origin can shift between sessions.
- three.js is one large chunk. That is expected on Quest.
