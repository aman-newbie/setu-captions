// Runs entirely inside a Web Worker so the UI thread never blocks.
// @xenova/transformers pulls the ONNX-format Whisper weights straight from
// the Hugging Face Hub CDN on first use and caches them in the browser
// (service worker + Cache Storage handle repeat-visit / offline reuse).
import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

// Fast: small download, runs on modest hardware. Accurate: bigger model,
// noticeably better on accented / code-switched speech, needs more RAM+CPU.
const MODEL_BY_MODE = {
  fast: 'Xenova/whisper-base',
  accurate: 'Xenova/whisper-small'
};

let transcriber = null;
let loadedModelId = null;

// Whisper ships as several separate files (encoder, decoder, tokenizer,
// configs...). Each one reports its own 0-100% independently, so passing
// that straight through makes the bar jump backward every time a new file
// starts. We track bytes across ALL files and report one combined,
// never-decreasing percentage instead.
function createProgressAggregator(postProgress) {
  const files = new Map(); // file -> { loaded, total }
  let maxPercent = 0;

  return (event) => {
    if (event?.file) {
      const prev = files.get(event.file) || { loaded: 0, total: 0 };
      if (typeof event.loaded === 'number') prev.loaded = event.loaded;
      if (typeof event.total === 'number') prev.total = event.total;
      files.set(event.file, prev);
    }

    let loadedSum = 0;
    let totalSum = 0;
    for (const { loaded, total } of files.values()) {
      loadedSum += loaded;
      totalSum += total;
    }

    const rawPercent = totalSum > 0 ? (loadedSum / totalSum) * 100 : 0;
    maxPercent = Math.max(maxPercent, rawPercent); // never let it go backward

    postProgress({
      status: event?.status,
      file: event?.file,
      overallPercent: Math.min(100, maxPercent)
    });
  };
}

async function ensureModel(mode) {
  const modelId = MODEL_BY_MODE[mode] || MODEL_BY_MODE.fast;
  if (transcriber && loadedModelId === modelId) return transcriber;

  const reportProgress = createProgressAggregator((payload) => {
    self.postMessage({ type: 'progress', payload });
  });

  transcriber = await pipeline('automatic-speech-recognition', modelId, {
    progress_callback: reportProgress
  });
  loadedModelId = modelId;
  return transcriber;
}

self.onmessage = async (event) => {
  const { type } = event.data;

  if (type === 'load') {
    const { mode } = event.data;
    try {
      await ensureModel(mode);
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: err?.message || String(err) });
    }
    return;
  }

  if (type === 'transcribe') {
    const { mode, pcm, languageHint } = event.data;
    try {
      const model = await ensureModel(mode);
      // languageHint: 'hi' | 'en' | undefined (undefined = let Whisper detect,
      // which is the closer-to-honest option for mixed Hinglish speech).
      const output = await model(pcm, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: languageHint || null,
        task: 'transcribe',
        return_timestamps: true
      });

      const chunks = output?.chunks?.length
        ? output.chunks
        : [{ timestamp: [0, null], text: output?.text || '' }];

      const segments = chunks.map((chunk) => ({
        start: chunk.timestamp?.[0] ?? 0,
        end: chunk.timestamp?.[1] ?? (chunk.timestamp?.[0] ?? 0) + 2,
        text: chunk.text || ''
      }));

      self.postMessage({ type: 'result', payload: { segments, rawText: output?.text || '' } });
    } catch (err) {
      self.postMessage({ type: 'error', message: err?.message || String(err) });
    }
  }
};
