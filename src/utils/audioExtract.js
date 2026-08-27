/**
 * Decode a video/audio File into mono Float32 PCM at the target sample rate
 * (16kHz, what Whisper expects). Everything happens via the browser's
 * built-in Web Audio API — the file bytes never leave the tab.
 */
export async function fileToMonoPCM(file, targetSampleRate = 16000) {
  const arrayBuffer = await file.arrayBuffer();

  const DecodeCtx = window.AudioContext || window.webkitAudioContext;
  const decodeCtx = new DecodeCtx();
  let decoded;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await decodeCtx.close();
  }

  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const frameCount = Math.max(1, Math.ceil(decoded.duration * targetSampleRate));
  const offlineCtx = new OfflineCtx(1, frameCount, targetSampleRate);

  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  // Connecting a multi-channel source to a 1-channel destination triggers
  // the Web Audio API's built-in down-mix, so this also handles stereo.
  source.connect(offlineCtx.destination);
  source.start(0);

  const rendered = await offlineCtx.startRendering();
  return {
    pcm: rendered.getChannelData(0),
    duration: decoded.duration,
    sampleRate: targetSampleRate
  };
}

export function estimateDeviceTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4; // GB, Chrome-only; undefined elsewhere
  if (cores <= 2 || memory <= 2) return 'low';
  if (cores <= 4 || memory <= 4) return 'mid';
  return 'high';
}
