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
let service = null;

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

// ---- File selection (click + drag/drop) ----
browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files?.[0]) handleFile(fileInput.files[0]);
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
  currentFile = file;
  const url = URL.createObjectURL(file);
  preview.src = url;
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
  if (progress?.status === 'progress' && typeof progress.progress === 'number') {
    const pct = Math.round(progress.progress);
    modelStatusLabel.textContent = `Downloading model: ${progress.file || ''}`.trim();
    modelStatusPct.textContent = `${pct}%`;
    modelStatusBar.style.width = `${pct}%`;
  } else if (progress?.status === 'done') {
    modelStatusLabel.textContent = 'Preparing AI model…';
  } else {
    modelStatusLabel.textContent = 'Preparing AI model…';
  }
}

transcribeBtn.addEventListener('click', async () => {
  if (!currentFile) return;
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
