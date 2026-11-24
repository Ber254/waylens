# WayLens – AI eyes for blind travelers (#BuildHybridAI)

A web app (Chrome) that describes surroundings, reads and translates signs/menus/tickets, and answers spoken or typed questions about what the camera sees. It is built on **Firebase AI Logic hybrid inference**: prompts run on-device with Gemini Nano when the local model is available and fall back to the cloud when it is not.

## Why hybrid matters for this user
| Need | On-device | Cloud |
|---|---|---|
| Works in a metro tunnel / abroad without data | yes | no |
| Camera frames of a traveler's surroundings stay private | yes | no |
| Long or hard scenes, devices without Nano | no | yes |

* **Automatic mode:** `InferenceMode.PREFER_ON_DEVICE` – local first, cloud fallback.
* **Private mode:** `InferenceMode.ONLY_ON_DEVICE` – nothing ever leaves the phone (voice input is disabled there because Chrome's speech recognition is an online service).
* Every answer is announced with where it was computed (`response.inferenceSource`).

## Accessibility design
Screen-reader first: three large buttons, keyboard shortcuts (D / R / A / P / Esc), `aria-live` status, answers read aloud with Web Speech, haptic feedback, high contrast, adjustable speech speed, ES/EN answers. The model is instructed to put hazards first, use clock positions, and **never claim a path or crossing is safe**.

## Run it
```bash
npm install
cp .env.example .env     # fill in your Firebase web app config
npm run dev              # or: npm run build && npm run preview
```
1. Create a Firebase project, add a Web app, enable the Gemini Developer API (Firebase AI Logic).
2. Enable **App Check** (register the web app with the *Fraud Defense (reCAPTCHA Enterprise)* provider and your site key) and set `VITE_APPCHECK_DEBUG=true`; load the app once, copy the debug token from the browser console into *App Check > Manage debug tokens*.
3. Use Chrome with Gemini Nano available (desktop Chrome with the Prompt API enabled, or Android). First tap on *Start* triggers the model download.
4. Try it without Firebase: `npm run dev` then open `/?mock=1` (dev-only fake backend; never use for the demo video).

Code that calls Firebase AI Logic at runtime: `src/ai.js` (`getAI`, `getGenerativeModel` with `HybridParams`, `generateContent`).

## Tests
`npm test` runs a Playwright UI smoke test against the mock backend (flows, offline, private mode, accessible names). Real on-device inference needs Chrome + Gemini Nano and is verified manually.

## Safety & limits
WayLens is an assistive aid and can be wrong. It is not a replacement for a cane, guide dog or orientation training.

License: Apache-2.0
