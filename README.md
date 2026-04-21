# The Password Game Solver (Chrome Extension)

A Chrome extension that plays [The Password Game](https://neal.fun/password-game/) automatically via a constraint solver approach and ProseMirror input escalation.

## Setup and Build

1. `npm install`
2. `node esbuild.config.mjs`
3. Open Chrome -> Extensions -> Enable Developer Mode.
4. Click "Load unpacked" and select the `dist` folder generated (or the root if manifest points to `dist/`). Wait, manifest is in root, load the root directory!

## Manual Testing Guide (Phase 0)

The extension uses an escalation ladder to type into the ProseMirror editor. If it fails, open DevTools on the game and run:
`document.querySelector("[contenteditable='true']")`
to ensure the framework setup hasn't dramatically changed. Check `SELECTORS.md` strings.

## Usage

- The extension will automatically run on the password game page.
- Most rules are solved dynamically.
- For rules requiring visual interpretation (Captcha, Chess, GeoGuessr, YouTube durations when un-parseable), it will pause and prompt for human fallback in the extension popup. Check the popup when the game stalls!

## Known Limitations
- YouTube duration solver doesn't have an API key and relies on simple fallback strategies or manual input.
- GeoGuessr requires manual human intervention.
- Unicode matching handles Emoji natively using `Intl.Segmenter` but limits digits specifically to ASCII 0-9 as per JS defaults unless modified.

## Troubleshooting

- **Game Doesn't React**: The extension's escalation ladder tests `execCommand`, `InputEvent`, direct ProseMirror View accesses, and a fallback property hack. If none of these works due to a major rewrite of the site, see `dom-writer.ts` and inspect if the `.pmViewDesc` structure changed.
