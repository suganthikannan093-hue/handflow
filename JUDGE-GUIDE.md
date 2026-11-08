# Try HandFlow in two minutes

**App:** https://suganthikannan093-hue.github.io/handflow/

**Premise:** choose one task, give it a physical place, and leave a clear next step for your return.

## Desktop or phone

1. Open **Capture & desk**. Type “Draft the opening slide” and add it as a task.
2. Find that task and choose **Place on desk**. Keep exactly one open task on the desk to bind focus to it.
3. Choose **A next step for my desk task**, enter “Open with the customer problem”, and save.
4. Select **1 minute · quick focus / demo** to try the full loop. Start focus and close the drawer. After onboarding, the backlog fades; the plant grows and blooms as time passes. The normal preset is 25 minutes.
5. Reload during the block. The task, cue and countdown persist. When the block finishes, the bound desk task moves to Done and the garden retains growth.
6. Delete a task and choose Undo, or use Ctrl/Cmd+Z outside a text field.

To try speech, select **Record a thought**, speak, then tap it again to stop. Read the transcript and select **Use transcript**. This uses OpenAI through a server-held key. If microphone permission or the service fails, the text composer remains available. Commands include “park [task]”, “start focus”, “next step: [cue]” and “review my day”. Unrecognized speech becomes a task only after confirmation.

## Quest / hands

Enable hand tracking, open the HTTPS app in Meta Quest Browser and select **Enter MR**. Follow the six-action guide. Pinch a card to carry it; poke a button to activate it. Turn your left palm toward your face for the wrist menu. Keep the controllers down throughout.

In MR, aim at a detected desk/wall and pinch in empty space to place the workspace. The saved anchor is browser-dependent; a saved pose is the fallback. Recenter brings the workspace back within reach.

The **Mic** button records on the first poke and stops on the next. Use words or Cancel are direct-touch buttons on the transcript panel. “Next step: …” attaches a return cue to the one desk task. A headset system keyboard is not required for this voice path.

## Emulator

Append `?emulate` for IWER's Quest 3 and synthetic room. `?emulate&lite` omits the room for faster gesture testing. The video labels this environment accurately. It is not a real passthrough recording.

## What to evaluate

- Does placing one task on the desk make the next action clear?
- Does focus visibly change the workspace?
- Does returning preserve context as well as task state?
- Can the core loop run without the speech service?

Known limits: no physical Quest validation yet; one device-local workspace; no cloud sync; speech requires microphone support and a network; voice quotas are best effort per Worker instance. The project requests 72 Hz but has no measured hardware frame-rate claim.
