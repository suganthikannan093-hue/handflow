# HandFlow submission script (draft for review)

Status: **not submitted**. Other agents should review this file and mark changes. Do not paste it into Devpost until the blockers in section 6 are done.

This draft is the submission package. `DEVPOST.md` is the prose source. `SUBMISSION.md` is older: it names the silent clip and an IST time that does not match the official clock. Use this file.

Official deadline, from the contest site and rules: **18 November 2026, 12:00 PM Pacific Time** (Devpost also shows **3:00 PM EST**). That is **19 November 2026, 1:30 AM IST**. Judging runs 23 November–9 December 2026. Winners are announced 11 December 2026. No edits after the deadline. The URL must stay up through judging.

## 1. Form fields

| Field | Paste this |
| --- | --- |
| Name | HandFlow |
| Tagline (140 characters) | Your hands are the interface: a seated mixed-reality workspace for tasks, notes and focus. |
| Track | Productivity |
| Division | New Experience |
| Try-it link | Rebuild first. The current Pages URL is an older build. See section 6. |
| Repository | https://github.com/suganthikannan093-hue/handflow |
| Video | Public YouTube or Vimeo, under 3 minutes. No URL exists yet. |
| Built with | webxr, threejs, typescript, vite, meta-quest, hand-tracking, iwer, playwright |

Eligibility the submitter must confirm before clicking submit: 18 or older, Meta VR Start member on the same account, Meta developer access, one entry as the team representative, English, not in a country or region the rules exclude. An entry filed by someone else is void. This draft does not confirm membership.

## 2. Devpost description

Paste the sections below. They match `DEVPOST.md`.

### Inspiration

A desk day is a pile of small moves: which task is next, a note you will lose, a timer you forget to start. On a Quest those moves usually mean picking up controllers, finding a keyboard, or leaving the headset. HandFlow started from the opposite idea. You are already sitting at a desk. Your hands are already there. The workspace should meet them.

The Meta VR Start brief asks for something you would actually use, not a tech demo of hand tracking. A kanban board, a sticky note and a pomodoro timer are familiar on purpose. They are the tools people already trust. Putting them in reach, with pinch, poke and a palm menu, is the new part. The part you come back for is smaller: leave today's one task on a stand. Tomorrow it is still there.

### What it does

HandFlow is a seated WebXR workspace for Meta Quest Browser.

- Pinch a card and drop it on To Do, Doing or Done. Drop it on the bin to delete it.
- Drop a card on one of three stands in front of the board and it stays there, across sessions. The board counts how many are still out. Come back and that line is waiting. If exactly one task is out, the focus timer takes its name. When the 25 minutes finish, that task moves to Done and the plant grows.
- Poke + to add a task, or hold the mic and speak. The on-device agent can plan the morning, leave a named task on a stand, start focus, finish a named task, say what is still out, and open wind-down. Anything else becomes a card. An optional model stays off unless you turn it on and save your own key on the device. The key is not in the project.
- Sticky notes pin when you drop them on the board or the timer, including a drop that is still a little in front of the surface. Long notes wrap and the note grows. A drop off to the side floats.
- The focus timer is 25 minutes, then a 5 minute break. Morning Plan and Wind-down Review keep a streak, grow a plant, and save a daily history on the device.
- A six-action lesson teaches by doing, including leaving a task on the glowing stand. Finish it and the payoff lands in under a minute. While a card is in your hand, a label says Column, Stand, or Delete.
- Enter mixed reality first. If passthrough is unavailable, the same button opens VR. Hit-testing places the board on a desk or a wall. A persistent anchor keeps that spot when the browser allows it. A saved pose is the fallback. Recenter puts the board back in front of you. The stands move with the board.
- A small gaze marker sits at the center of your view while a session is running. Look-and-hold is an accessibility option, off by default.
- The palm menu recenters, switches MR and VR, places the board, toggles a soft ambient pad, and opens high contrast, larger targets, and look-and-hold. Those settings are saved.
- The board, buttons and timer stay inside about 30° either side of centre. The session asks the headset for 72 fps. A debug counter can show the frame rate.

### How we built it

WebXR, three.js and the Hand Input API, bundled with Vite and TypeScript. Meta's Immersive Web Emulator runs a Quest 3 with hands on the desktop. The Playwright test drives those hands: drag a card, leave one on a stand, create a card, pin a note, start the timer and stop it. Thirty-three unit tests cover the state, including pinch hysteresis and the spoken desk actions.

A pinch is the distance between thumb tip and index tip. It starts under 2 cm and releases past 3.5 cm, so a drag does not drop when the fingers relax. A poke is the index tip entering a button. A palm-up left hand opens the menu. No controller is required.

Notes used to look pinned while the save said they were not, because a dragged note sits on a plane in front of the board. Pinning now accepts that near drop. Long text used to draw past the card. The note grows and the type shrinks until the words fit.

Tasks, streaks, the plant and the stands stay on the device. Nothing about a task leaves the headset unless you turn on the model planner and provide a key.

### Challenges

Hand tracking in the browser does not give a collision mesh. Poke targets are thin volumes, larger when large targets are on. Look-and-hold is a dwell on the same button.

Persistent anchors are not on every Quest Browser build. The saved pose brings a placed board back.

Asking the session for 72 fps, foveation, and a framebuffer scale of 1 is in the code. A Quest 3 frame rate has not been measured on a headset. The public demo is the desktop emulator.

### Accomplishments

The workspace is usable with hands only, in MR or VR, and the same build is a URL. The original twelve state tests still pass, with more around pinning, habits, the stands, pinch hysteresis and the spoken agent.

### What we learned

A productivity app in a headset wins or loses on reach, and on whether the object did what the hand just did. If a note looks pinned and the save says it is not, the feature is broken. Comfort is a layout rule: if the timer sits too far off centre, you will not use it for 25 minutes.

### What's next

- A pass on a physical Quest 3 to tune pinch distance and poke depth.
- Handwriting or a system keyboard for edits after dictation.
- More than one board, still local-first.
- A Horizon Store web wrapper once the public URL has been used for a week.

**Target launch: 15 December 2026.** That is the public WebXR URL, with the morning loop and mixed-reality placement, after judge feedback. A store build follows in January 2027 if the Quest pass goes well.

## 3. Video script

Rules: under 3 minutes, real emulator or headset footage, public on YouTube or Vimeo, English. Judges need not watch past 3 minutes. Lead with the stand, not with a tour of every button. Do not use an AI-generated picture of the app. The voice should be US English and sound like a person talking, not a trailer.

The file on disk today is `demo/handflow-feature-tour.mp4` (2:06, 1280×720, emulator hands, Piper Lessac). It includes the stand. It does **not** show the spoken agent (leave a named task, start focus by voice, "what's on my desk"). The silent `demo/handflow-demo.mp4` is the wrong file to upload. Re-record from this script before upload if the agent stays in the description.

| Time | On screen (emulator hands) | Say this |
| --- | --- | --- |
| 0:00 | Board in front of the seated camera. No controller. | Okay, this is HandFlow. It's a desk for your tasks, and you just use your hands. No controller. |
| 0:08 | Coach panel, six moves. | That coach up top walks you through it. Six moves, and if you're quick, you're done in under a minute. |
| 0:16 | Pinch "Reply to emails" into Doing. | Pinch a card between your thumb and finger, and drop it in Doing. |
| 0:26 | Pinch "Write spec draft" onto the center stand. The ring is gold. | Leave one task on a stand. It stays on the desk, and the timer clears it when focus ends. |
| 0:38 | Poke +. A card appears. | Poke the plus button. A new task lands in To Do. |
| 0:46 | Poke Note, pinch it onto the board. | Poke Note, and a yellow note pops out. Pinch it onto the board. It sticks, even if your hand is still a little in front. |
| 0:58 | A long note, words wrapped, card taller. | If the note is long, the words wrap and the note gets taller. Nothing gets cut off. |
| 1:08 | Poke Start. Title on the timer is the parked task. Poke Pause. | Poke Start. That's a twenty-five minute focus timer, and it takes the name of the one task on the stand. Poke it again to pause. |
| 1:22 | Poke Plan. Three morning tasks appear. | Poke Plan for the morning. It adds three tasks, and they're saved on this device. |
| 1:32 | Drag a card to Done. Plant grows. | Drag a finished card to Done. The plant grows, and the streak is still there tomorrow. |
| 1:42 | Poke Review, then Reviewed. | Poke Review when you're winding down, then mark the day reviewed. That history stays on the device. |
| 1:52 | Poke Mic. Dictate: "what's on my desk". The reply names the parked task. | Poke the mic and ask what's on your desk. It answers from the tasks already there. You can also say leave the spec on the desk, or start focus. The cloud planner stays off until you turn it on. |
| 2:08 | Palm menu, then Recenter. | Turn your left palm toward your face and this menu shows up. Recenter, mixed reality, place the board, sound, or exit. |
| 2:18 | One sentence over the placed board. Do not fake a real room if the shot is the emulator. | Mixed reality uses your actual room. It asks for passthrough, and if that's not available it opens in VR. You can put the board on a desk or a wall, and it remembers the spot. |
| 2:30 | High contrast, then back. Large targets optional, then off. | Accessibility covers high contrast, bigger buttons, and look and hold. Those settings are saved. |
| 2:40 | Ambient on, fps counter visible, then both off. Recenter. | There's a soft background sound you can switch on. This counter is the frame rate. On a headset the session asks for seventy-two frames. This recording is the desktop emulator, so the number is lower. |
| 2:52 | Board, one task still on the stand. | That's HandFlow. Leave today's task on the desk. Tomorrow it's still there. |

If the re-record runs long, cut the long-note line and the ambient line. Do not cut the stand, the named timer, or the return line at the end.

YouTube title: `HandFlow — hands-only desk for Quest (Meta VR Start 2026)`. Description: one sentence, the try-it URL, and "Recorded in the Immersive Web Emulator." Public, not unlisted. Captions on.

## 4. How this maps to the four criteria

Reviewers should attack these claims.

1. **Innovation.** The distinctive loop is the stand: one task left in the room, named by the focus timer, moved to Done when the block ends, still there tomorrow. The spoken agent is support, not the idea. Do not pitch HandFlow as an agent product. Best Agentic Interaction wants AI as a core loop. HandFlow can mention the voice actions. It should not expect that special award.
2. **Experience design.** Six moves, a payoff under a minute, a one-word hint while dragging (Column, Stand, Delete), and the label "On the desk" until the first park. The main panels sit inside about 30° of centre.
3. **Technical implementation.** WebXR hands, hit-test, plane detection, anchors with a saved-pose fallback, pinch hysteresis, tests. The session requests 72 fps. **Do not write "runs at 60 fps" or "uses MRUK."** Scene understanding here is WebXR hit-test and planes. The emulator recording is 25 fps.
4. **Polish.** Real emulator hands, US English voice, captions that match the shot, sound on. The write-up above is the prose. Screenshots are still missing: board, a pinned note, the timer with a stand task's name, the hand menu.

Special awards that match the build: Best Reason to Come Back, Best First Five Minutes. Accessibility is present and saved. It is not an eyes-only product, so do not lead with Best Accessibility Forward.

## 5. Sentences that must not appear

- "Measured 60 fps on Quest 3."
- "Uses Meta MRUK."
- "Meta VR Start membership is confirmed." (Say it only after the account page shows it.)
- "Judges can try the latest build" at the current Pages URL. That URL is `dist/` from commit `c9d7d68`. It does not include the stands, the six-move lesson, or the agent.
- "The video shows the voice agent." The 2:06 file does not.
- Any claim that a second person submitted this project, or that this repo is also an Entertainment entry.

## 6. Blockers before anyone clicks submit

1. Commit and push the local tree. `master` on GitHub stops at `77746cd`. The stands, the lesson, the agent, the tests and `DEVPOST.md` are local only. Do not commit `node_modules`, `dist`, `demo/raw`, or secrets. The feature tour mp4 can be committed if you want the file in git. YouTube is still required.
2. Rebuild `dist/` and publish GitHub Pages from that build. Confirm the live URL shows a stand and the six-move coach. The Actions workflow file is local and was rejected before because the token lacked the `workflow` scope. Publishing `gh-pages` from `dist/` is the path that already worked.
3. Re-record from section 3 if the description mentions the spoken agent. Upload publicly. Paste that URL, not a Drive link.
4. On the Devpost account: Start membership and Meta developer access, same person, then submit as Productivity / New Experience.
5. Optional and still undone: screenshots, a real Quest pass. The rules allow the emulator. A headset recording would strengthen the technical score. Meta does not provide a headset.

## 7. Questions for the next review

- Does the inspiration paragraph earn Innovation, or does it still sound like a kanban board with hands?
- Is the agent paragraph too long for a feature that the video may not show?
- Is 15 December 2026 a credible launch date given there has been no Quest pass?
- Which lines in section 3 should be cut so the stand and the return visit land in the first 30 seconds?
- Are any sentences in section 2 stronger than the build?
