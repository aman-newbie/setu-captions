import { describe, it, expect } from 'vitest';
import { formatSRTTime, formatVTTTime, segmentsToSRT, segmentsToVTT } from '../src/utils/srtVtt.js';

const hinglishSegments = [
  { start: 0, end: 2.4, text: 'Bro aaj hum is video ko properly edit karenge.' },
  { start: 2.4, end: 5.1, text: 'I think ye transition thoda zyada fast hai.' },
  {
    start: 5.1,
    end: 9.75,
    text: 'Basically hum yaha pe ek zoom effect use karenge and then text animate hoga.'
  }
];

describe('formatSRTTime', () => {
  it('pads hours, minutes, seconds and uses a comma before milliseconds', () => {
    expect(formatSRTTime(0)).toBe('00:00:00,000');
    expect(formatSRTTime(65.25)).toBe('00:01:05,250');
    expect(formatSRTTime(3661.001)).toBe('01:01:01,001');
  });
});

describe('formatVTTTime', () => {
  it('uses a dot before milliseconds', () => {
    expect(formatVTTTime(65.25)).toBe('00:01:05.250');
  });
});

describe('segmentsToSRT', () => {
  it('numbers cues sequentially and keeps Hinglish text unmodified', () => {
    const srt = segmentsToSRT(hinglishSegments);
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,400');
    expect(srt).toContain('Bro aaj hum is video ko properly edit karenge.');
    expect(srt).toContain('3\n00:00:05,100 --> 00:00:09,750');
    expect(srt).not.toContain('undefined');
  });
});

describe('segmentsToVTT', () => {
  it('starts with the WEBVTT header and formats cue timing correctly', () => {
    const vtt = segmentsToVTT(hinglishSegments);
    expect(vtt.startsWith('WEBVTT\n')).toBe(true);
    expect(vtt).toContain('00:00:02.400 --> 00:00:05.100');
    expect(vtt).toContain('ye transition thoda zyada fast hai');
  });
});
