// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { CaptionEditor } from '../src/components/captionEditor.js';

function makeVideoStub() {
  return {
    currentTime: 0,
    addEventListener: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined)
  };
}

const segments = [
  { start: 0, end: 2.4, text: 'Bro aaj hum is video ko properly edit karenge.' },
  { start: 2.4, end: 5.1, text: 'I think ye transition thoda zyada fast hai.' }
];

describe('CaptionEditor', () => {
  it('renders an empty-state message when there are no segments', () => {
    const listEl = document.createElement('ol');
    const editor = new CaptionEditor({ listEl, videoEl: makeVideoStub() });
    editor.setSegments([]);
    expect(listEl.querySelector('.caption-empty')).toBeTruthy();
  });

  it('renders one keyboard-accessible time button and one textarea per segment', () => {
    const listEl = document.createElement('ol');
    const editor = new CaptionEditor({ listEl, videoEl: makeVideoStub() });
    editor.setSegments(segments);

    const rows = listEl.querySelectorAll('.caption-row');
    expect(rows.length).toBe(2);

    const timeButtons = listEl.querySelectorAll('button.caption-time');
    expect(timeButtons.length).toBe(2);
    timeButtons.forEach((btn) => expect(btn.getAttribute('type')).toBe('button'));

    const textareas = listEl.querySelectorAll('textarea.caption-text');
    expect(textareas.length).toBe(2);
    expect(textareas[0].value).toBe(segments[0].text);
  });

  it('seeks the video when a caption time button is clicked (keyboard-activatable via native button semantics)', () => {
    const listEl = document.createElement('ol');
    const video = makeVideoStub();
    const editor = new CaptionEditor({ listEl, videoEl: video });
    editor.setSegments(segments);

    const secondTimeBtn = listEl.querySelectorAll('button.caption-time')[1];
    secondTimeBtn.dispatchEvent(new window.Event('click', { bubbles: true }));

    expect(video.currentTime).toBe(segments[1].start);
    expect(video.play).toHaveBeenCalled();
  });

  it('updates a segment and notifies onChange when its textarea is edited', () => {
    const listEl = document.createElement('ol');
    const onChange = vi.fn();
    const editor = new CaptionEditor({ listEl, videoEl: makeVideoStub(), onChange });
    editor.setSegments(segments);

    const firstTextarea = listEl.querySelectorAll('textarea.caption-text')[0];
    firstTextarea.value = 'Edited line';
    firstTextarea.dispatchEvent(new window.Event('input', { bubbles: true }));

    expect(editor.getSegments()[0].text).toBe('Edited line');
    expect(onChange).toHaveBeenCalled();
  });
});
