# HandFlow – Submission notes (Meta VR Start Developer Competition 2026)
**Deadline: 18 Nov 2026, 12:00 PM PT (= 19 Nov 2026, 12:30 AM IST).** Aim to submit at least 24 h early.

Devpost prose (inspiration, build, what's next, launch date) is in `DEVPOST.md`.
Track: **Productivity**. Division: **New Experience**. Target public launch: **15 December 2026**.

## Status of the judging package
- Code: this repo. `npm test` and `npm run test:e2e` cover the board, notes and timer with emulated hand pinches.
- Try-it link: GitHub Pages from `dist/`. `.github/workflows/pages.yml` builds and deploys on `master`. A token without the `workflow` scope cannot push that file; add it from an account that can update Actions, then set the Pages source to GitHub Actions. Until then, publish `dist/` from a `gh-pages` branch.
- Demo video: `demo/handflow-demo.mp4`, recorded from the IWER Quest with hand pinches. Upload that file to YouTube or Vimeo and paste the public URL into Devpost. This environment cannot sign in to those sites.
- Devpost form: paste `DEVPOST.md`. This environment cannot sign in to Devpost or click submit.
- Meta VR Start membership and Meta developer access: not confirmed from this machine. Check VR Start is active and that developer.meta.com shows the same account before you submit.
- A physical Quest pass is still outstanding. Pinch `0.02` / `0.035` and palm `0.55` in `src/main.ts` are the numbers to tune.

## 1. Primary deliverable: WebXR link
1. Run `npm ci && npm test && npm run build`.
2. Deploy `dist/` to Netlify, GitHub Pages, Vercel or Cloudflare Pages. It must be **HTTPS**.
3. On a Quest, open the URL in Meta Quest Browser. Check that hands-only use works, that the app recenters on entry, and that the hand menu and exit work.
4. Put the URL on the Devpost submission as the "try it" link. Also add a QR code and the short form, which is easy to type in Quest Browser.

## 2. Optional: Meta Horizon Store web app (PWA)
HandFlow already has `manifest.webmanifest` and an icon, and it runs fullscreen in standalone mode.
- **PWABuilder** (pwabuilder.com): enter the deployed URL, then Package → Meta Quest. This produces a signed APK that wraps the PWA.
- **Bubblewrap with Meta's fork:** `npx @meta-quest/bubblewrap-cli init --manifest https://<your-site>/manifest.webmanifest`, then `build`. Sideload it with `adb install app-release-signed.apk` or upload it to the Meta Horizon developer dashboard (Release channel / App Lab-style test release).
- For a store PWA, add 512×512 and 192×192 PNG icons, and a service worker if offline support is wanted.
- If the competition asks for an **invite URL**, create a release channel in the developer dashboard, add the judges or turn on the invite link, then paste that URL into Devpost.
- Check the Devpost rules page for the current required platform and format before you submit.

## 3. Devpost checklist
- [ ] Project name, tagline ("Your hands are the interface: a seated VR workspace for tasks, notes and focus"), and the **Productivity** track selected
- [ ] WebXR URL (and APK or invite link if packaged) that works on Quest 3/3S/Pro
- [ ] Demo video (see below), public on YouTube or Vimeo, under the length limit
- [ ] Screenshots: board, a note being pinned, the timer running, the hand menu
- [ ] Description: problem → hands-first solution → how it works (pinch/poke/palm-up) → seated ergonomics → tech stack (WebXR, three.js, Hand Input API, IWER) → what's next
- [ ] Public repository link with the README
- [ ] Team members added; confirm eligibility and that all rules are accepted
- [ ] Built-with tags: webxr, threejs, typescript, vite, meta-quest, hand-tracking

## 4. Demo video tips
- Record on the headset (Camera app, or Meta Horizon app casting), and add a **mixed-reality or picture-in-picture shot of your real hands** to prove there are no controllers.
- Follow the demo script in the README. Show a useful result in the first 20 seconds: move a card to Done and hear the chime.
- Keep head movement slow and record at 1080p or higher. Turn on sound so the audio feedback is heard. Add captions for each gesture ("Pinch", "Poke", "Palm up").
- End with persistence (exit, re-enter, everything is still there) and the hand menu Exit. Total length about 2–3 minutes.
