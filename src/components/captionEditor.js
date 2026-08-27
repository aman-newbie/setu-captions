import { formatSRTTime } from '../utils/srtVtt.js';

/**
 * Renders an editable caption list into `listEl`, keeps it in sync with
 * `videoEl` playback, and calls `onChange(segments)` whenever the user edits
 * text so the caller can keep its own state up to date.
 */
export class CaptionEditor {
  constructor({ listEl, videoEl, onChange }) {
    this.listEl = listEl;
    this.videoEl = videoEl;
    this.onChange = onChange;
    this.segments = [];

    this.videoEl.addEventListener('timeupdate', () => this.highlightActive());
  }

  setSegments(segments) {
    this.segments = segments.map((s) => ({ ...s }));
    this.render();
  }

  getSegments() {
    return this.segments;
  }

  render() {
    this.listEl.innerHTML = '';

    if (!this.segments.length) {
      const empty = document.createElement('li');
      empty.className = 'caption-empty';
      empty.textContent = 'Captions will appear here once generated. Every line stays editable.';
      this.listEl.appendChild(empty);
      return;
    }

    this.segments.forEach((seg, index) => {
      const row = document.createElement('li');
      row.className = 'caption-row';
      row.dataset.index = String(index);

      // A real <button> instead of a click handler on the row: it's
      // reachable and activatable with the keyboard (Tab + Enter/Space) for
      // free, and it avoids nesting one interactive element (the row) around
      // another (the textarea), which is invisible to assistive tech.
      const timeBtn = document.createElement('button');
      timeBtn.type = 'button';
      timeBtn.className = 'caption-time';
      timeBtn.textContent = `${formatSRTTime(seg.start)} → ${formatSRTTime(seg.end)}`;
      timeBtn.setAttribute('aria-label', `Jump video to ${formatSRTTime(seg.start)}`);
      timeBtn.addEventListener('click', () => {
        this.videoEl.currentTime = seg.start;
        this.videoEl.play?.().catch(() => {});
      });

      const textarea = document.createElement('textarea');
      textarea.className = 'caption-text';
      textarea.value = seg.text;
      textarea.spellcheck = false;
      textarea.setAttribute('aria-label', `Caption text for ${formatSRTTime(seg.start)} to ${formatSRTTime(seg.end)}`);
      textarea.addEventListener('input', () => {
        this.segments[index].text = textarea.value;
        this.onChange?.(this.segments);
      });

      row.appendChild(timeBtn);
      row.appendChild(textarea);
      this.listEl.appendChild(row);
    });
  }

  highlightActive() {
    const t = this.videoEl.currentTime;
    const rows = this.listEl.querySelectorAll('.caption-row');
    rows.forEach((row) => {
      const index = Number(row.dataset.index);
      const seg = this.segments[index];
      const isActive = seg && t >= seg.start && t <= seg.end;
      row.classList.toggle('active', Boolean(isActive));
      if (isActive) {
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }
}
