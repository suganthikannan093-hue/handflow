# HandFlow submission package

**App:** https://suganthikannan093-hue.github.io/handflow/

**Repository:** https://github.com/suganthikannan093-hue/handflow

**Voice:** https://handflow-voice.adeptacorn256.chatgpt.site/api/status

**Track:** Productivity · **Division:** New Experience

**Pitch:** Give your next task a place. A hands-first desk for focus, progress, and a clear way back.

## Current materials

- `DEVPOST.md`: current description; replaces the old template/planner pitch.
- `RELEASE-NOTES.md`: latest features and review fixes.
- `JUDGE-GUIDE.md`: reproducible two-minute try-it path.
- `PROOF.md`: tests and evidence boundaries.
- `SUBMISSION-SCRIPT.md`: final form and video handoff; updated after the app is verified and published.
- `demo/handflow-final.mp4`: final recording will replace the older demo drafts once rendering is complete.

## Publishing

The judging URL serves the production output on the existing `gh-pages` branch. Source and release documentation live on `master`. Publishing does not depend on adding a new Actions workflow. `release.json` in the deployed output identifies the release and source commit.

The voice backend is a separate Sites Worker. Its existing project ID is tracked inside `voice-service/.openai/hosting.json`; the OpenAI key is held only as a secret runtime variable. The public frontend config contains an endpoint URL only.

## Entrant-only completion

Confirm VR Start membership, developer access, division eligibility, team representation and project rights; upload the final video publicly to YouTube/Vimeo; paste the final materials into Devpost; check every submitted link; submit and save the receipt. This work does not assert submission or eligibility.

Official rules: https://start-developer-competition-26.devpost.com/rules

Deadline listed by the organizer: **18 November 2026, 12:00 PM PST** (19 November, 1:30 AM IST). Freeze the submitted build at the deadline and keep it available through the winner announcement. The official rules accept Quest or equivalent XR-emulator demonstration footage and require a public YouTube/Vimeo video under three minutes.

A physical Quest validation pass remains recommended; emulator footage must stay labelled as such. Requesting 72 Hz does not prove on-device performance.
