// src/services/audioService.ts
export const decode = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes.buffer;
};

export const decodeAudioData = (arrayBuffer: ArrayBuffer, audioCtx: AudioContext, sampleRate: number = 24000): AudioBuffer => {
  const int16Array = new Int16Array(arrayBuffer);
  const buffer = audioCtx.createBuffer(1, int16Array.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < int16Array.length; i++) channelData[i] = int16Array[i] / 32768.0;
  return buffer;
};

export const createPcmBlob = (float32Array: Float32Array, inputSampleRate: number): string => {
  const targetSampleRate = 16000;
  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.floor(float32Array.length / ratio);
  const int16Array = new Int16Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const offset = Math.floor(i * ratio);
    const sample = Math.max(-1, Math.min(1, float32Array[offset]));
    int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
  }
  const bytes = new Uint8Array(int16Array.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};
