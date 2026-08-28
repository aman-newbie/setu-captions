import './style.css';
import { TranscriptionService } from './services/transcriptionService.js';
import { fileToMonoPCM, estimateDeviceTier } from './utils/audioExtract.js';
import { segmentsToSRT, segmentsToVTT, downloadTextFile } from './utils/srtVtt.js';
import { CaptionEditor } from './components/captionEditor.js';

const dropzone = document.getElementById('dropzone');
const dropzoneEmpty = document.getElementById('dropzone-empty');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const preview = document.getElementById('preview');
const fileError = document.getElementById('file-error');

const modelStatus = document.getElementById('model-status');
const modelStatusLabel = document.getElementById('model-status-label');
const modelStatusPct = document.getElementById('model-status-pct');
const modelStatusBar = document.getElementById('model-status-bar');

const modeSelect = document.getElementById('mode-select');
const langSelect = document.getElementById('lang-select');
const transcribeBtn = document.getElementById('transcribe-btn');
const deviceHint = document.getElementById('device-hint');

const exportSrtBtn = document.getElementById('export-srt');
const exportVttBtn = document.getElementById('export-vtt');
const captionListEl = document.getElementById('caption-list');

let currentFile = null;
let currentObjectUrl = null;
let service = null;
let isBusy = false; // true while a model load or transcription is in flight

const editor = new CaptionEditor({
  listEl: captionListEl,
  videoEl: preview,
  onChange: () => {
    const hasSegments = editor.getSegments().length > 0;
    exportSrtBtn.disabled = !hasSegments;
    exportVttBtn.disabled = !hasSegments;
  }
});

// ---- Device capability hint (Fast vs Accurate suggestion) ----
(function suggestMode() {
  const tier = estimateDeviceTier();
  if (tier === 'low') {
    deviceHint.textContent =
      'Your device looks resource-constrained — Fast mode is selected and recommended.';
  } else if (tier === 'high') {
    modeSelect.querySelector('input[value="accurate"]').checked = true;
    deviceHint.textContent = 'Your device can comfortably run Accurate mode.';
  } else {
    deviceHint.textContent = 'Fast mode recommended for this device. Accurate mode will be slower.';
  }
})();

// ---- Stray-drop safety net ----
// Without this, dropping a file even slightly outside the dropzone (or on
// any other part of the page) makes the browser navigate away to render the
// raw file, silently blowing away the whole app. Suppressing the default at
// the document level everywhere makes drag-and-drop safe regardless of
// exactly where the user releases the file.
['dragover', 'drop'].forEach((evt) => {
  document.addEventListener(evt, (e) => e.preventDefault());
});

function showFileError(message) {
  fileError.textContent = message;
  fileError.hidden = false;
}

function clearFileError() {
  fileError.hidden = true;
  fileError.textContent = '';
}

function isSupportedMediaFile(file) {
  if (file.type) return file.type.startsWith('video/') || file.type.startsWith('audio/');
  // Some OS/browser combinations leave `type` empty for less common
  // containers (e.g. .mkv). Fall back to extension sniffing so those
  // files aren't rejected outright.
  return /\.(mp4|mov|m4v|webm|mkv|avi|mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name || '');
}

// ---- File selection (click + drag/drop) ----
browseBtn.addEventListener('click', () => fileInput.click());
// Clicking anywhere on the empty dropzone (not just the button) opens the
// picker too — a bigger, more forgiving touch target on mobile. Scoped to
// dropzoneEmpty so it never fires once a video is loaded and showing native
// playback controls in its place.
dropzoneEmpty.addEventListener('click', (e) => {
  if (e.target.closest('#browse-btn')) return;
  fileInput.click();
});
// Keyboard support to match the role="button"/tabindex="0" added to the
// dropzone empty state — Enter/Space opens the file picker, same as click.
dropzoneEmpty.addEventListener('keydown', (e) => {
  if (e.target.closest('#browse-btn')) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener('change', () => {
  if (fileInput.files?.[0]) handleFile(fileInput.files[0]);
  fileInput.value = ''; // allow re-selecting the same file later
});

['dragenter', 'dragover'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  })
);
['dragleave', 'drop'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
  })
);
dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  if (isBusy) {
    showFileError('A transcription is still in progress. Please wait for it to finish first.');
    return;
  }

  if (!isSupportedMediaFile(file)) {
    showFileError(`"${file.name}" doesn't look like a video or audio file. Please choose a media file.`);
    return;
  }
  clearFileError();

  // A previously loaded file's captions belong to that file, not this one —
  // carrying them over would let someone export stale, mismatched captions.
  editor.setSegments([]);
  exportSrtBtn.disabled = true;
  exportVttBtn.disabled = true;
  modelStatus.hidden = true;

  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  currentFile = file;
  currentObjectUrl = URL.createObjectURL(file);
  preview.src = currentObjectUrl;
  preview.hidden = false;
  dropzoneEmpty.hidden = true;
  transcribeBtn.disabled = false;
}

// ---- Transcription ----
function currentMode() {
  return modeSelect.querySelector('input[name="mode"]:checked').value;
}

function currentLanguageHint() {
  const value = langSelect.value;
  return value === 'auto' ? undefined : value;
}

function setModelProgress(progress) {
  modelStatus.hidden = false;
  const pct = Math.round(progress?.overallPercent ?? 0);
  modelStatusPct.textContent = `${pct}%`;
  modelStatusBar.style.width = `${pct}%`;
  modelStatusLabel.textContent = pct > 0 && pct < 100 ? 'Downloading model…' : 'Preparing AI model…';
}

transcribeBtn.addEventListener('click', async () => {
  if (!currentFile || isBusy) return;
  isBusy = true;
  clearFileError();
  transcribeBtn.disabled = true;
  transcribeBtn.textContent = 'Working…';
  modelStatus.hidden = false;
  modelStatusLabel.textContent = 'Preparing AI model…';
  modelStatusBar.style.width = '0%';
  modelStatusPct.textContent = '0%';

  try {
    if (!service) service = new TranscriptionService();

    await service.loadModel(currentMode(), setModelProgress);
    modelStatusLabel.textContent = 'AI model ready ✓';
    modelStatusPct.textContent = '100%';
    modelStatusBar.style.width = '100%';

    modelStatusLabel.textContent = 'Extracting audio locally…';
    const { pcm } = await fileToMonoPCM(currentFile, 16000);

    modelStatusLabel.textContent = 'Transcribing (this happens on your device)…';
    const { segments } = await service.transcribe(currentMode(), pcm, currentLanguageHint());

    editor.setSegments(segments);
    exportSrtBtn.disabled = segments.length === 0;
    exportVttBtn.disabled = segments.length === 0;
    modelStatusLabel.textContent = `Done — ${segments.length} caption line${segments.length === 1 ? '' : 's'} generated.`;
  } catch (err) {
    console.error(err);
    modelStatusLabel.textContent = `Something went wrong: ${err.message}`;
  } finally {
    isBusy = false;
    transcribeBtn.disabled = false;
    transcribeBtn.textContent = 'Generate captions';
  }
});

// ---- Export ----
exportSrtBtn.addEventListener('click', () => {
  const srt = segmentsToSRT(editor.getSegments());
  downloadTextFile('captions.srt', srt, 'application/x-subrip');
});

exportVttBtn.addEventListener('click', () => {
  const vtt = segmentsToVTT(editor.getSegments());
  downloadTextFile('captions.vtt', vtt, 'text/vtt');
});

window.addEventListener('beforeunload', () => {
  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
});
