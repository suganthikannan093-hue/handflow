# HandFlow · 8 November 2026

## A task gets a place, a focus block, and a way back

- **Your own words:** a task/note composer and recorded OpenAI voice capture replace reliance on template-only content. Review the transcript before applying it.
- **Quiet focus:** after onboarding, Start fades the backlog when one desk task is bound to the timer. The task, countdown and garden remain prominent. Pause brings the board back.
- **Next-step cues:** save a concrete restart instruction on your desk task. It travels with the card and survives undo and reload.
- **An earned garden:** growth is visible during a focus block; completed focus earns lasting growth for the day.
- **Flexible focus:** choose 25, 5 or 1 minute. Short blocks are clearly labelled on the timer and are useful for trying the full loop.
- **An operable desktop path:** Capture & desk exposes real form fields, task movement, desk placement, delete/undo, timer controls, comfort settings and status announcements.

## Review fixes included

Larger board and readable labels; Start begins focus on its first click; first-launch guided tutorial; three-card column paging; free-space note snapping; timer wall-clock persistence; mobile HUD dismissal and touch instructions; undo; palm menu tested with emulated joints; FPS off by default; no per-frame pixel reads in the tested emulator path.

MR desk placement keeps the toolbar, delete zone and task stands above the tabletop. The restart cue uses its own clear board banner.

Spoken next-step commands accept the punctuation produced by transcription, including commas and dashes, without creating an extra task.

## Voice details

The frontend contains an endpoint URL, never an OpenAI key. The public voice service is https://handflow-voice.adeptacorn256.chatgpt.site. Audio is recorded only after an explicit tap, stops after 20 seconds, and is sent to OpenAI for transcription. HandFlow does not persist it. Errors preserve the text-entry path. Origin checks and in-memory request limits are demo safeguards, not durable billing quotas. A production rollout needs shared quota storage and account-level spend controls.

Browser speech remains a fallback when no cloud endpoint is configured. The old browser-local xAI planner key is no longer used.

## Verification boundary

Desktop and emulated Quest checks do not establish physical Quest performance, comfort or real-room tracking quality. No physical headset result is claimed. See PROOF.md and JUDGE-GUIDE.md.
