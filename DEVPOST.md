# Devpost copy — HandFlow

**Track:** Productivity
**Division:** New Experience
**Tagline:** Your hands are the interface: a seated mixed-reality workspace for tasks, notes and focus.

## Inspiration

A desk day is a pile of small moves: which task is next, a note you will lose, a timer you forget to start. On a Quest those moves usually mean picking up controllers, finding a keyboard, or leaving the headset. HandFlow started from the opposite idea. You are already sitting at a desk. Your hands are already there. The workspace should meet them.

The Meta VR Start brief asks for something you would actually use, not a tech demo of hand tracking. A kanban board, a sticky note and a pomodoro timer are boring on purpose. They are the tools people already trust. Putting them in reach, with pinch, poke and a palm menu, is the new part.

## What it does

HandFlow is a seated WebXR workspace for Meta Quest Browser.

- Pinch a card and drop it on To Do, Doing or Done. Drop it on the bin to delete it.
- Poke + to add a task from a template, or hold the mic button and dictate one.
- Say "plan my morning" and an on-device planner lays out three priorities. An optional SpaceXAI connection stays off unless you turn it on and save your own key locally. The key is never in the repo.
- Sticky notes pin when you drop them on the board or the timer, including when your hand is still a few centimetres in front of the surface. Long notes wrap instead of being clipped. Drop a note in open space and it floats.
- The focus timer is 25 minutes, then a 5 minute break.
- Morning Plan and Wind-down Review keep a streak, grow a plant as you finish tasks, and save a daily history on the device.
- A five-action tutorial teaches by doing. Finish it and the payoff lands in under a minute.
- Enter mixed reality first. If passthrough is unavailable, the same button opens VR. Plane detection and hit-testing place the board on a desk or a wall. A persistent anchor keeps that spot; a saved pose is the fallback.
- The palm menu recenters, switches MR and VR, replaces the board, toggles a soft ambient pad, and opens accessibility: high contrast, larger targets, and look-and-hold. Those settings are saved.
- The board, dock and timer stay inside about 30° either side of centre. A debug counter shows the frame rate. The session asks the headset for 72 fps.

## How we built it

WebXR, three.js and the Hand Input API, bundled with Vite and TypeScript. Meta's IWER emulator runs a Quest 3 with hands on the desktop, which is also what the Playwright test drives.

The state module has no three.js in it. Cards, notes, the timer, streaks, the morning planner, pinning, text fitting and accessibility all live there and are unit tested. The scene in `src/main.ts` is a direct-touch layer: a pinch is the distance between thumb tip and index tip, a poke is the index tip entering a button, and a palm-up left hand opens the menu. No controller is required. Controllers still work if you are holding them.

Sticky notes used to pin only when they were within 10 cm of the surface along its normal. A note you drag stays on a plane in front of the board, so a drop that looked lined up was still "too far" and was saved as unpinned. Pinning now uses the distance to the surface, so a near drop snaps on and the saved record says so. Note text used to be drawn at a fixed size past the edge of a tiny canvas. Notes now grow a little and the type shrinks until the words fit.

Mixed reality requests `immersive-ar` with hit-test, plane-detection and anchors, and falls back to `immersive-vr`. Placement is stored as a persistent anchor when the browser allows it, and always as a pose.

The habit loop, the plant and the history are local. Nothing about your tasks leaves the headset unless you explicitly enable the model planner and provide a key.

## Challenges

Hand tracking in the browser does not give you a collision mesh. The pinch has hysteresis so a drag does not drop when your fingers relax a little. Poke targets are thin volumes, with a larger volume when large targets are on. Look-and-hold is a dwell on the same button so you can select without a pinch.

Persistent anchors are not on every Quest Browser build. The pose fallback means a placed board still comes back.

72 fps on a Quest is mostly about not redrawing canvas textures every frame, capping the pixel ratio in the headset, and asking the session for 72. The counter is there so you can see it on device.

## Accomplishments

The workspace is usable with hands only, in MR or VR, and the same build is a URL. Twelve original unit tests still pass, with more around pinning, habits and the tutorial. A Playwright test scripts real emulated pinches: create a card, drag it, pin a note, start the timer and stop it.

## What we learned

A productivity app in a headset wins or loses on reach and on whether the object did what your hand just did. If a note looks pinned and the save says it is not, the feature is broken. Comfort is a layout constraint, not a paragraph in the README: if the timer sits at 50° you will not use it for 25 minutes.

## What's next

- A pass on a physical Quest 3 to tune pinch distance and poke depth.
- Handwriting or a system keyboard for edits after dictation.
- More than one board, still local-first.
- A Horizon Store web wrapper once the Pages URL has been used for a week.

**Target launch: 15 December 2026.** That is the public WebXR URL, with the morning loop and mixed-reality placement, after judge feedback. A store build follows in January 2027 if the Quest pass goes well.

## Built with

webxr, threejs, typescript, vite, meta-quest, hand-tracking, iwer, playwright
