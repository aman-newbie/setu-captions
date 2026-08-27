/**
 * Convert caption segments to SubRip (.srt) and WebVTT (.vtt) text, and
 * trigger a browser download. Kept dependency-free and framework-free so it
 * can be unit tested without a browser.
 *
 * A "segment" is: { start: number (seconds), end: number (seconds), text: string }
 */

function pad(n, len = 2) {
  return String(Math.trunc(n)).padStart(len, '0');
}

function splitSeconds(totalSeconds) {
  const clamped = Math.max(0, totalSeconds || 0);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  return { h, m, s, ms };
}

export function formatSRTTime(totalSeconds) {
  const { h, m, s, ms } = splitSeconds(totalSeconds);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

export function formatVTTTime(totalSeconds) {
  const { h, m, s, ms } = splitSeconds(totalSeconds);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

export function segmentsToSRT(segments) {
  return segments
    .map((seg, i) => {
      const text = (seg.text || '').trim();
      return `${i + 1}\n${formatSRTTime(seg.start)} --> ${formatSRTTime(seg.end)}\n${text}\n`;
    })
    .join('\n')
    .trim() + '\n';
}

export function segmentsToVTT(segments) {
  const body = segments
    .map((seg) => {
      const text = (seg.text || '').trim();
      return `${formatVTTTime(seg.start)} --> ${formatVTTTime(seg.end)}\n${text}\n`;
    })
    .join('\n')
    .trim();
  return `WEBVTT\n\n${body}\n`;
}

export function downloadTextFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
