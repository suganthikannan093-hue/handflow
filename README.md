# ✋ HandFlow – Hands-First Productivity Workspace

A seated, hands-only WebXR workspace for Meta Quest: a Kanban board, task cards, pinnable sticky notes and a Pomodoro focus timer, all used by **pinching, dragging and poking**. You don't need controllers (they still work if you have them). Built for the **Meta VR Start Developer Competition 2026 – Productivity track**.

## Stack decision
**WebXR + three.js + the WebXR Hand Input API, built with Vite + TypeScript.** Meta's **IWER** (Immersive Web Emulation Runtime, part of the Immersive Web SDK) handles desktop emulation.

Why:
- **Fastest path to judges:** a WebXR build ships as a URL. You don't need an APK, sideloading or store review. It opens in Meta Quest Browser and can be packaged as a Horizon Store web app later (see SUBMISSION.md).
- **Plain three.js instead of the full `@iwsdk/core` framework:** IWSDK is an ECS framework whose APIs are still changing quickly. HandFlow only needs pinch, poke and palm-up detection, which take about 150 lines on top of the standard `XRHand` joint API. That keeps the bundle and the risk small and the code easy for judges to read. We still use Meta's IWSDK emulator (`iwer`) so the app can be tested with an emulated Quest 3 and hands on a desktop.
- **Pure state module:** all task, note, timer and persistence logic is in `src/state.ts`. It has no three.js dependency and is fully unit-tested.

## Architecture
```
index.html            HUD overlay + "Enter VR" button, PWA manifest link
src/boot.ts           Optional IWER (Quest 3 + hands) emulator when URL has ?emulate, then loads main
src/state.ts          Pure model: cards/Kanban ops, column/slot mapping, notes, Pomodoro timer, localStorage save/load
src/main.ts           Scene, layout, interaction system, hand menu, tutorial, render loop, XR session enter/exit
src/ui.ts             Canvas-texture panels (crisp rounded UI, buttons, word-wrapped text)
src/audio.ts          WebAudio synth sfx (hover/grab/drop/press/complete), no asset files
tests/state.test.ts   Vitest unit tests for state logic
scripts/smoke.mjs     Headless Chromium smoke test (desktop + emulated XR session, mouse drag, persistence)
public/               manifest.webmanifest, icon.svg
```
**Interaction system (`main.ts`)**: each frame, every input source becomes a `Pointer`:
- **Hands:** the pinch point is the midpoint of the thumb tip and index tip. A pinch starts below 2 cm and releases above 3.5 cm (hysteresis), so a grab doesn't drop while you're dragging. The poke point is the index tip, which presses a button when it enters the button's thin volume. Hits use world-space proximity, not rays, so everything is direct touch within arm's reach.
- **Controllers (optional):** ray plus trigger.
- **Mouse (desktop):** a ray through the cursor. Click counts as a pinch, and drags move along a plane parallel to the board.

Grabbed cards are lifted, scaled to 108% and follow the pinch. When you release one:
- Over the board, it snaps to the column and slot under it (`columnForX` / `indexForY`, then `moveCard`) and animates into place.
- Over 🗑, it's deleted.
- Anywhere else, it springs back.

Notes released within 5–10 cm of the board or the timer **pin** to that surface (red pin, aligned to the surface). Otherwise they float where you left them. Every change is saved to `localStorage` (`handflow.v1`). The timer is saved paused, so it resumes cleanly after a reload.

**Seated ergonomics:** the whole workspace is one group placed 0.55 m in front of the eyes and 15 cm below eye height. The board is in the centre and tilted slightly toward you, the creation dock is on the left and the timer is on the right, both angled inward. **Recenter** (in the hand menu) moves the workspace back in front of your current head pose. It also recenters automatically when you enter VR.

**Hand menu:** turn your **left palm toward your face**. The palm normal comes from the wrist and the index and pinky metacarpals. A menu appears above your wrist with **Recenter · Help · Timer · Exit**. Poke it with your right index finger.

## Setup
```bash
cd /workspace/handflow
npm install
npm test          # vitest unit tests
npm run build     # type-check + production build -> dist/
npm run smoke     # headless smoke test against dist/ (needs a build first)
```

## Run on desktop (testing)
```bash
npm run dev       # https://localhost:5173 (self-signed cert, accept the warning)
```
- `https://localhost:5173/` opens mouse mode. Click and drag = pinch and drag, click = poke, A/D = turn your view.
- `https://localhost:5173/?emulate` loads Meta's IWER Quest 3 emulator with hands, so the **Enter VR** button works on desktop.

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
   - **GitHub Pages:** push the repo and publish `dist/`, for example with `npx gh-pages -d dist`, or with a Pages Action that runs `npm ci && npm run build`.
   - **Vercel / Cloudflare Pages:** set the build command to `npm run build` and the output folder to `dist`.

Turn on hand tracking on the Quest (Settings → Movement tracking → Hand and body tracking) and put the controllers down. Quest Browser switches to hands automatically.

## Demo script (hands-only, about 3 minutes, good for the video)
1. **Enter:** sit down and tap **Enter VR**. The workspace appears at arm's reach in front of you. *"No controllers — just my hands."*
2. **Tutorial:** poke **→ Next** on the tutorial panel above the board to page through the six tips. On the last tip it closes.
3. **Move a task:** pinch **"Reply to emails"** in To Do and drag it into **Doing**. It snaps in with a chime, and the column counts update.
4. **Finish a task:** pinch **"Review pull request"** and drop it in **Done**. A completion arpeggio plays and the card gets a ✓.
5. **Create tasks:** on the left dock, poke **⟳ Task** to choose a template (the label shows "Next: …"), then poke the big blue **+**. A new card pops into To Do. Make two or three.
6. **Pin a note:** poke **+ Note**. A yellow sticky note appears. Pinch it and drop it on the board or the timer, and it pins with a red pin. Drop another one in mid-air and it floats.
7. **Focus timer:** on the right, poke **▶ Start**. The 25:00 countdown begins and the ring turns pink. Poke **⏸ Pause**, then **↺ Reset**. **⏭ Skip** switches between Focus and Break. Finished focus sessions add to 🍅×N.
8. **Delete:** drag a card onto **🗑 Drop to delete**.
9. **Hand menu:** turn your left palm up and poke **◎ Recenter** after leaning or turning. **? Help** reopens the tutorial.
10. **Persistence:** poke **⏏ Exit**, reload the page and enter again. Everything is where you left it.

Reset the demo data: `localStorage.removeItem('handflow.v1')` in the console, then reload.

## Test results (on the build box)
- `npm test`: 12/12 vitest tests pass.
- `npm run build`: type-check is clean and `dist/` is produced (about 165 kB gzipped).
- `npm run smoke`: headless Chromium in two modes, with no console errors in either.
  - Desktop mode: a mouse drag moved a card from To Do to Done, and the change was saved.
  - `?emulate` mode: the IWER emulator started an immersive-vr session.

## Known limitations
- Real hand tracking (pinch thresholds, poke depth, palm-up angle) is implemented against the WebXR Hand Input spec, but **it has only been verified in emulation and headless tests, not on a physical Quest.** Tune `0.02`/`0.035` (pinch) and `0.55` (palm dot) in `main.ts` on the device if needed.
- Text entry uses preset task templates and note texts (no voice or keyboard yet).
- One board and a single local workspace; no cloud sync.
- three.js is bundled as one chunk of about 640 kB minified (Vite warns about the size; it's fine for Quest).
