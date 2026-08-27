/**
 * Thin promise-based wrapper around whisper.worker.js so the rest of the app
 * never touches postMessage/onmessage directly.
 */
export class TranscriptionService {
  constructor() {
    this.worker = new Worker(new URL('../workers/whisper.worker.js', import.meta.url), {
      type: 'module'
    });
  }

  loadModel(mode, onProgress) {
    return new Promise((resolve, reject) => {
      const handleMessage = (event) => {
        const { type, payload, message } = event.data;
        if (type === 'progress') {
          onProgress?.(payload);
        } else if (type === 'ready') {
          this.worker.removeEventListener('message', handleMessage);
          resolve();
        } else if (type === 'error') {
          this.worker.removeEventListener('message', handleMessage);
          reject(new Error(message));
        }
      };
      this.worker.addEventListener('message', handleMessage);
      this.worker.postMessage({ type: 'load', mode });
    });
  }

  transcribe(mode, pcm, languageHint) {
    return new Promise((resolve, reject) => {
      const handleMessage = (event) => {
        const { type, payload, message } = event.data;
        if (type === 'result') {
          this.worker.removeEventListener('message', handleMessage);
          resolve(payload);
        } else if (type === 'error') {
          this.worker.removeEventListener('message', handleMessage);
          reject(new Error(message));
        }
      };
      this.worker.addEventListener('message', handleMessage);
      // Structured-clone the Float32Array by transferring its buffer for speed.
      this.worker.postMessage(
        { type: 'transcribe', mode, pcm, languageHint },
        [pcm.buffer]
      );
    });
  }

  terminate() {
    this.worker.terminate();
  }
}
