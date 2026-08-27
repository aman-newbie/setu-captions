# Setu Captions

**Setu** (सेतु) means "bridge" — this app is a bridge between your video and its
subtitles, for creators speaking Hindi, English, and the Hinglish mix in between.

Free. Private. No account, no upload, no API key.

## Features

- Drag-and-drop (or file picker) video/audio upload
- On-device speech-to-text using an open-source Whisper model — your media
  never leaves the browser tab
- Fast / Accurate mode toggle, with a device-capability hint to suggest which
  one your hardware can comfortably run
- Language hint selector: Auto (recommended for Hinglish), Hindi, English
- Editable caption list, synced to video playback (click a line to jump the
  video to it; the active line highlights as the video plays)
- Export to `.srt` and `.vtt`
- Installable PWA with offline caching of the app shell and the downloaded
  model, so repeat use doesn't need internet

## Tech stack

- [Vite](https://vitejs.dev/) — build tool, vanilla JS (no framework overhead)
- [`@xenova/transformers`](https://github.com/xenova/transformers.js) — runs
  Whisper (ONNX format) fully client-side via WebAssembly/ONNX Runtime Web
- [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) — manifest + service
  worker generation, with custom runtime caching for the model weights
- [Vitest](https://vitest.dev/) — unit tests for the caption export logic
- GitHub Actions — build, test, and deploy to GitHub Pages on every push to
  `main`

## Architecture

```
User's video/audio file
        │
        ▼
  Browser (Web Audio API) ── decode + resample to 16kHz mono PCM
        │
        ▼
  Web Worker ── @xenova/transformers Whisper pipeline (WASM/ONNX)
        │
        ▼
  Caption segments {start, end, text}
        │
        ▼
  Editable caption list, synced to <video>
        │
        ▼
  .srt / .vtt export (client-side Blob download)
```

Nothing here talks to a backend. The only network requests the app makes are
the *first-time* download of the Whisper model weights (from the Hugging
Face Hub CDN) and the ONNX Runtime WASM binaries — both are cached by the
service worker afterward.

## How transcription works

Transcription uses [Whisper](https://github.com/openai/whisper), OpenAI's
open-source (MIT-licensed) speech recognition model, running through
`@xenova/transformers`'s browser-native ONNX build. Two model sizes are
offered:

| Mode | Model | Trade-off |
|---|---|---|
| Fast | `Xenova/whisper-base` | Smaller download, quicker, good baseline accuracy |
| Accurate | `Xenova/whisper-small` | Larger download, slower, better on accents & code-switching |

Whisper is multilingual and handles Hindi, English, and mixed Hindi-English
speech without any fine-tuning from us. The language hint lets you nudge it,
or leave it on Auto and let Whisper detect per-segment.

## Supported languages & code-switching — please read

- **Hindi** and **English** are both first-class — Whisper was trained on
  both at scale.
- **Hinglish / code-switching**: this is the hardest case for *any* current
  open-source ASR model, including Whisper. In testing, it handles many
  code-switched sentences well, but it is **not guaranteed** to always
  preserve the exact mixed-language phrasing — it can occasionally normalize
  a sentence toward pure Hindi (Devanagari) or pure English rather than
  keeping the original code-switch. If you see this, editing the affected
  line is currently the fix; there's no larger open-source model available
  today that solves this perfectly for free. This is a real limitation of
  the field, not something we're hiding.

## Privacy

Audio/video processing (decoding, resampling, transcription) all happens
inside your browser tab, using the Web Audio API and a Web Worker. The file
you select is never uploaded to any server we control. The only outbound
network requests are the one-time model/runtime downloads described above,
made directly from your browser to Hugging Face's and jsDelivr's CDNs.

## Browser compatibility

Requires a browser with WebAssembly, Web Audio API, and Web Workers — all
modern evergreen browsers:

- Chrome/Edge 90+, Firefox 90+, Safari 15.4+ (desktop and iOS/iPadOS)
- Android Chrome/Firefox (recent versions)

Older browsers, or browsers with WebAssembly disabled, cannot run local
transcription. Low-memory mobile devices may struggle with Accurate mode —
use Fast mode there.

## Local development

```bash
git clone https://github.com/aman-newbie/setu-captions.git
cd setu-captions
npm install
npm run dev
```

Open the printed local URL. First transcription run will download the model
(progress is shown in the UI); subsequent runs use the cache.

## Build

```bash
npm run build
npm run preview   # sanity-check the production build locally
```

## Tests

```bash
npm test
```

Covers the SRT/VTT formatting logic (timestamp formatting, cue numbering,
Hinglish text passthrough). Browser-only code (audio decoding, the Whisper
worker) is exercised manually in-browser rather than unit tested, since it
depends on Web Audio/WebAssembly APIs that don't exist in a Node test runner.

## Deployment

Deployment is automatic: `.github/workflows/deploy.yml` builds, tests, and
publishes the app to GitHub Pages on every push to `main`, using GitHub's
official `actions/deploy-pages` action. No manual deploy step, no server to
manage, no hosting cost.

If you fork this repo, enable Pages under **Settings → Pages → Source: GitHub
Actions**, and update `base` in `vite.config.js` to match your repo name.

## Free / open-source components

| Component | License | Notes |
|---|---|---|
| Whisper model weights | MIT (OpenAI) | via Xenova's ONNX-converted mirrors |
| `@xenova/transformers` | Apache-2.0 | in-browser inference runtime |
| ONNX Runtime Web | MIT | WebAssembly execution backend |
| Vite, Vitest, vite-plugin-pwa | MIT | build tooling |
| GitHub Actions / Pages | Free tier | CI/CD + static hosting |

No paid API, no API key, and no subscription is required for the core
caption-generation workflow.

## Cost

**Free**, including hosting (GitHub Pages free tier) and transcription
(runs on the user's own device, no metered API calls). The only "cost" is
bandwidth for the one-time model download, paid by neither you nor us — it's
a direct browser-to-CDN request with no middleman.

## PWA / installability

The app ships a web manifest and service worker (via `vite-plugin-pwa`), so
supporting browsers will offer an "Install" option, and the app shell plus
downloaded model are cached for offline reuse. App icons currently ship as
SVG placeholders (`public/icons/`); swapping in a proper PNG icon set
(192×192, 512×512, maskable variants) is a good follow-up for a polished
install prompt on platforms with limited SVG-icon support.

## Known limitations

- Hinglish code-switching preservation is best-effort, not guaranteed (see
  above).
- App icons are SVG placeholders, not a full PNG icon set.
- First transcription run requires internet access to download the model;
  fully offline only after that first download.
- Very long videos (30+ minutes) in Accurate mode may be slow on
  lower-end hardware — this is expected given the local-processing
  privacy trade-off.
- No automated browser/E2E tests are included; only the export-format unit
  tests run in CI. Manual testing is recommended before relying on this for
  a specific accent/dialect at scale.

## License

MIT — see [LICENSE](./LICENSE).
