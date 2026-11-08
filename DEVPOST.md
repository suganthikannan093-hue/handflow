# HandFlow

**Tagline:** Give your next task a place. A hands-first desk for focus, progress, and a clear way back.

**Track:** Productivity · **Division:** New Experience

## Inspiration

The hard part of a workday is often the moment before the work: choosing one thing, getting started, and remembering where to resume after an interruption. A long task list records our intentions, but gives every intention the same visual weight.

HandFlow turns that moment into a small physical ritual. Take one task out of the backlog. Leave it on your desk. Start focusing. When you stop, leave a concrete next step in the same place. The next time you return, your task and its context are waiting together.

## What it does

HandFlow is a seated, hands-first mixed-reality workspace built for Meta Quest Browser. Its central loop is **capture → place → focus → grow → return**.

Capture a task or note in your own words. Recorded speech goes through a server-side OpenAI transcription service; the transcript appears for review before it changes the workspace. A text composer and keyboard-operable task controls provide another way in. Short desk commands run locally: “park [task]”, “start focus”, “next step: [cue]”, and “review my day”.

Pinch one task onto a stand in front of the board. With exactly one open task on the desk, Start binds the timer to that task. Once onboarding is complete, the backlog fades during focus, leaving the desk task, countdown and growing plant prominent. Pausing restores the board. Choose a normal 25-minute block, five minutes, or a one-minute quick block.

The plant grows during focused time and blooms as the session progresses. A completed block earns lasting growth in the day's garden and moves the bound desk task to Done. Wind-down records the day and identifies anything still on the stands.

A saved next-step cue stays attached to its task through moves, undo and reload. It is a practical return cue: “Open with the customer problem” is easier to act on than “Work on slides”. The running timer also survives reload using an absolute wall-clock end time.

The workspace requests mixed reality and can be placed on a detected desk or wall using WebXR hit-testing. Persistent anchors are used where supported, with a saved pose as fallback. A left palm facing the user opens Recenter, Help, placement, sound, accessibility and Exit. Controllers are optional.

## How we built it

TypeScript, three.js, WebXR Hand Input, Vite, and Meta's IWER emulator. The application owns the spatial interaction and productivity state; OpenAI supplies optional speech transcription. Removing the voice service leaves a working workspace with custom text input, direct manipulation, timer, notes, history and persistence.

Pinches use separate grab and release thresholds to prevent accidental drops. Pokes use direct finger proximity. Columns show three cards with paging for the rest; pinned notes snap to free positions. Delete has undo. Canvas labels wrap to fit, and high contrast, larger targets and look-and-hold are available alongside desktop controls.

The voice Worker keeps the API key out of the frontend and repository. It bounds upload size, uses request timeouts, restricts browser origins, and applies best-effort per-instance request limits. HandFlow does not persist audio. Users review a transcription before applying it, and a failure explains how to continue with text.

## Challenges and learning

A spatial object has to behave as it looks. A card left on a stand should still be there tomorrow; a running countdown should not disappear on refresh; a pinned note should not cover the task beneath it. Those details matter more than another panel of features.

We also learned that a convincing focus loop needs a visible change. The quiet board and live plant make the transition into focus legible, while the next-step cue gives the experience a reason to be reopened.

## Validation

The repository includes unit tests, browser workflow tests, emulated hand pinch/poke and palm-menu tests, and an MR desk-placement/anchor test. `PROOF.md` records the verified results and their limits. The voice service has also transcribed a real uploaded audio fixture through OpenAI.

The demonstration uses actual application footage in the IWER Quest emulator, with emulated hands and a synthetic room. It is not physical Quest footage. Hardware performance, physical hand-tracking comfort, and behavior in an unfamiliar real room still need device validation; requesting 72 Hz is not a measured frame-rate claim.

## What's next

The next milestone is physical Quest testing across different rooms, hand poses and lighting conditions. We will use that evidence to tune reach, poke depth and visual density before a broader launch. Subsequent work will improve task editing inside the headset and provide durable service quotas for a wider voice rollout.

**Target public launch: 15 December 2026**, subject to device validation. A Horizon Store package is a later step.

## Built with

WebXR · three.js · TypeScript · Vite · Meta IWER · OpenAI Audio API · Cloudflare Workers via Sites · Vitest · Playwright

## Disclosures

Development used AI coding assistance. The demo narration is AI-generated speech; the application footage is recorded from the running app. The voice demonstration uses a disclosed prerecorded input phrase sent through the real transcription service.
