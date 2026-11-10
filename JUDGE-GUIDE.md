# Try HandFlow in two minutes

**App:** https://suganthikannan093-hue.github.io/handflow/

**Track:** Meta VR Start Developer Competition 2026 — Productivity, with a “Best Reason to Come Back” pitch: a daily hands-first ritual, device-local persistence, a plant that grows with finished work, and a “Where you left off” greeting on the next launch.

**Premise:** pinch one task onto the desk focus stand, let the rest of the backlog recede while you focus, and carry a short note plus the next task into tomorrow.

This guide is a walkthrough, not a user study.

## Desktop or phone

1. Open **Capture & desk**. Type “Draft the opening slide” and add it as a task.
2. Find that task and choose **Place on desk**. Keep exactly one open task on the desk to bind focus to it.
3. Choose **A next step for my desk task**, enter “Open with the customer problem”, and save.
4. Select **1 minute · quick focus / demo** to try the full loop. Start focus and close the drawer. After onboarding, the backlog fades and a compact view keeps the focus task plus the next three. The plant grows and blooms as time passes. The normal preset is 25 minutes.
5. Reload during the block. The task, cue and countdown persist. When the block finishes, the bound desk task moves to Done and the garden retains growth.
6. Choose **Carry to tomorrow**, write a short context note, and save. Reload: the board greets you with **Where you left off**, and that task is first.
7. Delete a task and choose Undo, or use Ctrl/Cmd+Z outside a text field.

To try speech, select **Record a thought**, speak, then tap it again to stop. Read the transcript and select **Use transcript**. This uses OpenAI through a server-held key. Voice is never required. If microphone permission or the network fails, a hands-only hint appears; pinch a task onto the desk stand or type in this drawer. Commands include “park [task]”, “start focus”, “next step: [cue]” and “review my day”. Unrecognized speech becomes a task only after confirmation.

## Quest / hands

Enable hand tracking, open the HTTPS app in Meta Quest Browser and select **Enter MR**. Follow the six-action guide. Pinch a card to carry it; poke a button to activate it. Turn your left palm toward your face for the wrist menu. Keep the controllers down throughout.

The workspace opens in front of you (viewer-relative). Pinch the **Grab to place** handle to move it onto any desk or wall, and poke − / + to scale it. Recenter brings it back within reach. Interactive targets stay inside about 0.6 m of a seated hand.

The **Mic** button records on the first poke and stops on the next. **Hands instead** closes voice capture. “Next step: …” attaches a return cue to the one desk task. A headset system keyboard is not required for this voice path, and every voice action has a poke or Capture & desk equivalent.

## Emulator

Append `?emulate` for IWER's Quest 3 and synthetic room. `?emulate&lite` omits the room for faster gesture testing. The video labels this environment accurately. It is not a real passthrough recording.

## What to evaluate

- Does placing one task on the desk make the next action clear?
- Does focus visibly change the workspace, and does the backlog recede?
- Does “Carry to tomorrow” plus “Where you left off” give a reason to return?
- Can the core loop run without the speech service?

Known limits: no physical Quest validation yet; one device-local workspace; no cloud sync; speech requires microphone support and a network; voice quotas are best effort per Worker instance. The project requests 72 Hz but has no measured hardware frame-rate claim.
